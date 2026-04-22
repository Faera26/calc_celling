import type {
  CatalogItem,
  CartRow,
  CompanySettings,
  EstimateCalculationMetric,
  EstimateCalculationRule,
  EstimateComponentSnapshot,
  EstimateItemSnapshot,
  EstimateSaveDraft,
  EstimateSourceSnapshot,
  EstimateStatus,
  SavedEstimatePosition,
  SavedEstimateRoom,
} from '../../types';
import { adjustedPrice, labelOf, roundPrice } from '../../utils';

export interface EstimateRoomMetrics {
  area: number;
  perimeter: number;
  corners: number;
  lightPoints: number;
  pipes: number;
  curtainTracks: number;
  niches: number;
}

export interface CalculatedEstimateRoom extends EstimateRoomMetrics {
  id: string;
  positionIndex: number;
  name: string;
  comment: string | null;
}

export interface CalculatedEstimatePosition {
  positionIndex: number;
  roomId: string | null;
  itemType: CartRow['type'];
  itemId: string;
  itemName: string;
  qty: number;
  unit: string;
  basePrice: number;
  price: number;
  total: number;
  category: string | null;
  subcategory: string | null;
  itemSnapshot: EstimateItemSnapshot;
  componentsSnapshot: EstimateComponentSnapshot[];
  sourceSnapshot: EstimateSourceSnapshot;
}

export interface CalculatedEstimateSummary extends EstimateRoomMetrics {
  roomCount: number;
  itemsCount: number;
  componentsCount: number;
  subtotal: number;
  total: number;
}

export interface CalculatedEstimate {
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  objectAddress: string | null;
  clientComment: string | null;
  status: EstimateStatus;
  rooms: CalculatedEstimateRoom[];
  positions: CalculatedEstimatePosition[];
  summary: CalculatedEstimateSummary;
  settingsSnapshot: {
    companyName: string;
    managerName: string;
    phone: string;
    email: string;
    marginPercent: number;
    discountPercent: number;
    pdfNote: string;
    calculation_rules: EstimateCalculationRule[];
  };
}

export interface EstimateRecordPayloads {
  baseEstimatePayload: {
    user_id: string;
    client_name: string;
    client_phone: string | null;
    margin_percent: number;
    discount_percent: number;
    subtotal: number;
    total: number;
    status: EstimateStatus;
  };
  extendedEstimatePayload: {
    user_id: string;
    client_name: string;
    client_phone: string | null;
    margin_percent: number;
    discount_percent: number;
    subtotal: number;
    total: number;
    status: EstimateStatus;
    title: string;
    client_email: string | null;
    object_address: string | null;
    client_comment: string | null;
    room_count: number;
    items_count: number;
    components_count: number;
    settings_snapshot: CalculatedEstimate['settingsSnapshot'];
  };
}

export interface EstimatePersistenceRows {
  roomRows: Array<{
    id: string;
    smeta_id: string;
    position_index: number;
    name: string;
    area: number;
    perimeter: number;
    corners: number;
    light_points: number;
    pipes: number;
    curtain_tracks: number;
    niches: number;
    comment: string | null;
  }>;
  basePositionRows: Array<{
    smeta_id: string;
    item_type: CartRow['type'];
    item_id: string;
    item_name: string;
    qty: number;
    unit: string;
    price: number;
    total: number;
  }>;
  extendedPositionRows: Array<{
    smeta_id: string;
    position_index: number;
    room_id: string | null;
    item_type: CartRow['type'];
    item_id: string;
    item_name: string;
    qty: number;
    unit: string;
    base_price: number;
    price: number;
    total: number;
    category: string | null;
    subcategory: string | null;
    item_snapshot: EstimateItemSnapshot;
    components_snapshot: EstimateComponentSnapshot[];
    source_snapshot: EstimateSourceSnapshot;
  }>;
}

export interface EstimatePdfItem {
  name: string;
  type: string;
  section?: string;
  qty: number;
  price: number;
  unit: string;
  image?: string | null;
  description?: string | null;
  components?: Array<{
    type: string;
    name: string;
    qty: number;
    unit: string;
    price: number;
  }>;
}

interface CalculateEstimateInput {
  draft: EstimateSaveDraft;
  settings: CompanySettings;
  cartRows?: CartRow[];
  catalogRows?: CartRow[];
}

interface CreateSavedEstimatePositionInput {
  estimateId: string;
  positionIndex: number;
  roomId: string | null;
  name: string;
  qty: string | number;
  unit: string;
  price: string | number;
  itemType?: SavedEstimatePosition['item_type'];
  itemId?: string;
  category?: string | null;
  subcategory?: string | null;
  image?: string | null;
  description?: string | null;
  source?: string | null;
  componentsSnapshot?: EstimateComponentSnapshot[];
}

interface ResolvedRuleItem {
  type: CartRow['type'];
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  unit: string | null;
  basePrice: number;
  image: string | null;
  description: string | null;
  source: string | null;
  stats: Record<string, unknown> | null;
}

function emptyRoomMetrics(): EstimateRoomMetrics {
  return {
    area: 0,
    perimeter: 0,
    corners: 0,
    lightPoints: 0,
    pipes: 0,
    curtainTracks: 0,
    niches: 0,
  };
}

function componentTypeLabel(type: EstimateComponentSnapshot['item_type']): string {
  if (type === 'tovar') return 'Товар';
  return 'Услуга';
}

export function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createDefaultCalculationRules(): EstimateCalculationRule[] {
  return [
    {
      id: 'rule-canvas-area',
      enabled: true,
      label: 'Полотно по площади комнаты',
      metric: 'area',
      item_type: 'tovar',
      search: 'полотно',
      item_id: '',
      item_name: '',
      category: 'Потолки',
      subcategory: 'Полотно',
      unit: 'м²',
      base_price: null,
      image: null,
      description: null,
      multiplier: 1,
      round_to: 0.1,
    },
    {
      id: 'rule-profile-perimeter',
      enabled: true,
      label: 'Профиль по периметру комнаты',
      metric: 'perimeter',
      item_type: 'tovar',
      search: 'профиль',
      item_id: '',
      item_name: '',
      category: 'Потолки',
      subcategory: 'Профиль',
      unit: 'м',
      base_price: null,
      image: null,
      description: null,
      multiplier: 1,
      round_to: 0.1,
    },
  ];
}

export function calculateEstimate(input: CalculateEstimateInput): CalculatedEstimate {
  const catalogRows = input.catalogRows || input.cartRows || [];
  const title = input.draft.title.trim() || `Смета от ${new Date().toLocaleDateString('ru-RU')}`;
  const rooms = normalizeEstimateRooms(input.draft.rooms);
  const roomMetrics = summarizeRoomMetrics(rooms);
  const calculationRules = normalizeCalculationRules(input.draft.calculationRules);

  // Если в смете только одна комната, стартовые позиции можно сразу к ней привязать.
  // Так площадь, периметр и дополнительные узлы не теряют связь с конкретным помещением.
  const defaultRoomId = rooms.length === 1 ? rooms[0].id : null;
  const manualPositions = catalogRows.map((row, index) => (
    buildCalculatedPositionFromCartRow(row, index + 1, defaultRoomId, input.settings)
  ));
  const automaticPositions = buildAutomaticPositions({
    rooms,
    settings: input.settings,
    rules: calculationRules,
    catalogRows,
    existingPositions: manualPositions,
  });
  const positions = [...manualPositions, ...automaticPositions].map((position, index) => ({
    ...position,
    positionIndex: index + 1,
  }));
  const positionSummary = summarizeCalculatedPositions(positions);

  return {
    title,
    clientName: normalizeText(input.draft.clientName) || title,
    clientPhone: normalizeText(input.draft.clientPhone),
    clientEmail: normalizeText(input.draft.clientEmail),
    objectAddress: normalizeText(input.draft.objectAddress),
    clientComment: normalizeText(input.draft.clientComment),
    status: input.draft.status,
    rooms,
    positions,
    summary: {
      ...roomMetrics,
      ...positionSummary,
      roomCount: rooms.length,
    },
    settingsSnapshot: {
      companyName: input.settings.companyName,
      managerName: input.settings.managerName,
      phone: input.settings.phone,
      email: input.settings.email,
      marginPercent: input.settings.marginPercent,
      discountPercent: input.settings.discountPercent,
      pdfNote: input.settings.pdfNote,
      calculation_rules: calculationRules,
    },
  };
}

export function buildEstimateRecordPayloads(userId: string, estimate: CalculatedEstimate): EstimateRecordPayloads {
  const baseEstimatePayload = {
    user_id: userId,
    client_name: estimate.clientName || estimate.title,
    client_phone: estimate.clientPhone,
    margin_percent: estimate.settingsSnapshot.marginPercent,
    discount_percent: estimate.settingsSnapshot.discountPercent,
    subtotal: estimate.summary.subtotal,
    total: estimate.summary.total,
    status: estimate.status,
  };

  return {
    baseEstimatePayload,
    extendedEstimatePayload: {
      ...baseEstimatePayload,
      title: estimate.title,
      client_email: estimate.clientEmail,
      object_address: estimate.objectAddress,
      client_comment: estimate.clientComment,
      room_count: estimate.summary.roomCount,
      items_count: estimate.summary.itemsCount,
      components_count: estimate.summary.componentsCount,
      settings_snapshot: estimate.settingsSnapshot,
    },
  };
}

export function buildEstimatePersistenceRows(
  estimateId: string,
  estimate: CalculatedEstimate
): EstimatePersistenceRows {
  const roomRows = estimate.rooms.map((room) => ({
    id: room.id,
    smeta_id: estimateId,
    position_index: room.positionIndex,
    name: room.name,
    area: room.area,
    perimeter: room.perimeter,
    corners: room.corners,
    light_points: room.lightPoints,
    pipes: room.pipes,
    curtain_tracks: room.curtainTracks,
    niches: room.niches,
    comment: room.comment,
  }));

  const basePositionRows = estimate.positions.map((position) => ({
    smeta_id: estimateId,
    item_type: position.itemType,
    item_id: position.itemId,
    item_name: position.itemName,
    qty: position.qty,
    unit: position.unit,
    price: position.price,
    total: position.total,
  }));

  const extendedPositionRows = estimate.positions.map((position) => ({
    smeta_id: estimateId,
    position_index: position.positionIndex,
    room_id: position.roomId,
    item_type: position.itemType,
    item_id: position.itemId,
    item_name: position.itemName,
    qty: position.qty,
    unit: position.unit,
    base_price: position.basePrice,
    price: position.price,
    total: position.total,
    category: position.category,
    subcategory: position.subcategory,
    item_snapshot: position.itemSnapshot,
    components_snapshot: position.componentsSnapshot,
    source_snapshot: position.sourceSnapshot,
  }));

  return {
    roomRows,
    basePositionRows,
    extendedPositionRows,
  };
}

export function normalizeSavedEstimatePositions(
  positions: SavedEstimatePosition[],
  validRoomIds: Set<string>
): SavedEstimatePosition[] {
  return positions.map((position, index) => {
    const qty = toNumber(position.qty);
    const price = toNumber(position.price);
    const roomId = position.room_id && validRoomIds.has(position.room_id) ? position.room_id : null;

    return {
      ...position,
      position_index: index + 1,
      room_id: roomId,
      qty,
      price,
      total: roundPrice(qty * price),
      item_snapshot: normalizeItemSnapshot(position.item_snapshot, position),
      components_snapshot: normalizeComponentSnapshots(position.components_snapshot),
      source_snapshot: normalizeSourceSnapshot(position.source_snapshot),
    };
  });
}

export function buildSavedEstimateRoomPayloads(estimateId: string, rooms: SavedEstimateRoom[]) {
  return rooms.map((room, index) => ({
    id: room.id,
    smeta_id: estimateId,
    position_index: index + 1,
    name: normalizeText(room.name) || `Комната ${index + 1}`,
    // Площадь и периметр считаются отдельными метриками комнаты.
    // Именно они потом используются движком как база для материалов по м² и м.п.
    area: toNumber(room.area),
    perimeter: toNumber(room.perimeter),
    corners: toNumber(room.corners),
    // Дополнительные узлы вроде светильников, труб, карнизов и ниш
    // храним отдельно, чтобы их можно было считать поштучно или по метрам.
    light_points: toNumber(room.light_points),
    pipes: toNumber(room.pipes),
    curtain_tracks: toNumber(room.curtain_tracks),
    niches: toNumber(room.niches),
    comment: normalizeText(room.comment),
  }));
}

export function buildSavedEstimatePositionPayloads(estimateId: string, positions: SavedEstimatePosition[]) {
  return positions.map((position) => ({
    id: position.id,
    smeta_id: estimateId,
    position_index: position.position_index,
    room_id: position.room_id || null,
    item_type: position.item_type,
    item_id: position.item_id,
    item_name: position.item_name,
    qty: toNumber(position.qty),
    unit: normalizeText(position.unit) || 'шт.',
    base_price: toNumber(position.base_price ?? position.price),
    price: toNumber(position.price),
    total: roundPrice(toNumber(position.total)),
    category: normalizeText(position.category),
    subcategory: normalizeText(position.subcategory),
    item_snapshot: normalizeItemSnapshot(position.item_snapshot, position),
    components_snapshot: normalizeComponentSnapshots(position.components_snapshot),
    source_snapshot: normalizeSourceSnapshot(position.source_snapshot),
  }));
}

export function summarizeSavedEstimatePositions(positions: SavedEstimatePosition[]) {
  return positions.reduce((summary, position) => ({
    subtotal: summary.subtotal + toNumber(position.total),
    total: summary.total + toNumber(position.total),
    itemsCount: summary.itemsCount + 1,
    componentsCount: summary.componentsCount + normalizeComponentSnapshots(position.components_snapshot).length,
  }), {
    subtotal: 0,
    total: 0,
    itemsCount: 0,
    componentsCount: 0,
  });
}

export function createSavedEstimatePosition(input: CreateSavedEstimatePositionInput): SavedEstimatePosition {
  const qty = toNumber(input.qty) || 1;
  const price = toNumber(input.price);
  const itemId = input.itemId || `local-${crypto.randomUUID()}`;
  const itemName = normalizeText(input.name) || 'Без названия';
  const unit = normalizeText(input.unit) || 'шт.';
  const category = normalizeText(input.category) || 'Локальные';
  const subcategory = normalizeText(input.subcategory);
  const itemType = input.itemType || 'tovar';

  return {
    id: crypto.randomUUID(),
    smeta_id: input.estimateId,
    position_index: input.positionIndex,
    room_id: input.roomId,
    item_type: itemType,
    item_id: itemId,
    item_name: itemName,
    qty,
    unit,
    base_price: price,
    price,
    total: roundPrice(price * qty),
    category,
    subcategory,
    item_snapshot: {
      item_type: itemType,
      item_id: itemId,
      name: itemName,
      category,
      subcategory,
      unit,
      image: input.image || null,
      description: input.description || null,
      source: input.source || null,
      base_price: price,
      saved_price: price,
      saved_at: new Date().toISOString(),
    },
    source_snapshot: normalizeSourceSnapshot({
      name: itemName,
      category,
      subcategory,
      unit,
      base_price: price,
      image: input.image || null,
      description: input.description || null,
      source: input.source || null,
    }),
    components_snapshot: normalizeComponentSnapshots(input.componentsSnapshot),
  };
}

export function buildEstimatePdfItemsFromCartRows(cartRows: CartRow[], settings: CompanySettings): EstimatePdfItem[] {
  return cartRows.map((row) => ({
    name: row.item.name,
    type: labelOf(row.type),
    qty: row.qty,
    price: row.price,
    unit: row.item.unit || 'шт.',
    components: normalizeComponentSnapshots(row.components).map((component) => ({
      type: componentTypeLabel(component.item_type),
      name: component.item_name,
      qty: toNumber(component.qty) * row.qty,
      unit: component.unit || 'шт.',
      price: adjustedPrice(component.price, settings),
    })),
  }));
}

export function buildEstimatePdfItemsFromSavedPositions(
  positions: SavedEstimatePosition[],
  resolveSectionName: (roomId?: string | null) => string
): EstimatePdfItem[] {
  return positions.map((position) => {
    const sourceSnapshot = normalizeSourceSnapshot(position.source_snapshot);

    return {
      name: position.item_name,
      type: labelOf(position.item_type),
      section: resolveSectionName(position.room_id),
      image: sourceSnapshot.image || null,
      description: sourceSnapshot.description || null,
      qty: toNumber(position.qty),
      price: toNumber(position.price),
      unit: position.unit || 'шт.',
      components: normalizeComponentSnapshots(position.components_snapshot).map((component) => ({
        type: componentTypeLabel(component.item_type),
        name: component.item_name,
        qty: toNumber(component.qty),
        unit: component.unit || 'шт.',
        price: toNumber(component.price),
      })),
    };
  });
}

function normalizeEstimateRooms(rooms: EstimateSaveDraft['rooms']): CalculatedEstimateRoom[] {
  return rooms.map((room, index) => ({
    id: room.id,
    positionIndex: index + 1,
    name: normalizeText(room.name) || `Комната ${index + 1}`,
    // Площадь нужна для материалов по квадратным метрам, например полотна.
    area: toNumber(room.area),
    // Периметр нужен для профилей, вставок и других работ по длине.
    perimeter: toNumber(room.perimeter),
    corners: toNumber(room.corners),
    // Эти поля описывают дополнительные узлы комнаты:
    // точки света, обходы труб, карнизы и ниши.
    lightPoints: toNumber(room.lightPoints),
    pipes: toNumber(room.pipes),
    curtainTracks: toNumber(room.curtainTracks),
    niches: toNumber(room.niches),
    comment: normalizeText(room.comment),
  }));
}

function summarizeRoomMetrics(rooms: CalculatedEstimateRoom[]): EstimateRoomMetrics {
  return rooms.reduce((summary, room) => ({
    area: summary.area + room.area,
    perimeter: summary.perimeter + room.perimeter,
    corners: summary.corners + room.corners,
    lightPoints: summary.lightPoints + room.lightPoints,
    pipes: summary.pipes + room.pipes,
    curtainTracks: summary.curtainTracks + room.curtainTracks,
    niches: summary.niches + room.niches,
  }), emptyRoomMetrics());
}

function summarizeCalculatedPositions(positions: CalculatedEstimatePosition[]) {
  return positions.reduce((summary, position) => ({
    subtotal: summary.subtotal + position.total,
    total: summary.total + position.total,
    itemsCount: summary.itemsCount + 1,
    componentsCount: summary.componentsCount + position.componentsSnapshot.length,
  }), {
    subtotal: 0,
    total: 0,
    itemsCount: 0,
    componentsCount: 0,
  });
}

function buildAutomaticPositions(input: {
  rooms: CalculatedEstimateRoom[];
  settings: CompanySettings;
  rules: EstimateCalculationRule[];
  catalogRows: CartRow[];
  existingPositions: CalculatedEstimatePosition[];
}): CalculatedEstimatePosition[] {
  const positions: CalculatedEstimatePosition[] = [];

  input.rooms.forEach((room) => {
    input.rules.forEach((rule) => {
      if (!rule.enabled) return;

      const item = resolveRuleItem(rule, input.catalogRows);
      if (!item) return;

      const qty = calculateRuleQuantity(room, rule);
      if (qty <= 0) return;

      // Если менеджер уже добавил ту же позицию вручную в эту комнату,
      // автоматическое правило её не дублирует.
      const hasManualMatch = input.existingPositions.some((position) => (
        position.itemId === item.id
        && position.roomId === room.id
      ));

      if (hasManualMatch) return;

      positions.push(buildAutomaticPosition({
        positionIndex: input.existingPositions.length + positions.length + 1,
        room,
        rule,
        item,
        settings: input.settings,
      }));
    });
  });

  return positions;
}

function buildCalculatedPositionFromCartRow(
  row: CartRow,
  positionIndex: number,
  defaultRoomId: string | null,
  settings: CompanySettings
): CalculatedEstimatePosition {
  return {
    positionIndex,
    roomId: defaultRoomId,
    itemType: row.type,
    itemId: row.item.id,
    itemName: row.item.name,
    qty: toNumber(row.qty),
    unit: row.item.unit || 'шт.',
    basePrice: toNumber(row.item.price),
    price: toNumber(row.price),
    total: roundPrice(toNumber(row.total)),
    category: normalizeText(row.item.category),
    subcategory: normalizeText(row.item.subcategory),
    itemSnapshot: buildItemSnapshot(row),
    componentsSnapshot: buildComponentSnapshots(row, settings),
    sourceSnapshot: normalizeSourceSnapshot({
      name: row.item.name,
      category: row.item.category,
      subcategory: row.item.subcategory,
      unit: row.item.unit,
      base_price: row.item.price,
      image: row.item.image,
      description: row.item.description,
      source: row.item.source,
    }),
  };
}

function buildAutomaticPosition(input: {
  positionIndex: number;
  room: CalculatedEstimateRoom;
  rule: EstimateCalculationRule;
  item: ResolvedRuleItem;
  settings: CompanySettings;
}): CalculatedEstimatePosition {
  const qty = calculateRuleQuantity(input.room, input.rule);
  const price = adjustedPrice(input.item.basePrice, input.settings);

  return {
    positionIndex: input.positionIndex,
    roomId: input.room.id,
    itemType: input.item.type,
    itemId: input.item.id,
    itemName: input.item.name,
    qty,
    unit: input.item.unit || 'шт.',
    basePrice: input.item.basePrice,
    price,
    total: roundPrice(price * qty),
    category: input.item.category,
    subcategory: input.item.subcategory,
    itemSnapshot: {
      item_type: input.item.type,
      item_id: input.item.id,
      name: input.item.name,
      category: input.item.category,
      subcategory: input.item.subcategory,
      unit: input.item.unit,
      image: input.item.image,
      description: input.item.description,
      source: 'smart-rule',
      base_price: input.item.basePrice,
      saved_price: price,
      saved_at: new Date().toISOString(),
      stats: input.item.stats,
    },
    componentsSnapshot: [],
    sourceSnapshot: normalizeSourceSnapshot({
      name: input.item.name,
      category: input.item.category,
      subcategory: input.item.subcategory,
      unit: input.item.unit,
      base_price: input.item.basePrice,
      image: input.item.image,
      description: input.item.description,
      source: 'smart-rule',
      rule_id: input.rule.id,
      rule_label: input.rule.label,
      metric: input.rule.metric,
      auto_generated: true,
    }),
  };
}

function buildComponentSnapshots(row: CartRow, settings: CompanySettings): EstimateComponentSnapshot[] {
  return normalizeComponentSnapshots(row.components).map((component) => {
    const qty = toNumber(component.qty) * toNumber(row.qty);
    const price = adjustedPrice(component.price, settings);

    return {
      item_type: component.item_type,
      item_id: component.item_id,
      item_name: component.item_name,
      qty,
      unit: component.unit || 'шт.',
      price,
      total: roundPrice(price * qty),
      base_price: toOptionalNumber(component.price),
      category: normalizeText(component.category),
      subcategory: normalizeText(component.subcategory),
      image: typeof component.image === 'string' ? component.image : null,
      comment: typeof component.comment === 'string' ? component.comment : null,
    };
  });
}

function buildItemSnapshot(row: CartRow): EstimateItemSnapshot {
  return {
    item_type: row.type,
    item_id: row.item.id,
    name: row.item.name,
    category: normalizeText(row.item.category),
    subcategory: normalizeText(row.item.subcategory),
    unit: row.item.unit || 'шт.',
    image: typeof row.item.image === 'string' ? row.item.image : null,
    description: typeof row.item.description === 'string' ? row.item.description : null,
    source: typeof row.item.source === 'string' ? row.item.source : null,
    base_price: toNumber(row.item.price),
    saved_price: toNumber(row.price),
    saved_at: new Date().toISOString(),
    stats: 'stats' in row.item && row.item.stats && typeof row.item.stats === 'object'
      ? row.item.stats as Record<string, unknown>
      : null,
  };
}

function normalizeCalculationRules(rules: EstimateCalculationRule[] | null | undefined): EstimateCalculationRule[] {
  const source = Array.isArray(rules) && rules.length > 0 ? rules : createDefaultCalculationRules();

  return source.map((rule, index) => ({
    id: normalizeText(rule.id) || `rule-${index + 1}`,
    enabled: rule.enabled !== false,
    label: normalizeText(rule.label) || `Правило ${index + 1}`,
    metric: normalizeMetric(rule.metric),
    item_type: rule.item_type || 'tovar',
    search: normalizeText(rule.search) || '',
    item_id: normalizeText(rule.item_id) || '',
    item_name: normalizeText(rule.item_name) || '',
    category: normalizeText(rule.category),
    subcategory: normalizeText(rule.subcategory),
    unit: normalizeText(rule.unit),
    base_price: toOptionalNumber(rule.base_price),
    image: typeof rule.image === 'string' ? rule.image : null,
    description: typeof rule.description === 'string' ? rule.description : null,
    multiplier: toNumber(rule.multiplier || 1) || 1,
    round_to: toNumber(rule.round_to || 0) || 0,
  }));
}

function normalizeMetric(metric: EstimateCalculationMetric | null | undefined): EstimateCalculationMetric {
  if (
    metric === 'area'
    || metric === 'perimeter'
    || metric === 'corners'
    || metric === 'light_points'
    || metric === 'pipes'
    || metric === 'curtain_tracks'
    || metric === 'niches'
    || metric === 'fixed'
  ) {
    return metric;
  }

  return 'fixed';
}

function resolveRuleItem(rule: EstimateCalculationRule, catalogRows: CartRow[]): ResolvedRuleItem | null {
  const directName = normalizeText(rule.item_name);
  const directPrice = toOptionalNumber(rule.base_price);

  if (directName && directPrice !== null) {
    return {
      type: rule.item_type || 'tovar',
      id: normalizeText(rule.item_id) || `rule-item-${rule.id}`,
      name: directName,
      category: normalizeText(rule.category),
      subcategory: normalizeText(rule.subcategory),
      unit: normalizeText(rule.unit),
      basePrice: directPrice,
      image: typeof rule.image === 'string' ? rule.image : null,
      description: typeof rule.description === 'string' ? rule.description : null,
      source: 'smart-rule',
      stats: null,
    };
  }

  const query = normalizeSearchToken(rule.search || rule.item_name || '');
  if (!query) return null;

  const matchedRow = catalogRows.find((row) => {
    if (rule.item_id && row.item.id === rule.item_id) return true;
    return normalizeSearchToken(row.item.name).includes(query);
  });

  if (!matchedRow) return null;
  return itemFromCatalog(matchedRow.type, matchedRow.item);
}

function itemFromCatalog(type: CartRow['type'], item: CatalogItem): ResolvedRuleItem {
  return {
    type,
    id: item.id,
    name: item.name,
    category: normalizeText(item.category),
    subcategory: normalizeText(item.subcategory),
    unit: normalizeText(item.unit),
    basePrice: toNumber(item.price),
    image: typeof item.image === 'string' ? item.image : null,
    description: typeof item.description === 'string' ? item.description : null,
    source: typeof item.source === 'string' ? item.source : null,
    stats: null,
  };
}

function calculateRuleQuantity(room: CalculatedEstimateRoom, rule: EstimateCalculationRule): number {
  const metricValue = metricValueOfRoom(room, rule.metric);
  const rawQty = rule.metric === 'fixed'
    ? rule.multiplier
    : metricValue * rule.multiplier;

  return roundRuleQuantity(rawQty, rule.round_to);
}

function metricValueOfRoom(room: CalculatedEstimateRoom, metric: EstimateCalculationMetric): number {
  if (metric === 'area') return room.area;
  if (metric === 'perimeter') return room.perimeter;
  if (metric === 'corners') return room.corners;
  if (metric === 'light_points') return room.lightPoints;
  if (metric === 'pipes') return room.pipes;
  if (metric === 'curtain_tracks') return room.curtainTracks;
  if (metric === 'niches') return room.niches;
  return 1;
}

function roundRuleQuantity(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const normalizedStep = toNumber(step);
  if (normalizedStep <= 0) {
    return roundPrice(value);
  }

  // Округляем вверх до шага правила, чтобы материала точно хватило.
  // Например, профиль можно считать по 0.1 м, а светильники поштучно.
  return roundPrice(Math.ceil(value / normalizedStep) * normalizedStep);
}

function normalizeComponentSnapshots(components: SavedEstimatePosition['components_snapshot'] | CartRow['components']): EstimateComponentSnapshot[] {
  if (!Array.isArray(components)) return [];

  return components.map((component) => ({
    item_type: component.item_type,
    item_id: component.item_id,
    item_name: component.item_name,
    qty: toNumber(component.qty),
    unit: component.unit || 'шт.',
    price: toNumber(component.price),
    total: roundPrice(toNumber(component.total) || toNumber(component.price) * toNumber(component.qty)),
    base_price: toOptionalNumber(component.base_price),
    category: normalizeText(component.category),
    subcategory: normalizeText(component.subcategory),
    image: typeof component.image === 'string' ? component.image : null,
    comment: typeof component.comment === 'string' ? component.comment : null,
  }));
}

function normalizeItemSnapshot(
  snapshot: SavedEstimatePosition['item_snapshot'] | EstimateItemSnapshot | null | undefined,
  fallback?: Pick<SavedEstimatePosition, 'item_type' | 'item_id' | 'item_name' | 'category' | 'subcategory' | 'unit' | 'base_price' | 'price'>
): EstimateItemSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      item_type: fallback?.item_type || 'tovar',
      item_id: fallback?.item_id || '',
      name: fallback?.item_name || '',
      category: fallback?.category || null,
      subcategory: fallback?.subcategory || null,
      unit: fallback?.unit || null,
      base_price: toOptionalNumber(fallback?.base_price),
      saved_price: toOptionalNumber(fallback?.price),
      saved_at: null,
      image: null,
      description: null,
      source: null,
      stats: null,
    };
  }

  return {
    item_type: snapshot.item_type,
    item_id: snapshot.item_id,
    name: snapshot.name,
    category: normalizeText(snapshot.category),
    subcategory: normalizeText(snapshot.subcategory),
    unit: typeof snapshot.unit === 'string' ? snapshot.unit : null,
    image: typeof snapshot.image === 'string' ? snapshot.image : null,
    description: typeof snapshot.description === 'string' ? snapshot.description : null,
    source: typeof snapshot.source === 'string' ? snapshot.source : null,
    base_price: toOptionalNumber(snapshot.base_price),
    saved_price: toOptionalNumber(snapshot.saved_price),
    saved_at: typeof snapshot.saved_at === 'string' ? snapshot.saved_at : null,
    stats: snapshot.stats && typeof snapshot.stats === 'object'
      ? snapshot.stats as Record<string, unknown>
      : null,
  };
}

function normalizeSourceSnapshot(snapshot: SavedEstimatePosition['source_snapshot'] | EstimateSourceSnapshot | null | undefined): EstimateSourceSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    return {};
  }

  return {
    image: typeof snapshot.image === 'string' ? snapshot.image : null,
    description: typeof snapshot.description === 'string' ? snapshot.description : null,
    source: typeof snapshot.source === 'string' ? snapshot.source : null,
    name: typeof snapshot.name === 'string' ? snapshot.name : null,
    category: typeof snapshot.category === 'string' ? snapshot.category : null,
    subcategory: typeof snapshot.subcategory === 'string' ? snapshot.subcategory : null,
    unit: typeof snapshot.unit === 'string' ? snapshot.unit : null,
    base_price: toOptionalNumber(snapshot.base_price),
    rule_id: typeof snapshot.rule_id === 'string' ? snapshot.rule_id : null,
    rule_label: typeof snapshot.rule_label === 'string' ? snapshot.rule_label : null,
    metric: snapshot.metric ? normalizeMetric(snapshot.metric) : null,
    auto_generated: typeof snapshot.auto_generated === 'boolean' ? snapshot.auto_generated : null,
  };
}

function normalizeText(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeSearchToken(value: string): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/\s+/g, ' ');
}
