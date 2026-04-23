import { describe, expect, it } from 'vitest';
import type { CatalogItem, UzelItem } from '../../types';
import {
  buildCatalogPayload,
  itemFormFromCatalogItem,
  normalizeCategoryPath,
  validateCatalogItemForm,
} from './catalogCrud';

describe('catalogCrud', () => {
  it('нормализует пустые категорию и подкатегорию', () => {
    expect(normalizeCategoryPath('', '')).toEqual({
      category: 'Без категории',
      subcategory: 'Без подкатегории',
    });
  });

  it('возвращает ошибку, если форма карточки не заполнена корректно', () => {
    expect(validateCatalogItemForm({
      id: '',
      name: '   ',
      category: '',
      subcategory: '',
      price: '-10',
      unit: '',
      image: '',
      description: '',
    })).toBe('Укажи название позиции.');

    expect(validateCatalogItemForm({
      id: '',
      name: 'Полотно',
      category: '',
      subcategory: '',
      price: '100',
      unit: '',
      image: '',
      description: '',
    })).toBe('Укажи единицу измерения.');
  });

  it('строит payload для товара и сохраняет source существующей записи', () => {
    const existingItem: CatalogItem = {
      id: 'canvas-1',
      name: 'Старое полотно',
      category: 'Полотна',
      subcategory: 'Мат',
      price: 500,
      unit: 'м2',
      source: 'catalog-import',
    };

    const result = buildCatalogPayload('tovar', {
      id: '',
      name: 'Новое полотно',
      category: '',
      subcategory: '',
      price: '650',
      unit: 'м2',
      image: ' ',
      description: '  Белое  ',
    }, existingItem);

    expect(result.categoryPath).toEqual({
      category: 'Без категории',
      subcategory: 'Без подкатегории',
    });
    expect(result.payload).toMatchObject({
      id: 'canvas-1',
      name: 'Новое полотно',
      price: 650,
      unit: 'м2',
      description: 'Белое',
      source: 'catalog-import',
    });
  });

  it('строит payload для узла и сохраняет текущую статистику', () => {
    const existingNode: UzelItem = {
      id: 'node-1',
      name: 'Парящий профиль',
      category: 'Узлы',
      subcategory: 'Профили',
      price: 1200,
      unit: 'шт.',
      stats: {
        positions: 3,
        products: 2,
        services: 1,
      },
    };

    const result = buildCatalogPayload('uzel', {
      id: 'node-1',
      name: 'Парящий профиль премиум',
      category: 'Узлы',
      subcategory: 'Профили',
      price: '1500',
      unit: 'шт.',
      image: '',
      description: '',
    }, existingNode);

    expect(result.payload).toMatchObject({
      id: 'node-1',
      name: 'Парящий профиль премиум',
      price: 1500,
      stats: {
        positions: 3,
        products: 2,
        services: 1,
      },
    });
  });

  it('переводит запись каталога в форму редактирования', () => {
    expect(itemFormFromCatalogItem({
      id: 'svc-1',
      name: 'Монтаж',
      category: 'Услуги',
      subcategory: 'Основные',
      price: 200,
      unit: 'м2',
      image: null,
      description: null,
    })).toEqual({
      id: 'svc-1',
      name: 'Монтаж',
      category: 'Услуги',
      subcategory: 'Основные',
      price: '200',
      unit: 'м2',
      image: '',
      description: '',
    });
  });
});
