import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { PLACEHOLDER_IMAGE } from '../constants';
import type { CatalogItem, CatalogType, CompanySettings, UzelComponent } from '../types';
import { adjustedPrice, keyOf, labelOf, money, nodeCompositionCounts } from '../utils';

interface CatalogCardProps {
  item: CatalogItem;
  activeType: CatalogType;
  isAdmin: boolean;
  cartQty: number;
  cachedComponents?: UzelComponent[];
  settings: CompanySettings;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
  onViewNode: () => void;
  onOpenConstructor: () => void;
}

export default function CatalogCard({
  item,
  activeType,
  isAdmin,
  cartQty,
  cachedComponents,
  settings,
  onAddToCart,
  onRemoveFromCart,
  onViewNode,
  onOpenConstructor,
}: CatalogCardProps) {
  const composition = activeType === 'uzel' ? nodeCompositionCounts(item, cachedComponents) : undefined;
  const componentCount = composition?.positions;
  const cartKey = keyOf(activeType, item.id);

  return (
    <Card key={cartKey} sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '24px' }}>
      <Box sx={{ height: 180, backgroundColor: 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <CardMedia
          component="img"
          image={item.image || PLACEHOLDER_IMAGE}
          alt={item.name}
          sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: 'multiply', transition: 'transform 0.5s ease', '&:hover': { transform: 'scale(1.05)' } }}
        />
      </Box>
      <CardContent sx={{ flexGrow: 1, px: 2.5, pt: 2.5 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Chip size="small" label={labelOf(activeType)} sx={{ bgcolor: activeType === 'uzel' ? 'var(--secondary)' : 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.65rem' }} />
          <Typography variant="caption" sx={{ color: 'var(--secondary)', fontWeight: 500 }}>
            ID {item.id} • {item.category}
          </Typography>
        </Stack>
        <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>
          {item.name}
        </Typography>
        {activeType === 'uzel' && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              size="small"
              variant="outlined"
              sx={{ borderColor: 'rgba(0,0,0,0.05)', bgcolor: 'rgba(0,0,0,0.02)', fontSize: '0.7rem' }}
              label={typeof componentCount === 'number' ? `${componentCount} поз.` : 'Состав'}
            />
          </Stack>
        )}
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--primary)' }}>
            {money(adjustedPrice(item.price, settings))}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--secondary)', opacity: 0.8 }}>
            база {money(item.price)} {item.unit ? `/ ${item.unit}` : ''}
          </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ p: 2.5, pt: 0 }}>
        <Stack spacing={1.5} sx={{ width: '100%' }}>
          {activeType === 'uzel' && (
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="outlined" onClick={onViewNode} sx={{ borderRadius: '12px', py: 1 }}>
                Инфо
              </Button>
              {isAdmin && (
                <Button fullWidth variant="outlined" color="inherit" onClick={onOpenConstructor} sx={{ borderRadius: '12px', py: 1 }}>
                  Состав
                </Button>
              )}
            </Stack>
          )}
          {cartQty > 0 ? (
            <Stack direction="row" sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(0,0,0,0.05)', borderRadius: '12px', px: 1 }}>
              <IconButton size="small" onClick={onRemoveFromCart}><RemoveIcon fontSize="small" /></IconButton>
              <Typography sx={{ fontWeight: 800 }}>{cartQty}</Typography>
              <IconButton size="small" onClick={onAddToCart}><AddIcon fontSize="small" /></IconButton>
            </Stack>
          ) : (
            <Button fullWidth variant="contained" onClick={onAddToCart} sx={{ borderRadius: '12px', py: 1, bgcolor: 'var(--primary)' }}>
              В смету
            </Button>
          )}
        </Stack>
      </CardActions>
    </Card>
  );
}
