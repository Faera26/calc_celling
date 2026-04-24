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
  initialType: CatalogType;
}

type SubcategorySummary = CategoryGroup['subcategories'][number];

const CATALOG_COUNTS_TIMEOUT_MS = 5000;
const CATALOG_DATA_TIMEOUT_MS = 8000;
const NODE_COMPONENTS_TIMEOUT_MS = 8000;
const CATALOG_COUNTS_DELAY_MS = 1500;

function normalizeCategory(value: string | null | undefined) {
  return value || 'Без категории';
}

function normalizeSubcategory(value: string | null | undefined) {
  return value || 'Без подкатегории';
}

function buildCategorySummary(rows: CategoryRow[]) {
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    const category = normalizeCategory(row.category);
    const count = Number(row.items_count || 0);
    totals.set(category, (totals.get(category) || 0) + count);
  });

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ru'))
    .map(([category, total]) => ({
      category,
      total,
      subcategories: [],
    }));
}

function buildSubcategorySummary(rows: CategoryRow[]) {
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    const subcategory = normalizeSubcategory(row.subcategory);
    const count = Number(row.items_count || 0);
    totals.set(subcategory, (totals.get(subcategory) || 0) + count);
  });

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ru'))
    .map(([name, count]) => ({ name, count }));
}

export function useCatalog({ authReady, userId, userEmail, initialType }: UseCatalogOptions) {
  const storedUser = readStoredAuthUser();
  const resolvedUserId = userId || storedUser?.id || '';
  const resolvedUserEmail = userEmail || storedUser?.email || '';
  const [activeType, setActiveType] = useState<CatalogType>(initialType);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<string, SubcategorySummary[]>>({});
  const [counts, setCounts] = useState<CatalogCounts>(EMPTY_COUNTS);
  const [loadError, setLoadError] = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_OPTION);
  const [activeSubcategory, setActiveSubcategory] = useState(ALL_OPTION);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [nodeComponents, setNodeComponents] = useState<Record<string, UzelComponent[]>>({});
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  const selectionReady = activeCategory !== ALL_OPTION && activeSubcategory !== ALL_OPTION;
  const searchReady = Boolean(debouncedSearch);
  const itemsReady = selectionReady || searchReady;
  const filterIsActive = activeCategory !== ALL_OPTION || activeSubcategory !== ALL_OPTION || Boolean(debouncedSearch);
  const totalPages = Math.max(1, Math.ceil(itemsTotal / PAGE_SIZE));
  const nextPageDisabled = !hasNextPage && page >= totalPages;
  const activeSubcategories = activeCategory === ALL_OPTION
    ? []
    : subcategoriesByCategory[activeCategory] || [];

  const refresh = useCallback(() => {
    setCategoriesLoaded(false);
    setSubcategoriesByCategory({});
    setCatalogRefresh((prev) => prev + 1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setActiveCategory(ALL_OPTION);
    setActiveSubcategory(ALL_OPTION);
    setPage(1);
    setItems([]);
    setItemsTotal(0);
    setHasNextPage(false);
  }, []);

  useEffect(() => {
    setActiveType(initialType);
  }, [initialType]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(cleanSearch(search));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // При переходе между страницами каталогов начинаем выбор заново,
    // чтобы не тянуть подкатегории и позиции от другого раздела.
    setCategories([]);
    setCategoriesLoaded(false);
    setSubcategoriesByCategory({});
    setActiveCategory(ALL_OPTION);
    setActiveSubcategory(ALL_OPTION);
    setItems([]);
    setItemsTotal(0);
    setHasNextPage(false);
    setPage(1);
  }, [activeType]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeSubcategory]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!authReady || !resolvedUserEmail) {
      setItems([]);
      setItemsTotal(0);
      setHasNextPage(false);
      setCategories([]);
      setCategoriesLoaded(false);
      setSubcategoriesByCategory({});
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

  const ensureCategoriesLoaded = useCallback(async (force = false) => {
    if (!authReady || !resolvedUserEmail || !resolvedUserId) return [];
    if (categoriesLoaded && !force) return categories;

    setCategoriesLoading(true);
    setLoadError('');

    try {
      const rows = await withTimeout(
        restSelect<CategoryRow>('kategorii', {
          select: 'category,items_count',
          filters: { entity_type: activeType },
          order: 'category.asc',
        }),
        `${titleOf(activeType)}: категории`,
        CATALOG_DATA_TIMEOUT_MS,
      );

      const nextCategories = buildCategorySummary(rows || []);
      setCategories(nextCategories);
      setCategoriesLoaded(true);
      return nextCategories;
    } catch (error) {
      setCategories([]);
      setCategoriesLoaded(false);
      setLoadError(formatError(error));
      return [];
    } finally {
      setCategoriesLoading(false);
    }
  }, [activeType, authReady, categories, categoriesLoaded, resolvedUserEmail, resolvedUserId]);

  const ensureSubcategoriesLoaded = useCallback(async (category: string, force = false) => {
    if (!category || category === ALL_OPTION) return [];
    if (!authReady || !resolvedUserEmail || !resolvedUserId) return [];

    const cachedRows = subcategoriesByCategory[category];
    if (cachedRows && !force) return cachedRows;

    setSubcategoriesLoading(true);
    setLoadError('');

    try {
      const rows = await withTimeout(
        restSelect<CategoryRow>('kategorii', {
          select: 'subcategory,items_count',
          filters: { entity_type: activeType, category },
          order: 'subcategory.asc',
        }),
        `${titleOf(activeType)}: подкатегории`,
        CATALOG_DATA_TIMEOUT_MS,
      );

      const nextSubcategories = buildSubcategorySummary(rows || []);
      setSubcategoriesByCategory((prev) => ({ ...prev, [category]: nextSubcategories }));
      return nextSubcategories;
    } catch (error) {
      setLoadError(formatError(error));
      return [];
    } finally {
      setSubcategoriesLoading(false);
    }
  }, [activeType, authReady, resolvedUserEmail, resolvedUserId, subcategoriesByCategory]);

  const selectCategory = useCallback(async (category: string) => {
    setActiveCategory(category);
    setActiveSubcategory(ALL_OPTION);
    setPage(1);
    setItems([]);
    setItemsTotal(0);
    setHasNextPage(false);

    if (category !== ALL_OPTION) {
      await ensureSubcategoriesLoaded(category);
    }
  }, [ensureSubcategoriesLoaded]);

  const selectSubcategory = useCallback((subcategory: string) => {
    setActiveSubcategory(subcategory);
    setPage(1);
  }, []);

  useEffect(() => {
    if (!authReady || !resolvedUserEmail || !resolvedUserId) return;

    if (!itemsReady) {
      setItems([]);
      setItemsTotal(0);
      setHasNextPage(false);
      return;
    }

    let cancelled = false;

    async function loadCatalogPage() {
      setItemsLoading(true);
      setLoadError('');

      try {
        const from = (page - 1) * PAGE_SIZE;
        const table = tableOf(activeType);
        const filters = {
          ...(activeCategory !== ALL_OPTION ? { category: activeCategory } : {}),
          ...(activeSubcategory !== ALL_OPTION ? { subcategory: activeSubcategory } : {}),
        };

        // Без поиска каталог остаётся ленивым: грузим позиции только после выбора подкатегории.
        // Если менеджер ищет по названию, даём быстрый глобальный поиск без лишних кликов.
        const [pageData, totalCount] = await Promise.all([
          withTimeout(
            restSelect<CatalogItem>(table, {
              select: activeType === 'uzel'
                ? 'id,name,category,subcategory,price,unit,image,description,stats'
                : 'id,name,category,subcategory,price,unit,image,description,source',
              filters,
              order: 'name.asc',
              limit: PAGE_SIZE + 1,
              offset: from,
              search: debouncedSearch,
            }),
            `${titleOf(activeType)}: страница ${page}`,
            CATALOG_DATA_TIMEOUT_MS,
          ),
          withTimeout(
            restCount(table, filters, debouncedSearch),
            `${titleOf(activeType)}: количество позиций`,
            CATALOG_DATA_TIMEOUT_MS,
          ),
        ]);

        if (cancelled) return;

        const rows = ((pageData || []) as CatalogItem[]).map((item) => normalizeItem(item));
        setItems(rows.slice(0, PAGE_SIZE));
        setHasNextPage(rows.length > PAGE_SIZE);
        setItemsTotal(totalCount);
      } catch (error) {
        if (cancelled) return;
        setItems([]);
        setItemsTotal(0);
        setHasNextPage(false);
        setLoadError(formatError(error));
      } finally {
        if (!cancelled) {
          setItemsLoading(false);
        }
      }
    }

    void loadCatalogPage();

    return () => {
      cancelled = true;
    };
  }, [
    activeCategory,
    activeSubcategory,
    activeType,
    authReady,
    debouncedSearch,
    page,
    resolvedUserEmail,
    resolvedUserId,
    itemsReady,
    catalogRefresh,
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
    categoriesLoaded,
    categoriesLoading,
    subcategories: activeSubcategories,
    subcategoriesLoading,
    counts,
    loadError,
    setLoadError,
    activeType,
    activeCategory,
    activeSubcategory,
    search,
    setSearch,
    debouncedSearch,
    page,
    setPage,
    filterIsActive,
    selectionReady,
    searchReady,
    itemsReady,
    totalPages,
    nextPageDisabled,
    nodeComponents,
    ensureCategoriesLoaded,
    ensureSubcategoriesLoaded,
    selectCategory,
    selectSubcategory,
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
