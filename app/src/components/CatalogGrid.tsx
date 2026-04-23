import { Box, CircularProgress } from '@mui/material';
import type { CatalogItem, CatalogType, CartEntry, CompanySettings, UzelComponent } from '../types';
import { keyOf } from '../utils';
import CatalogCard from './CatalogCard';

interface CatalogGridBaseProps {
  items: CatalogItem[];
  activeType: CatalogType;
  isAdmin: boolean;
  nodeComponents: Record<string, UzelComponent[]>;
  settings: CompanySettings;
  loading: boolean;
  onViewNode: (item: CatalogItem) => void;
  onOpenConstructor: (item: CatalogItem) => void;
}

interface CatalogGridBrowseProps extends CatalogGridBaseProps {
  mode?: 'browse';
  cart: Record<string, CartEntry>;
  onAddToCart: (type: CatalogType, item: CatalogItem) => void | Promise<void>;
  onRemoveFromCart: (cartKey: string) => void;
}

interface CatalogGridManageProps extends CatalogGridBaseProps {
  mode: 'manage';
  deletingItemId?: string;
  onEditItem?: (item: CatalogItem) => void;
  onDeleteItem?: (item: CatalogItem) => void;
}

type CatalogGridProps = CatalogGridBrowseProps | CatalogGridManageProps;

export default function CatalogGrid(props: CatalogGridProps) {
  const {
    items,
    activeType,
    isAdmin,
    nodeComponents,
    settings,
    loading,
    onViewNode,
    onOpenConstructor,
  } = props;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const gridStyles = {
    display: 'grid',
    gridTemplateColumns: {
      xs: '1fr',
      sm: 'repeat(2, minmax(0, 1fr))',
      xl: 'repeat(3, minmax(0, 1fr))',
    },
    gap: 2,
  } as const;

  if (props.mode === 'manage') {
    return (
      <Box sx={gridStyles}>
        {items.map((item) => {
          const cardKey = keyOf(activeType, item.id);
          const cachedComponents = nodeComponents[item.id];
          const editItem = props.onEditItem;
          const deleteItem = props.onDeleteItem;

          return (
            <CatalogCard
              key={cardKey}
              item={item}
              activeType={activeType}
              isAdmin={isAdmin}
              cartQty={0}
              cachedComponents={cachedComponents}
              settings={settings}
              mode="manage"
              deleteInProgress={props.deletingItemId === item.id}
              onAddToCart={() => {}}
              onRemoveFromCart={() => {}}
              onViewNode={() => onViewNode(item)}
              onOpenConstructor={() => onOpenConstructor(item)}
              onEdit={editItem ? () => editItem(item) : undefined}
              onDelete={deleteItem ? () => deleteItem(item) : undefined}
            />
          );
        })}
      </Box>
    );
  }

  return (
    <Box sx={gridStyles}>
      {items.map((item) => {
        const cardKey = keyOf(activeType, item.id);
        const cachedComponents = nodeComponents[item.id];
        const cartQty = props.cart[cardKey]?.qty || 0;

        return (
          <CatalogCard
            key={cardKey}
            item={item}
            activeType={activeType}
            isAdmin={isAdmin}
            cartQty={cartQty}
            cachedComponents={cachedComponents}
            settings={settings}
            mode="browse"
            onAddToCart={() => props.onAddToCart(activeType, item)}
            onRemoveFromCart={() => props.onRemoveFromCart(cardKey)}
            onViewNode={() => onViewNode(item)}
            onOpenConstructor={() => onOpenConstructor(item)}
          />
        );
      })}
    </Box>
  );
}
