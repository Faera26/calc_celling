import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { CatalogItem, CatalogType, CompanySettings, UzelComponent } from '../types';
import { PLACEHOLDER_IMAGE } from '../constants';
import { adjustedPrice, labelOf, money, nodeCompositionCounts } from '../utils';

interface CatalogItemDetailsDialogProps {
  open: boolean;
  item: CatalogItem | null;
  activeType: CatalogType;
  settings: CompanySettings;
  cachedComponents?: UzelComponent[];
  isAdmin: boolean;
  onClose: () => void;
  onAddToCart?: () => void;
  onEdit?: () => void;
  onOpenConstructor?: () => void;
}

export default function CatalogItemDetailsDialog({
  open,
  item,
  activeType,
  settings,
  cachedComponents,
  isAdmin,
  onClose,
  onAddToCart,
  onEdit,
  onOpenConstructor,
}: CatalogItemDetailsDialogProps) {
  if (!item) {
    return null;
  }

  const composition = activeType === 'uzel' ? nodeCompositionCounts(item, cachedComponents) : null;
  const salePrice = money(adjustedPrice(item.price, settings));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{item.name}</DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box
            sx={{
              flex: { md: '0 0 340px' },
              minHeight: 280,
              borderRadius: '24px',
              bgcolor: 'rgba(8,43,76,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 3,
            }}
          >
            <Box
              component="img"
              src={item.image || PLACEHOLDER_IMAGE}
              alt={item.name}
              sx={{ width: '100%', maxHeight: 320, objectFit: 'contain' }}
            />
          </Box>

          <Stack spacing={2} sx={{ flexGrow: 1 }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Chip label={labelOf(activeType)} color="primary" />
              <Chip label={item.category || 'Без категории'} variant="outlined" />
              {item.subcategory && <Chip label={item.subcategory} variant="outlined" />}
            </Stack>

            <Box>
              <Typography sx={{ color: 'rgba(8,43,76,0.58)', mb: 0.75 }}>Цена для сметы</Typography>
              <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: '#082B4C', lineHeight: 1 }}>
                {salePrice}
              </Typography>
              <Typography sx={{ mt: 0.5, color: 'rgba(8,43,76,0.58)' }}>
                Базовая цена: {money(item.price)}{item.unit ? ` / ${item.unit}` : ''}
              </Typography>
            </Box>

            <Box>
              <Typography sx={{ color: 'rgba(8,43,76,0.58)', mb: 0.75 }}>Описание</Typography>
              <Typography sx={{ lineHeight: 1.75 }}>
                {item.description || 'Описание пока не заполнено. Здесь можно хранить пояснение для менеджера и клиента.'}
              </Typography>
            </Box>

            {activeType === 'uzel' && (
              <Box>
                <Typography sx={{ color: 'rgba(8,43,76,0.58)', mb: 0.75 }}>Состав узла</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Chip label={`${composition?.positions || 0} позиций`} />
                  <Chip label={`${composition?.products || 0} товаров`} variant="outlined" />
                  <Chip label={`${composition?.services || 0} услуг`} variant="outlined" />
                </Stack>
              </Box>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Закрыть</Button>
        {activeType === 'uzel' && isAdmin && onOpenConstructor && (
          <Button variant="outlined" onClick={onOpenConstructor}>
            Состав узла
          </Button>
        )}
        {isAdmin && onEdit && (
          <Button variant="outlined" onClick={onEdit}>
            Редактировать
          </Button>
        )}
        {onAddToCart && (
          <Button variant="contained" onClick={onAddToCart}>
            В смету
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
