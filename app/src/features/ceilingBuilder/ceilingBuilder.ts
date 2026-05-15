import type {
  CalculationTransferPayload,
  CeilingBuilderAngle,
  CeilingBuilderDiagonal,
  CeilingBuilderFabricSettings,
  CeilingBuilderObject,
  CeilingBuilderObjectType,
  CeilingBuilderPoint,
  CeilingBuilderSeam,
  CeilingBuilderValidationIssue,
  CeilingBuilderWall,
  CeilingFabricTexture,
  CeilingShapeBuilderState,
  CeilingShapeTemplate,
  CeilingSketch,
  CeilingSketchLinearFeature,
  CeilingSketchMetrics,
  CeilingSketchPointRef,
} from '../../types';
import {
  calculateCeilingSketchMetrics,
  createDefaultCeilingSketch,
} from '../ceilingSketch/ceilingSketch';

const DEFAULT_WIDTH_MM = 4200;
const DEFAULT_DEPTH_MM = 3200;
const DEFAULT_MARGIN_MM = 500;

function id(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function point(label: string, x: number, y: number, pointId = id('point')): CeilingBuilderPoint {
  return {
    id: pointId,
    label,
    x: Math.round(x),
    y: Math.round(y),
    locked: false,
  };
}

function distanceMm(a: Pick<CeilingBuilderPoint, 'x' | 'y'>, b: Pick<CeilingBuilderPoint, 'x' | 'y'>) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointRef(pointValue: Pick<CeilingBuilderPoint, 'x' | 'y'>): CeilingSketchPointRef {
  return { xMm: Math.round(pointValue.x), yMm: Math.round(pointValue.y) };
}

function nextPointLabel(index: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < alphabet.length) return alphabet[index];
  return `${alphabet[index % alphabet.length]}${Math.floor(index / alphabet.length) + 1}`;
}

function polygonSignedArea(points: CeilingBuilderPoint[]) {
  if (points.length < 3) return 0;

  return points.reduce((total, current, index) => {
    const next = points[(index + 1) % points.length];
    return total + current.x * next.y - next.x * current.y;
  }, 0) / 2;
}

function polygonAreaMm2(points: CeilingBuilderPoint[]) {
  return Math.abs(polygonSignedArea(points));
}

function polygonPerimeterMm(points: CeilingBuilderPoint[], isClosed: boolean) {
  if (points.length < 2) return 0;

  const edgeCount = isClosed ? points.length : points.length - 1;
  let total = 0;

  for (let index = 0; index < edgeCount; index += 1) {
    total += distanceMm(points[index], points[(index + 1) % points.length]);
  }

  return total;
}

function angleAtPoint(points: CeilingBuilderPoint[], index: number) {
  if (points.length < 3) return 0;

  const previous = points[(index - 1 + points.length) % points.length];
  const current = points[index];
  const next = points[(index + 1) % points.length];
  const first = { x: previous.x - current.x, y: previous.y - current.y };
  const second = { x: next.x - current.x, y: next.y - current.y };
  const dot = first.x * second.x + first.y * second.y;
  const magnitude = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (magnitude <= 0) return 0;

  const radians = Math.acos(Math.max(-1, Math.min(1, dot / magnitude)));
  return round((radians * 180) / Math.PI, 1);
}

function pointOrientation(points: CeilingBuilderPoint[], index: number) {
  const previous = points[(index - 1 + points.length) % points.length];
  const current = points[index];
  const next = points[(index + 1) % points.length];
  return (current.x - previous.x) * (next.y - current.y) - (current.y - previous.y) * (next.x - current.x);
}

function classifyAngle(points: CeilingBuilderPoint[], index: number): CeilingBuilderAngle['type'] {
  const angle = angleAtPoint(points, index);
  if (Math.abs(angle - 180) < 0.5) return 'straight';

  const orientation = Math.sign(polygonSignedArea(points)) || 1;
  const localOrientation = Math.sign(pointOrientation(points, index));
  return localOrientation === 0 || localOrientation === orientation ? 'outer' : 'inner';
}

function buildAngles(points: CeilingBuilderPoint[], isClosed: boolean): CeilingBuilderAngle[] {
  if (!isClosed || points.length < 3) return [];

  return points.map((pointValue, index) => ({
    id: `angle-${pointValue.id}`,
    pointId: pointValue.id,
    degrees: angleAtPoint(points, index),
    type: classifyAngle(points, index),
    isManual: false,
  }));
}

function wallLabel(from: CeilingBuilderPoint, to: CeilingBuilderPoint) {
  return `${from.label}${to.label}`;
}

function buildWalls(
  points: CeilingBuilderPoint[],
  isClosed: boolean,
  previousWalls: CeilingBuilderWall[] = []
): CeilingBuilderWall[] {
  const edgeCount = isClosed ? points.length : Math.max(0, points.length - 1);
  const previousById = new Map(previousWalls.map((wall) => [wall.id, wall]));
  const nextWalls: CeilingBuilderWall[] = [];

  for (let index = 0; index < edgeCount; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    const wallId = `wall-${from.id}-${to.id}`;
    const previous = previousById.get(wallId);

    nextWalls.push({
      id: wallId,
      fromPointId: from.id,
      toPointId: to.id,
      label: wallLabel(from, to),
      lengthMm: previous?.lengthMm ?? Math.round(distanceMm(from, to)),
      isMeasured: previous?.isMeasured ?? false,
      comment: previous?.comment ?? '',
    });
  }

  return nextWalls;
}

function buildDefaultFabricSettings(): CeilingBuilderFabricSettings {
  return {
    material: 'pvc',
    texture: '',
    color: 'white',
    manufacturer: '',
    rollWidthMm: 3200,
    orientationMode: 'auto',
    orientationWallId: null,
    orientationAngle: 0,
    seamMode: 'auto',
    allowanceMm: 0,
    shrinkPercent: 0,
    harpoonEnabled: true,
    harpoonType: 'standard',
    productionComment: '',
  };
}

function basePointsForTemplate(template: CeilingShapeTemplate) {
  if (template === 'l_shape') {
    return [
      point('A', 0, 0),
      point('B', 4200, 0),
      point('C', 4200, 1600),
      point('D', 2600, 1600),
      point('E', 2600, 3200),
      point('F', 0, 3200),
    ];
  }

  if (template === 'u_shape') {
    return [
      point('A', 0, 0),
      point('B', 4400, 0),
      point('C', 4400, 3200),
      point('D', 3000, 3200),
      point('E', 3000, 1800),
      point('F', 1400, 1800),
      point('G', 1400, 3200),
      point('H', 0, 3200),
    ];
  }

  if (template === 'polygon') {
    return [
      point('A', 0, 0),
      point('B', 3600, 0),
      point('C', 4300, 1800),
      point('D', 2600, 3300),
      point('E', 0, 2600),
    ];
  }

  if (template === 'free') {
    return [];
  }

  return [
    point('A', 0, 0),
    point('B', DEFAULT_WIDTH_MM, 0),
    point('C', DEFAULT_WIDTH_MM, DEFAULT_DEPTH_MM),
    point('D', 0, DEFAULT_DEPTH_MM),
  ];
}

function defaultViewState() {
  return {
    zoom: 1,
    panX: 0,
    panY: 0,
    showGrid: true,
    showLabels: true,
    orthoEnabled: false,
    selectedElementId: null,
    selectedElementType: null,
    activeMode: 'shape' as const,
  };
}

function buildSeamFromSketch(seam: CeilingSketch['fabric']['seams'][number], index: number): CeilingBuilderSeam {
  return {
    id: seam.id || `seam-${index + 1}`,
    startX: seam.start.xMm,
    startY: seam.start.yMm,
    endX: seam.end.xMm,
    endY: seam.end.yMm,
    offsetMm: 0,
    angle: round((Math.atan2(seam.end.yMm - seam.start.yMm, seam.end.xMm - seam.start.xMm) * 180) / Math.PI, 1),
    isManual: true,
    comment: '',
  };
}

function nearestWall(
  points: CeilingBuilderPoint[],
  walls: CeilingBuilderWall[],
  object: CeilingBuilderObject
): CeilingBuilderWall | null {
  if (walls.length === 0) return null;

  let bestWall: CeilingBuilderWall | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  walls.forEach((wall) => {
    const from = points.find((pointValue) => pointValue.id === wall.fromPointId);
    const to = points.find((pointValue) => pointValue.id === wall.toPointId);
    if (!from || !to) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx ** 2 + dy ** 2;
    const ratio = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((object.x - from.x) * dx + (object.y - from.y) * dy) / lengthSq));
    const projection = { x: from.x + dx * ratio, y: from.y + dy * ratio };
    const currentDistance = distanceMm({ x: object.x, y: object.y }, projection);

    if (currentDistance < bestDistance) {
      bestDistance = currentDistance;
      bestWall = wall;
    }
  });

  return bestWall;
}

export function createDefaultCeilingBuilderState(
  template: CeilingShapeTemplate = 'rectangle',
  roomId: string | null = null,
  calculationId: string | null = null
): CeilingShapeBuilderState {
  const points = basePointsForTemplate(template);
  const isClosed = template !== 'free' && points.length >= 3;
  const walls = buildWalls(points, isClosed);

  return {
    id: id('builder'),
    roomId,
    calculationId,
    template,
    isClosed,
    points,
    walls,
    diagonals: [],
    angles: buildAngles(points, isClosed),
    objects: [],
    fabricSettings: buildDefaultFabricSettings(),
    seams: [],
    viewState: defaultViewState(),
    validationIssues: [],
    notes: {
      productionComment: '',
      installerComment: '',
      measurementComment: '',
    },
    updatedAt: new Date().toISOString(),
  };
}

export function applyTemplate(
  state: CeilingShapeBuilderState,
  template: CeilingShapeTemplate
): CeilingShapeBuilderState {
  const points = basePointsForTemplate(template);
  const isClosed = template !== 'free' && points.length >= 3;
  const walls = buildWalls(points, isClosed);

  return withValidation({
    ...state,
    template,
    isClosed,
    points,
    walls,
    diagonals: [],
    angles: buildAngles(points, isClosed),
    viewState: {
      ...state.viewState,
      selectedElementId: null,
      selectedElementType: null,
    },
    updatedAt: new Date().toISOString(),
  });
}

export function addBuilderPoint(
  state: CeilingShapeBuilderState,
  x: number,
  y: number
): CeilingShapeBuilderState {
  const points = [
    ...state.points,
    point(nextPointLabel(state.points.length), x, y),
  ];

  return withValidation({
    ...state,
    template: state.template === 'free' ? 'free' : state.template,
    isClosed: false,
    points,
    walls: buildWalls(points, false, state.walls),
    angles: [],
    updatedAt: new Date().toISOString(),
  });
}

export function closeBuilderContour(state: CeilingShapeBuilderState): CeilingShapeBuilderState {
  if (state.points.length < 3) return state;

  return withValidation({
    ...state,
    isClosed: true,
    walls: buildWalls(state.points, true, state.walls),
    angles: buildAngles(state.points, true),
    updatedAt: new Date().toISOString(),
  });
}

export function moveBuilderPoint(
  state: CeilingShapeBuilderState,
  pointId: string,
  x: number,
  y: number
): CeilingShapeBuilderState {
  const points = state.points.map((pointValue) => (
    pointValue.id === pointId && !pointValue.locked
      ? { ...pointValue, x: Math.round(x), y: Math.round(y) }
      : pointValue
  ));

  return withValidation({
    ...state,
    points,
    walls: buildWalls(points, state.isClosed, state.walls),
    angles: buildAngles(points, state.isClosed),
    updatedAt: new Date().toISOString(),
  });
}

export function setBuilderPointLocked(
  state: CeilingShapeBuilderState,
  pointId: string,
  locked: boolean
): CeilingShapeBuilderState {
  return withValidation({
    ...state,
    points: state.points.map((pointValue) => (
      pointValue.id === pointId ? { ...pointValue, locked } : pointValue
    )),
    updatedAt: new Date().toISOString(),
  });
}

export function renameBuilderPoint(
  state: CeilingShapeBuilderState,
  pointId: string,
  label: string
): CeilingShapeBuilderState {
  const points = state.points.map((pointValue) => (
    pointValue.id === pointId ? { ...pointValue, label: label.trim().toUpperCase() || pointValue.label } : pointValue
  ));

  return withValidation({
    ...state,
    points,
    walls: buildWalls(points, state.isClosed, state.walls),
    angles: buildAngles(points, state.isClosed),
    updatedAt: new Date().toISOString(),
  });
}

export function removeBuilderPoint(
  state: CeilingShapeBuilderState,
  pointId: string
): CeilingShapeBuilderState {
  if (state.points.length <= 1) return state;

  const points = state.points
    .filter((pointValue) => pointValue.id !== pointId)
    .map((pointValue, index) => ({ ...pointValue, label: nextPointLabel(index) }));
  const isClosed = state.isClosed && points.length >= 3;

  return withValidation({
    ...state,
    points,
    isClosed,
    walls: buildWalls(points, isClosed, state.walls),
    diagonals: state.diagonals.filter((diagonal) => diagonal.fromPointId !== pointId && diagonal.toPointId !== pointId),
    angles: buildAngles(points, isClosed),
    updatedAt: new Date().toISOString(),
  });
}

export function insertBuilderPointAfter(
  state: CeilingShapeBuilderState,
  pointId: string
): CeilingShapeBuilderState {
  const index = state.points.findIndex((pointValue) => pointValue.id === pointId);
  if (index === -1 || state.points.length === 0) return state;

  const current = state.points[index];
  const next = state.points[(index + 1) % state.points.length];
  const inserted = point('', (current.x + next.x) / 2, (current.y + next.y) / 2);
  const points = [
    ...state.points.slice(0, index + 1),
    inserted,
    ...state.points.slice(index + 1),
  ].map((pointValue, pointIndex) => ({ ...pointValue, label: nextPointLabel(pointIndex) }));

  return withValidation({
    ...state,
    points,
    walls: buildWalls(points, state.isClosed, state.walls),
    angles: buildAngles(points, state.isClosed),
    updatedAt: new Date().toISOString(),
  });
}

export function setBuilderWallLength(
  state: CeilingShapeBuilderState,
  wallId: string,
  lengthMm: number | null
): CeilingShapeBuilderState {
  const safeLength = lengthMm === null ? null : Math.max(0, Math.round(lengthMm));

  return withValidation({
    ...state,
    walls: state.walls.map((wall) => (
      wall.id === wallId
        ? { ...wall, lengthMm: safeLength, isMeasured: Boolean(safeLength && safeLength > 0) }
        : wall
    )),
    updatedAt: new Date().toISOString(),
  });
}

export function setBuilderWallComment(
  state: CeilingShapeBuilderState,
  wallId: string,
  comment: string
): CeilingShapeBuilderState {
  return withValidation({
    ...state,
    walls: state.walls.map((wall) => wall.id === wallId ? { ...wall, comment } : wall),
    updatedAt: new Date().toISOString(),
  });
}

export function addBuilderDiagonal(
  state: CeilingShapeBuilderState,
  fromPointId: string,
  toPointId: string,
  lengthMm: number | null = null
): CeilingShapeBuilderState {
  if (fromPointId === toPointId) return state;
  const from = state.points.find((pointValue) => pointValue.id === fromPointId);
  const to = state.points.find((pointValue) => pointValue.id === toPointId);
  if (!from || !to) return state;

  const diagonal: CeilingBuilderDiagonal = {
    id: id('diagonal'),
    fromPointId,
    toPointId,
    label: `${from.label}${to.label}`,
    lengthMm: lengthMm ?? Math.round(distanceMm(from, to)),
    comment: '',
  };

  return withValidation({
    ...state,
    diagonals: [...state.diagonals, diagonal],
    updatedAt: new Date().toISOString(),
  });
}

export function updateBuilderDiagonal(
  state: CeilingShapeBuilderState,
  diagonalId: string,
  patch: Partial<Pick<CeilingBuilderDiagonal, 'lengthMm' | 'comment'>>
): CeilingShapeBuilderState {
  return withValidation({
    ...state,
    diagonals: state.diagonals.map((diagonal) => (
      diagonal.id === diagonalId
        ? {
          ...diagonal,
          ...patch,
          lengthMm: patch.lengthMm === undefined || patch.lengthMm === null
            ? patch.lengthMm ?? diagonal.lengthMm
            : Math.max(0, Math.round(patch.lengthMm)),
        }
        : diagonal
    )),
    updatedAt: new Date().toISOString(),
  });
}

export function removeBuilderDiagonal(
  state: CeilingShapeBuilderState,
  diagonalId: string
): CeilingShapeBuilderState {
  return withValidation({
    ...state,
    diagonals: state.diagonals.filter((diagonal) => diagonal.id !== diagonalId),
    updatedAt: new Date().toISOString(),
  });
}

export function addBuilderObject(
  state: CeilingShapeBuilderState,
  type: CeilingBuilderObjectType
): CeilingShapeBuilderState {
  const bounds = calculateBuilderBounds(state);
  const object: CeilingBuilderObject = {
    id: id(type),
    type,
    x: Math.round(bounds.minX + bounds.width / 2),
    y: Math.round(bounds.minY + bounds.height / 2),
    quantity: 1,
    comment: '',
  };

  if (type === 'pipe') {
    object.diameterMm = 25;
  }

  if (type === 'spotlight' || type === 'spotlight_group') {
    object.diameterMm = 80;
    object.meta = { thermalRing: true };
  }

  if (type === 'chandelier') {
    object.diameterMm = 160;
    object.meta = { platformDiameterMm: 160 };
  }

  if (type === 'cornice' || type === 'niche') {
    const wall = state.walls[0];
    const from = state.points.find((pointValue) => pointValue.id === wall?.fromPointId);
    const to = state.points.find((pointValue) => pointValue.id === wall?.toPointId);
    if (wall && from && to) {
      object.linkedWallId = wall.id;
      object.x = from.x;
      object.y = from.y;
      object.endX = to.x;
      object.endY = to.y;
      object.lengthMm = wall.lengthMm ?? Math.round(distanceMm(from, to));
    }
  }

  return withValidation({
    ...state,
    objects: [...state.objects, object],
    updatedAt: new Date().toISOString(),
  });
}

export function updateBuilderObject(
  state: CeilingShapeBuilderState,
  objectId: string,
  patch: Partial<CeilingBuilderObject>
): CeilingShapeBuilderState {
  const nextObjects = state.objects.map((object) => {
    if (object.id !== objectId) return object;

    const next = {
      ...object,
      ...patch,
      x: patch.x === undefined ? object.x : Math.round(patch.x),
      y: patch.y === undefined ? object.y : Math.round(patch.y),
      endX: patch.endX === undefined ? object.endX : Math.round(patch.endX),
      endY: patch.endY === undefined ? object.endY : Math.round(patch.endY),
      diameterMm: patch.diameterMm === undefined ? object.diameterMm : Math.max(0, Math.round(patch.diameterMm)),
      widthMm: patch.widthMm === undefined ? object.widthMm : Math.max(0, Math.round(patch.widthMm)),
      heightMm: patch.heightMm === undefined ? object.heightMm : Math.max(0, Math.round(patch.heightMm)),
      lengthMm: patch.lengthMm === undefined ? object.lengthMm : Math.max(0, Math.round(patch.lengthMm)),
      quantity: patch.quantity === undefined ? object.quantity : Math.max(1, Math.round(patch.quantity)),
      meta: patch.meta === undefined ? object.meta : { ...object.meta, ...patch.meta },
    };

    if (!next.linkedWallId) {
      const nearest = nearestWall(state.points, state.walls, next);
      if (nearest) next.linkedWallId = nearest.id;
    }

    return next;
  });

  return withValidation({
    ...state,
    objects: nextObjects,
    updatedAt: new Date().toISOString(),
  });
}

export function removeBuilderObject(
  state: CeilingShapeBuilderState,
  objectId: string
): CeilingShapeBuilderState {
  return withValidation({
    ...state,
    objects: state.objects.filter((object) => object.id !== objectId),
    updatedAt: new Date().toISOString(),
  });
}

export function updateBuilderFabricSettings(
  state: CeilingShapeBuilderState,
  patch: Partial<CeilingBuilderFabricSettings>
): CeilingShapeBuilderState {
  return withValidation({
    ...state,
    fabricSettings: {
      ...state.fabricSettings,
      ...patch,
    },
    updatedAt: new Date().toISOString(),
  });
}

export function addBuilderSeam(state: CeilingShapeBuilderState): CeilingShapeBuilderState {
  const bounds = calculateBuilderBounds(state);
  const seam: CeilingBuilderSeam = {
    id: id('seam'),
    startX: Math.round(bounds.minX + bounds.width / 2),
    startY: bounds.minY,
    endX: Math.round(bounds.minX + bounds.width / 2),
    endY: bounds.maxY,
    offsetMm: Math.round(bounds.width / 2),
    angle: 90,
    isManual: true,
    comment: '',
  };

  return withValidation({
    ...state,
    seams: [...state.seams, seam],
    updatedAt: new Date().toISOString(),
  });
}

export function updateBuilderSeam(
  state: CeilingShapeBuilderState,
  seamId: string,
  patch: Partial<CeilingBuilderSeam>
): CeilingShapeBuilderState {
  return withValidation({
    ...state,
    seams: state.seams.map((seam) => seam.id === seamId ? { ...seam, ...patch } : seam),
    updatedAt: new Date().toISOString(),
  });
}

export function removeBuilderSeam(
  state: CeilingShapeBuilderState,
  seamId: string
): CeilingShapeBuilderState {
  return withValidation({
    ...state,
    seams: state.seams.filter((seam) => seam.id !== seamId),
    updatedAt: new Date().toISOString(),
  });
}

export function updateBuilderNotes(
  state: CeilingShapeBuilderState,
  patch: Partial<CeilingShapeBuilderState['notes']>
): CeilingShapeBuilderState {
  return withValidation({
    ...state,
    notes: {
      ...state.notes,
      ...patch,
    },
    updatedAt: new Date().toISOString(),
  });
}

export function calculateBuilderBounds(state: Pick<CeilingShapeBuilderState, 'points' | 'objects' | 'seams'>) {
  const candidates = [
    ...state.points.map((pointValue) => ({ x: pointValue.x, y: pointValue.y })),
    ...state.objects.flatMap((object) => [
      { x: object.x, y: object.y },
      ...(object.endX === undefined || object.endY === undefined ? [] : [{ x: object.endX, y: object.endY }]),
    ]),
    ...state.seams.flatMap((seam) => [
      { x: seam.startX, y: seam.startY },
      { x: seam.endX, y: seam.endY },
    ]),
  ];

  if (candidates.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: DEFAULT_WIDTH_MM,
      maxY: DEFAULT_DEPTH_MM,
      width: DEFAULT_WIDTH_MM,
      height: DEFAULT_DEPTH_MM,
    };
  }

  const xs = candidates.map((candidate) => candidate.x);
  const ys = candidates.map((candidate) => candidate.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function calculateBuilderMetrics(state: CeilingShapeBuilderState): CeilingSketchMetrics {
  const areaM2 = state.isClosed ? round(polygonAreaMm2(state.points) / 1_000_000, 2) : 0;
  const perimeterM = state.isClosed ? round(polygonPerimeterMm(state.points, true) / 1000, 2) : 0;
  const objectCount = (type: CeilingBuilderObjectType) => state.objects
    .filter((object) => object.type === type)
    .reduce((sum, object) => sum + object.quantity, 0);
  const linearLengthM = (types: CeilingBuilderObjectType[]) => round(state.objects
    .filter((object) => types.includes(object.type))
    .reduce((sum, object) => sum + (object.lengthMm || 0), 0) / 1000, 2);
  const seamLengthM = round(state.seams.reduce((sum, seam) => (
    sum + distanceMm({ x: seam.startX, y: seam.startY }, { x: seam.endX, y: seam.endY })
  ), 0) / 1000, 2);

  return {
    areaM2,
    perimeterM,
    corners: state.isClosed ? state.points.length : 0,
    lightPoints: objectCount('spotlight') + objectCount('spotlight_group') + objectCount('chandelier'),
    lightLinesM: 0,
    pipes: objectCount('pipe'),
    curtainTracksM: linearLengthM(['cornice']),
    nichesM: linearLengthM(['niche']),
    levels: 0,
    seamsM: seamLengthM,
  };
}

export function pointInsideContour(state: CeilingShapeBuilderState, x: number, y: number) {
  if (!state.isClosed || state.points.length < 3) return false;

  let inside = false;
  for (let index = 0, previousIndex = state.points.length - 1; index < state.points.length; previousIndex = index, index += 1) {
    const current = state.points[index];
    const previous = state.points[previousIndex];
    const intersects = ((current.y > y) !== (previous.y > y))
      && (x < ((previous.x - current.x) * (y - current.y)) / (previous.y - current.y || 1) + current.x);
    if (intersects) inside = !inside;
  }

  return inside;
}

export function fabricOrientationAngle(state: CeilingShapeBuilderState) {
  if (state.fabricSettings.orientationMode === 'manual') {
    return state.fabricSettings.orientationAngle ?? 0;
  }

  if (state.fabricSettings.orientationMode === 'wall' && state.fabricSettings.orientationWallId) {
    const wall = state.walls.find((item) => item.id === state.fabricSettings.orientationWallId);
    const from = state.points.find((pointValue) => pointValue.id === wall?.fromPointId);
    const to = state.points.find((pointValue) => pointValue.id === wall?.toPointId);
    if (wall && from && to) {
      return round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI, 1);
    }
  }

  if (state.fabricSettings.orientationMode === 'longest_wall') {
    const wall = [...state.walls].sort((left, right) => (right.lengthMm || 0) - (left.lengthMm || 0))[0];
    const from = state.points.find((pointValue) => pointValue.id === wall?.fromPointId);
    const to = state.points.find((pointValue) => pointValue.id === wall?.toPointId);
    if (wall && from && to) {
      return round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI, 1);
    }
  }

  return state.fabricSettings.orientationAngle ?? 0;
}

export function projectedFabricWidthMm(state: CeilingShapeBuilderState) {
  if (state.points.length === 0) return 0;

  const angleRad = (fabricOrientationAngle(state) * Math.PI) / 180;
  const perpendicular = {
    x: -Math.sin(angleRad),
    y: Math.cos(angleRad),
  };
  const projections = state.points.map((pointValue) => pointValue.x * perpendicular.x + pointValue.y * perpendicular.y);
  return Math.round(Math.max(...projections) - Math.min(...projections));
}

export function fabricNeedsSeam(state: CeilingShapeBuilderState) {
  const width = projectedFabricWidthMm(state);
  const rollWidth = state.fabricSettings.rollWidthMm || 0;
  return width > 0 && rollWidth > 0 && width > rollWidth;
}

export function validateBuilderState(state: CeilingShapeBuilderState): CeilingBuilderValidationIssue[] {
  const issues: CeilingBuilderValidationIssue[] = [];
  const metrics = calculateBuilderMetrics(state);

  if (!state.isClosed) {
    issues.push({
      id: 'contour-open',
      severity: 'critical',
      message: 'Контур не замкнут.',
      actionMode: 'shape',
    });
  }

  if (state.points.length < 3) {
    issues.push({
      id: 'points-insufficient',
      severity: 'critical',
      message: 'Для расчета нужно минимум 3 точки.',
      actionMode: 'shape',
    });
  }

  if (state.walls.some((wall) => !wall.isMeasured || !wall.lengthMm)) {
    issues.push({
      id: 'walls-unmeasured',
      severity: 'critical',
      message: 'Не все стены имеют введенный размер.',
      actionMode: 'dimensions',
    });
  }

  if (metrics.areaM2 <= 0) {
    issues.push({
      id: 'area-empty',
      severity: 'critical',
      message: 'Площадь не рассчитана.',
      actionMode: 'shape',
    });
  }

  if (metrics.perimeterM <= 0) {
    issues.push({
      id: 'perimeter-empty',
      severity: 'critical',
      message: 'Периметр не рассчитан.',
      actionMode: 'shape',
    });
  }

  if (!state.fabricSettings.texture) {
    issues.push({
      id: 'fabric-texture-empty',
      severity: 'critical',
      message: 'Не выбрана фактура полотна.',
      actionMode: 'fabric',
    });
  }

  if (!state.fabricSettings.rollWidthMm) {
    issues.push({
      id: 'fabric-roll-empty',
      severity: 'critical',
      message: 'Не выбрана ширина рулона.',
      actionMode: 'fabric',
    });
  }

  state.objects.forEach((object) => {
    if (!pointInsideContour(state, object.x, object.y)) {
      issues.push({
        id: `object-outside-${object.id}`,
        severity: 'critical',
        message: 'Объект находится за пределами контура.',
        relatedElementType: 'object',
        relatedElementId: object.id,
        actionMode: 'objects',
      });
    }
  });

  if (state.diagonals.length === 0) {
    issues.push({
      id: 'diagonals-empty',
      severity: 'warning',
      message: 'Нет диагоналей для контрольной проверки.',
      actionMode: 'diagonals',
    });
  }

  state.diagonals.forEach((diagonal) => {
    if (!diagonal.lengthMm) return;
    const from = state.points.find((pointValue) => pointValue.id === diagonal.fromPointId);
    const to = state.points.find((pointValue) => pointValue.id === diagonal.toPointId);
    if (!from || !to) return;

    const actualLength = Math.round(distanceMm(from, to));
    if (Math.abs(actualLength - diagonal.lengthMm) > 50) {
      issues.push({
        id: `diagonal-mismatch-${diagonal.id}`,
        severity: 'warning',
        message: `Диагональ ${diagonal.label} отличается от текущей геометрии на ${Math.abs(actualLength - diagonal.lengthMm)} мм.`,
        relatedElementType: 'diagonal',
        relatedElementId: diagonal.id,
        actionMode: 'diagonals',
      });
    }
  });

  if (state.angles.some((angle) => Math.abs(angle.degrees - 90) > 1 && Math.abs(angle.degrees - 180) > 1)) {
    issues.push({
      id: 'angles-nonstandard',
      severity: 'warning',
      message: 'Есть нестандартные углы.',
      actionMode: 'shape',
    });
  }

  if (state.fabricSettings.orientationMode === 'auto') {
    issues.push({
      id: 'fabric-orientation-auto',
      severity: 'warning',
      message: 'Ориентация полотна оставлена автоматической.',
      actionMode: 'fabric',
    });
  }

  if (fabricNeedsSeam(state) && state.fabricSettings.seamMode === 'none') {
    issues.push({
      id: 'fabric-seam-required',
      severity: 'warning',
      message: 'При выбранной ширине рулона нужен шов.',
      actionMode: 'fabric',
    });
  }

  state.objects.forEach((object) => {
    if ((object.type === 'pipe' || object.type === 'spotlight' || object.type === 'chandelier')
      && (object.offsetFromWall1Mm === undefined || object.offsetFromWall2Mm === undefined)) {
      issues.push({
        id: `object-offsets-${object.id}`,
        severity: 'warning',
        message: 'Есть объекты без точной привязки к стенам.',
        relatedElementType: 'object',
        relatedElementId: object.id,
        actionMode: 'objects',
      });
    }
  });

  return issues;
}

export function withValidation(state: CeilingShapeBuilderState): CeilingShapeBuilderState {
  return {
    ...state,
    validationIssues: validateBuilderState(state),
  };
}

export function parseDimensionInput(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;

  const numeric = Number.parseFloat(normalized.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric)) return null;

  if (normalized.includes('м') || normalized.includes('.') || normalized.includes('m')) {
    return Math.round(numeric * 1000);
  }

  return Math.round(numeric);
}

function builderObjectsFromSketch(sketch: CeilingSketch): CeilingBuilderObject[] {
  const fixtures: CeilingBuilderObject[] = sketch.fixtures.map((fixture) => ({
    id: fixture.id,
    type: fixture.kind === 'spot'
      ? 'spotlight'
      : fixture.kind === 'chandelier'
        ? 'chandelier'
        : fixture.kind === 'vent'
          ? 'vent'
          : 'sensor',
    x: fixture.point.xMm,
    y: fixture.point.yMm,
    diameterMm: fixture.diameterMm,
    quantity: 1,
    comment: '',
  }));
  const obstacles: CeilingBuilderObject[] = sketch.obstacles.map((obstacle) => ({
    id: obstacle.id,
    type: obstacle.kind === 'pipe' || obstacle.kind === 'riser' ? 'pipe' : 'column',
    x: obstacle.point.xMm,
    y: obstacle.point.yMm,
    diameterMm: obstacle.diameterMm,
    widthMm: obstacle.widthMm,
    heightMm: obstacle.depthMm,
    quantity: 1,
    comment: '',
  }));
  const linearFeatures: CeilingBuilderObject[] = sketch.linearFeatures
    .filter((feature) => feature.kind === 'curtain_track' || feature.kind === 'niche')
    .map((feature) => ({
      id: feature.id,
      type: feature.kind === 'curtain_track' ? 'cornice' : 'niche',
      x: feature.start.xMm,
      y: feature.start.yMm,
      endX: feature.end.xMm,
      endY: feature.end.yMm,
      lengthMm: Math.round(Math.hypot(feature.end.xMm - feature.start.xMm, feature.end.yMm - feature.start.yMm)),
      widthMm: feature.widthMm,
      quantity: 1,
      comment: '',
    }));

  return [...fixtures, ...obstacles, ...linearFeatures];
}

export function createBuilderStateFromSketch(
  sketch: CeilingSketch,
  roomId: string | null = null,
  calculationId: string | null = null
): CeilingShapeBuilderState {
  if (sketch.builderState) {
    return withValidation({
      ...sketch.builderState,
      roomId: roomId ?? sketch.builderState.roomId,
      calculationId: calculationId ?? sketch.builderState.calculationId,
      viewState: {
        ...defaultViewState(),
        ...sketch.builderState.viewState,
      },
    });
  }

  const points = sketch.points.map((sketchPoint, index) => point(
    nextPointLabel(index),
    sketchPoint.xMm,
    sketchPoint.yMm,
    sketchPoint.id
  ));
  const walls = buildWalls(points, points.length >= 3).map((wall) => ({
    ...wall,
    isMeasured: true,
  }));
  const texture: CeilingBuilderFabricSettings['texture'] = sketch.fabric.texture === 'matte'
    ? 'matte'
    : sketch.fabric.texture;

  return withValidation({
    id: id('builder'),
    roomId,
    calculationId,
    template: 'polygon',
    isClosed: points.length >= 3,
    points,
    walls,
    diagonals: [],
    angles: buildAngles(points, points.length >= 3),
    objects: builderObjectsFromSketch(sketch),
    fabricSettings: {
      ...buildDefaultFabricSettings(),
      texture,
      rollWidthMm: sketch.fabric.rollWidthMm,
      orientationMode: 'manual',
      orientationAngle: sketch.fabric.directionDeg,
    },
    seams: sketch.fabric.seams.map(buildSeamFromSketch),
    viewState: defaultViewState(),
    validationIssues: [],
    notes: {
      productionComment: '',
      installerComment: '',
      measurementComment: '',
    },
    updatedAt: sketch.updatedAt || new Date().toISOString(),
  });
}

function sketchTexture(texture: CeilingBuilderFabricSettings['texture']): CeilingFabricTexture {
  if (texture === 'satin' || texture === 'gloss' || texture === 'fabric') return texture;
  return 'matte';
}

function linearFeatureFromBuilderObject(object: CeilingBuilderObject): CeilingSketchLinearFeature | null {
  if ((object.type !== 'cornice' && object.type !== 'niche') || object.endX === undefined || object.endY === undefined) {
    return null;
  }

  return {
    id: object.id,
    kind: object.type === 'cornice' ? 'curtain_track' : 'niche',
    start: { xMm: object.x, yMm: object.y },
    end: { xMm: object.endX, yMm: object.endY },
    widthMm: object.widthMm || 80,
  };
}

export function builderToCeilingSketch(
  state: CeilingShapeBuilderState,
  baseSketch: CeilingSketch = createDefaultCeilingSketch()
): CeilingSketch {
  const fixtures = state.objects
    .filter((object) => ['spotlight', 'spotlight_group', 'chandelier', 'vent', 'sensor'].includes(object.type))
    .flatMap((object) => Array.from({ length: object.quantity }, (_, index) => ({
      id: object.quantity > 1 ? `${object.id}-${index + 1}` : object.id,
      kind: object.type === 'spotlight' || object.type === 'spotlight_group'
        ? 'spot' as const
        : object.type === 'chandelier'
          ? 'chandelier' as const
          : object.type === 'vent'
            ? 'vent' as const
            : 'sensor' as const,
      point: { xMm: object.x, yMm: object.y },
      diameterMm: object.diameterMm || 80,
    })));
  const obstacles = state.objects
    .filter((object) => object.type === 'pipe' || object.type === 'column')
    .flatMap((object) => Array.from({ length: object.quantity }, (_, index) => ({
      id: object.quantity > 1 ? `${object.id}-${index + 1}` : object.id,
      kind: object.type === 'pipe' ? 'pipe' as const : 'column' as const,
      point: { xMm: object.x, yMm: object.y },
      diameterMm: object.diameterMm || 110,
      widthMm: object.widthMm,
      depthMm: object.heightMm,
      clearanceMm: 30,
    })));
  const linearFeatures = state.objects
    .map(linearFeatureFromBuilderObject)
    .filter((feature): feature is CeilingSketchLinearFeature => Boolean(feature));

  return {
    ...baseSketch,
    version: 1,
    points: state.points.map((pointValue) => ({
      id: pointValue.id,
      xMm: pointValue.x,
      yMm: pointValue.y,
    })),
    fixtures,
    obstacles,
    linearFeatures,
    fabric: {
      texture: sketchTexture(state.fabricSettings.texture),
      rollWidthMm: state.fabricSettings.rollWidthMm || 3200,
      directionDeg: fabricOrientationAngle(state),
      seams: state.seams.map((seam) => ({
        id: seam.id,
        start: { xMm: seam.startX, yMm: seam.startY },
        end: { xMm: seam.endX, yMm: seam.endY },
      })),
    },
    builderState: withValidation(state),
    updatedAt: new Date().toISOString(),
  };
}

export function buildCalculationTransferPayload(state: CeilingShapeBuilderState): CalculationTransferPayload {
  const metrics = calculateBuilderMetrics(state);
  const innerCornerCount = state.angles.filter((angle) => angle.type === 'inner').length;
  const outerCornerCount = state.angles.filter((angle) => angle.type === 'outer').length;
  const countByType = (type: CeilingBuilderObjectType) => state.objects
    .filter((object) => object.type === type)
    .reduce((sum, object) => sum + object.quantity, 0);
  const corniceLengthM = round(state.objects
    .filter((object) => object.type === 'cornice')
    .reduce((sum, object) => sum + (object.lengthMm || 0), 0) / 1000, 2);

  return {
    areaM2: metrics.areaM2,
    perimeterM: metrics.perimeterM,
    cornerCount: metrics.corners,
    wallCount: state.walls.length,
    innerCornerCount,
    outerCornerCount,
    walls: state.walls,
    diagonals: state.diagonals,
    hasNonStandardAngles: state.angles.some((angle) => Math.abs(angle.degrees - 90) > 1 && Math.abs(angle.degrees - 180) > 1),
    pipeCount: countByType('pipe'),
    chandelierCount: countByType('chandelier'),
    spotlightCount: countByType('spotlight') + countByType('spotlight_group'),
    corniceLengthM,
    fabricSettings: state.fabricSettings,
    objects: state.objects,
    notes: {
      ...state.notes,
      productionComment: state.fabricSettings.productionComment || state.notes.productionComment,
    },
  };
}

export function syncBuilderIntoSketch(
  state: CeilingShapeBuilderState,
  baseSketch?: CeilingSketch
) {
  const sketch = builderToCeilingSketch(state, baseSketch);
  return {
    sketch,
    metrics: calculateCeilingSketchMetrics(sketch),
    payload: buildCalculationTransferPayload(state),
  };
}

export function measuredWallLengthText(wall: CeilingBuilderWall) {
  return wall.lengthMm ? `${wall.lengthMm}` : '?';
}

export function defaultBuilderViewport(state: CeilingShapeBuilderState) {
  const bounds = calculateBuilderBounds(state);
  return {
    x: bounds.minX - DEFAULT_MARGIN_MM,
    y: bounds.minY - DEFAULT_MARGIN_MM,
    width: bounds.width + DEFAULT_MARGIN_MM * 2,
    height: bounds.height + DEFAULT_MARGIN_MM * 2,
  };
}
