import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import type { CatalogType, ItemForm } from '../types';
import { labelOf } from '../utils';

interface AddItemDialogProps {
  open: boolean;
  activeType: CatalogType;
  form: ItemForm;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (patch: Partial<ItemForm>) => void;
}

export default function AddItemDialog({
  open,
  activeType,
  form,
  saving,
  error,
  onClose,
  onSave,
  onFormChange,
}: AddItemDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Добавить: {labelOf(activeType).toLowerCase()}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="ID"
            value={form.id}
            onChange={(e) => onFormChange({ id: e.target.value })}
            helperText="Можно оставить пустым, приложение создаст ID автоматически. Для импортов лучше задавать стабильный ID."
          />
          <TextField
            label="Название"
            value={form.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
            required
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Категория"
              value={form.category}
              onChange={(e) => onFormChange({ category: e.target.value })}
            />
            <TextField
              fullWidth
              label="Подкатегория"
              value={form.subcategory}
              onChange={(e) => onFormChange({ subcategory: e.target.value })}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Цена"
              type="number"
              value={form.price}
              onChange={(e) => onFormChange({ price: e.target.value })}
            />
            <TextField
              fullWidth
              label="Ед. изм."
              value={form.unit}
              onChange={(e) => onFormChange({ unit: e.target.value })}
              placeholder="шт., м. п., м²"
            />
          </Stack>
          <TextField
            label="Ссылка на картинку"
            value={form.image}
            onChange={(e) => onFormChange({ image: e.target.value })}
          />
          <TextField
            label="Описание"
            multiline
            minRows={3}
            value={form.description}
            onChange={(e) => onFormChange({ description: e.target.value })}
          />
          {activeType === 'uzel' && (
            <Alert severity="info">
              Сейчас добавляется карточка узла. После сохранения открой "Конструктор", чтобы добавить товары и услуги внутрь узла.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={saving} onClick={onSave}>
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
