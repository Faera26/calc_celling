import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import MuiAppBar from '@mui/material/AppBar';
import {
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  ShoppingCart as CartIcon,
} from '@mui/icons-material';
import { NavLink, Outlet } from 'react-router-dom';
import type { AuthState, CompanySettings } from '../types';

interface AppLayoutProps {
  auth: AuthState & { logout: () => Promise<void> };
  settings: CompanySettings;
  search: string;
  onSearchChange: (value: string) => void;
  cartCount: number;
  onCartOpen: () => void;
  onSettingsOpen: () => void;
  onRefresh: () => void;
  loadError: string;
  onClearError: () => void;
  children?: React.ReactNode;
}

export default function AppLayout({
  auth,
  settings,
  search,
  onSearchChange,
  cartCount,
  onCartOpen,
  onSettingsOpen,
  onRefresh,
  loadError,
  onClearError,
}: AppLayoutProps) {
  const navLinks = [
    { to: '/', label: 'Каталог' },
    { to: '/estimates', label: 'Сметы' },
    ...(auth.isAdmin ? [{ to: '/admin', label: 'Админка' }] : []),
    { to: '/profile', label: 'Профиль' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <MuiAppBar position="sticky" color="inherit">
        <Toolbar sx={{ gap: 2, minHeight: 76 }}>
          <Avatar src={settings.avatarDataUrl || undefined} sx={{ bgcolor: 'primary.main' }}>
            {settings.companyName.slice(0, 1)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" color="primary.main" sx={{ lineHeight: 1.1 }}>
              {settings.companyName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {auth.userEmail}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
            {navLinks.map(link => (
              <Button
                key={link.to}
                component={NavLink}
                to={link.to}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  '&.active': {
                    color: 'primary.main',
                    borderBottom: '2px solid',
                    borderColor: 'primary.main',
                    borderRadius: 0,
                  }
                }}
              >
                {link.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Chip
            label={auth.profile?.role === 'admin' ? 'Админ' : auth.profile?.role === 'manager' ? 'Менеджер' : 'Просмотр'}
            color={auth.profile?.role === 'admin' ? 'secondary' : 'default'}
            variant={auth.profile?.role === 'admin' ? 'filled' : 'outlined'}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          />

          <TextField
            size="small"
            placeholder="Поиск по названию, ID, категории..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            sx={{ display: { xs: 'none', md: 'block' }, width: 360 }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
              }
            }}
          />

          <Tooltip title="Обновить каталог">
            <IconButton color="primary" onClick={onRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Настройки компании и маржи">
            <IconButton color="primary" onClick={onSettingsOpen}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Выйти">
            <IconButton color="primary" onClick={auth.logout}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>

          <IconButton color="primary" onClick={onCartOpen}>
            <Badge badgeContent={cartCount} color="error">
              <CartIcon />
            </Badge>
          </IconButton>
        </Toolbar>
      </MuiAppBar>

      {loadError && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="error" onClose={onClearError}>
            Не удалось загрузить данные из Supabase: {loadError}
          </Alert>
        </Box>
      )}

      <Outlet />
    </Box>
  );
}
