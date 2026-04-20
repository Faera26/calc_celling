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
import type { CatalogItem, CatalogType, UzelComponent } from '../types';
import { PLACEHOLDER_IMAGE } from '../constants';
import { adjustedPrice, keyOf, labelOf, money, nodeCompositionCounts } from '../utils';
import type { CompanySettings } from '../types';

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
    <Card key={cartKey} sx={{ display: 'flex', flexDirection: 'column', minHeight: 360 }}>
      <Box sx={{ height: 150, backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <CardMedia
          component="img"
          image={item.image || PLACEHOLDER_IMAGE}
          alt={item.name}
          sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
        />
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
          <Chip size="small" label={labelOf(activeType)} color={activeType === 'uzel' ? 'secondary' : 'primary'} />
          <Chip size="small" label={`ID ${item.id}`} variant="outlined" />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {item.category} / {item.subcategory}
        </Typography>
        <Typography variant="h6" sx={{ mt: 1, lineHeight: 1.25 }}>
          {item.name}
        </Typography>
        {activeType === 'uzel' && (
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              size="small"
              variant="outlined"
              label={`Комплектация: ${typeof componentCount === 'number' ? `${componentCount} поз.` : 'открой'}`}
            />
            {typeof composition?.products === 'number' && (
              <Chip size="small" variant="outlined" label={`Товары: ${composition.products}`} />
            )}
            {typeof composition?.services === 'number' && (
              <Chip size="small" variant="outlined" label={`Услуги: ${composition.services}`} />
            )}
          </Stack>
        )}
        <Typography variant="h4" color="primary.main" sx={{ mt: 2 }}>
          {money(adjustedPrice(item.price, settings))}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          база {money(item.price)} {item.unit ? `/ ${item.unit}` : ''}
        </Typography>
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
          {activeType === 'uzel' && (
            <Button fullWidth variant="outlined" onClick={onViewNode}>
              Смотреть
            </Button>
          )}
          {activeType === 'uzel' && isAdmin && (
            <Button fullWidth variant="outlined" color="secondary" onClick={onOpenConstructor}>
              Конструктор
            </Button>
          )}
          {cartQty > 0 ? (
            <Stack direction="row" sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <IconButton onClick={onRemoveFromCart}><RemoveIcon /></IconButton>
              <Typography sx={{ fontWeight: 700 }}>{cartQty}</Typography>
              <IconButton onClick={onAddToCart}><AddIcon /></IconButton>
            </Stack>
          ) : (
            <Button fullWidth variant="contained" onClick={onAddToCart}>
              В смету
            </Button>
          )}
        </Stack>
      </CardActions>
    </Card>
  );
}
