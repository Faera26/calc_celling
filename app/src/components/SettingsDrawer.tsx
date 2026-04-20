  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Description as EstimatesIcon,
  Person as ProfileIcon,
  AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon,
  Storefront as CatalogIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { CompanySettings } from '../types';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: CompanySettings;
  onUpdate: (patch: Partial<CompanySettings>) => void;
  onAvatar: (file?: File) => void;
  isAdmin?: boolean;
  onLogout?: () => void;
}

export default function SettingsDrawer({
  open,
  onClose,
  settings,
  onUpdate,
  onAvatar,
  isAdmin,
  onLogout,
}: SettingsDrawerProps) {
  const navigate = useNavigate();

  const handleNav = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', sm: 460 }, p: 3 }}>
        <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4">Настройки и меню</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>

        <Stack spacing={3}>
          {/* Навигация */}
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ ml: 1 }}>Меню</Typography>
            <List sx={{ bgcolor: 'action.hover', borderRadius: 2, mt: 1 }}>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav('/')}>
                  <ListItemIcon><CatalogIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Каталог" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav('/estimates')}>
                  <ListItemIcon><EstimatesIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Редактор смет (шаблоны)" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav('/profile')}>
                  <ListItemIcon><ProfileIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Мой профиль" />
                </ListItemButton>
              </ListItem>
              {isAdmin && (
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleNav('/admin')}>
                    <ListItemIcon><AdminIcon color="secondary" /></ListItemIcon>
                    <ListItemText primary="Админка" />
                  </ListItemButton>
                </ListItem>
              )}
              {onLogout && (
                <ListItem disablePadding sx={{ display: { xs: 'block', sm: 'none' } }}>
                  <ListItemButton onClick={() => { onLogout(); onClose(); }}>
                    <ListItemIcon><LogoutIcon color="error" /></ListItemIcon>
                    <ListItemText primary="Выйти" sx={{ color: 'error.main' }} />
                  </ListItemButton>
                </ListItem>
              )}
            </List>
          </Box>

          <Divider />

          {/* Настройки компании */}
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ ml: 1 }}>Профиль компании</Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar src={settings.avatarDataUrl || undefined} sx={{ width: 72, height: 72, bgcolor: 'primary.main' }}>
                  {settings.companyName.slice(0, 1)}
                </Avatar>
                <Button variant="outlined" component="label" size="small">
                  Загрузить логотип
                  <input hidden type="file" accept="image/*" onChange={(event) => onAvatar(event.target.files?.[0])} />
                </Button>
              </Stack>
              <TextField fullWidth label="Название компании" value={settings.companyName} onChange={(e) => onUpdate({ companyName: e.target.value })} />
              <TextField fullWidth label="Менеджер" value={settings.managerName} onChange={(e) => onUpdate({ managerName: e.target.value })} />
              <TextField fullWidth label="Телефон" value={settings.phone} onChange={(e) => onUpdate({ phone: e.target.value })} />
              <TextField fullWidth label="Email" value={settings.email} onChange={(e) => onUpdate({ email: e.target.value })} />
              <Stack direction="row" spacing={2}>
                <TextField fullWidth label="Маржа %" type="number" value={settings.marginPercent} onChange={(e) => onUpdate({ marginPercent: Number(e.target.value) })} />
                <TextField fullWidth label="Скидка %" type="number" value={settings.discountPercent} onChange={(e) => onUpdate({ discountPercent: Number(e.target.value) })} />
              </Stack>
              <TextField multiline minRows={3} label="Примечание в PDF" value={settings.pdfNote} onChange={(e) => onUpdate({ pdfNote: e.target.value })} />
            </Stack>
          </Box>

          <Alert severity="info">
            Эти настройки пока хранятся локально. Позже привяжем к Supabase.
          </Alert>
        </Stack>
      </Box>
    </Drawer>
  );
}
