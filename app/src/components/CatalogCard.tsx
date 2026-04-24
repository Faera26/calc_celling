import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import { PLACEHOLDER_IMAGE } from '../constants';
import type { CatalogItem, CatalogType, CompanySettings, UzelComponent } from '../types';
import { adjustedPrice, keyOf, labelOf, money, nodeCompositionCounts } from '../utils';

type CatalogCardMode = 'browse' | 'manage';

interface CatalogCardProps {
  item: CatalogItem;
  activeType: CatalogType;
  isAdmin: boolean;
  cartQty: number;
  cachedComponents?: UzelComponent[];
  settings: CompanySettings;
  mode?: CatalogCardMode;
  deleteInProgress?: boolean;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
  onViewNode: () => void;
  onOpenConstructor: () => void;
  onOpenDetails?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function CatalogCard({
  item,
  activeType,
  isAdmin,
  cartQty,
  cachedComponents,
  settings,
  mode = 'browse',
  deleteInProgress = false,
  onAddToCart,
  onRemoveFromCart,
  onViewNode,
  onOpenConstructor,
  onOpenDetails,
  onEdit,
  onDelete,
}: CatalogCardProps) {
  const composition = activeType === 'uzel' ? nodeCompositionCounts(item, cachedComponents) : undefined;
  const cartKey = keyOf(activeType, item.id);
  const manageMode = mode === 'manage';
  const hasManagementActions = Boolean(onEdit || onDelete);
  const showManagementActions = isAdmin && hasManagementActions;

  return (
    <Card
      key={cartKey}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: '28px',
        overflow: 'hidden',
        boxShadow: '0 18px 48px rgba(15, 23, 42, 0.06)',
      }}
    >
      <Box
        onClick={onOpenDetails}
        sx={{
          cursor: onOpenDetails ? 'pointer' : 'default',
          height: 210,
          background:
            'linear-gradient(180deg, rgba(8,43,76,0.03), rgba(11,92,173,0.05))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Box
          component="img"
          src={item.image || PLACEHOLDER_IMAGE}
          alt={item.name}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transition: 'transform 0.5s ease',
            '&:hover': { transform: onOpenDetails ? 'scale(1.03)' : 'none' },
          }}
        />
      </Box>

      <CardContent sx={{ flexGrow: 1, px: 2.5, pt: 2.5 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Chip
            size="small"
            label={labelOf(activeType)}
            sx={{
              bgcolor: activeType === 'uzel' ? 'var(--secondary)' : 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.68rem',
            }}
          />
          <Typography variant="caption" sx={{ color: 'var(--secondary)', fontWeight: 600 }}>
            ID {item.id}
          </Typography>
        </Stack>

        <Typography
          variant="h6"
          onClick={onOpenDetails}
          sx={{
            lineHeight: 1.15,
            fontWeight: 800,
            fontSize: '1.12rem',
            mb: 1,
            cursor: onOpenDetails ? 'pointer' : 'default',
          }}
        >
          {item.name}
        </Typography>

        <Typography variant="body2" sx={{ color: 'rgba(8,43,76,0.58)', minHeight: 42 }}>
          {item.description || `${item.category || 'Без категории'}${item.subcategory ? ` / ${item.subcategory}` : ''}`}
        </Typography>

        <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
          <Chip size="small" variant="outlined" label={item.category || 'Без категории'} />
          {item.subcategory && <Chip size="small" variant="outlined" label={item.subcategory} />}
          {activeType === 'uzel' && (
            <Chip
              size="small"
              variant="outlined"
              label={`${composition?.positions || 0} поз.`}
            />
          )}
        </Stack>

        <Box sx={{ mt: 'auto', pt: 2.25 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, color: 'var(--primary)' }}>
            {money(adjustedPrice(item.price, settings))}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--secondary)', opacity: 0.8 }}>
            база {money(item.price)} {item.unit ? `/ ${item.unit}` : ''}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ p: 2.5, pt: 0 }}>
        <Stack spacing={1.25} sx={{ width: '100%' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button fullWidth variant="outlined" onClick={onOpenDetails} sx={{ borderRadius: '14px', py: 1 }}>
              Карточка
            </Button>
            {activeType === 'uzel' && (
              <Button fullWidth variant="outlined" onClick={onViewNode} sx={{ borderRadius: '14px', py: 1 }}>
                Инфо
              </Button>
            )}
          </Stack>

          {activeType === 'uzel' && isAdmin && (
            <Button fullWidth variant="outlined" color="inherit" onClick={onOpenConstructor} sx={{ borderRadius: '14px', py: 1 }}>
              Состав узла
            </Button>
          )}

          {showManagementActions && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {onEdit && (
                <Button fullWidth variant="contained" onClick={onEdit} sx={{ borderRadius: '14px', py: 1.05 }}>
                  Редактировать
                </Button>
              )}
              {onDelete && (
                <Button fullWidth variant="outlined" color="error" onClick={onDelete} disabled={deleteInProgress} sx={{ borderRadius: '14px', py: 1.05 }}>
                  {deleteInProgress ? 'Удаляю...' : 'Удалить'}
                </Button>
              )}
            </Stack>
          )}

          {!manageMode && (
            cartQty > 0 ? (
              <Stack
                direction="row"
                sx={{
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: 'rgba(0,0,0,0.05)',
                  borderRadius: '14px',
                  px: 1,
                }}
              >
                <IconButton size="small" onClick={onRemoveFromCart}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ fontWeight: 800 }}>{cartQty}</Typography>
                <IconButton size="small" onClick={onAddToCart}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Stack>
            ) : (
              <Button fullWidth variant="contained" onClick={onAddToCart} sx={{ borderRadius: '14px', py: 1.05 }}>
                В смету
              </Button>
            )
          )}
        </Stack>
      </CardActions>
    </Card>
  );
}
