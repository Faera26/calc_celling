'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowOutward as ArrowOutwardIcon,
  AutoAwesome as AutoAwesomeIcon,
  Description as DescriptionIcon,
  Roofing as RoofingIcon,
  SettingsSuggest as SettingsSuggestIcon,
  Storefront as StorefrontIcon,
} from '@mui/icons-material';
import type { AuthState, CompanySettings } from '../types';
import { APP_ROUTES, type AppRoute } from '../features/app/navigation';
import { restCount } from '../supabaseRest';

interface HomePageProps {
  auth: AuthState;
  settings: CompanySettings;
}

interface HomeStats {
  estimates: number;
  products: number;
  services: number;
  nodes: number;
}

interface HomeAction {
  href: AppRoute;
  title: string;
  subtitle: string;
  icon: ReactNode;
}

const EMPTY_STATS: HomeStats = {
  estimates: 0,
  products: 0,
  services: 0,
  nodes: 0,
};

export default function HomePage({ auth, settings }: HomePageProps) {
  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const [estimates, products, services, nodes] = await Promise.all([
          restCount('smety'),
          restCount('tovary'),
          restCount('uslugi'),
          restCount('uzly'),
        ]);

        if (cancelled) return;
        setStats({
          estimates,
          products,
          services,
          nodes,
        });
      } catch (error) {
        if (cancelled) return;
        setStatsError(error instanceof Error ? error.message : String(error));
      }
    }

    if (auth.userId) {
      void loadStats();
    }

    return () => {
      cancelled = true;
    };
  }, [auth.userId]);

  const primaryActions = useMemo(() => {
    const actions: HomeAction[] = [
      {
        href: APP_ROUTES.catalog,
        title: 'Каталог',
        subtitle: 'Открыть материалы, услуги и узлы с ленивой загрузкой.',
        icon: <StorefrontIcon />,
      },
      {
        href: APP_ROUTES.estimates,
        title: 'Сметы',
        subtitle: 'Продолжить редактор, PDF и сохранённые расчёты.',
        icon: <DescriptionIcon />,
      },
      {
        href: APP_ROUTES.profile,
        title: 'Профиль',
        subtitle: 'Проверить аккаунт и персональные данные.',
        icon: <RoofingIcon />,
      },
    ];

    if (auth.isAdmin) {
      actions.push({
        href: APP_ROUTES.catalogManager,
        title: 'Управление каталогом',
        subtitle: 'Редактировать карточки, фото и структуру каталога.',
        icon: <SettingsSuggestIcon />,
      });
    }

    return actions;
  }, [auth.isAdmin]);

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1600, mx: 'auto' }}>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '36px',
          p: '1px',
          background: 'linear-gradient(135deg, rgba(8,43,76,0.18), rgba(11,92,173,0.14), rgba(35,156,140,0.12), rgba(255,255,255,0.95))',
          mb: 3,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at top left, rgba(17,120,198,0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(44,174,154,0.14), transparent 28%)',
            pointerEvents: 'none',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            borderRadius: '35px',
            px: { xs: 2, md: 4 },
            py: { xs: 3, md: 4 },
            bgcolor: 'rgba(248,250,252,0.94)',
          }}
        >
          <Stack spacing={3}>
            <Chip
              icon={<AutoAwesomeIcon />}
              label="SmartCeiling Workspace"
              sx={{
                width: 'fit-content',
                borderRadius: '999px',
                bgcolor: 'rgba(11,92,173,0.08)',
                color: 'var(--primary)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            />

            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={3} sx={{ justifyContent: 'space-between', alignItems: { xl: 'flex-end' } }}>
              <Box sx={{ maxWidth: 900 }}>
                <Typography
                  sx={{
                    fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
                    fontSize: { xs: '2rem', md: '3.45rem' },
                    lineHeight: 0.96,
                    fontWeight: 900,
                    color: '#082B4C',
                  }}
                >
                  Главный экран, с которого удобно и продавать, и администрировать.
                </Typography>
                <Typography
                  sx={{
                    mt: 1.75,
                    maxWidth: 760,
                    color: 'rgba(8,43,76,0.72)',
                    fontSize: { xs: '0.98rem', md: '1.05rem' },
                    lineHeight: 1.7,
                  }}
                >
                  Здесь собраны быстрые входы в каталог, сметы и настройки компании. Шестерёнка остаётся
                  только для коммерческих настроек, а основная работа живёт в понятной навигации.
                </Typography>
              </Box>

              <Stack spacing={1} sx={{ minWidth: { xl: 260 } }}>
                <Button
                  component={Link}
                  href={APP_ROUTES.catalog}
                  variant="contained"
                  endIcon={<ArrowOutwardIcon />}
                  sx={{ borderRadius: '999px', px: 2.5, py: 1.25, textTransform: 'none' }}
                >
                  Открыть каталог
                </Button>
                <Button
                  component={Link}
                  href={APP_ROUTES.estimates}
                  variant="outlined"
                  sx={{ borderRadius: '999px', px: 2.5, py: 1.25, textTransform: 'none' }}
                >
                  Перейти к сметам
                </Button>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <StatCard label="Сметы" value={stats.estimates} note="Сохранённые документы" />
              <StatCard label="Товары" value={stats.products} note="Каталог материалов" />
              <StatCard label="Услуги" value={stats.services} note="Монтаж и сервис" />
              <StatCard label="Узлы" value={stats.nodes} note="Готовые сборки" />
            </Stack>
          </Stack>
        </Box>
      </Box>

      {statsError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Не удалось обновить обзор каталога: {statsError}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={3}>
        <Box sx={{ flex: 1.2 }}>
          <SectionCard
            title="Быстрые действия"
            subtitle="Самые частые сценарии вынесены на главный экран, чтобы не искать их по меню."
          >
            <Stack spacing={1.5}>
              {primaryActions.map((action) => (
                <Button
                  key={action.href}
                  component={Link}
                  href={action.href}
                  variant="outlined"
                  sx={{
                    justifyContent: 'space-between',
                    textTransform: 'none',
                    borderRadius: '24px',
                    px: 2.25,
                    py: 1.75,
                    borderColor: 'rgba(8,43,76,0.08)',
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', textAlign: 'left' }}>
                    <Box sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: '16px', bgcolor: 'rgba(11,92,173,0.08)', color: '#0B5CAD' }}>
                      {action.icon}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, color: '#082B4C' }}>{action.title}</Typography>
                      <Typography sx={{ color: 'rgba(8,43,76,0.62)' }}>{action.subtitle}</Typography>
                    </Box>
                  </Stack>
                  <ArrowOutwardIcon />
                </Button>
              ))}
            </Stack>
          </SectionCard>
        </Box>

        <Box sx={{ flex: 0.9 }}>
          <SectionCard
            title="Коммерческие настройки"
            subtitle="То, что влияет на прайс, PDF и подачу компании клиенту."
          >
            <Stack spacing={1.25}>
              <SummaryRow label="Компания" value={settings.companyName || 'SmartCeiling'} />
              <SummaryRow label="Менеджер" value={settings.managerName || 'Не указан'} />
              <SummaryRow label="Маржа" value={`${settings.marginPercent || 0}%`} />
              <SummaryRow label="Скидка" value={`${settings.discountPercent || 0}%`} />
              <SummaryRow label="PDF-шаблон" value={settings.defaultPdfTemplate} />
            </Stack>
          </SectionCard>
        </Box>
      </Stack>
    </Box>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        p: '1px',
        borderRadius: '32px',
        background: 'linear-gradient(160deg, rgba(8,43,76,0.12), rgba(11,92,173,0.04), rgba(255,255,255,0.9))',
      }}
    >
      <Box sx={{ borderRadius: '31px', p: { xs: 2, md: 2.5 }, bgcolor: 'rgba(255,255,255,0.94)' }}>
        <Typography sx={{ fontSize: { xs: '1.15rem', md: '1.4rem' }, fontWeight: 800, color: '#082B4C' }}>
          {title}
        </Typography>
        <Typography sx={{ mt: 0.75, mb: 2.25, color: 'rgba(8,43,76,0.62)', lineHeight: 1.7 }}>
          {subtitle}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

function StatCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        p: '1px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(8,43,76,0.08))',
      }}
    >
      <Box sx={{ borderRadius: '23px', px: 2.25, py: 2, bgcolor: 'rgba(255,255,255,0.82)' }}>
        <Typography sx={{ color: 'rgba(8,43,76,0.55)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: '1.75rem', fontWeight: 800, color: '#082B4C' }}>
          {value.toLocaleString('ru-RU')}
        </Typography>
        <Typography sx={{ mt: 0.25, color: 'rgba(8,43,76,0.58)' }}>
          {note}
        </Typography>
      </Box>
    </Box>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography sx={{ color: 'rgba(8,43,76,0.58)' }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, color: '#082B4C', textAlign: 'right' }}>{value}</Typography>
    </Stack>
  );
}
