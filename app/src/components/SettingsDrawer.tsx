'use client';

import {
  Drawer,
  Box,
  Stack,
  IconButton,
  Avatar,
  Button,
  Alert,
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
  Storefront as CatalogIcon,
  KeyboardArrowRight as ArrowIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { APP_NAV_ITEMS } from '../features/app/navigation';
import type { CompanySettings } from '../types';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: CompanySettings;
  onUpdate: (patch: Partial<CompanySettings>) => void;
  onAvatar: (file?: File) => void;
  isAdmin?: boolean;
  onLogout?: () => void;
  syncSource?: 'local' | 'supabase';
  syncError?: string;
}

export default function SettingsDrawer({
  open,
  onClose,
  settings,
  onUpdate,
  onAvatar,
  isAdmin,
  onLogout,
  syncSource,
  syncError,
}: SettingsDrawerProps) {
  const router = useRouter();

  function handleNav(path: string) {
    router.push(path);
    onClose();
  }

  function renderNavIcon(href: string) {
    if (href === '/') {
      return <CatalogIcon sx={{ color: '#000' }} />;
    }

    if (href === '/estimates') {
      return <EstimatesIcon sx={{ color: '#000' }} />;
    }

    if (href === '/profile') {
      return <ProfileIcon sx={{ color: '#000' }} />;
    }

    return <AdminIcon sx={{ color: '#000' }} />;
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100vw', sm: 400 },
            borderRadius: { xs: 0, sm: '24px 0 0 24px' },
            border: 'none',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.05)',
            bgcolor: '#F5F5F7',
          },
        },
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 4 }, pt: 'var(--safe-area-top)' }}>
        <Stack direction="row" sx={{ mb: 4, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" className="headline-editorial">Меню</Typography>
          <IconButton onClick={onClose} sx={{ bgcolor: 'rgba(0,0,0,0.05)' }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Stack spacing={4}>
          <Box>
            <Typography variant="caption" sx={{ color: 'var(--secondary)', fontWeight: 600, ml: 1, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Приложение
            </Typography>
            <List sx={{ bgcolor: '#fff', borderRadius: '16px', overflow: 'hidden', p: 0 }}>
              {APP_NAV_ITEMS
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item, index, items) => (
                  <ListItem key={item.href} disablePadding divider={index !== items.length - 1}>
                    <ListItemButton onClick={() => handleNav(item.href)} sx={{ py: 1.5 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>{renderNavIcon(item.href)}</ListItemIcon>
                      <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
                      <ArrowIcon sx={{ color: 'rgba(0,0,0,0.2)', fontSize: 20 }} />
                    </ListItemButton>
                  </ListItem>
                ))}
            </List>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'var(--secondary)', fontWeight: 600, ml: 1, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Компания
            </Typography>
            <Stack spacing={2} sx={{ bgcolor: '#fff', borderRadius: '16px', p: 3 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1 }}>
                <Avatar
                  src={settings.avatarDataUrl || undefined}
                  sx={{ width: 64, height: 64, bgcolor: '#000', fontSize: '1.5rem', fontWeight: 800 }}
                >
                  {settings.companyName.slice(0, 1)}
                </Avatar>
                <Button variant="outlined" component="label" size="small" sx={{ borderRadius: '8px' }} disabled={!isAdmin}>
                  Логотип
                  <input hidden type="file" accept="image/*" onChange={(event) => onAvatar(event.target.files?.[0])} />
                </Button>
              </Stack>

              <TextField fullWidth size="small" label="Название" value={settings.companyName} onChange={(event) => onUpdate({ companyName: event.target.value })} disabled={!isAdmin} />
              <TextField fullWidth size="small" label="Менеджер" value={settings.managerName} onChange={(event) => onUpdate({ managerName: event.target.value })} disabled={!isAdmin} />

              <Stack direction="row" spacing={2}>
                <TextField fullWidth size="small" label="Маржа %" type="number" value={settings.marginPercent} onChange={(event) => onUpdate({ marginPercent: Number(event.target.value) })} disabled={!isAdmin} />
                <TextField fullWidth size="small" label="Скидка %" type="number" value={settings.discountPercent} onChange={(event) => onUpdate({ discountPercent: Number(event.target.value) })} disabled={!isAdmin} />
              </Stack>
            </Stack>
          </Box>

          {onLogout && (
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={() => {
                onLogout();
                onClose();
              }}
              sx={{ borderRadius: '12px', borderColor: 'rgba(211, 47, 47, 0.2)', py: 1.5 }}
            >
              Выйти из аккаунта
            </Button>
          )}

          {syncError && (
            <Alert severity="warning" sx={{ borderRadius: '12px' }}>
              {syncError}
            </Alert>
          )}

          <Alert severity="info" sx={{ borderRadius: '12px', bgcolor: 'rgba(2, 136, 209, 0.05)', color: '#0288d1', '& .MuiAlert-icon': { color: '#0288d1' } }}>
            {syncSource === 'supabase'
              ? isAdmin
                ? 'Настройки компании синхронизируются с Supabase и общие для всей команды.'
                : 'Настройки компании загружены из Supabase. Изменять их может администратор.'
              : 'Сейчас показан локальный резервный кэш настроек. Проверь подключение к Supabase.'}
          </Alert>
        </Stack>
      </Box>
    </Drawer>
  );
}
