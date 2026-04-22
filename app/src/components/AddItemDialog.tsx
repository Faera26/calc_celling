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
        Р”РѕР±Р°РІРёС‚СЊ: {labelOf(activeType).toLowerCase()}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="ID"
            value={form.id}
            onChange={(e) => onFormChange({ id: e.target.value })}
            helperText="РњРѕР¶РЅРѕ РѕСЃС‚Р°РІРёС‚СЊ РїСѓСЃС‚С‹Рј, РїСЂРёР»РѕР¶РµРЅРёРµ СЃРѕР·РґР°СЃС‚ ID Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё. Р”Р»СЏ РёРјРїРѕСЂС‚РѕРІ Р»СѓС‡С€Рµ Р·Р°РґР°РІР°С‚СЊ СЃС‚Р°Р±РёР»СЊРЅС‹Р№ ID."
          />
          <TextField
            label="РќР°Р·РІР°РЅРёРµ"
            value={form.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
            required
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="РљР°С‚РµРіРѕСЂРёСЏ"
              value={form.category}
              onChange={(e) => onFormChange({ category: e.target.value })}
            />
            <TextField
              fullWidth
              label="РџРѕРґРєР°С‚РµРіРѕСЂРёСЏ"
              value={form.subcategory}
              onChange={(e) => onFormChange({ subcategory: e.target.value })}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Р¦РµРЅР°"
              type="number"
              value={form.price}
              onChange={(e) => onFormChange({ price: e.target.value })}
            />
            <TextField
              fullWidth
              label="Р•Рґ. РёР·Рј."
              value={form.unit}
              onChange={(e) => onFormChange({ unit: e.target.value })}
              placeholder="С€С‚., Рј. Рї., РјВІ"
            />
          </Stack>
          <TextField
            label="РЎСЃС‹Р»РєР° РЅР° РєР°СЂС‚РёРЅРєСѓ"
            value={form.image}
            onChange={(e) => onFormChange({ image: e.target.value })}
          />
          <TextField
            label="РћРїРёСЃР°РЅРёРµ"
            multiline
            minRows={3}
            value={form.description}
            onChange={(e) => onFormChange({ description: e.target.value })}
          />
          {activeType === 'uzel' && (
            <Alert severity="info">
              РЎРµР№С‡Р°СЃ РґРѕР±Р°РІР»СЏРµС‚СЃСЏ РєР°СЂС‚РѕС‡РєР° СѓР·Р»Р°. РџРѕСЃР»Рµ СЃРѕС…СЂР°РЅРµРЅРёСЏ РѕС‚РєСЂРѕР№ &quot;РљРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ&quot;, С‡С‚РѕР±С‹ РґРѕР±Р°РІРёС‚СЊ С‚РѕРІР°СЂС‹ Рё СѓСЃР»СѓРіРё РІРЅСѓС‚СЂСЊ СѓР·Р»Р°.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>РћС‚РјРµРЅР°</Button>
        <Button variant="contained" disabled={saving} onClick={onSave}>
          {saving ? 'РЎРѕС…СЂР°РЅСЏСЋ...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
