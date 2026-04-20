import { Card, CardContent, Typography, Box } from '@mui/material';
import type { CatalogCounts } from '../types';

interface StatCardsProps {
  counts: CatalogCounts;
}

const cards = [
  { key: 'tovar' as const, label: 'Товары' },
  { key: 'usluga' as const, label: 'Услуги' },
  { key: 'uzel' as const, label: 'Узлы' },
  { key: 'komplektaciya' as const, label: 'Комплектация узлов' },
];

export default function StatCards({ counts }: StatCardsProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
      {cards.map(card => (
        <Card key={card.key}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">{card.label}</Typography>
            <Typography variant="h4" color="primary.main">{counts[card.key].toLocaleString('ru-RU')}</Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
