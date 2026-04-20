import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  PictureAsPdf as PdfIcon,
  Remove as RemoveIcon,
  Save as SaveIcon,
  ShoppingCart as CartIcon,
} from '@mui/icons-material';
import type { CatalogType, CartRow, CompanySettings, EstimateSaveDraft, UzelComponent } from '../types';
import { adjustedPrice, labelOf, money, splitNodeComponents } from '../utils';
import { generatePdf } from '../PdfExport';
import { restInsert } from '../supabaseRest';
import SaveEstimateDialog from './SaveEstimateDialog';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  cartRows: CartRow[];
  cartCount: number;
  subtotal: number;
  settings: CompanySettings;
  onAddToCart: (type: CatalogType, item: CartRow['item'], components?: CartRow['components']) => void;
  onRemoveFromCart: (cartKey: string) => void;
  onClearCart: () => void;
}

export default function CartDrawer({
  open,
  onClose,
  userId,
  cartRows,
  cartCount,
  subtotal,
  settings,
  onAddToCart,
  onRemoveFromCart,
  onClearCart,
}: CartDrawerProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingEstimate, setSavingEstimate] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');

  function toNumber(value: string | number | null | undefined) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isSchemaCacheError(error: unknown) {
    const message = error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: string }).message || '')
      : String(error || '');

    return message.includes('schema cache')
      || message.includes('Could not find')
      || message.includes('does not exist');
  }

  function handlePdfExport() {
    generatePdf(
      cartRows.map(row => ({
        name: row.item.name,
        type: labelOf(row.type),
        qty: row.qty,
        price: row.price,
        unit: row.item.unit || 'шт.',
        components: row.components?.map(component => ({
          type: component.item_type === 'tovar' ? 'Товар' : 'Услуга',
          name: component.item_name,
          qty: Number(component.qty || 0) * row.qty,
          unit: component.unit || 'шт.',
          price: adjustedPrice(component.price, settings)
        }))
      })),
      {
        total: subtotal,
        companyName: settings.companyName,
        managerName: settings.managerName,
        phone: settings.phone,
        email: settings.email,
        marginPercent: settings.marginPercent,
        discountPercent: settings.discountPercent,
        note: settings.pdfNote
      }
    );
  }

  async function handleSaveEstimate(draft: EstimateSaveDraft) {
    if (!userId) {
      setSaveError('Не вижу пользователя. Выйди и войди снова.');
      return;
    }

    if (cartRows.length === 0) {
      setSaveError('Смета пустая.');
      return;
    }

    setSavingEstimate(true);
    setSaveError('');
    setSaveNotice('');

    const componentsCount = cartRows.reduce((sum, row) => sum + (row.components?.length || 0), 0);
    const title = draft.title.trim() || `Смета от ${new Date().toLocaleDateString('ru-RU')}`;

    const baseEstimatePayload = {
      user_id: userId,
      client_name: draft.clientName.trim() || title,
      client_phone: draft.clientPhone.trim() || null,
      margin_percent: settings.marginPercent,
      discount_percent: settings.discountPercent,
      subtotal,
      total: subtotal,
      status: draft.status,
    };

    const extendedEstimatePayload = {
      ...baseEstimatePayload,
      title,
      client_email: draft.clientEmail.trim() || null,
      object_address: draft.objectAddress.trim() || null,
      client_comment: draft.clientComment.trim() || null,
      room_count: draft.rooms.length,
      items_count: cartRows.length,
      components_count: componentsCount,
      settings_snapshot: {
        companyName: settings.companyName,
        managerName: settings.managerName,
        phone: settings.phone,
        email: settings.email,
        marginPercent: settings.marginPercent,
        discountPercent: settings.discountPercent,
        pdfNote: settings.pdfNote,
      },
    };

    let degradedMode = false;
    let estimateRows: Array<{ id: string }> = [];

    try {
      estimateRows = await restInsert<{ id: string }>('smety', extendedEstimatePayload, { select: 'id' });
    } catch (error) {
      if (!isSchemaCacheError(error)) {
        setSavingEstimate(false);
        setSaveError(`${error instanceof Error ? error.message : String(error)} Проверь, что выполнен supabase_estimates_rooms.sql.`);
        return;
      }

      degradedMode = true;
      try {
        estimateRows = await restInsert<{ id: string }>('smety', baseEstimatePayload, { select: 'id' });
      } catch (fallbackError) {
        setSavingEstimate(false);
        setSaveError(`${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)} Проверь, что выполнен supabase_estimates_rooms.sql.`);
        return;
      }
    }

    if (!estimateRows[0]?.id) {
      setSavingEstimate(false);
      setSaveError('Supabase не вернул ID сметы. Проверь, что выполнен supabase_estimates_rooms.sql.');
      return;
    }

    const estimateId = estimateRows[0].id;

    const roomRows = draft.rooms.map((room, index) => ({
      id: room.id,
      smeta_id: estimateId,
      position_index: index + 1,
      name: room.name.trim() || `Комната ${index + 1}`,
      area: toNumber(room.area),
      perimeter: toNumber(room.perimeter),
      corners: toNumber(room.corners),
      light_points: toNumber(room.lightPoints),
      pipes: toNumber(room.pipes),
      curtain_tracks: toNumber(room.curtainTracks),
      niches: toNumber(room.niches),
      comment: room.comment.trim() || null,
    }));

    let roomsWarning = '';
    if (!degradedMode) {
      try {
        await restInsert('smeta_komnaty', roomRows, { returning: 'minimal' });
      } catch (roomsError) {
        if (isSchemaCacheError(roomsError)) {
          degradedMode = true;
          roomsWarning = 'Комнаты не сохранились, потому что Supabase ещё не видит новую таблицу smeta_komnaty.';
        } else {
          setSavingEstimate(false);
          setSaveError(`${roomsError instanceof Error ? roomsError.message : String(roomsError)} Проверь, что выполнен supabase_estimates_rooms.sql.`);
          return;
        }
      }
    }

    const basePositionRows = cartRows.map((row) => ({
      smeta_id: estimateId,
      item_type: row.type,
      item_id: row.item.id,
      item_name: row.item.name,
      qty: row.qty,
      unit: row.item.unit || 'шт.',
      price: row.price,
      total: row.total,
    }));

    const extendedPositionRows = cartRows.map((row, index) => ({
      smeta_id: estimateId,
      position_index: index + 1,
      room_id: null,
      item_type: row.type,
      item_id: row.item.id,
      item_name: row.item.name,
      qty: row.qty,
      unit: row.item.unit || 'шт.',
      base_price: row.item.price,
      price: row.price,
      total: row.total,
      category: row.item.category || null,
      subcategory: row.item.subcategory || null,
      components_snapshot: (row.components || []).map(component => {
        const price = adjustedPrice(component.price, settings);
        const qty = toNumber(component.qty) * row.qty;
        return {
          item_type: component.item_type,
          item_id: component.item_id,
          item_name: component.item_name,
          qty,
          unit: component.unit || 'шт.',
          price,
          total: price * qty,
          category: component.category || null,
          subcategory: component.subcategory || null,
        };
      }),
      source_snapshot: {
        name: row.item.name,
        category: row.item.category,
        subcategory: row.item.subcategory,
        unit: row.item.unit,
        base_price: row.item.price,
      },
    }));

    try {
      await restInsert('smeta_pozicii', degradedMode ? basePositionRows : extendedPositionRows, { returning: 'minimal' });
    } catch (positionsError) {
      if (!degradedMode && isSchemaCacheError(positionsError)) {
        degradedMode = true;
        try {
          await restInsert('smeta_pozicii', basePositionRows, { returning: 'minimal' });
        } catch (fallbackPositionsError) {
          setSavingEstimate(false);
          setSaveError(`${fallbackPositionsError instanceof Error ? fallbackPositionsError.message : String(fallbackPositionsError)} Проверь, что выполнен supabase_estimates_rooms.sql.`);
          return;
        }
      } else {
        setSavingEstimate(false);
        setSaveError(`${positionsError instanceof Error ? positionsError.message : String(positionsError)} Проверь, что выполнен supabase_estimates_rooms.sql.`);
        return;
      }
    }

    setSavingEstimate(false);

    if (!degradedMode) {
      onClearCart();
    }

    setSaveOpen(false);
    setSaveNotice(
      degradedMode
        ? `Смета сохранена в базовом режиме. ${roomsWarning} Выполни supabase_estimates_rooms.sql, чтобы сохранялись комнаты и составы узлов.`
        : 'Смета сохранена. Она появилась в разделе “Сметы”.'
    );
  }

  function renderNodeComponents(row: CartRow) {
    if (row.type !== 'uzel') return null;
    if (!row.components || row.components.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Комплектация этого узла пока не загружена в смету.
        </Typography>
      );
    }

    const groupedRows = splitNodeComponents(row.components);
    const groups = [
      { title: 'Товары в узле', rows: groupedRows.products },
      { title: 'Услуги в узле', rows: groupedRows.services },
    ].filter(group => group.rows.length > 0);

    function componentQty(component: UzelComponent) {
      return Number(component.qty || 0) * row.qty;
    }

    function componentPrice(component: UzelComponent) {
      return adjustedPrice(component.price, settings);
    }

    function groupTotal(groupRows: UzelComponent[]) {
      return groupRows.reduce((sum, component) => (
        sum + componentPrice(component) * componentQty(component)
      ), 0);
    }

    return (
      <Box sx={{ mt: 1, p: 1.25, borderRadius: 1, backgroundColor: '#F8FAFC' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Комплектация узла
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.components.length} поз.
          </Typography>
        </Stack>
        <Stack spacing={0.75}>
          {groups.map(group => (
            <Box key={group.title}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {group.title} · {group.rows.length} поз.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {money(groupTotal(group.rows))}
                </Typography>
              </Stack>
              {group.rows.map(component => (
                <Stack key={component.id} direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                  <Typography variant="body2" sx={{ minWidth: 0 }}>
                    {component.item_name}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {componentQty(component)} {component.unit || 'шт.'} × {money(componentPrice(component))} = {money(componentPrice(component) * componentQty(component))}
                  </Typography>
                </Stack>
              ))}
            </Box>
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4">Смета</Typography>
            <Typography variant="body2" color="text.secondary">Позиций: {cartCount}</Typography>
          </Box>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        <Divider sx={{ my: 2 }} />

        <List sx={{ flexGrow: 1, overflow: 'auto' }}>
          {cartRows.map(row => (
            <ListItem key={row.cartKey} sx={{ px: 0, alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ width: '100%' }}>
                <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <ListItemText
                    primary={row.item.name}
                    secondary={`${labelOf(row.type)} · ${row.qty} ${row.item.unit || 'шт.'} · ${money(row.total)}`}
                    slotProps={{
                      primary: { sx: { fontWeight: 700 } },
                      secondary: { color: 'text.secondary' }
                    }}
                  />
                  <Stack direction="row" sx={{ alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <IconButton size="small" onClick={() => onRemoveFromCart(row.cartKey)}><RemoveIcon fontSize="small" /></IconButton>
                    <Typography sx={{ px: 1, fontWeight: 700 }}>{row.qty}</Typography>
                    <IconButton size="small" onClick={() => onAddToCart(row.type, row.item, row.components)}><AddIcon fontSize="small" /></IconButton>
                  </Stack>
                </Stack>
                {renderNodeComponents(row)}
              </Box>
            </ListItem>
          ))}
          {cartRows.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
              <CartIcon sx={{ fontSize: 56, opacity: 0.25 }} />
              <Typography>Смета пустая</Typography>
            </Box>
          )}
        </List>

        <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {saveNotice && (
              <Alert severity="success" onClose={() => setSaveNotice('')}>
                {saveNotice}
              </Alert>
            )}
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography color="text.secondary">Маржа</Typography>
              <Typography>{settings.marginPercent}%</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography color="text.secondary">Скидка</Typography>
              <Typography>{settings.discountPercent}%</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="h5">Итого</Typography>
              <Typography variant="h5" color="primary.main">{money(subtotal)}</Typography>
            </Stack>
          </Stack>
          <Button
            fullWidth
            size="large"
            variant="outlined"
            startIcon={<SaveIcon />}
            disabled={cartRows.length === 0}
            onClick={() => {
              setSaveError('');
              setSaveOpen(true);
            }}
            sx={{ mb: 1 }}
          >
            Сохранить смету
          </Button>
          <Button
            fullWidth
            size="large"
            variant="contained"
            startIcon={<PdfIcon />}
            disabled={cartRows.length === 0}
            onClick={handlePdfExport}
          >
            Скачать PDF
          </Button>
          <Button
            fullWidth
            color="inherit"
            disabled={cartRows.length === 0}
            onClick={onClearCart}
            sx={{ mt: 1 }}
          >
            Очистить смету
          </Button>
        </Box>
      </Box>
      <SaveEstimateDialog
        open={saveOpen}
        cartCount={cartCount}
        total={subtotal}
        saving={savingEstimate}
        error={saveError}
        onClose={() => setSaveOpen(false)}
        onSave={handleSaveEstimate}
      />
    </Drawer>
  );
}
