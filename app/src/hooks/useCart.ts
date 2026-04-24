import { useEffect, useMemo, useState } from 'react';
import type { CatalogItem, CatalogType, CartEntry, CartRow, CompanySettings } from '../types';
import { keyOf, normalizeItem } from '../utils';
import { buildCartRows, calculateCartCount, calculateCartSubtotal } from '../features/cart/cartMath';

const CART_STORAGE_KEY = 'smart-ceiling-draft-cart-v1';

function isCatalogType(value: unknown): value is CatalogType {
  return value === 'tovar' || value === 'usluga' || value === 'uzel';
}

function readCartFromStorage(): Record<string, CartEntry> {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.sessionStorage.getItem(CART_STORAGE_KEY);
    if (!rawValue) return {};

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return {};
    }

    return Object.values(parsedValue as Record<string, unknown>).reduce<Record<string, CartEntry>>((acc, value) => {
      if (!value || typeof value !== 'object') return acc;

      const entry = value as Partial<CartEntry>;
      const item = entry.item;
      const qty = Number(entry.qty || 0);

      if (!isCatalogType(entry.type) || !item || typeof item.id !== 'string' || typeof item.name !== 'string') {
        return acc;
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        return acc;
      }

      acc[keyOf(entry.type, item.id)] = {
        type: entry.type,
        item: normalizeItem(item),
        qty,
        components: Array.isArray(entry.components) ? entry.components : undefined,
      };

      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function useCart(settings: CompanySettings) {
  const [cart, setCart] = useState<Record<string, CartEntry>>(() => readCartFromStorage());
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (Object.keys(cart).length === 0) {
      window.sessionStorage.removeItem(CART_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

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
