import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type {
  AuthState,
  CatalogItem,
  CatalogType,
  CartEntry,
  CompanySettings,
  ItemForm,
  UzelComponent,
  UzelItem,
} from '../types';
import { ALL_OPTION, EMPTY_ITEM_FORM } from '../constants';
import { useCatalog, openNodeDetails } from '../hooks/useCatalog';
import { useConstructor } from '../hooks/useConstructor';
import StatCards from '../components/StatCards';
import CatalogGrid from '../components/CatalogGrid';
import PaginationControls from '../components/PaginationControls';
import EmptyState from '../components/EmptyState';
import NodeDetailsDialog from '../components/NodeDetailsDialog';
import ConstructorDialog from '../components/ConstructorDialog';
import AddItemDialog from '../components/AddItemDialog';
import CatalogItemDetailsDialog from '../components/CatalogItemDetailsDialog';
import CatalogTypeSwitcher from '../components/CatalogTypeSwitcher';
import CatalogHierarchyPicker from '../components/CatalogHierarchyPicker';
import { supabase } from '../supabaseClient';
import { formatError, readImageAsDataUrl, titleOf, withTimeout } from '../utils';

interface CatalogPageProps {
  auth: AuthState;
  settings: CompanySettings;
  cart: Record<string, CartEntry>;
  initialType: CatalogType;
  onAddToCart: (type: CatalogType, item: CatalogItem, components?: UzelComponent[]) => void;
  onRemoveFromCart: (cartKey: string) => void;
  search: string;
  catalogRefreshToggle: number;
}

export default function CatalogPage({
  auth,
  settings,
  cart,
  initialType,
  onAddToCart,
  onRemoveFromCart,
  search,
  catalogRefreshToggle,
}: CatalogPageProps) {
  const catalog = useCatalog({
    authReady: auth.ready,
    userId: auth.userId,
    userEmail: auth.userEmail,
    initialType,
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
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [nodeDetailsLoading, setNodeDetailsLoading] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM_FORM);
  const [savingItem, setSavingItem] = useState(false);
  const [saveError, setSaveError] = useState('');
  const catalogSearchValue = catalog.search;
  const setCatalogSearch = catalog.setSearch;
  const refreshCatalog = catalog.refresh;

  useEffect(() => {
    if (catalogSearchValue !== search) {
      setCatalogSearch(search);
    }
  }, [search, catalogSearchValue, setCatalogSearch]);

  useEffect(() => {
    if (catalogRefreshToggle > 0) {
      refreshCatalog();
    }
  }, [catalogRefreshToggle, refreshCatalog]);

  function handleViewNode(item: CatalogItem) {
    if (catalog.activeType !== 'uzel') return;

    const node = item as UzelItem;
    setSelectedNode(node);
    openNodeDetails(node, catalog.loadNodeComponents, setNodeDetailsLoading, catalog.setLoadError);
  }

  function handleOpenDetails(item: CatalogItem) {
    setSelectedItem(item);
  }

  function handleOpenConstructor(item: CatalogItem) {
    if (catalog.activeType !== 'uzel') return;

    const node = item as UzelItem;
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

  async function handleItemImageUpload(file?: File) {
    if (!file) return;

    try {
      const image = await readImageAsDataUrl(file);
      setItemForm((previousValue) => ({ ...previousValue, image }));
    } catch (error) {
      setSaveError(formatError(error));
    }
  }

  const selectionHint = !catalog.selectionReady
    ? 'Выбери категорию и подкатегорию. Только после этого подгрузится страница позиций.'
    : '';

  return (
    <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
      <CatalogTypeSwitcher activeType={catalog.activeType} />

      <StatCards counts={catalog.counts} />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        sx={{
          mt: 3,
          mb: 2,
          alignItems: { md: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            {titleOf(catalog.activeType)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ленивый каталог: сначала раздел, затем подкатегория, затем страница позиций.
          </Typography>
        </Box>

        {auth.isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setItemDialogOpen(true)}>
            Добавить позицию
          </Button>
        )}
      </Stack>

      <CatalogHierarchyPicker
        title={`Навигация по каталогу ${titleOf(catalog.activeType).toLowerCase()}`}
        categories={catalog.categories}
        categoriesLoaded={catalog.categoriesLoaded}
        categoriesLoading={catalog.categoriesLoading}
        subcategories={catalog.subcategories}
        subcategoriesLoading={catalog.subcategoriesLoading}
        activeCategory={catalog.activeCategory}
        activeSubcategory={catalog.activeSubcategory}
        onOpenCategories={() => {
          void catalog.ensureCategoriesLoaded();
        }}
        onOpenSubcategories={() => {
          if (catalog.activeCategory !== ALL_OPTION) {
            void catalog.ensureSubcategoriesLoaded(catalog.activeCategory);
          }
        }}
        onSelectCategory={(category) => {
          void catalog.selectCategory(category);
        }}
        onSelectSubcategory={catalog.selectSubcategory}
      />

      {catalog.loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => catalog.setLoadError('')}>
          Не удалось загрузить данные из Supabase: {catalog.loadError}
        </Alert>
      )}

      {selectionHint && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {selectionHint}
        </Alert>
      )}

      {catalog.selectionReady && (
        <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {catalog.itemsTotal.toLocaleString('ru-RU')} позиций
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {catalog.activeCategory} → {catalog.activeSubcategory}
          </Typography>
        </Stack>
      )}

      {catalog.selectionReady && (
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
          onOpenDetails={handleOpenDetails}
        />
      )}

      {catalog.selectionReady && !catalog.itemsLoading && catalog.items.length === 0 && (
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

      {catalog.selectionReady && (
        <PaginationControls
          page={catalog.page}
          totalPages={catalog.totalPages}
          nextPageDisabled={catalog.nextPageDisabled}
          onPageChange={catalog.setPage}
        />
      )}

      <NodeDetailsDialog
        node={selectedNode}
        rows={selectedNode ? catalog.nodeComponents[selectedNode.id] || [] : []}
        loading={nodeDetailsLoading}
        isAdmin={auth.isAdmin}
        onClose={() => setSelectedNode(null)}
        onAddToCart={() => {
          if (selectedNode) {
            void handleAddToCart('uzel', selectedNode);
          }
          setSelectedNode(null);
        }}
        onOpenConstructor={() => {
          if (selectedNode) {
            handleOpenConstructor(selectedNode);
          }
        }}
      />

      <CatalogItemDetailsDialog
        open={Boolean(selectedItem)}
        item={selectedItem}
        activeType={catalog.activeType}
        settings={settings}
        cachedComponents={selectedItem ? catalog.nodeComponents[selectedItem.id] || [] : []}
        isAdmin={auth.isAdmin}
        onClose={() => setSelectedItem(null)}
        onAddToCart={selectedItem ? () => {
          void handleAddToCart(catalog.activeType, selectedItem);
          setSelectedItem(null);
        } : undefined}
        onOpenConstructor={selectedItem && catalog.activeType === 'uzel'
          ? () => {
            handleOpenConstructor(selectedItem);
            setSelectedItem(null);
          }
          : undefined}
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
        onImageUpload={handleItemImageUpload}
      />
    </Box>
  );
}
