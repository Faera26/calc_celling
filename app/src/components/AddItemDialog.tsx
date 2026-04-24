import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CatalogType, ItemForm } from '../types';
import type { CatalogDialogMode } from '../features/catalog/catalogCrud';
import { PLACEHOLDER_IMAGE } from '../constants';
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
  onImageUpload?: (file?: File) => void | Promise<void>;
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
  onImageUpload,
}: AddItemDialogProps) {
  const isEditMode = mode === 'edit';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {isEditMode ? `Редактировать: ${labelOf(activeType).toLowerCase()}` : `Добавить: ${labelOf(activeType).toLowerCase()}`}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Box
              sx={{
                flex: { md: '0 0 220px' },
                p: 2,
                borderRadius: '24px',
                bgcolor: 'rgba(8,43,76,0.04)',
              }}
            >
              <Box
                component="img"
                src={form.image || PLACEHOLDER_IMAGE}
                alt={form.name || 'Превью карточки'}
                sx={{ width: '100%', height: 220, objectFit: 'contain', borderRadius: '18px', bgcolor: '#fff' }}
              />

              <Stack spacing={1} sx={{ mt: 2 }}>
                <Button variant="contained" component="label" sx={{ borderRadius: '14px', textTransform: 'none' }}>
                  Загрузить фото
                  <input hidden type="file" accept="image/*" onChange={(event) => void onImageUpload?.(event.target.files?.[0])} />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Можно загрузить файл с устройства или вставить ссылку ниже.
                </Typography>
              </Stack>
            </Box>

            <Stack spacing={2} sx={{ flexGrow: 1 }}>
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
                minRows={4}
                value={form.description}
                onChange={(event) => onFormChange({ description: event.target.value })}
              />
            </Stack>
          </Stack>

          {activeType === 'uzel' && (
            <Alert severity="info">
              Для узла карточка хранит общие данные. Состав материалов и услуг редактируется отдельно в конструкторе узла.
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
