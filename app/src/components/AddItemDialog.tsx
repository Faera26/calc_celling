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
import type { CatalogDialogMode } from '../features/catalog/catalogCrud';
import { labelOf } from '../utils';

interface AddItemDialogProps {
  open: boolean;
  activeType: CatalogType;
  mode?: CatalogDialogMode;
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
  mode = 'create',
  form,
  saving,
  error,
  onClose,
  onSave,
  onFormChange,
}: AddItemDialogProps) {
  const isEditMode = mode === 'edit';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isEditMode ? `Редактировать: ${labelOf(activeType).toLowerCase()}` : `Добавить: ${labelOf(activeType).toLowerCase()}`}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="ID"
            value={form.id}
            disabled={isEditMode}
            onChange={(event) => onFormChange({ id: event.target.value })}
            helperText={
              isEditMode
                ? 'ID лучше не менять, чтобы не потерять связи в каталоге и сметах.'
                : 'Можно оставить пустым, тогда система создаст ID автоматически.'
            }
          />

          <TextField
            label="Название"
            value={form.name}
            onChange={(event) => onFormChange({ name: event.target.value })}
            required
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Категория"
              value={form.category}
              onChange={(event) => onFormChange({ category: event.target.value })}
            />
            <TextField
              fullWidth
              label="Подкатегория"
              value={form.subcategory}
              onChange={(event) => onFormChange({ subcategory: event.target.value })}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Цена"
              type="number"
              value={form.price}
              onChange={(event) => onFormChange({ price: event.target.value })}
            />
            <TextField
              fullWidth
              label="Ед. изм."
              value={form.unit}
              onChange={(event) => onFormChange({ unit: event.target.value })}
              placeholder="шт., м. п., м2"
            />
          </Stack>

          <TextField
            label="Ссылка на картинку"
            value={form.image}
            onChange={(event) => onFormChange({ image: event.target.value })}
          />

          <TextField
            label="Описание"
            multiline
            minRows={3}
            value={form.description}
            onChange={(event) => onFormChange({ description: event.target.value })}
          />

          {activeType === 'uzel' && (
            <Alert severity="info">
              Для узла карточка хранит только общие данные. Состав материалов и услуг редактируется отдельно в конструкторе узла.
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={saving} onClick={onSave}>
          {saving ? 'Сохраняю...' : isEditMode ? 'Сохранить изменения' : 'Создать позицию'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
