import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { UzelComponent, UzelItem } from '../types';
import { money, splitNodeComponents } from '../utils';

interface NodeDetailsDialogProps {
  node: UzelItem | null;
  rows: UzelComponent[];
  loading: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onAddToCart: () => void;
  onOpenConstructor: () => void;
}

export default function NodeDetailsDialog({
  node,
  rows,
  loading,
  isAdmin,
  onClose,
  onAddToCart,
  onOpenConstructor,
}: NodeDetailsDialogProps) {
  const groupedRows = splitNodeComponents(rows);

  function renderGroup(title: string, groupRows: UzelComponent[]) {
    if (groupRows.length === 0) return null;

    const groupTotal = groupRows.reduce((sum, component) => sum + Number(component.total || 0), 0);

    return (
      <Box>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">{title}</Typography>
          <Chip size="small" label={`${groupRows.length} поз. · ${money(groupTotal)}`} variant="outlined" />
        </Stack>

        <Stack spacing={1}>
          {groupRows.map(component => (
            <Stack key={component.id} direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{component.item_name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  ID {component.item_id} · {component.category || 'Без категории'} / {component.subcategory || 'Без подкатегории'}
                </Typography>
              </Box>
              <Typography sx={{ minWidth: 170, textAlign: { md: 'right' } }}>
                {component.qty} {component.unit} × {money(component.price)} = {money(component.total)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <Dialog open={Boolean(node)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{node?.name}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {renderGroup('Товары в узле', groupedRows.products)}
            {groupedRows.products.length > 0 && groupedRows.services.length > 0 && <Divider />}
            {renderGroup('Услуги в узле', groupedRows.services)}
            {rows.length === 0 && (
              <Alert severity="info">В этом узле пока нет товаров или услуг.</Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {node && (
          <>
            {isAdmin && (
              <Button color="secondary" onClick={onOpenConstructor}>
                Конструктор
              </Button>
            )}
            <Button variant="contained" onClick={onAddToCart}>
              Добавить узел в смету
            </Button>
          </>
        )}
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}
