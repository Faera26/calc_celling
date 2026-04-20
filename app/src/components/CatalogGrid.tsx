import { Box, CircularProgress } from '@mui/material';
import type { CatalogItem, CatalogType, CartEntry, UzelComponent, UzelItem } from '../types';
import type { CompanySettings } from '../types';
import { keyOf } from '../utils';
import CatalogCard from './CatalogCard';

interface CatalogGridProps {
  items: CatalogItem[];
  activeType: CatalogType;
  isAdmin: boolean;
  cart: Record<string, CartEntry>;
  nodeComponents: Record<string, UzelComponent[]>;
  settings: CompanySettings;
  loading: boolean;
  onAddToCart: (type: CatalogType, item: CatalogItem) => void | Promise<void>;
  onRemoveFromCart: (cartKey: string) => void;
  onViewNode: (node: UzelItem) => void;
  onOpenConstructor: (node: UzelItem) => void;
}

export default function CatalogGrid({
  items,
  activeType,
  isAdmin,
  cart,
  nodeComponents,
  settings,
  loading,
  onAddToCart,
  onRemoveFromCart,
  onViewNode,
  onOpenConstructor,
}: CatalogGridProps) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, minmax(0, 1fr))',
        xl: 'repeat(3, minmax(0, 1fr))'
      },
      gap: 2
    }}>
      {items.map(item => {
        const cartKey = keyOf(activeType, item.id);
        const cartQty = cart[cartKey]?.qty || 0;
        const cachedComponents = nodeComponents[item.id];

        return (
          <CatalogCard
            key={cartKey}
            item={item}
            activeType={activeType}
            isAdmin={isAdmin}
            cartQty={cartQty}
            cachedComponents={cachedComponents}
            settings={settings}
            onAddToCart={() => onAddToCart(activeType, item)}
            onRemoveFromCart={() => onRemoveFromCart(cartKey)}
            onViewNode={() => onViewNode(item as UzelItem)}
            onOpenConstructor={() => onOpenConstructor(item as UzelItem)}
          />
        );
      })}
    </Box>
  );
}
