import type { CartEntry, CartRow, CompanySettings } from '../../types';
import { adjustedPrice, roundPrice } from '../../utils';

export function buildCartRows(cart: Record<string, CartEntry>, settings: CompanySettings): CartRow[] {
  // Вынесли расчёт строк корзины в чистую функцию.
  // Так её можно проверять тестами без React и без UI.
  return Object.entries(cart).map(([cartKey, entry]) => {
    const price = adjustedPrice(entry.item.price, settings);

    return {
      cartKey,
      type: entry.type,
      item: entry.item,
      qty: entry.qty,
      price,
      total: roundPrice(price * entry.qty),
      components: entry.components,
    };
  });
}

export function calculateCartSubtotal(cartRows: CartRow[]): number {
  return cartRows.reduce((sum, row) => sum + row.total, 0);
}

export function calculateCartCount(cart: Record<string, CartEntry>): number {
  return Object.values(cart).reduce((sum, entry) => sum + entry.qty, 0);
}
