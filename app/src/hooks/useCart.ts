import { useMemo, useState } from 'react';
import type { CatalogItem, CatalogType, CartEntry, CartRow, CompanySettings } from '../types';
import { adjustedPrice, keyOf, normalizeItem } from '../utils';

export function useCart(settings: CompanySettings) {
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  const cartRows: CartRow[] = useMemo(() => {
    return Object.entries(cart).map(([cartKey, entry]) => {
      const price = adjustedPrice(entry.item.price, settings);
      return {
        cartKey,
        type: entry.type,
        item: entry.item,
        qty: entry.qty,
        price,
        total: price * entry.qty,
        components: entry.components
      };
    });
  }, [cart, settings]);

  const subtotal = cartRows.reduce((sum, row) => sum + row.total, 0);
  const cartCount = Object.values(cart).reduce((sum, entry) => sum + entry.qty, 0);

  function addToCart(type: CatalogType, item: CatalogItem, components?: CartEntry['components']) {
    const cartKey = keyOf(type, item.id);
    const normalized = normalizeItem(item);

    setCart(prev => {
      const current = prev[cartKey];
      return {
        ...prev,
        [cartKey]: current
          ? { ...current, item: normalized, qty: current.qty + 1, components: components || current.components }
          : { type, item: normalized, qty: 1, components }
      };
    });
  }

  function removeFromCart(cartKey: string) {
    setCart(prev => {
      const current = prev[cartKey];
      if (!current) return prev;

      const next = { ...prev };
      if (current.qty > 1) next[cartKey] = { ...current, qty: current.qty - 1 };
      else delete next[cartKey];

      return next;
    });
  }

  function clearCart() {
    setCart({});
  }

  function updateCartItem(cartKey: string, item: CatalogItem) {
    setCart(prev => {
      if (!prev[cartKey]) return prev;
      return {
        ...prev,
        [cartKey]: { ...prev[cartKey], item }
      };
    });
  }

  return {
    cart,
    cartRows,
    subtotal,
    cartCount,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    removeFromCart,
    clearCart,
    updateCartItem
  };
}
