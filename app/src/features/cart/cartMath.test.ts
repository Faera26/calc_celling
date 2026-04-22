import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../constants';
import type { CartEntry } from '../../types';
import { buildCartRows, calculateCartCount, calculateCartSubtotal } from './cartMath';

describe('cartMath', () => {
  it('применяет маржу и скидку к материалам в корзине', () => {
    const cart: Record<string, CartEntry> = {
      'tovar:item-1': {
        type: 'tovar',
        item: {
          id: 'item-1',
          name: 'ПВХ полотно',
          category: 'Полотна',
          subcategory: 'Матовые',
          price: 100,
          unit: 'м²',
        },
        qty: 3,
      },
    };

    const settings = {
      ...DEFAULT_SETTINGS,
      marginPercent: 20,
      discountPercent: 10,
    };

    const rows = buildCartRows(cart, settings);

    expect(rows).toHaveLength(1);
    expect(rows[0].price).toBe(108);
    expect(rows[0].total).toBe(324);
    expect(calculateCartSubtotal(rows)).toBe(324);
    expect(calculateCartCount(cart)).toBe(3);
  });

  it('считает количество позиций по сумме qty, а не по числу строк', () => {
    const cart: Record<string, CartEntry> = {
      'tovar:a': {
        type: 'tovar',
        item: { id: 'a', name: 'Профиль', category: 'Комплект', subcategory: 'Алюминий', price: 50, unit: 'м' },
        qty: 2,
      },
      'usluga:b': {
        type: 'usluga',
        item: { id: 'b', name: 'Монтаж', category: 'Работы', subcategory: 'Монтаж', price: 300, unit: 'шт.' },
        qty: 1,
      },
    };

    expect(calculateCartCount(cart)).toBe(3);
  });
});
