import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { restSelect } from '../supabaseRest';
import type {
  CatalogItem,
  CatalogType,
  ComponentDraft,
  ConstructorState,
  UzelComponent,
  UzelItem,
} from '../types';
import { EMPTY_COMPONENT_DRAFT } from '../constants';
import {
  catalogColumnsOf,
  cleanSearch,
  formatError,
  normalizeComponent,
  normalizeItem,
  tableOf,
  withTimeout,
  categoryId,
} from '../utils';

interface UseConstructorOptions {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
  onNodeUpdated?: (node: UzelItem, components: UzelComponent[]) => void;
  onRefresh?: () => void;
}

export function useConstructor({
  userId,
  userEmail,
  isAdmin,
  onNodeUpdated,
  onRefresh,
}: UseConstructorOptions) {
  const [constructorState, setConstructorState] = useState<ConstructorState | null>(null);
  const [constructorLoading, setConstructorLoading] = useState(false);
  const [componentDraft, setComponentDraft] = useState<ComponentDraft>(EMPTY_COMPONENT_DRAFT);
  const [componentOptions, setComponentOptions] = useState<CatalogItem[]>([]);
  const [componentOptionsLoading, setComponentOptionsLoading] = useState(false);
  const [savingConstructor, setSavingConstructor] = useState(false);
  const [constructorError, setConstructorError] = useState('');
  const [componentSearch, setComponentSearch] = useState('');
  const [debouncedComponentSearch, setDebouncedComponentSearch] = useState('');

  // Debounce component search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedComponentSearch(cleanSearch(componentSearch));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [componentSearch]);

  // Load component options when constructor is open
  useEffect(() => {
    if (!constructorState || !userEmail || !userId) {
      setComponentOptions([]);
      return;
    }

    let cancelled = false;

    async function loadComponentOptions() {
      setComponentOptionsLoading(true);

      try {
        const data = await withTimeout(
          restSelect<CatalogItem>(tableOf(componentDraft.itemType), {
            select: catalogColumnsOf(componentDraft.itemType),
            order: 'name.asc',
            limit: 80,
            offset: 0,
            search: debouncedComponentSearch,
          }),
          'Поиск позиции для конструктора'
        );

        if (cancelled) return;
        setComponentOptionsLoading(false);
        setComponentOptions(((data || []) as CatalogItem[]).map(item => normalizeItem(item)));
      } catch (error) {
        if (cancelled) return;
        setComponentOptionsLoading(false);
        setComponentOptions([]);
        setConstructorError(formatError(error));
      }
    }

    loadComponentOptions();
    return () => { cancelled = true; };
  }, [constructorState, userEmail, userId, componentDraft.itemType, debouncedComponentSearch]);

  async function openConstructor(
    node: UzelItem,
    loadNodeComponents: (id: string, force?: boolean) => Promise<UzelComponent[]>
  ) {
    setConstructorError('');
    setComponentDraft(EMPTY_COMPONENT_DRAFT);
    setComponentSearch('');
    setComponentOptions([]);
    setConstructorLoading(true);
    setConstructorState({ node, rows: [] });

    try {
      const rows = await loadNodeComponents(node.id);
      setConstructorState(prev =>
        prev && prev.node.id === node.id ? { ...prev, rows: [...rows] } : prev
      );
    } catch (error) {
      setConstructorError(formatError(error));
    } finally {
      setConstructorLoading(false);
    }
  }

  function closeConstructor() {
    setConstructorState(null);
  }

  function addComponent() {
    if (!constructorState) return;

    const item = componentOptions.find(c => c.id === componentDraft.itemId);
    if (!item) {
      setConstructorError('Выбери товар или услугу из списка.');
      return;
    }

    const qty = Number(componentDraft.qty || 1);
    if (!Number.isFinite(qty) || qty <= 0) {
      setConstructorError('Количество должно быть больше нуля.');
      return;
    }

    const nextIndex = constructorState.rows.length + 1;
    const row: UzelComponent = {
      id: `${constructorState.node.id}:${nextIndex}`,
      uzel_id: constructorState.node.id,
      position_index: nextIndex,
      item_type: componentDraft.itemType,
      item_id: item.id,
      item_name: item.name,
      qty,
      unit: item.unit || '',
      price: item.price,
      total: item.price * qty,
      category: item.category,
      subcategory: item.subcategory,
      image: item.image || null,
      comment: null
    };

    setConstructorState(prev => prev ? { ...prev, rows: [...prev.rows, row] } : prev);
    setComponentDraft(prev => ({ ...prev, itemId: '', qty: '1' }));
    setComponentSearch('');
    setConstructorError('');
  }

  function removeComponent(index: number) {
    setConstructorState(prev => {
      if (!prev) return prev;

      const rows = prev.rows
        .filter((_row, rowIndex) => rowIndex !== index)
        .map((row, rowIndex) => ({
          ...row,
          id: `${prev.node.id}:${rowIndex + 1}`,
          position_index: rowIndex + 1
        }));

      return { ...prev, rows };
    });
  }

  async function saveConstructor() {
    if (!constructorState || !isAdmin) return;

    setSavingConstructor(true);
    setConstructorError('');

    const total = constructorState.rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const normalizedRows = constructorState.rows.map((row, index) => ({
      id: `${constructorState.node.id}:${index + 1}`,
      uzel_id: constructorState.node.id,
      position_index: index + 1,
      item_type: row.item_type,
      item_id: row.item_id,
      item_name: row.item_name,
      qty: Number(row.qty || 0),
      unit: row.unit,
      price: Number(row.price || 0),
      total: Number(row.total || 0),
      category: row.category || null,
      subcategory: row.subcategory || null,
      image: row.image || null,
      comment: row.comment || null
    }));

    const nodeUpdate = {
      price: total,
      stats: {
        positions: normalizedRows.length,
        products: normalizedRows.filter(row => row.item_type === 'tovar').length,
        services: normalizedRows.filter(row => row.item_type === 'usluga').length,
        source: 'manual_constructor',
        updated_at: new Date().toISOString()
      }
    };

    try {
      const { error: nodeError } = await withTimeout(
        supabase
          .from('uzly')
          .update(nodeUpdate)
          .eq('id', constructorState.node.id),
        'Обновление узла'
      );
      if (nodeError) throw nodeError;

      const { error: deleteError } = await withTimeout(
        supabase
          .from('komplektaciya_uzlov')
          .delete()
          .eq('uzel_id', constructorState.node.id),
        'Очистка старой комплектации'
      );
      if (deleteError) throw deleteError;

      if (normalizedRows.length > 0) {
        const { error: insertError } = await withTimeout(
          supabase
            .from('komplektaciya_uzlov')
            .insert(normalizedRows),
          'Сохранение комплектации'
        );
        if (insertError) throw insertError;
      }
    } catch (error) {
      setSavingConstructor(false);
      setConstructorError(formatError(error));
      return;
    }

    const updatedNode = normalizeItem({
      ...constructorState.node,
      price: total,
      stats: nodeUpdate.stats
    });
    const normalizedComponents = normalizedRows.map(row => normalizeComponent(row as UzelComponent));

    onNodeUpdated?.(updatedNode, normalizedComponents);
    setConstructorState(null);
    setSavingConstructor(false);
    onRefresh?.();
  }

  async function upsertCategory(type: CatalogType, category: string, subcategory: string) {
    const id = categoryId(type, category, subcategory);
    const { data, error } = await withTimeout(
      supabase
        .from('kategorii')
        .select('items_count')
        .eq('id', id)
        .maybeSingle(),
      'Проверка категории'
    );

    if (error) throw error;

    const { error: upsertError } = await withTimeout(
      supabase.from('kategorii').upsert({
        id,
        entity_type: type,
        category,
        subcategory,
        items_count: Number(data?.items_count || 0) + 1,
        updated_at: new Date().toISOString()
      }),
      'Сохранение категории'
    );

    if (upsertError) throw upsertError;
  }

  return {
    constructorState,
    constructorLoading,
    componentDraft,
    setComponentDraft,
    componentOptions,
    componentOptionsLoading,
    savingConstructor,
    constructorError,
    setConstructorError,
    componentSearch,
    setComponentSearch,
    openConstructor,
    closeConstructor,
    addComponent,
    removeComponent,
    saveConstructor,
    upsertCategory,
  };
}
