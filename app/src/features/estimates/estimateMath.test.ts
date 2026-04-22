import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../constants';
import type { CartRow, EstimateSaveDraft } from '../../types';
import {
  buildEstimatePersistenceRows,
  buildEstimateRecordPayloads,
  calculateEstimate,
  createSavedEstimatePosition,
  summarizeSavedEstimatePositions,
  toNumber,
} from './calculationEngine';

describe('calculationEngine', () => {
  it('нормализует комнаты и собирает сводку по площади, периметру и дополнительным узлам', () => {
    const draft: EstimateSaveDraft = {
      title: 'Тест',
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      objectAddress: '',
      clientComment: '',
      status: 'draft',
      rooms: [{
        id: 'room-1',
        name: '  Гостиная  ',
        area: '18.5',
        perimeter: '17.2',
        corners: '6',
        lightPoints: '8',
        pipes: '2',
        curtainTracks: '3.5',
        niches: '1.2',
        comment: '  с подсветкой  ',
      }],
    };

    const estimate = calculateEstimate({
      draft,
      settings: DEFAULT_SETTINGS,
      cartRows: [],
    });

    expect(estimate.rooms).toEqual([{
      id: 'room-1',
      positionIndex: 1,
      name: 'Гостиная',
      area: 18.5,
      perimeter: 17.2,
      corners: 6,
      lightPoints: 8,
      pipes: 2,
      curtainTracks: 3.5,
      niches: 1.2,
      comment: 'с подсветкой',
    }]);
    expect(estimate.summary).toMatchObject({
      area: 18.5,
      perimeter: 17.2,
      corners: 6,
      lightPoints: 8,
      pipes: 2,
      curtainTracks: 3.5,
      niches: 1.2,
      roomCount: 1,
      itemsCount: 0,
      componentsCount: 0,
      subtotal: 0,
      total: 0,
    });
  });

  it('строит итоговую смету и snapshot материалов узла с учётом количества и наценки', () => {
    const cartRows: CartRow[] = [{
      cartKey: 'uzel:node-1',
      type: 'uzel',
      item: {
        id: 'node-1',
        name: 'Световая линия',
        category: 'Узлы',
        subcategory: 'Свет',
        price: 1000,
        unit: 'шт.',
      },
      qty: 2,
      price: 1000,
      total: 2000,
      components: [{
        id: 'component-1',
        uzel_id: 'node-1',
        position_index: 1,
        item_type: 'tovar',
        item_id: 'mat-1',
        item_name: 'Профиль',
        qty: 1.5,
        unit: 'м',
        price: 100,
        total: 150,
        category: 'Материалы',
        subcategory: 'Профиль',
      }, {
        id: 'component-2',
        uzel_id: 'node-1',
        position_index: 2,
        item_type: 'usluga',
        item_id: 'svc-1',
        item_name: 'Монтаж света',
        qty: 1,
        unit: 'шт.',
        price: 200,
        total: 200,
        category: 'Работы',
        subcategory: 'Свет',
      }],
    }];

    const estimate = calculateEstimate({
      draft: {
        title: 'Смета',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        objectAddress: '',
        clientComment: '',
        status: 'draft',
        rooms: [{
          id: 'room-1',
          name: 'Спальня',
          area: '12',
          perimeter: '14',
          corners: '4',
          lightPoints: '2',
          pipes: '1',
          curtainTracks: '0',
          niches: '0',
          comment: '',
        }],
      },
      settings: {
        ...DEFAULT_SETTINGS,
        marginPercent: 10,
        discountPercent: 0,
      },
      cartRows,
    });

    expect(estimate.positions[0].componentsSnapshot).toEqual([{
      item_type: 'tovar',
      item_id: 'mat-1',
      item_name: 'Профиль',
      qty: 3,
      unit: 'м',
      price: 110,
      total: 330,
      base_price: 100,
      category: 'Материалы',
      subcategory: 'Профиль',
      image: null,
      comment: null,
    }, {
      item_type: 'usluga',
      item_id: 'svc-1',
      item_name: 'Монтаж света',
      qty: 2,
      unit: 'шт.',
      price: 220,
      total: 440,
      base_price: 200,
      category: 'Работы',
      subcategory: 'Свет',
      image: null,
      comment: null,
    }]);
    expect(estimate.summary).toMatchObject({
      itemsCount: 1,
      componentsCount: 2,
      subtotal: 2000,
      total: 2000,
    });
  });

  it('автоматически привязывает стартовые позиции к комнате, если комната одна', () => {
    const cartRows: CartRow[] = [{
      cartKey: 'tovar:item-1',
      type: 'tovar',
      item: {
        id: 'item-1',
        name: 'Полотно',
        category: 'Материалы',
        subcategory: 'ПВХ',
        price: 450,
        unit: 'м²',
      },
      qty: 2,
      price: 450,
      total: 900,
    }];

    const estimate = calculateEstimate({
      draft: {
        title: 'Смета',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        objectAddress: '',
        clientComment: '',
        status: 'draft',
        rooms: [{
          id: 'room-1',
          name: 'Комната 1',
          area: '10',
          perimeter: '14',
          corners: '4',
          lightPoints: '0',
          pipes: '0',
          curtainTracks: '0',
          niches: '0',
          comment: '',
        }],
      },
      settings: DEFAULT_SETTINGS,
      cartRows,
    });

    expect(estimate.positions[0].roomId).toBe('room-1');
  });

  it('автоматически добавляет полотно по площади и профиль по периметру комнаты', () => {
    const estimate = calculateEstimate({
      draft: {
        title: 'Автоправила',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        objectAddress: '',
        clientComment: '',
        status: 'draft',
        rooms: [{
          id: 'room-1',
          name: 'Гостиная',
          area: '20',
          perimeter: '18',
          corners: '4',
          lightPoints: '0',
          pipes: '0',
          curtainTracks: '0',
          niches: '0',
          comment: '',
        }],
        calculationRules: [{
          id: 'rule-canvas',
          enabled: true,
          label: 'Полотно',
          metric: 'area',
          item_type: 'tovar',
          search: 'полотно',
          item_id: 'canvas-1',
          item_name: 'Полотно MSD',
          category: 'Потолки',
          subcategory: 'Полотно',
          unit: 'м²',
          base_price: 500,
          multiplier: 1,
          round_to: 0.1,
        }, {
          id: 'rule-profile',
          enabled: true,
          label: 'Профиль',
          metric: 'perimeter',
          item_type: 'tovar',
          search: 'профиль',
          item_id: 'profile-1',
          item_name: 'Профиль алюминиевый',
          category: 'Потолки',
          subcategory: 'Профиль',
          unit: 'м',
          base_price: 120,
          multiplier: 1,
          round_to: 0.1,
        }],
      },
      settings: DEFAULT_SETTINGS,
      cartRows: [],
    });

    expect(estimate.positions).toHaveLength(2);
    expect(estimate.positions[0]).toMatchObject({
      roomId: 'room-1',
      itemName: 'Полотно MSD',
      qty: 20,
      unit: 'м²',
      total: 10000,
    });
    expect(estimate.positions[1]).toMatchObject({
      roomId: 'room-1',
      itemName: 'Профиль алюминиевый',
      qty: 18,
      unit: 'м',
      total: 2160,
    });
    expect(estimate.positions[0].sourceSnapshot).toMatchObject({
      source: 'smart-rule',
      auto_generated: true,
      rule_label: 'Полотно',
      metric: 'area',
    });
    expect(estimate.settingsSnapshot.calculation_rules).toHaveLength(2);
  });

  it('строит payloads для сохранения без дублирования логики в UI', () => {
    const cartRows: CartRow[] = [{
      cartKey: 'tovar:item-1',
      type: 'tovar',
      item: {
        id: 'item-1',
        name: 'Полотно',
        category: 'Материалы',
        subcategory: 'ПВХ',
        price: 450,
        unit: 'м²',
      },
      qty: 4,
      price: 450,
      total: 1800,
    }];

    const estimate = calculateEstimate({
      draft: {
        title: 'Объект 1',
        clientName: 'Клиент',
        clientPhone: '+7',
        clientEmail: '',
        objectAddress: '',
        clientComment: '',
        status: 'draft',
        rooms: [{
          id: 'room-1',
          name: 'Комната 1',
          area: '16',
          perimeter: '18',
          corners: '4',
          lightPoints: '1',
          pipes: '0',
          curtainTracks: '0',
          niches: '0',
          comment: '',
        }],
      },
      settings: DEFAULT_SETTINGS,
      cartRows,
    });

    const recordPayloads = buildEstimateRecordPayloads('user-1', estimate);
    const rows = buildEstimatePersistenceRows('estimate-1', estimate);

    expect(recordPayloads.baseEstimatePayload).toMatchObject({
      user_id: 'user-1',
      client_name: 'Клиент',
      subtotal: 1800,
      total: 1800,
      status: 'draft',
    });
    expect(rows.roomRows).toHaveLength(1);
    expect(rows.basePositionRows).toEqual([{
      smeta_id: 'estimate-1',
      item_type: 'tovar',
      item_id: 'item-1',
      item_name: 'Полотно',
      qty: 4,
      unit: 'м²',
      price: 450,
      total: 1800,
    }]);
    expect(rows.extendedPositionRows[0]).toMatchObject({
      smeta_id: 'estimate-1',
      position_index: 1,
      room_id: 'room-1',
      item_type: 'tovar',
      item_id: 'item-1',
      item_name: 'Полотно',
      qty: 4,
      unit: 'м²',
      base_price: 450,
      price: 450,
      total: 1800,
    });
  });

  it('собирает локальную позицию и считает сводку редактора смет через доменный модуль', () => {
    const first = createSavedEstimatePosition({
      estimateId: 'estimate-1',
      positionIndex: 1,
      roomId: null,
      name: 'Монтаж',
      qty: '2',
      unit: 'шт.',
      price: '500',
      itemType: 'usluga',
      source: 'local',
    });

    const second = createSavedEstimatePosition({
      estimateId: 'estimate-1',
      positionIndex: 2,
      roomId: 'room-2',
      name: 'Световая линия',
      qty: '1',
      unit: 'шт.',
      price: '1800',
      itemType: 'uzel',
      source: 'catalog',
      componentsSnapshot: [{
        item_type: 'tovar',
        item_id: 'light-1',
        item_name: 'Профиль',
        qty: 2,
        unit: 'м',
        price: 300,
        total: 600,
      }],
    });

    expect(summarizeSavedEstimatePositions([first, second])).toEqual({
      subtotal: 2800,
      total: 2800,
      itemsCount: 2,
      componentsCount: 1,
    });
  });

  it('безопасно преобразует пустые и некорректные значения в ноль', () => {
    expect(toNumber('')).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber('12.5')).toBe(12.5);
  });
});
