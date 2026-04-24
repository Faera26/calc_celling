import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
  DeleteOutlined as DeleteOutlineIcon,
} from '@mui/icons-material';
import type {
  AuthState,
  CatalogItem,
  CatalogType,
  CompanySettings,
  ItemForm,
  UzelItem,
} from '../types';
import { EMPTY_ITEM_FORM } from '../constants';
import { useCatalog, openNodeDetails } from '../hooks/useCatalog';
import { useConstructor } from '../hooks/useConstructor';
import CatalogGrid from '../components/CatalogGrid';
import AddItemDialog from '../components/AddItemDialog';
import CatalogItemDetailsDialog from '../components/CatalogItemDetailsDialog';
import CatalogHierarchyPicker from '../components/CatalogHierarchyPicker';
import ConfirmDialog from '../components/ConfirmDialog';
import ConstructorDialog from '../components/ConstructorDialog';
import EmptyState from '../components/EmptyState';
import NodeDetailsDialog from '../components/NodeDetailsDialog';
import PaginationControls from '../components/PaginationControls';
import { formatError, readImageAsDataUrl, titleOf } from '../utils';
import {
  itemFormFromCatalogItem,
  validateCatalogItemForm,
} from '../features/catalog/catalogCrud';
import { APP_ROUTES } from '../features/app/navigation';
import { deleteCatalogItemRecord, saveCatalogItemRecord } from '../features/catalog/catalogManagerService';

interface CatalogManagerPageProps {
  auth: AuthState;
  settings: CompanySettings;
  search: string;
  catalogRefreshToggle: number;
}

const MANAGER_TABS: Array<{ type: CatalogType; label: string; eyebrow: string; subtitle: string }> = [
  { type: 'tovar', label: 'Товары', eyebrow: 'Price Book', subtitle: 'Материалы, полотна и комплектующие' },
  { type: 'usluga', label: 'Услуги', eyebrow: 'Labor', subtitle: 'Монтаж, выезды и сервисные работы' },
  { type: 'uzel', label: 'Узлы', eyebrow: 'Assemblies', subtitle: 'Готовые сборки и продающие решения' },
];

function catalogTypeFromQuery(value: string | null): CatalogType {
  if (value === 'uzel' || value === 'usluga') {
    return value;
  }

  return 'tovar';
}

function managerStatCards(settings: CompanySettings) {
  return [
    { label: 'Маржа', value: `${Number(settings.marginPercent || 0)}%`, note: 'Наценка каталога' },
    { label: 'Скидка', value: `${Number(settings.discountPercent || 0)}%`, note: 'Текущий дисконт' },
    { label: 'PDF', value: settings.companyName || 'SmartCeiling', note: 'Бренд в КП' },
  ];
}

export default function CatalogManagerPage({
  auth,
  settings,
  search,
  catalogRefreshToggle,
}: CatalogManagerPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialType = catalogTypeFromQuery(searchParams.get('type'));
  const stats = useMemo(() => managerStatCards(settings), [settings]);

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM_FORM);
  const [saveError, setSaveError] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState('');
  const [notice, setNotice] = useState('');

  const catalogSearchValue = catalog.search;
  const setCatalogSearch = catalog.setSearch;
  const refreshCatalog = catalog.refresh;

  useEffect(() => {
    if (catalogSearchValue !== search) {
      setCatalogSearch(search);
    }
  }, [catalogSearchValue, search, setCatalogSearch]);

  useEffect(() => {
    if (catalogRefreshToggle > 0) {
      refreshCatalog();
    }
  }, [catalogRefreshToggle, refreshCatalog]);

  if (!auth.isAdmin) {
    return (
      <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
        <Alert severity="warning">
          Эта страница доступна только администратору.
        </Alert>
      </Box>
    );
  }

  function setType(nextType: CatalogType) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('type', nextType);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  function handleViewNode(item: CatalogItem) {
    if (catalog.activeType !== 'uzel') return;

    const node = item as UzelItem;
    setSelectedNode(node);
    openNodeDetails(node, catalog.loadNodeComponents, setNodeDetailsLoading, catalog.setLoadError);
  }

  function handleOpenConstructor(item: CatalogItem) {
    if (catalog.activeType !== 'uzel') return;

    const node = item as UzelItem;
    setSelectedNode(null);
    void constructor.openConstructor(node, catalog.loadNodeComponents);
  }

  function handleOpenDetails(item: CatalogItem) {
    setSelectedItem(item);
  }

  function openCreateDialog() {
    setDialogMode('create');
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
    setSaveError('');
    setDialogOpen(true);
  }

  function openEditDialog(item: CatalogItem) {
    setDialogMode('edit');
    setEditingItem(item);
    setItemForm(itemFormFromCatalogItem(item));
    setSaveError('');
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
    setSaveError('');
  }

  async function handleSaveItem() {
    const validationError = validateCatalogItemForm(itemForm);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSavingItem(true);
    setSaveError('');

    try {
      await saveCatalogItemRecord({
        type: catalog.activeType,
        mode: dialogMode,
        form: itemForm,
        existingItem: editingItem,
      });

      closeDialog();
      refreshCatalog();
      setNotice(dialogMode === 'create' ? 'Позиция добавлена в каталог.' : 'Карточка обновлена.');
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
      setItemForm((prev) => ({ ...prev, image }));
    } catch (error) {
      setSaveError(formatError(error));
    }
  }

  async function handleDeleteItem() {
    if (!deleteTarget) {
      return;
    }

    setDeletingItemId(deleteTarget.id);
    setSaveError('');

    try {
      await deleteCatalogItemRecord({
        type: catalog.activeType,
        item: deleteTarget,
      });

      if (selectedNode?.id === deleteTarget.id) {
        setSelectedNode(null);
      }

      setDeleteTarget(null);
      refreshCatalog();
      setNotice('Позиция удалена из каталога.');
    } catch (error) {
      setSaveError(formatError(error));
    } finally {
      setDeletingItemId('');
    }
  }

  const selectionHint = !catalog.itemsReady
    ? 'Выбери категорию и подкатегорию или начни поиск по названию позиции.'
    : '';
  const resultScope = catalog.searchReady
    ? `Поиск: ${catalog.debouncedSearch}${catalog.selectionReady ? ` • ${catalog.activeCategory} → ${catalog.activeSubcategory}` : ''}`
    : `${catalog.activeCategory} → ${catalog.activeSubcategory}`;

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1680, mx: 'auto' }}>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '36px',
          p: '1px',
          background: 'linear-gradient(135deg, rgba(11,92,173,0.24), rgba(35,156,140,0.18), rgba(255,255,255,0.9))',
          mb: 3,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at top left, rgba(17,120,198,0.22), transparent 30%), radial-gradient(circle at bottom right, rgba(44,174,154,0.18), transparent 28%)',
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
            boxShadow: '0 24px 80px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ alignItems: { lg: 'flex-end' }, justifyContent: 'space-between' }}>
              <Box sx={{ maxWidth: 860 }}>
                <Chip
                  icon={<AutoAwesomeIcon />}
                  label="Premium Catalog Control"
                  sx={{
                    mb: 2,
                    borderRadius: '999px',
                    bgcolor: 'rgba(11,92,173,0.08)',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                />

                <Typography
                  sx={{
                    fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
                    fontSize: { xs: '2rem', md: '3.2rem' },
                    lineHeight: 0.98,
                    fontWeight: 900,
                    color: '#082B4C',
                    maxWidth: 900,
                  }}
                >
                  Управляй каталогом как продуктом, а не как складом.
                </Typography>

                <Typography
                  sx={{
                    mt: 2,
                    maxWidth: 720,
                    color: 'rgba(8,43,76,0.72)',
                    fontSize: { xs: '0.98rem', md: '1.05rem' },
                    lineHeight: 1.7,
                  }}
                >
                  Здесь администратор управляет товарами, услугами и узлами в одном премиальном интерфейсе:
                  быстрые правки, ленивые фильтры, карточки без складского вайба и понятный путь до продающей сметы.
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Button
                  variant="outlined"
                  component={Link}
                  href={APP_ROUTES.admin}
                  sx={{
                    borderRadius: '999px',
                    px: 2.5,
                    py: 1.2,
                    textTransform: 'none',
                  }}
                >
                  Пользователи
                </Button>

                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreateDialog}
                  sx={{
                    borderRadius: '999px',
                    px: 2.75,
                    py: 1.2,
                    textTransform: 'none',
                    boxShadow: '0 20px 40px rgba(11,92,173,0.20)',
                  }}
                >
                  Новая позиция
                </Button>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              {MANAGER_TABS.map((tab) => {
                const isActive = tab.type === catalog.activeType;

                return (
                  <Button
                    key={tab.type}
                    onClick={() => setType(tab.type)}
                    sx={{
                      flex: 1,
                      p: 0.75,
                      borderRadius: '28px',
                      textTransform: 'none',
                      border: '1px solid rgba(8,43,76,0.08)',
                      bgcolor: isActive ? 'rgba(11,92,173,0.10)' : 'rgba(255,255,255,0.72)',
                      transition: 'transform 700ms cubic-bezier(0.32,0.72,0,1), background-color 700ms cubic-bezier(0.32,0.72,0,1)',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        bgcolor: isActive ? 'rgba(11,92,173,0.14)' : 'rgba(255,255,255,0.88)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        borderRadius: '24px',
                        px: { xs: 2, md: 2.5 },
                        py: 2,
                        textAlign: 'left',
                        bgcolor: isActive ? 'rgba(255,255,255,0.82)' : 'transparent',
                      }}
                    >
                      <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(8,43,76,0.5)', fontWeight: 800 }}>
                        {tab.eyebrow}
                      </Typography>
                      <Typography sx={{ mt: 0.75, fontSize: '1.35rem', fontWeight: 800, color: '#082B4C' }}>
                        {tab.label}
                      </Typography>
                      <Typography sx={{ mt: 0.5, fontSize: '0.94rem', color: 'rgba(8,43,76,0.68)' }}>
                        {tab.subtitle}
                      </Typography>
                    </Box>
                  </Button>
                );
              })}
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              {stats.map((stat) => (
                <Box
                  key={stat.label}
                  sx={{
                    flex: 1,
                    p: '1px',
                    borderRadius: '26px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(8,43,76,0.08))',
                  }}
                >
                  <Box
                    sx={{
                      borderRadius: '25px',
                      px: 2.25,
                      py: 2,
                      bgcolor: 'rgba(255,255,255,0.82)',
                    }}
                  >
                    <Typography sx={{ color: 'rgba(8,43,76,0.55)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
                      {stat.label}
                    </Typography>
                    <Typography sx={{ mt: 0.5, fontSize: '1.55rem', fontWeight: 800, color: '#082B4C' }}>
                      {stat.value}
                    </Typography>
                    <Typography sx={{ mt: 0.25, color: 'rgba(8,43,76,0.58)' }}>
                      {stat.note}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Box>
      </Box>

      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      {catalog.loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => catalog.setLoadError('')}>
          Не удалось загрузить данные: {catalog.loadError}
        </Alert>
      )}

      {saveError && !dialogOpen && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}

      <Box
        sx={{
          p: '1px',
          borderRadius: '32px',
          background: 'linear-gradient(160deg, rgba(8,43,76,0.12), rgba(11,92,173,0.04), rgba(255,255,255,0.9))',
        }}
      >
        <Box
          sx={{
            borderRadius: '31px',
            px: { xs: 2, md: 3 },
            py: { xs: 2.25, md: 3 },
            bgcolor: 'rgba(255,255,255,0.94)',
          }}
        >
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: { lg: 'center' }, justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.8rem' }, fontWeight: 800, color: '#082B4C' }}>
                  {titleOf(catalog.activeType)}
                </Typography>
                <Typography sx={{ mt: 0.75, color: 'rgba(8,43,76,0.64)', maxWidth: 760 }}>
                  Категории и подкатегории подгружаются только по клику, а позиции листаются страницами. Так панель остаётся быстрой даже на большом каталоге.
                </Typography>
              </Box>

              {catalog.itemsReady && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Chip label={`${catalog.itemsTotal.toLocaleString('ru-RU')} поз.`} sx={{ borderRadius: '999px', fontWeight: 700 }} />
                  <Chip label={resultScope} sx={{ borderRadius: '999px', fontWeight: 700 }} />
                </Stack>
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
                void catalog.ensureSubcategoriesLoaded(catalog.activeCategory);
              }}
              onSelectCategory={(category) => {
                void catalog.selectCategory(category);
              }}
              onSelectSubcategory={catalog.selectSubcategory}
            />

            {selectionHint && (
              <Alert severity="info">{selectionHint}</Alert>
            )}

            {catalog.itemsReady && (
              <>
                <CatalogGrid
                  items={catalog.items}
                  activeType={catalog.activeType}
                  isAdmin={auth.isAdmin}
                  nodeComponents={catalog.nodeComponents}
                  settings={settings}
                  loading={catalog.itemsLoading}
                  mode="manage"
                  deletingItemId={deletingItemId}
                  onViewNode={handleViewNode}
                  onOpenConstructor={handleOpenConstructor}
                  onOpenDetails={handleOpenDetails}
                  onEditItem={openEditDialog}
                  onDeleteItem={setDeleteTarget}
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
              </>
            )}
          </Stack>
        </Box>
      </Box>

      <NodeDetailsDialog
        node={selectedNode}
        rows={selectedNode ? catalog.nodeComponents[selectedNode.id] || [] : []}
        loading={nodeDetailsLoading}
        isAdmin={auth.isAdmin}
        onClose={() => setSelectedNode(null)}
        onAddToCart={() => setSelectedNode(null)}
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
        onEdit={selectedItem ? () => {
          openEditDialog(selectedItem);
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
        onUpdateComponent={constructor.updateComponent}
        onDraftChange={constructor.setComponentDraft}
        onSearchChange={constructor.setComponentSearch}
      />

      <AddItemDialog
        open={dialogOpen}
        activeType={catalog.activeType}
        mode={dialogMode}
        form={itemForm}
        saving={savingItem}
        error={saveError}
        onClose={closeDialog}
        onSave={handleSaveItem}
        onFormChange={(patch) => setItemForm((prev) => ({ ...prev, ...patch }))}
        onImageUpload={handleItemImageUpload}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить позицию?"
        description={deleteTarget ? `Карточка «${deleteTarget.name}» будет удалена из каталога.` : ''}
        confirmLabel="Удалить"
        confirmColor="error"
        tone="danger"
        loading={deletingItemId === deleteTarget?.id}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteItem}
      >
        <Stack spacing={1.25}>
          <Typography color="text.secondary">
            Уже сохранённые сметы не пострадают: snapshot внутри них останется неизменным.
          </Typography>
          <Alert severity="warning" icon={<DeleteOutlineIcon />}>
            Это действие нельзя отменить из интерфейса.
          </Alert>
        </Stack>
      </ConfirmDialog>
    </Box>
  );
}
