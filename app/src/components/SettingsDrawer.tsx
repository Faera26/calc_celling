import {
  Alert,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type { CompanySettings } from '../types';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: CompanySettings;
  onUpdate: (patch: Partial<CompanySettings>) => void;
  onAvatar: (file?: File) => void;
}

export default function SettingsDrawer({
  open,
  onClose,
  settings,
  onUpdate,
  onAvatar,
}: SettingsDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', sm: 460 }, p: 3 }}>
        <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4">Настройки</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar src={settings.avatarDataUrl || undefined} sx={{ width: 72, height: 72, bgcolor: 'primary.main' }}>
              {settings.companyName.slice(0, 1)}
            </Avatar>
            <Button variant="outlined" component="label">
              Загрузить аватар
              <input hidden type="file" accept="image/*" onChange={(event) => onAvatar(event.target.files?.[0])} />
            </Button>
          </Stack>
          <TextField label="Название компании" value={settings.companyName} onChange={(e) => onUpdate({ companyName: e.target.value })} />
          <TextField label="Менеджер" value={settings.managerName} onChange={(e) => onUpdate({ managerName: e.target.value })} />
          <TextField label="Телефон" value={settings.phone} onChange={(e) => onUpdate({ phone: e.target.value })} />
          <TextField label="Email" value={settings.email} onChange={(e) => onUpdate({ email: e.target.value })} />
          <Stack direction="row" spacing={2}>
            <TextField fullWidth label="Маржа %" type="number" value={settings.marginPercent} onChange={(e) => onUpdate({ marginPercent: Number(e.target.value) })} />
            <TextField fullWidth label="Скидка %" type="number" value={settings.discountPercent} onChange={(e) => onUpdate({ discountPercent: Number(e.target.value) })} />
          </Stack>
          <TextField multiline minRows={3} label="Примечание в PDF" value={settings.pdfNote} onChange={(e) => onUpdate({ pdfNote: e.target.value })} />
          <Alert severity="info">
            Эти настройки пока хранятся на устройстве. Следующий шаг: привязать их к аккаунту Supabase и хранить в `nastroiki_kompanii` / `profiles`.
          </Alert>
        </Stack>
      </Box>
    </Drawer>
  );
}
