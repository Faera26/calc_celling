'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  PictureAsPdf as PdfIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import type { CompanySettings } from '../types';
import { APP_ROUTES } from '../features/app/navigation';
import PdfColorPalette from './PdfColorPalette';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: CompanySettings;
  onUpdate: (patch: Partial<CompanySettings>) => void;
  onAvatar: (file?: File) => void | Promise<void>;
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
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100vw', sm: 430 },
            borderRadius: { xs: 0, sm: '28px 0 0 28px' },
            border: 'none',
            boxShadow: '-12px 0 40px rgba(15, 23, 42, 0.10)',
            bgcolor: '#F5F7FB',
          },
        },
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 3 }, pt: 'var(--safe-area-top)', pb: 'calc(var(--safe-area-bottom) + 24px)' }}>
        <Stack direction="row" sx={{ mb: 3, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" className="headline-editorial">Настройки</Typography>
            <Typography sx={{ mt: 0.5, color: 'rgba(8,43,76,0.58)' }}>
              Здесь живут только коммерческие и системные параметры.
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ bgcolor: 'rgba(0,0,0,0.05)' }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Stack spacing={2}>
          <DrawerCard
            title="Компания"
            icon={<TuneIcon sx={{ color: '#0B5CAD' }} />}
            subtitle="Логотип, контакты и базовая идентика в PDF и интерфейсе."
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar
                  src={settings.avatarDataUrl || undefined}
                  sx={{ width: 72, height: 72, bgcolor: '#000', fontSize: '1.75rem', fontWeight: 800 }}
                >
                  {settings.companyName.slice(0, 1)}
                </Avatar>
                <Button variant="outlined" component="label" sx={{ borderRadius: '14px', textTransform: 'none' }} disabled={!isAdmin}>
                  Загрузить логотип
                  <input hidden type="file" accept="image/*" onChange={(event) => void onAvatar(event.target.files?.[0])} />
                </Button>
              </Stack>

              <TextField fullWidth size="small" label="Название компании" value={settings.companyName} onChange={(event) => onUpdate({ companyName: event.target.value })} disabled={!isAdmin} />
              <TextField fullWidth size="small" label="Менеджер" value={settings.managerName} onChange={(event) => onUpdate({ managerName: event.target.value })} disabled={!isAdmin} />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField fullWidth size="small" label="Телефон" value={settings.phone} onChange={(event) => onUpdate({ phone: event.target.value })} disabled={!isAdmin} />
                <TextField fullWidth size="small" label="Email" value={settings.email} onChange={(event) => onUpdate({ email: event.target.value })} disabled={!isAdmin} />
              </Stack>
            </Stack>
          </DrawerCard>

          <DrawerCard
            title="Коммерция"
            icon={<TuneIcon sx={{ color: '#0B5CAD' }} />}
            subtitle="Базовые проценты, которые влияют на цену для клиента."
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                size="small"
                label="Маржа %"
                type="number"
                value={settings.marginPercent}
                onChange={(event) => onUpdate({ marginPercent: Number(event.target.value) })}
                disabled={!isAdmin}
              />
              <TextField
                fullWidth
                size="small"
                label="Скидка %"
                type="number"
                value={settings.discountPercent}
                onChange={(event) => onUpdate({ discountPercent: Number(event.target.value) })}
                disabled={!isAdmin}
              />
            </Stack>
          </DrawerCard>

          <DrawerCard
            title="PDF и документы"
            icon={<PdfIcon sx={{ color: '#0B5CAD' }} />}
            subtitle="Возвращаем шаблоны PDF в явное место, чтобы их было легко менять."
          >
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Шаблон PDF по умолчанию"
                  value={settings.defaultPdfTemplate}
                  onChange={(event) => onUpdate({ defaultPdfTemplate: event.target.value as CompanySettings['defaultPdfTemplate'] })}
                  disabled={!isAdmin}
                >
                  <MenuItem value="classic">Classic</MenuItem>
                  <MenuItem value="wave">Wave</MenuItem>
                  <MenuItem value="stripe">Stripe</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                </TextField>

              </Stack>

              <PdfColorPalette
                value={settings.defaultPdfAccentColor}
                onChange={(defaultPdfAccentColor) => onUpdate({ defaultPdfAccentColor })}
                disabled={!isAdmin}
                label="Акцентный цвет PDF"
              />

              <TextField
                fullWidth
                size="small"
                label="Примечание в PDF"
                value={settings.pdfNote}
                onChange={(event) => onUpdate({ pdfNote: event.target.value })}
                multiline
                minRows={3}
                disabled={!isAdmin}
              />
            </Stack>
          </DrawerCard>

          {isAdmin && (
            <DrawerCard
              title="Админ-инструменты"
              icon={<AdminIcon sx={{ color: '#0B5CAD' }} />}
              subtitle="То, что действительно подходит шестерёнке: настройки и админские переходы."
            >
              <Stack spacing={1.25}>
                <Button
                  component={Link}
                  href={APP_ROUTES.admin}
                  onClick={onClose}
                  variant="outlined"
                  startIcon={<AdminIcon />}
                  sx={{ justifyContent: 'flex-start', borderRadius: '14px', textTransform: 'none' }}
                >
                  Открыть админку доступа
                </Button>
              </Stack>
            </DrawerCard>
          )}

          {onLogout && (
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={() => {
                void onLogout();
                onClose();
              }}
              sx={{ borderRadius: '16px', py: 1.35, textTransform: 'none' }}
            >
              Выйти из аккаунта
            </Button>
          )}

          {syncError && (
            <Alert severity="warning" sx={{ borderRadius: '16px' }}>
              {syncError}
            </Alert>
          )}

          <Alert severity="info" sx={{ borderRadius: '16px', bgcolor: 'rgba(2, 136, 209, 0.05)', color: '#0288d1', '& .MuiAlert-icon': { color: '#0288d1' } }}>
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

function DrawerCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: '24px', p: 2.25, boxShadow: '0 16px 34px rgba(15, 23, 42, 0.05)' }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: '14px', bgcolor: 'rgba(11,92,173,0.08)' }}>
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, color: '#082B4C' }}>{title}</Typography>
          <Typography sx={{ color: 'rgba(8,43,76,0.58)', lineHeight: 1.65 }}>{subtitle}</Typography>
        </Box>
      </Stack>
      {children}
    </Box>
  );
}
