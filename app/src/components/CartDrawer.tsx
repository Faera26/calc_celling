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
import { buildEstimatePdfItemsFromCartRows } from '../features/estimates/calculationEngine';
import { saveEstimateToSupabase } from '../features/estimates/saveEstimateToSupabase';
import type { CatalogType, CartRow, CompanySettings, EstimateSaveDraft, UzelComponent } from '../types';
import { adjustedPrice, labelOf, money, splitNodeComponents } from '../utils';
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

  async function handlePdfExport() {
    // PDF-движок тяжёлый и нужен только по кнопке экспорта.
    // Лениво подгружаем его, чтобы не раздувать стартовый bundle каталога.
    const { generatePdf } = await import('../PdfExport');

    generatePdf(buildEstimatePdfItemsFromCartRows(cartRows, settings), {
      total: subtotal,
      companyName: settings.companyName,
      managerName: settings.managerName,
      phone: settings.phone,
      email: settings.email,
      marginPercent: settings.marginPercent,
      discountPercent: settings.discountPercent,
      note: settings.pdfNote,
    });
  }

  async function handleSaveEstimate(draft: EstimateSaveDraft) {
    if (!userId) {
      setSaveError('Не вижу пользователя. Выйди и войди снова.');
      return;
    }

    setSavingEstimate(true);
    setSaveError('');
    setSaveNotice('');

    try {
      // Drawer отвечает только за UI-состояние.
      // Само сохранение вынесено в feature-слой, чтобы код компонента
      // было проще читать и сопровождать.
      const result = await saveEstimateToSupabase({
        userId,
        cartRows,
        settings,
        draft,
      });

      if (result.shouldClearCart) {
        onClearCart();
      }

      setSaveOpen(false);
      setSaveNotice(result.notice);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingEstimate(false);
    }
  }

  function renderNodeComponents(row: CartRow) {
    if (row.type !== 'uzel') {
      return null;
    }

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
    ].filter((group) => group.rows.length > 0);

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
          {groups.map((group) => (
            <Box key={group.title}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {group.title} • {group.rows.length} поз.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {money(groupTotal(group.rows))}
                </Typography>
              </Stack>
              {group.rows.map((component) => (
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
          {cartRows.map((row) => (
            <ListItem key={row.cartKey} sx={{ px: 0, alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ width: '100%' }}>
                <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <ListItemText
                    primary={row.item.name}
                    secondary={`${labelOf(row.type)} • ${row.qty} ${row.item.unit || 'шт.'} • ${money(row.total)}`}
                    slotProps={{
                      primary: { sx: { fontWeight: 700 } },
                      secondary: { color: 'text.secondary' },
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
        cartRows={cartRows}
        cartCount={cartCount}
        total={subtotal}
        saving={savingEstimate}
        error={saveError}
        settings={settings}
        onClose={() => setSaveOpen(false)}
        onSave={handleSaveEstimate}
      />
    </Drawer>
  );
}
