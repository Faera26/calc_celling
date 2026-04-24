import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type {
  CartRow,
  CompanySettings,
  EstimateDocumentType,
  EstimateCalculationMetric,
  EstimateCalculationRule,
  EstimatePdfTemplate,
  EstimateRoomDraft,
  EstimateSaveDraft,
  EstimateStatus,
} from '../types';
import {
  calculateEstimate,
  createDefaultCalculationRules,
} from '../features/estimates/calculationEngine';
import { supabase } from '../supabaseClient';
import { cleanSearch, money } from '../utils';

interface RuleCatalogOption {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string;
  subcategory: string;
  image?: string | null;
  description?: string | null;
  type: 'tovar' | 'usluga' | 'uzel';
}

interface SaveEstimateDialogProps {
  open: boolean;
  cartRows: CartRow[];
  cartCount: number;
  total: number;
  saving: boolean;
  error: string;
  settings: CompanySettings;
  onClose: () => void;
  onSave: (draft: EstimateSaveDraft) => void;
}

function emptyRoom(index: number): EstimateRoomDraft {
  return {
    id: crypto.randomUUID(),
    name: `Комната ${index}`,
    area: '',
    perimeter: '',
    corners: '',
    lightPoints: '',
    pipes: '',
    curtainTracks: '',
    niches: '',
    comment: '',
  };
}

function defaultDraft(settings: CompanySettings): EstimateSaveDraft {
  return {
    title: `Смета от ${new Date().toLocaleDateString('ru-RU')}`,
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    objectAddress: '',
    clientComment: '',
    status: 'draft',
    documentType: 'preliminary',
    pdfTemplate: settings.defaultPdfTemplate,
    pdfAccentColor: settings.defaultPdfAccentColor,
    rooms: [emptyRoom(1)],
    calculationRules: createDefaultCalculationRules(),
  };
}

function metricLabel(metric: EstimateCalculationMetric) {
  if (metric === 'area') return 'площади';
  if (metric === 'perimeter') return 'периметру';
  if (metric === 'corners') return 'углам';
  if (metric === 'light_points') return 'светильникам';
  if (metric === 'pipes') return 'трубам';
  if (metric === 'curtain_tracks') return 'карнизам';
  if (metric === 'niches') return 'нишам';
  return 'фиксированному количеству';
}

async function searchCatalogOptions(query: string): Promise<RuleCatalogOption[]> {
  const normalizedQuery = cleanSearch(query);
  if (!normalizedQuery) return [];

  const [tovary, uslugi, uzly] = await Promise.all([
    supabase.from('tovary').select('id, name, price, unit, category, subcategory, image, description').ilike('name', `%${normalizedQuery}%`).limit(8),
    supabase.from('uslugi').select('id, name, price, unit, category, subcategory, image, description').ilike('name', `%${normalizedQuery}%`).limit(8),
    supabase.from('uzly').select('id, name, price, unit, category, subcategory, image, description').ilike('name', `%${normalizedQuery}%`).limit(8),
  ]);

  return [
    ...(tovary.data || []).map((item) => ({ ...item, type: 'tovar' as const })),
    ...(uslugi.data || []).map((item) => ({ ...item, type: 'usluga' as const })),
    ...(uzly.data || []).map((item) => ({ ...item, type: 'uzel' as const })),
  ];
}

function hydrateRule(rule: EstimateCalculationRule, options: RuleCatalogOption[]): EstimateCalculationRule {
  if (rule.item_id && rule.item_name && Number.isFinite(Number(rule.base_price))) {
    return rule;
  }

  const match = options[0];
  if (!match) return rule;

  return {
    ...rule,
    item_type: match.type,
    item_id: match.id,
    item_name: match.name,
    category: match.category,
    subcategory: match.subcategory,
    unit: match.unit,
    base_price: match.price,
    image: match.image || null,
    description: match.description || null,
  };
}

export default function SaveEstimateDialog({
  open,
  cartRows,
  cartCount,
  total,
  saving,
  error,
  settings,
  onClose,
  onSave,
}: SaveEstimateDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [draft, setDraft] = useState<EstimateSaveDraft>(() => defaultDraft(settings));
  const [ruleOptions, setRuleOptions] = useState<Record<string, RuleCatalogOption[]>>({});
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState('');

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const initialDraft = defaultDraft(settings);
    setDraft(initialDraft);
    setRuleOptions({});
    setRulesError('');

    async function preloadRuleCatalog() {
      setRulesLoading(true);

      try {
        const rules = initialDraft.calculationRules || [];
        const results = await Promise.all(
          rules.map((rule) => searchCatalogOptions(rule.search || rule.item_name || ''))
        );

        if (cancelled) return;

        const nextOptions = Object.fromEntries(
          rules.map((rule, index) => [rule.id, results[index]])
        );

        setRuleOptions(nextOptions);
        setDraft((prev) => ({
          ...prev,
          calculationRules: (prev.calculationRules || []).map((rule) => hydrateRule(rule, nextOptions[rule.id] || [])),
        }));
      } catch (loadError) {
        if (cancelled) return;
        setRulesError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    }

    preloadRuleCatalog();
    return () => { cancelled = true; };
  }, [open, settings]);

  const previewEstimate = useMemo(
    () => calculateEstimate({ draft, settings, cartRows }),
    [cartRows, draft, settings]
  );

  const automaticPositions = previewEstimate.positions.filter((position) => position.sourceSnapshot.auto_generated);

  function updateRoom(roomId: string, patch: Partial<EstimateRoomDraft>) {
    setDraft((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) => room.id === roomId ? { ...room, ...patch } : room),
    }));
  }

  function addRoom() {
    setDraft((prev) => ({
      ...prev,
      rooms: [...prev.rooms, emptyRoom(prev.rooms.length + 1)],
    }));
  }

  function removeRoom(roomId: string) {
    setDraft((prev) => ({
      ...prev,
      rooms: prev.rooms.length > 1 ? prev.rooms.filter((room) => room.id !== roomId) : prev.rooms,
    }));
  }

  function updateRule(ruleId: string, patch: Partial<EstimateCalculationRule>) {
    setDraft((prev) => ({
      ...prev,
      calculationRules: (prev.calculationRules || []).map((rule) => (
        rule.id === ruleId ? { ...rule, ...patch } : rule
      )),
    }));
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="lg"
      fullScreen={fullScreen}
    >
      <DialogTitle>Сохранить смету</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Alert severity="info">
            Сохраняем клиента, комнаты, позиции и снимок текущих цен. Умные правила могут автоматически добавить полотно по площади и профиль по периметру.
          </Alert>

          {error && <Alert severity="error">{error}</Alert>}
          {rulesError && <Alert severity="warning">Не удалось заранее загрузить каталог для умных правил: {rulesError}</Alert>}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Название сметы"
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Статус"
              value={draft.status}
              onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value as EstimateStatus }))}
              sx={{ minWidth: { md: 190 } }}
            >
              <MenuItem value="draft">Черновик</MenuItem>
              <MenuItem value="sent">Отправлено</MenuItem>
              <MenuItem value="accepted">Принято</MenuItem>
              <MenuItem value="archived">Архив</MenuItem>
            </TextField>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              label="Документ"
              value={draft.documentType || 'preliminary'}
              onChange={(event) => setDraft((prev) => ({ ...prev, documentType: event.target.value as EstimateDocumentType }))}
              sx={{ minWidth: { md: 190 } }}
            >
              <MenuItem value="preliminary">Предварительный</MenuItem>
              <MenuItem value="final">Финальный</MenuItem>
            </TextField>
            <TextField
              select
              label="Шаблон PDF"
              value={draft.pdfTemplate || settings.defaultPdfTemplate}
              onChange={(event) => setDraft((prev) => ({ ...prev, pdfTemplate: event.target.value as EstimatePdfTemplate }))}
              sx={{ minWidth: { md: 190 } }}
            >
              <MenuItem value="classic">Classic</MenuItem>
              <MenuItem value="wave">Wave</MenuItem>
              <MenuItem value="stripe">Stripe</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </TextField>
            <TextField
              label="Акцент PDF"
              value={draft.pdfAccentColor || settings.defaultPdfAccentColor}
              onChange={(event) => setDraft((prev) => ({ ...prev, pdfAccentColor: event.target.value }))}
              sx={{ minWidth: { md: 180 } }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Клиент"
              value={draft.clientName}
              onChange={(event) => setDraft((prev) => ({ ...prev, clientName: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Телефон"
              value={draft.clientPhone}
              onChange={(event) => setDraft((prev) => ({ ...prev, clientPhone: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Email"
              value={draft.clientEmail}
              onChange={(event) => setDraft((prev) => ({ ...prev, clientEmail: event.target.value }))}
              fullWidth
            />
          </Stack>

          <TextField
            label="Адрес объекта"
            value={draft.objectAddress}
            onChange={(event) => setDraft((prev) => ({ ...prev, objectAddress: event.target.value }))}
            fullWidth
          />

          <TextField
            label="Комментарий"
            value={draft.clientComment}
            onChange={(event) => setDraft((prev) => ({ ...prev, clientComment: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1 }}>
            <Box>
              <Typography variant="h6">Комнаты и параметры потолка</Typography>
              <Typography variant="body2" color="text.secondary">
                Площадь нужна для материалов по м², периметр для профилей и вставок, а дополнительные поля помогают считать свет, трубы, карнизы и ниши.
              </Typography>
            </Box>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={addRoom}>
              Добавить комнату
            </Button>
          </Stack>

          <Stack spacing={2}>
            {draft.rooms.map((room, index) => (
              <Box key={room.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: { xs: 1.5, md: 2 } }}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1">Комната {index + 1}</Typography>
                  <IconButton color="error" disabled={draft.rooms.length === 1} onClick={() => removeRoom(room.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                  <TextField label="Название" value={room.name} onChange={(event) => updateRoom(room.id, { name: event.target.value })} fullWidth />
                  <TextField label="Площадь, м²" type="number" value={room.area} onChange={(event) => updateRoom(room.id, { area: event.target.value })} />
                  <TextField label="Периметр, м" type="number" value={room.perimeter} onChange={(event) => updateRoom(room.id, { perimeter: event.target.value })} />
                  <TextField label="Углы" type="number" value={room.corners} onChange={(event) => updateRoom(room.id, { corners: event.target.value })} />
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField label="Светильники" type="number" value={room.lightPoints} onChange={(event) => updateRoom(room.id, { lightPoints: event.target.value })} />
                  <TextField label="Трубы" type="number" value={room.pipes} onChange={(event) => updateRoom(room.id, { pipes: event.target.value })} />
                  <TextField label="Карниз, м" type="number" value={room.curtainTracks} onChange={(event) => updateRoom(room.id, { curtainTracks: event.target.value })} />
                  <TextField label="Ниши, м" type="number" value={room.niches} onChange={(event) => updateRoom(room.id, { niches: event.target.value })} />
                </Stack>

                <TextField
                  label="Заметка по комнате"
                  value={room.comment}
                  onChange={(event) => updateRoom(room.id, { comment: event.target.value })}
                  sx={{ mt: 2 }}
                  fullWidth
                />
              </Box>
            ))}
          </Stack>

          <Divider />

          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1, mb: 2 }}>
              <Box>
                <Typography variant="h6">Умные правила</Typography>
                <Typography variant="body2" color="text.secondary">
                  Правила считаются отдельно от интерфейса: движок сам умножает метрику комнаты на коэффициент и добавляет позиции в итоговую смету.
                </Typography>
              </Box>
              {rulesLoading && <CircularProgress size={22} />}
            </Stack>

            <Stack spacing={2}>
              {(draft.calculationRules || []).map((rule) => {
                const options = ruleOptions[rule.id] || [];
                const selectedOption = options.find((option) => option.id === rule.item_id) || null;

                return (
                  <Box key={rule.id} sx={{ border: '1px solid', borderColor: rule.enabled ? 'primary.light' : 'divider', borderRadius: 2, p: { xs: 1.5, md: 2 } }}>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{rule.label}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Основано на {metricLabel(rule.metric)} комнаты. Коэффициент показывает, сколько единиц материала нужно на 1 единицу метрики.
                          </Typography>
                        </Box>
                        <FormControlLabel
                          control={(
                            <Switch
                              checked={rule.enabled}
                              onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                            />
                          )}
                          label={rule.enabled ? 'Включено' : 'Выключено'}
                        />
                      </Stack>

                      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
                        <Autocomplete
                          fullWidth
                          options={options}
                          value={selectedOption}
                          isOptionEqualToValue={(option, value) => option.id === value.id}
                          getOptionLabel={(option) => option.name}
                          onChange={(_, newValue) => {
                            if (!newValue) {
                              updateRule(rule.id, {
                                item_id: '',
                                item_name: '',
                                base_price: null,
                                unit: '',
                                category: '',
                                subcategory: '',
                                image: null,
                                description: null,
                              });
                              return;
                            }

                            updateRule(rule.id, {
                              item_type: newValue.type,
                              item_id: newValue.id,
                              item_name: newValue.name,
                              base_price: newValue.price,
                              unit: newValue.unit,
                              category: newValue.category,
                              subcategory: newValue.subcategory,
                              image: newValue.image || null,
                              description: newValue.description || null,
                            });
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Что добавлять автоматически"
                              helperText={rule.item_name ? 'Можно поменять товар вручную.' : 'Выберите позицию из каталога.'}
                            />
                          )}
                          renderOption={(props, option) => (
                            <Box component="li" {...props}>
                              <Stack sx={{ minWidth: 0 }}>
                                <Typography>{option.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {option.category || 'Без категории'} · {money(option.price)} / {option.unit || 'шт.'}
                                </Typography>
                              </Stack>
                            </Box>
                          )}
                        />

                        <TextField
                          label="Коэффициент"
                          type="number"
                          value={rule.multiplier}
                          onChange={(event) => updateRule(rule.id, { multiplier: Number(event.target.value || 0) })}
                          sx={{ width: { lg: 140 } }}
                        />
                        <TextField
                          label="Шаг округления"
                          type="number"
                          value={rule.round_to}
                          onChange={(event) => updateRule(rule.id, { round_to: Number(event.target.value || 0) })}
                          sx={{ width: { lg: 160 } }}
                        />
                      </Stack>

                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <Chip size="small" label={`Метрика: ${metricLabel(rule.metric)}`} />
                        <Chip size="small" label={`Товар: ${rule.item_name || 'не выбран'}`} color={rule.item_name ? 'primary' : 'default'} variant={rule.item_name ? 'filled' : 'outlined'} />
                        <Chip size="small" label={`Цена: ${rule.base_price ? money(Number(rule.base_price)) : 'не задана'}`} />
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Box>

          <Divider />

          <Box sx={{ borderRadius: 2, bgcolor: 'grey.50', p: { xs: 1.5, md: 2 } }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Предпросмотр расчёта</Typography>
            <Stack spacing={1}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography color="text.secondary">Позиции из корзины</Typography>
                <Typography>{cartCount}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography color="text.secondary">Автоматически добавится</Typography>
                <Typography>{automaticPositions.length}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography color="text.secondary">Сумма корзины сейчас</Typography>
                <Typography>{money(total)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="h6">Итого после правил</Typography>
                <Typography variant="h6" color="primary.main">{money(previewEstimate.summary.total)}</Typography>
              </Stack>
            </Stack>

            {automaticPositions.length > 0 && (
              <Stack spacing={1} sx={{ mt: 2 }}>
                {automaticPositions.map((position) => (
                  <Box key={`${position.itemId}-${position.roomId}-${position.positionIndex}`} sx={{ borderRadius: 1.5, bgcolor: 'background.paper', p: 1.25 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{position.itemName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {position.sourceSnapshot.rule_label || 'Умное правило'} · {position.qty} {position.unit}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 700 }}>{money(position.total)}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Отмена</Button>
        <Button
          variant="contained"
          onClick={() => onSave(draft)}
          disabled={saving || previewEstimate.summary.itemsCount === 0}
        >
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
