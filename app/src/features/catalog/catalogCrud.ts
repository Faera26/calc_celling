import { supabase } from '../../supabaseClient';
import { restCount } from '../../supabaseRest';
import type { CatalogItem, CatalogType, ItemForm, UzelItem } from '../../types';
import { categoryId, tableOf } from '../../utils';

export type CatalogDialogMode = 'create' | 'edit';

export interface CatalogCategoryPath {
  category: string;
  subcategory: string;
}

interface CatalogPayloadBase extends Record<string, unknown> {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  unit: string;
  image: string | null;
  description: string | null;
}

type CatalogPayloadMap = {
  tovar: CatalogPayloadBase & { source: string };
  usluga: CatalogPayloadBase & { source: string };
  uzel: CatalogPayloadBase & { stats: Record<string, unknown> | null };
};

export type CatalogPayload<T extends CatalogType> = CatalogPayloadMap[T];

export interface BuildCatalogPayloadResult<T extends CatalogType> {
  payload: CatalogPayload<T>;
  categoryPath: CatalogCategoryPath;
}

function normalizeText(value: string) {
  return value.trim();
}

export function normalizeCategoryPath(category: string, subcategory: string): CatalogCategoryPath {
  return {
    category: normalizeText(category) || 'Без категории',
    subcategory: normalizeText(subcategory) || 'Без подкатегории',
  };
}

export function validateCatalogItemForm(form: ItemForm) {
  if (!normalizeText(form.name)) {
    return 'Укажи название позиции.';
  }

  if (!normalizeText(form.unit)) {
    return 'Укажи единицу измерения.';
  }

  const price = Number(form.price);
  if (!Number.isFinite(price) || price < 0) {
    return 'Цена должна быть числом не меньше нуля.';
  }

  return '';
}

export function itemFormFromCatalogItem(item: CatalogItem): ItemForm {
  return {
    id: item.id,
    name: item.name || '',
    category: item.category || '',
    subcategory: item.subcategory || '',
    price: String(Number(item.price || 0)),
    unit: item.unit || '',
    image: item.image || '',
    description: item.description || '',
  };
}

function nodeStatsOf(item?: CatalogItem | null) {
  if (!item) {
    return {
      positions: 0,
      products: 0,
      services: 0,
      source: 'manual_created',
    };
  }

  return ((item as UzelItem).stats as Record<string, unknown> | null) || {
    positions: 0,
    products: 0,
    services: 0,
    source: 'manual_created',
  };
}

export function buildCatalogPayload<T extends CatalogType>(
  type: T,
  form: ItemForm,
  existingItem?: CatalogItem | null,
): BuildCatalogPayloadResult<T> {
  const categoryPath = normalizeCategoryPath(form.category, form.subcategory);
  const basePayload: CatalogPayloadBase = {
    id: normalizeText(form.id) || existingItem?.id || crypto.randomUUID(),
    name: normalizeText(form.name),
    category: categoryPath.category,
    subcategory: categoryPath.subcategory,
    price: Number(form.price || 0),
    unit: normalizeText(form.unit),
    image: normalizeText(form.image) || null,
    description: normalizeText(form.description) || null,
  };

  if (type === 'uzel') {
    return {
      payload: {
        ...basePayload,
        stats: nodeStatsOf(existingItem),
      } as CatalogPayload<T>,
      categoryPath,
    };
  }

  return {
    payload: {
      ...basePayload,
      source: normalizeText(existingItem?.source || '') || 'manual',
    } as CatalogPayload<T>,
    categoryPath,
  };
}

function uniqueCategoryPaths(paths: CatalogCategoryPath[]) {
  const seen = new Set<string>();

  return paths.filter((path) => {
    const key = `${path.category}::${path.subcategory}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function syncCatalogCategories(type: CatalogType, paths: CatalogCategoryPath[]) {
  const normalizedPaths = uniqueCategoryPaths(
    paths.map((path) => normalizeCategoryPath(path.category, path.subcategory)),
  );

  await Promise.all(
    normalizedPaths.map(async (path) => {
      const count = await restCount(tableOf(type), {
        category: path.category,
        subcategory: path.subcategory,
      });

      const id = categoryId(type, path.category, path.subcategory);

      if (count > 0) {
        const { error } = await supabase.from('kategorii').upsert({
          id,
          entity_type: type,
          category: path.category,
          subcategory: path.subcategory,
          items_count: count,
          updated_at: new Date().toISOString(),
        });

        if (error) {
          throw error;
        }

        return;
      }

      const { error } = await supabase.from('kategorii').delete().eq('id', id);
      if (error) {
        throw error;
      }
    }),
  );
}
