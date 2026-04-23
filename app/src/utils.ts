import type {
  CatalogItem,
  CatalogType,
  CategoryGroup,
  CategoryRow,
  CompanySettings,
  ComponentType,
  UzelComponent,
  UzelItem,
} from './types';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from './constants';

/* ---------- Formatting ---------- */

export function money(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString('ru-RU')} ₽`;
}

export function roundPrice(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function adjustedPrice(price: number, settings: CompanySettings) {
  const withMargin = Number(price || 0) * (1 + Number(settings.marginPercent || 0) / 100);
  return roundPrice(withMargin * (1 - Number(settings.discountPercent || 0) / 100));
}

/* ---------- Keys & table mapping ---------- */

export function keyOf(type: CatalogType, id: string) {
  return `${type}:${id}`;
}

export function tableOf(type: CatalogType | ComponentType) {
  if (type === 'tovar') return 'tovary';
  if (type === 'usluga') return 'uslugi';
  return 'uzly';
}

export function catalogColumnsOf(type: CatalogType | ComponentType) {
  if (type === 'uzel') return 'id,name,category,subcategory,price,unit,image,description,stats';
  return 'id,name,category,subcategory,price,unit,image,description,source';
}

/* ---------- Labels ---------- */

export function labelOf(type: CatalogType) {
  if (type === 'tovar') return 'Товар';
  if (type === 'usluga') return 'Услуга';
  return 'Узел';
}

export function titleOf(type: CatalogType) {
  if (type === 'tovar') return 'Товары';
  if (type === 'usluga') return 'Услуги';
  return 'Узлы';
}

/* ---------- Normalization ---------- */

export function normalizeItem<T extends CatalogItem>(item: T): T {
  return {
    ...item,
    category: item.category || 'Без категории',
    subcategory: item.subcategory || 'Без подкатегории',
    price: Number(item.price || 0),
    unit: item.unit || ''
  };
}

export function normalizeComponent(row: UzelComponent): UzelComponent {
  return {
    ...row,
    qty: Number(row.qty || 0),
    price: Number(row.price || 0),
    total: Number(row.total || 0),
    unit: row.unit || ''
  };
}

export function nodePositionCount(item: CatalogItem) {
  const stats = (item as UzelItem).stats;
  if (!stats || typeof stats !== 'object') return undefined;

  const raw = stats.positions;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function statsNumber(item: CatalogItem, key: string) {
  const stats = (item as UzelItem).stats;
  if (!stats || typeof stats !== 'object') return undefined;

  const raw = stats[key];
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function nodeCompositionCounts(item: CatalogItem, components?: UzelComponent[]) {
  if (components) {
    const products = components.filter(component => component.item_type === 'tovar').length;
    const services = components.filter(component => component.item_type === 'usluga').length;

    return {
      products,
      services,
      positions: components.length,
      known: true
    };
  }

  const products = statsNumber(item, 'products');
  const services = statsNumber(item, 'services');
  const positions = nodePositionCount(item);

  return {
    products,
    services,
    positions,
    known: products !== undefined || services !== undefined || positions !== undefined
  };
}

export function splitNodeComponents(components: UzelComponent[]) {
  return {
    products: components.filter(component => component.item_type === 'tovar'),
    services: components.filter(component => component.item_type === 'usluga')
  };
}

/* ---------- Search ---------- */

export function cleanSearch(value: string) {
  return value
    .trim()
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

/* ---------- Error formatting ---------- */

export function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return String(error);

  const details = error as { message?: string; code?: string; details?: string; hint?: string };
  return [
    details.message || JSON.stringify(error),
    details.code ? `код ${details.code}` : '',
    details.details,
    details.hint
  ].filter(Boolean).join(' · ');
}

/* ---------- Timeout wrapper ---------- */

export function withTimeout<T>(promise: PromiseLike<T>, label: string, ms = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    // По умолчанию не держим экран в ожидании по минуте на одном запросе.
    const timer = window.setTimeout(() => {
      reject(new Error(`${label}: Supabase не ответил за ${Math.round(ms / 1000)} сек.`));
    }, ms);

    Promise.resolve(promise)
      .then(value => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

/* ---------- Categories ---------- */

export function categoryId(entityType: CatalogType, category: string, subcategory: string) {
  const bytes = new TextEncoder().encode(`${category}|${subcategory}`);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return `${entityType}:${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').slice(0, 80)}`;
}

export function buildCategoryGroups(rows: CategoryRow[]): CategoryGroup[] {
  const map = new Map<string, Map<string, number>>();

  rows.forEach(row => {
    const category = row.category || 'Без категории';
    const subcategory = row.subcategory || 'Без подкатегории';
    const count = Number(row.items_count || 0);
    const group = map.get(category) || new Map<string, number>();

    group.set(subcategory, (group.get(subcategory) || 0) + count);
    map.set(category, group);
  });

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
    .map(([category, subMap]) => {
      const subcategories = [...subMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'ru'))
        .map(([name, count]) => ({ name, count }));

      return {
        category,
        total: subcategories.reduce((sum, item) => sum + item.count, 0),
        subcategories
      };
    });
}

/* ---------- Settings persistence ---------- */

export function readSettings(): CompanySettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
