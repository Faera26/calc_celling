'use client';

import type { ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
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
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAV_ITEMS } from '../features/app/navigation';
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
  children?: ReactNode;
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
  children,
}: AppLayoutProps) {
  const pathname = usePathname();
  const currentPath = pathname ?? '/';
  const navLinks = APP_NAV_ITEMS.filter((link) => !link.adminOnly || auth.isAdmin);

  // Один массив маршрутов используется и в верхнем меню, и в боковом drawer.
  // Так новичку проще менять навигацию: достаточно поправить один файл.
  function isActiveLink(href: string) {
    if (href === '/') {
      return currentPath === '/';
    }

    return currentPath.startsWith(href);
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#FBFBFD' }}>
      <MuiAppBar
        position="sticky"
        elevation={0}
        className="glass"
        sx={{
          color: 'var(--primary)',
          pt: 'var(--safe-area-top)',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: { xs: 0.5, sm: 2 }, minHeight: { xs: 56, sm: 72 }, px: { xs: 1, sm: 4 } }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: { xs: 1, sm: 1.5 }, minWidth: 0, flexShrink: 1 }}>
            <Avatar
              src={settings.avatarDataUrl || undefined}
              sx={{
                width: { xs: 28, sm: 40 },
                height: { xs: 28, sm: 40 },
                bgcolor: 'var(--primary)',
                fontSize: { xs: '0.8rem', sm: '1rem' },
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {settings.companyName.slice(0, 1)}
            </Avatar>
            <Box sx={{ minWidth: 0, flexShrink: 1 }}>
              <Typography
                variant="subtitle1"
                className="headline-editorial"
                sx={{
                  lineHeight: 1.2,
                  fontSize: { xs: '0.85rem', sm: '1.1rem' },
                  fontWeight: 700,
                  color: 'var(--primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {settings.companyName}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ display: { xs: 'none', lg: 'flex' }, gap: 0.5, ml: 3 }}>
            {navLinks.map((link) => {
              const isActive = isActiveLink(link.href);

              return (
                <Button
                  key={link.href}
                  component={Link}
                  href={link.href}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '14px',
                    px: 2,
                    py: 0.5,
                    borderRadius: '8px',
                    color: isActive ? 'var(--primary)' : 'var(--secondary)',
                    bgcolor: isActive ? 'rgba(0,0,0,0.04)' : 'transparent',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.02)',
                    },
                  }}
                >
                  {link.label}
                </Button>
              );
            })}
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} sx={{ alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Поиск..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              sx={{
                display: { xs: 'none', md: 'block' },
                width: { md: 180, lg: 240 },
                mr: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  bgcolor: 'rgba(0,0,0,0.04)',
                  height: '36px',
                  fontSize: '14px',
                  '& fieldset': { border: 'none' },
                },
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'var(--secondary)', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Tooltip title="Обновить">
              <IconButton onClick={onRefresh} size="small" sx={{ color: 'var(--primary)' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Настройки">
              <IconButton onClick={onSettingsOpen} size="small" sx={{ color: 'var(--primary)' }}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <IconButton onClick={onCartOpen} size="small" sx={{ color: 'var(--primary)' }}>
              <Badge badgeContent={cartCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                <CartIcon fontSize="small" />
              </Badge>
            </IconButton>

            <Tooltip title="Выйти">
              <IconButton onClick={auth.logout} size="small" sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: 'var(--primary)' }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </MuiAppBar>

      <Box component="main">
        {children}
      </Box>
    </Box>
  );
}
