import Link from 'next/link';
import { Button, Stack, Typography } from '@mui/material';
import type { CatalogType } from '../types';

interface CatalogTypeSwitcherProps {
  activeType: CatalogType;
}

const CATALOG_LINKS: Array<{ type: CatalogType; href: string; title: string; subtitle: string }> = [
  { type: 'uzel', href: '/catalog/uzly', title: 'Каталог узлов', subtitle: 'Готовые узлы и решения' },
  { type: 'tovar', href: '/catalog/tovary', title: 'Каталог товаров', subtitle: 'Материалы и комплектующие' },
  { type: 'usluga', href: '/catalog/uslugi', title: 'Каталог услуг', subtitle: 'Монтаж и дополнительные работы' },
];

export default function CatalogTypeSwitcher({ activeType }: CatalogTypeSwitcherProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={0}
      sx={{
        mb: 3,
        overflow: 'hidden',
        borderRadius: '24px',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        backgroundColor: '#fff',
      }}
    >
      {CATALOG_LINKS.map((item) => {
        const isActive = item.type === activeType;

        return (
          <Button
            key={item.type}
            component={Link}
            href={item.href}
            fullWidth
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 0.5,
              minHeight: { xs: 76, md: 108 },
              px: { xs: 2, md: 3 },
              py: { xs: 1.5, md: 2.5 },
              borderRadius: 0,
              textTransform: 'none',
              textAlign: 'left',
              color: isActive ? '#0B5CAD' : 'text.primary',
              background: isActive
                ? 'linear-gradient(135deg, rgba(14, 116, 144, 0.18), rgba(59, 130, 246, 0.08))'
                : '#fff',
              borderRight: { md: item.type !== 'usluga' ? '1px solid rgba(15, 23, 42, 0.08)' : 'none' },
              borderBottom: { xs: item.type !== 'usluga' ? '1px solid rgba(15, 23, 42, 0.08)' : 'none', md: 'none' },
              '&:hover': {
                background: isActive
                  ? 'linear-gradient(135deg, rgba(14, 116, 144, 0.22), rgba(59, 130, 246, 0.12))'
                  : 'rgba(15, 23, 42, 0.03)',
              },
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {item.title}
            </Typography>
            <Typography sx={{ fontSize: { xs: 12, md: 14 }, color: isActive ? '#0B5CAD' : 'text.secondary' }}>
              {item.subtitle}
            </Typography>
          </Button>
        );
      })}
    </Stack>
  );
}
