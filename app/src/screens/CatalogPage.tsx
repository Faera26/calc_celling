import { useEffect, useState } from 'react';
import {
  Box,
  Alert,
  Button,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { AuthState, CatalogItem, CatalogType, CartEntry, CompanySettings, ItemForm, UzelComponent, UzelItem } from '../types';
import { EMPTY_ITEM_FORM } from '../constants';
import { useCatalog, openNodeDetails } from '../hooks/useCatalog';
import { useConstructor } from '../hooks/useConstructor';
import StatCards from '../components/StatCards';
import CategoryNav from '../components/CategoryNav';
import CatalogGrid from '../components/CatalogGrid';
import PaginationControls from '../components/PaginationControls';
import EmptyState from '../components/EmptyState';
import NodeDetailsDialog from '../components/NodeDetailsDialog';
import ConstructorDialog from '../components/ConstructorDialog';
import AddItemDialog from '../components/AddItemDialog';
import { supabase } from '../supabaseClient';
import { withTimeout, formatError } from '../utils';

interface CatalogPageProps {
  auth: AuthState;
  settings: CompanySettings;
  cart: Record<string, CartEntry>;
  onAddToCart: (type: CatalogType, item: CatalogItem, components?: UzelComponent[]) => void;
  onRemoveFromCart: (cartKey: string) => void;
  search: string;
  catalogRefreshToggle: number;
}

export default function CatalogPage({
  auth,
  settings,
  cart,
  onAddToCart,
  onRemoveFromCart,
  search,
  catalogRefreshToggle,
}: CatalogPageProps) {
  const catalog = useCatalog({
    authReady: auth.ready,
    userId: auth.userId,
    userEmail: auth.userEmail,
  });

  const constructor = useConstructor({
    userId: auth.userId,
    userEmail: auth.userEmail,
    isAdmin: auth.isAdmin,
    onNodeUpdated: (node, components) => {
      catalog.updateItemInList(node);
      catalog.updateNodeComponents(node.id, components);
    },
    onRefresh: catalog.refresh,
  });

  const [selectedNode, setSelectedNode] = useState<UzelItem | null>(null);
  const [nodeDetailsLoading, setNodeDetailsLoading] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM_FORM);
  const [savingItem, setSavingItem] = useState(false);
  const [saveError, setSaveError] = useState('');
  const catalogSearchValue = catalog.search;
  const setCatalogSearch = catalog.setSearch;
  const refreshCatalog = catalog.refresh;

  // Поиск живёт в layout, а реальные данные — внутри useCatalog.
  // Синхронизируем их тут, чтобы не менять состояние прямо во время render.
  useEffect(() => {
    if (catalogSearchValue !== search) {
      setCatalogSearch(search);
    }
  }, [search, catalogSearchValue, setCatalogSearch]);

  // Кнопка "обновить" из шапки просто меняет счётчик.
  // Когда счётчик меняется, каталог перечитывает данные.
  useEffect(() => {
    if (catalogRefreshToggle > 0) {
      refreshCatalog();
    }
  }, [catalogRefreshToggle, refreshCatalog]);

  function handleViewNode(node: UzelItem) {
    setSelectedNode(node);
    openNodeDetails(node, catalog.loadNodeComponents, setNodeDetailsLoading, catalog.setLoadError);
  }

  function handleOpenConstructor(node: UzelItem) {
    setSelectedNode(null);
    constructor.openConstructor(node, catalog.loadNodeComponents);
  }

  async function handleAddToCart(type: CatalogType, item: CatalogItem) {
    if (type !== 'uzel') {
      onAddToCart(type, item);
      return;
    }

    try {
      const components = await catalog.loadNodeComponents(item.id);
      onAddToCart(type, item, components);
    } catch (error) {
      catalog.setLoadError(`Не удалось добавить узел в смету с комплектацией: ${formatError(error)}`);
    }
  }

  async function handleSaveItem() {
    setSavingItem(true);
    setSaveError('');

    const trimmedCategory = itemForm.category.trim() || 'Без категории';
    const trimmedSubcategory = itemForm.subcategory.trim() || 'Без подкатегории';

    const newItem = {
      id: itemForm.id.trim() || crypto.randomUUID(),
      name: itemForm.name.trim(),
      category: trimmedCategory,
      subcategory: trimmedSubcategory,
      price: Number(itemForm.price || 0),
      unit: itemForm.unit.trim(),
      image: itemForm.image.trim() || null,
      description: itemForm.description.trim() || null,
    };

    if (!newItem.name) {
      setSaveError('Укажи название позиции.');
      setSavingItem(false);
      return;
    }

    try {
      const table = catalog.activeType === 'tovar' ? 'tovary' : catalog.activeType === 'usluga' ? 'uslugi' : 'uzly';

      const { error } = await withTimeout(
        supabase.from(table).insert([
          catalog.activeType === 'uzel'
            ? { ...newItem, stats: { positions: 0, products: 0, services: 0, source: 'manual_created' } }
            : { ...newItem, source: 'manual' },
        ]),
        'Сохранение позиции'
      );

      if (error) {
        throw error;
      }

      await constructor.upsertCategory(catalog.activeType, trimmedCategory, trimmedSubcategory);

      setItemDialogOpen(false);
      setItemForm(EMPTY_ITEM_FORM);
      catalog.refresh();
    } catch (error) {
      setSaveError(formatError(error));
    } finally {
      setSavingItem(false);
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
      <StatCards counts={catalog.counts} />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 3, mb: 2, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Tabs
          value={catalog.activeType}
          onChange={(_, value) => catalog.setActiveType(value as CatalogType)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="tovar" label="Товары" />
          <Tab value="usluga" label="Услуги" />
          <Tab value="uzel" label="Узлы" />
        </Tabs>

        {auth.isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setItemDialogOpen(true)}>
            Добавить позицию
          </Button>
        )}
      </Stack>

      <CategoryNav
        categories={catalog.categories}
        categoriesLoading={catalog.categoriesLoading}
        activeCategory={catalog.activeCategory}
        activeSubcategory={catalog.activeSubcategory}
        onFilterChange={(category, subcategory) => {
          catalog.setActiveCategory(category);
          catalog.setActiveSubcategory(subcategory);
        }}
      />

      {catalog.loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => catalog.setLoadError('')}>
          Не удалось загрузить данные из Supabase: {catalog.loadError}
        </Alert>
      )}

      <Box sx={{ width: '100%' }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {catalog.itemsTotal} {catalog.itemsTotal === 1 ? 'позиция' : catalog.itemsTotal > 1 && catalog.itemsTotal < 5 ? 'позиции' : 'позиций'}
            </Typography>
          </Stack>

          <CatalogGrid
            items={catalog.items}
            activeType={catalog.activeType}
            isAdmin={auth.isAdmin}
            cart={cart}
            nodeComponents={catalog.nodeComponents}
            settings={settings}
            loading={catalog.itemsLoading}
            onAddToCart={handleAddToCart}
            onRemoveFromCart={onRemoveFromCart}
            onViewNode={handleViewNode}
            onOpenConstructor={handleOpenConstructor}
          />

          {!catalog.itemsLoading && catalog.items.length === 0 && (
            <EmptyState
              activeType={catalog.activeType}
              activeCategory={catalog.activeCategory}
              activeSubcategory={catalog.activeSubcategory}
              debouncedSearch={catalog.debouncedSearch}
              filterIsActive={catalog.filterIsActive}
              onResetFilters={catalog.resetFilters}
              onRefresh={catalog.refresh}
            />
          )}

          <PaginationControls
            page={catalog.page}
            totalPages={catalog.totalPages}
            nextPageDisabled={catalog.nextPageDisabled}
            onPageChange={catalog.setPage}
          />
        </Box>
      </Box>

      <NodeDetailsDialog
        node={selectedNode}
        rows={selectedNode ? catalog.nodeComponents[selectedNode.id] || [] : []}
        loading={nodeDetailsLoading}
        isAdmin={auth.isAdmin}
        onClose={() => setSelectedNode(null)}
        onAddToCart={() => {
          if (selectedNode) {
            handleAddToCart('uzel', selectedNode);
          }
          setSelectedNode(null);
        }}
        onOpenConstructor={() => {
          if (selectedNode) {
            handleOpenConstructor(selectedNode);
          }
        }}
      />

      <ConstructorDialog
        state={constructor.constructorState}
        loading={constructor.constructorLoading}
        saving={constructor.savingConstructor}
        error={constructor.constructorError}
        componentDraft={constructor.componentDraft}
        componentOptions={constructor.componentOptions}
        componentOptionsLoading={constructor.componentOptionsLoading}
        componentSearch={constructor.componentSearch}
        onClose={constructor.closeConstructor}
        onSave={constructor.saveConstructor}
        onAddComponent={constructor.addComponent}
        onRemoveComponent={constructor.removeComponent}
        onDraftChange={constructor.setComponentDraft}
        onSearchChange={constructor.setComponentSearch}
      />

      <AddItemDialog
        open={itemDialogOpen}
        activeType={catalog.activeType}
        form={itemForm}
        saving={savingItem}
        error={saveError}
        onClose={() => setItemDialogOpen(false)}
        onSave={handleSaveItem}
        onFormChange={(patch) => setItemForm((previousValue) => ({ ...previousValue, ...patch }))}
      />
    </Box>
  );
}
