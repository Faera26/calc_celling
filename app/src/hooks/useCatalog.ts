import { useEffect, useState, useCallback } from 'react';
import { restCount, restSelect } from '../supabaseRest';
import { readStoredAuthUser } from '../supabaseClient';
import type {
  CatalogItem,
  CatalogType,
  CatalogCounts,
  CategoryGroup,
  CategoryRow,
  UzelComponent,
  UzelItem,
} from '../types';
import { ALL_OPTION, EMPTY_COUNTS, PAGE_SIZE } from '../constants';
import {
  buildCategoryGroups,
  catalogColumnsOf,
  cleanSearch,
  formatError,
  normalizeComponent,
  normalizeItem,
  tableOf,
  titleOf,
  withTimeout,
} from '../utils';

interface UseCatalogOptions {
  authReady: boolean;
  userId: string;
  userEmail: string;
}

const CATALOG_COUNTS_TIMEOUT_MS = 5000;
const CATALOG_DATA_TIMEOUT_MS = 8000;
const NODE_COMPONENTS_TIMEOUT_MS = 8000;
const CATALOG_COUNTS_DELAY_MS = 1500;

export function useCatalog({ authReady, userId, userEmail }: UseCatalogOptions) {
  const storedUser = readStoredAuthUser();
  const resolvedUserId = userId || storedUser?.id || '';
  const resolvedUserEmail = userEmail || storedUser?.email || '';
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [counts, setCounts] = useState<CatalogCounts>(EMPTY_COUNTS);
  const [loadError, setLoadError] = useState('');
  const [activeType, setActiveType] = useState<CatalogType>('uzel');
  const [activeCategory, setActiveCategory] = useState(ALL_OPTION);
  const [activeSubcategory, setActiveSubcategory] = useState(ALL_OPTION);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [nodeComponents, setNodeComponents] = useState<Record<string, UzelComponent[]>>({});
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  const filterIsActive = activeCategory !== ALL_OPTION || activeSubcategory !== ALL_OPTION || Boolean(debouncedSearch);
  const activeCount = counts[activeType] || 0;
  const totalPages = Math.max(1, Math.ceil(itemsTotal / PAGE_SIZE));
  const nextPageDisabled = !hasNextPage && page >= totalPages;

  const refresh = useCallback(() => setCatalogRefresh((prev) => prev + 1), []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setActiveCategory(ALL_OPTION);
    setActiveSubcategory(ALL_OPTION);
    setPage(1);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(cleanSearch(search));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setActiveCategory(ALL_OPTION);
    setActiveSubcategory(ALL_OPTION);
  }, [activeType]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeCategory, activeSubcategory]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!filterIsActive) setItemsTotal(activeCount);
  }, [filterIsActive, activeCount]);

  useEffect(() => {
    if (!authReady || !resolvedUserEmail) {
      setItems([]);
      setItemsTotal(0);
      setHasNextPage(false);
      setCategories([]);
      setCounts(EMPTY_COUNTS);
      setNodeComponents({});
      return;
    }
    if (!resolvedUserId) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void loadCounts();
    }, CATALOG_COUNTS_DELAY_MS);

    async function loadCounts() {
      // Счётчики вторичны: грузим их после первого экрана и по одному,
      // чтобы не создавать пачку параллельных запросов к Supabase.
      const countTargets: Array<[keyof CatalogCounts, string, string]> = [
        ['tovar', 'tovary', 'Счётчик товаров'],
        ['usluga', 'uslugi', 'Счётчик услуг'],
        ['uzel', 'uzly', 'Счётчик узлов'],
        ['komplektaciya', 'komplektaciya_uzlov', 'Счётчик комплектации узлов'],
      ];
      const nextCounts: CatalogCounts = { ...EMPTY_COUNTS };

      for (const [key, table, label] of countTargets) {
        try {
          nextCounts[key] = await withTimeout(
            restCount(table),
            label,
            CATALOG_COUNTS_TIMEOUT_MS,
          );
        } catch {
          nextCounts[key] = 0;
        }

        if (cancelled) return;
      }

      setCounts(nextCounts);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authReady, resolvedUserEmail, resolvedUserId, catalogRefresh]);

  useEffect(() => {
    if (!authReady || !resolvedUserEmail || !resolvedUserId) return;

    let cancelled = false;

    async function loadCatalogPage() {
      setItemsLoading(true);
      setCategoriesLoading(true);
      setLoadError('');

      try {
        const from = (page - 1) * PAGE_SIZE;
        const table = tableOf(activeType);
        const filters: Record<string, string> = {};

        if (activeCategory !== ALL_OPTION) filters.category = activeCategory;
        if (activeSubcategory !== ALL_OPTION) filters.subcategory = activeSubcategory;

        // Сначала показываем сам список позиций. Категории добираем после него,
        // чтобы пользователь быстрее увидел каталог, даже если боковые данные тормозят.
        const pageData = await withTimeout(
          restSelect<CatalogItem>(table, {
            select: catalogColumnsOf(activeType),
            filters,
            order: 'name.asc',
            limit: PAGE_SIZE + 1,
            offset: from,
            search: debouncedSearch,
          }),
          `${titleOf(activeType)}: страница ${page}`,
          CATALOG_DATA_TIMEOUT_MS,
        );

        if (cancelled) return;

        const rows = ((pageData || []) as CatalogItem[]).map((item) => normalizeItem(item));
        const visibleRows = rows.slice(0, PAGE_SIZE);
        const nextExists = rows.length > PAGE_SIZE;
        const fallbackTotal = from + visibleRows.length + (nextExists ? 1 : 0);
        const unfilteredTotal = activeCount || fallbackTotal;

        setItems(visibleRows);
        setHasNextPage(nextExists);
        setItemsTotal(filterIsActive ? fallbackTotal : unfilteredTotal);

        try {
          const categoryData = await withTimeout(
            restSelect<CategoryRow>('kategorii', {
              select: 'category,subcategory,items_count',
              filters: { entity_type: activeType },
              order: 'category.asc,subcategory.asc',
            }),
            'Категории',
            CATALOG_DATA_TIMEOUT_MS,
          );

          if (cancelled) return;
          setCategories(buildCategoryGroups(categoryData || []));
        } catch (error) {
          if (cancelled) return;
          setCategories([]);
          console.warn('Не удалось загрузить категории каталога:', error);
        }
      } catch (error) {
        if (cancelled) return;
        setItems([]);
        setItemsTotal(0);
        setHasNextPage(false);
        setCategories([]);
        setLoadError(formatError(error));
      } finally {
        if (!cancelled) {
          setItemsLoading(false);
          setCategoriesLoading(false);
        }
      }
    }

    void loadCatalogPage();
    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    resolvedUserEmail,
    resolvedUserId,
    activeType,
    activeCategory,
    activeSubcategory,
    debouncedSearch,
    page,
    catalogRefresh,
    activeCount,
    filterIsActive,
  ]);

  async function loadNodeComponents(nodeId: string, force = false) {
    if (!force && nodeComponents[nodeId]) return nodeComponents[nodeId];

    const data = await withTimeout(
      restSelect<UzelComponent>('komplektaciya_uzlov', {
        select: '*',
        filters: { uzel_id: nodeId },
        order: 'position_index.asc',
      }),
      'Комплектация узла',
      NODE_COMPONENTS_TIMEOUT_MS,
    );

    const rows = ((data || []) as UzelComponent[]).map((row) => normalizeComponent(row));
    setNodeComponents((prev) => ({ ...prev, [nodeId]: rows }));
    return rows;
  }

  function updateItemInList(updatedItem: CatalogItem) {
    setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
  }

  function updateNodeComponents(nodeId: string, rows: UzelComponent[]) {
    setNodeComponents((prev) => ({ ...prev, [nodeId]: rows }));
  }

  return {
    items,
    itemsTotal,
    hasNextPage,
    itemsLoading,
    categories,
    categoriesLoading,
    counts,
    loadError,
    setLoadError,
    activeType,
    setActiveType,
    activeCategory,
    setActiveCategory,
    activeSubcategory,
    setActiveSubcategory,
    search,
    setSearch,
    debouncedSearch,
    page,
    setPage,
    filterIsActive,
    totalPages,
    nextPageDisabled,
    nodeComponents,
    loadNodeComponents,
    updateItemInList,
    updateNodeComponents,
    refresh,
    resetFilters,
  };
}

export async function openNodeDetails(
  node: UzelItem,
  loadFn: (id: string) => Promise<UzelComponent[]>,
  setLoading: (v: boolean) => void,
  setError: (v: string) => void,
) {
  setLoading(true);
  try {
    await loadFn(node.id);
  } catch (error) {
    setError(formatError(error));
  } finally {
    setLoading(false);
  }
}
