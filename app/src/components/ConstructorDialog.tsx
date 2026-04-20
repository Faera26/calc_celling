import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Remove as RemoveIcon } from '@mui/icons-material';
import type { ComponentDraft, ComponentType, ConstructorState, CatalogItem } from '../types';
import { money } from '../utils';

interface ConstructorDialogProps {
  state: ConstructorState | null;
  loading: boolean;
  saving: boolean;
  error: string;
  componentDraft: ComponentDraft;
  componentOptions: CatalogItem[];
  componentOptionsLoading: boolean;
  componentSearch: string;
  onClose: () => void;
  onSave: () => void;
  onAddComponent: () => void;
  onRemoveComponent: (index: number) => void;
  onDraftChange: (draft: ComponentDraft) => void;
  onSearchChange: (search: string) => void;
}

export default function ConstructorDialog({
  state,
  loading,
  saving,
  error,
  componentDraft,
  componentOptions,
  componentOptionsLoading,
  componentSearch,
  onClose,
  onSave,
  onAddComponent,
  onRemoveComponent,
  onDraftChange,
  onSearchChange,
}: ConstructorDialogProps) {
  return (
    <Dialog open={Boolean(state)} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        Конструктор узла: {state?.node.name}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Alert severity="info">
            Здесь собирается комплектация узла. Выбираешь товар или услугу, задаёшь количество, сохраняешь — цена узла пересчитывается автоматически.
          </Alert>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Добавить позицию в узел</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Тип"
                  value={componentDraft.itemType}
                  onChange={(e) => {
                    onDraftChange({ itemType: e.target.value as ComponentType, itemId: '', qty: '1' });
                    onSearchChange('');
                  }}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="tovar">Товар</MenuItem>
                  <MenuItem value="usluga">Услуга</MenuItem>
                </TextField>
                <TextField
                  label="Поиск"
                  value={componentSearch}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    onDraftChange({ ...componentDraft, itemId: '' });
                  }}
                  placeholder="Название, ID, категория"
                  sx={{ flexGrow: 1 }}
                />
                <TextField
                  label="Кол-во"
                  type="number"
                  value={componentDraft.qty}
                  onChange={(e) => onDraftChange({ ...componentDraft, qty: e.target.value })}
                  sx={{ width: { xs: '100%', md: 120 } }}
                />
              </Stack>
              <TextField
                select
                fullWidth
                label="Позиция"
                value={componentDraft.itemId}
                onChange={(e) => onDraftChange({ ...componentDraft, itemId: e.target.value })}
                sx={{ mt: 2 }}
                helperText={componentOptionsLoading ? 'Ищу позиции...' : 'Показываю первые 80 совпадений из Supabase'}
              >
                <MenuItem value="" disabled>Выбери позицию</MenuItem>
                {componentOptions.map(item => (
                  <MenuItem key={item.id} value={item.id}>
                    ID {item.id} • {item.name} • {money(item.price)} {item.unit ? `/ ${item.unit}` : ''}
                  </MenuItem>
                ))}
              </TextField>
              <Button sx={{ mt: 2 }} variant="contained" onClick={onAddComponent} disabled={loading || componentOptionsLoading}>
                Добавить в комплектацию
              </Button>
            </CardContent>
          </Card>

          <Box>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', gap: 1, mb: 2 }}>
              <Box>
                <Typography variant="h6">Текущая комплектация</Typography>
                <Typography variant="body2" color="text.secondary">
                  Позиций: {state?.rows.length || 0}
                </Typography>
              </Box>
              <Typography variant="h5" color="primary.main">
                {money((state?.rows || []).reduce((sum, row) => sum + row.total, 0))}
              </Typography>
            </Stack>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={1}>
                {(state?.rows || []).map((row, index) => (
                  <Card key={`${row.id}-${index}`} variant="outlined">
                    <CardContent sx={{ py: 1.5 }}>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Chip size="small" label={row.item_type === 'tovar' ? 'Товар' : 'Услуга'} sx={{ mb: 1 }} />
                          <Typography sx={{ fontWeight: 700 }}>{row.item_name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            ID {row.item_id} • {row.category || 'Без категории'} / {row.subcategory || 'Без подкатегории'}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                          <Typography sx={{ minWidth: 190, textAlign: 'right' }}>
                            {row.qty} {row.unit} × {money(row.price)} = {money(row.total)}
                          </Typography>
                          <IconButton color="error" onClick={() => onRemoveComponent(index)}>
                            <RemoveIcon />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {(state?.rows.length || 0) === 0 && (
                  <Alert severity="warning">В узле пока нет товаров или услуг.</Alert>
                )}
              </Stack>
            )}
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={saving || loading} onClick={onSave}>
          {saving ? 'Сохраняю...' : 'Сохранить комплектацию'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
