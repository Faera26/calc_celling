import type { CatalogItem, CatalogType, ItemForm } from '../../types';
import { restDelete, restInsert, restUpdate } from '../../supabaseRest';
import {
  buildCatalogPayload,
  normalizeCategoryPath,
  syncCatalogCategories,
} from './catalogCrud';

interface SaveCatalogItemParams {
  type: CatalogType;
  mode: 'create' | 'edit';
  form: ItemForm;
  existingItem?: CatalogItem | null;
}

interface DeleteCatalogItemParams {
  type: CatalogType;
  item: CatalogItem;
}

function tableNameOf(type: CatalogType) {
  if (type === 'tovar') return 'tovary';
  if (type === 'usluga') return 'uslugi';
  return 'uzly';
}

export async function saveCatalogItemRecord({
  type,
  mode,
  form,
  existingItem,
}: SaveCatalogItemParams) {
  const table = tableNameOf(type);
  const previousCategoryPath = existingItem
    ? normalizeCategoryPath(existingItem.category, existingItem.subcategory)
    : null;
  const { payload, categoryPath } = buildCatalogPayload(type, form, existingItem);

  if (mode === 'create') {
    await restInsert(table, payload, { returning: 'minimal' });
  } else if (existingItem) {
    await restUpdate(table, payload, {
      filters: { id: existingItem.id },
      returning: 'minimal',
    });
  }

  await syncCatalogCategories(
    type,
    previousCategoryPath ? [previousCategoryPath, categoryPath] : [categoryPath],
  );
}

export async function deleteCatalogItemRecord({ type, item }: DeleteCatalogItemParams) {
  const table = tableNameOf(type);

  await restDelete(table, {
    filters: { id: item.id },
    returning: 'minimal',
  });

  await syncCatalogCategories(type, [
    normalizeCategoryPath(item.category, item.subcategory),
  ]);
}
