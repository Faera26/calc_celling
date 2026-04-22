import { useMemo, useState } from 'react';
import type { CatalogItem, CatalogType, CartEntry, CartRow, CompanySettings } from '../types';
import { keyOf, normalizeItem } from '../utils';
import { buildCartRows, calculateCartCount, calculateCartSubtotal } from '../features/cart/cartMath';

export function useCart(settings: CompanySettings) {
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  const cartRows: CartRow[] = useMemo(() => buildCartRows(cart, settings), [cart, settings]);
  const subtotal = calculateCartSubtotal(cartRows);
  const cartCount = calculateCartCount(cart);

  function addToCart(type: CatalogType, item: CatalogItem, components?: CartEntry['components']) {
    const cartKey = keyOf(type, item.id);
    const normalized = normalizeItem(item);

    setCart((prev) => {
      const current = prev[cartKey];
      return {
        ...prev,
        [cartKey]: current
          ? { ...current, item: normalized, qty: current.qty + 1, components: components || current.components }
          : { type, item: normalized, qty: 1, components },
      };
    });
  }

  function removeFromCart(cartKey: string) {
    setCart((prev) => {
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
    setCart((prev) => {
      if (!prev[cartKey]) return prev;
      return {
        ...prev,
        [cartKey]: { ...prev[cartKey], item },
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
    updateCartItem,
  };
}
