'use client';

import type { ReactNode } from 'react';
import {
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
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
  AdminPanelSettings as AdminIcon,
  ArrowBackIosNew as ArrowBackIcon,
  Description as EstimatesIcon,
  HomeRounded as HomeIcon,
  Logout as LogoutIcon,
  Person as ProfileIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  ShoppingCart as CartIcon,
  Storefront as CatalogIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { APP_NAV_ITEMS, APP_ROUTES } from '../features/app/navigation';
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
  searchEnabled?: boolean;
  searchPlaceholder?: string;
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
  searchEnabled = false,
  searchPlaceholder = 'Поиск...',
  children,
}: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? APP_ROUTES.home;
  const navLinks = APP_NAV_ITEMS.filter((link) => !link.adminOnly || auth.isAdmin);
  const isHomePage = currentPath === APP_ROUTES.home;

  function isActiveLink(href: string) {
    if (href === APP_ROUTES.home) {
      return currentPath === APP_ROUTES.home;
    }

    if (href === APP_ROUTES.catalog) {
      return currentPath.startsWith(APP_ROUTES.catalog);
    }

    return currentPath.startsWith(href);
  }

  function resolveNavValue() {
    const activeLink = navLinks.find((link) => isActiveLink(link.href));
    return activeLink?.href || APP_ROUTES.home;
  }

  function navIconOf(href: string) {
    if (href === APP_ROUTES.home) return <HomeIcon />;
    if (href === APP_ROUTES.catalog) return <CatalogIcon />;
    if (href === APP_ROUTES.estimates) return <EstimatesIcon />;
    if (href === APP_ROUTES.profile) return <ProfileIcon />;
    return <AdminIcon />;
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#FBFBFD', pb: { xs: '92px', md: 0 } }}>
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
        <Toolbar sx={{ gap: { xs: 0.75, sm: 2 }, minHeight: { xs: 64, sm: 76 }, px: { xs: 1.25, sm: 3 } }}>
          {!isHomePage && (
            <Tooltip title="Назад">
              <IconButton
                onClick={() => {
                  if (window.history.length > 1) {
                    router.back();
                    return;
                  }

                  router.push(APP_ROUTES.home);
                }}
                size="small"
                sx={{ color: 'var(--primary)', flexShrink: 0 }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Stack
            component={Link}
            href={APP_ROUTES.home}
            direction="row"
            sx={{ alignItems: 'center', gap: { xs: 1, sm: 1.5 }, minWidth: 0, flexShrink: 1 }}
          >
            <Avatar
              src={settings.avatarDataUrl || undefined}
              sx={{
                width: { xs: 32, sm: 42 },
                height: { xs: 32, sm: 42 },
                bgcolor: 'var(--primary)',
                fontSize: { xs: '0.9rem', sm: '1rem' },
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
                  lineHeight: 1.1,
                  fontSize: { xs: '0.95rem', sm: '1.1rem' },
                  fontWeight: 800,
                  color: 'var(--primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {settings.companyName}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  color: 'var(--secondary)',
                }}
              >
                {isHomePage ? 'Главный экран' : 'Нажми, чтобы перейти на главную'}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          {searchEnabled && (
            <TextField
              size="small"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              sx={{
                display: { xs: 'none', md: 'block' },
                width: { md: 220, lg: 300 },
                mr: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: 'rgba(0,0,0,0.04)',
                  height: '40px',
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
          )}

          <Stack direction="row" spacing={{ xs: 0.25, sm: 0.75 }} sx={{ alignItems: 'center' }}>
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

      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 'calc(var(--safe-area-bottom) + 12px)',
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        <BottomNavigation
          showLabels
          value={resolveNavValue()}
          sx={{
            height: 72,
            borderRadius: '24px',
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.12)',
            bgcolor: 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(14px)',
          }}
        >
          {navLinks.map((link) => (
            <BottomNavigationAction
              key={link.href}
              component={Link}
              href={link.href}
              value={link.href}
              label={link.label}
              icon={navIconOf(link.href)}
              sx={{
                minWidth: 0,
                '&.Mui-selected': {
                  color: '#0B5CAD',
                },
              }}
            />
          ))}
        </BottomNavigation>
      </Box>
    </Box>
  );
}
