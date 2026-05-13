import type {
  CeilingFabricTexture,
  CeilingSketch,
  CeilingSketchLinearFeature,
  CeilingSketchMetrics,
  CeilingSketchObstacle,
  CeilingSketchPoint,
  CeilingSketchPointRef,
  CeilingSketchFixture,
  EstimateSettingsSnapshot,
} from '../../types';

const DEFAULT_WIDTH_MM = 4200;
const DEFAULT_DEPTH_MM = 3200;

function id(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function point(pointId: string, xMm: number, yMm: number): CeilingSketchPoint {
  return { id: pointId, xMm, yMm };
}

function refOf(source: CeilingSketchPoint | CeilingSketchPointRef): CeilingSketchPointRef {
  return { xMm: source.xMm, yMm: source.yMm };
}

function distanceMm(a: CeilingSketchPointRef, b: CeilingSketchPointRef) {
  return Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function normalizedPoints(points: CeilingSketchPoint[]) {
  if (points.length >= 3) return points;
  return createDefaultCeilingSketch().points;
}

function polygonAreaMm2(points: CeilingSketchPointRef[]) {
  if (points.length < 3) return 0;

  const sum = points.reduce((total, current, index) => {
    const next = points[(index + 1) % points.length];
    return total + current.xMm * next.yMm - next.xMm * current.yMm;
  }, 0);

  return Math.abs(sum) / 2;
}

function polygonPerimeterMm(points: CeilingSketchPointRef[]) {
  if (points.length < 2) return 0;

  return points.reduce((total, current, index) => {
    const next = points[(index + 1) % points.length];
    return total + distanceMm(current, next);
  }, 0);
}

export function createDefaultCeilingSketch(widthMm = DEFAULT_WIDTH_MM, depthMm = DEFAULT_DEPTH_MM): CeilingSketch {
  return {
    version: 1,
    points: [
      point('p-1', 0, 0),
      point('p-2', widthMm, 0),
      point('p-3', widthMm, depthMm),
      point('p-4', 0, depthMm),
    ],
    levels: [],
    fixtures: [],
    obstacles: [],
    linearFeatures: [],
    fabric: {
      texture: 'matte',
      rollWidthMm: 3200,
      directionDeg: 0,
      seams: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

export function calculateCeilingSketchMetrics(sketch: CeilingSketch): CeilingSketchMetrics {
  const points = normalizedPoints(sketch.points);
  const lightLinesMm = sketch.linearFeatures
    .filter((feature) => feature.kind === 'light_line')
    .reduce((sum, feature) => sum + distanceMm(feature.start, feature.end), 0);
  const curtainTracksMm = sketch.linearFeatures
    .filter((feature) => feature.kind === 'curtain_track')
    .reduce((sum, feature) => sum + distanceMm(feature.start, feature.end), 0);
  const nichesMm = sketch.linearFeatures
    .filter((feature) => feature.kind === 'niche')
    .reduce((sum, feature) => sum + distanceMm(feature.start, feature.end), 0);
  const seamsMm = sketch.fabric.seams.reduce((sum, seam) => sum + distanceMm(seam.start, seam.end), 0);

  return {
    areaM2: round(polygonAreaMm2(points) / 1_000_000, 2),
    perimeterM: round(polygonPerimeterMm(points) / 1000, 2),
    corners: points.length,
    lightPoints: sketch.fixtures.filter((fixture) => fixture.kind === 'spot' || fixture.kind === 'chandelier').length,
    pipes: sketch.obstacles.filter((obstacle) => obstacle.kind === 'pipe' || obstacle.kind === 'riser').length,
    curtainTracksM: round(curtainTracksMm / 1000, 2),
    nichesM: round(nichesMm / 1000, 2),
    lightLinesM: round(lightLinesMm / 1000, 2),
    levels: sketch.levels.length,
    seamsM: round(seamsMm / 1000, 2),
  };
}

export function formatSketchNumber(value: number) {
  return Number.isFinite(value) ? String(round(value, 2)) : '0';
}

export function resizeCeilingSketch(sketch: CeilingSketch, widthMm: number, depthMm: number): CeilingSketch {
  const safeWidth = Math.max(500, Number(widthMm || DEFAULT_WIDTH_MM));
  const safeDepth = Math.max(500, Number(depthMm || DEFAULT_DEPTH_MM));

  return {
    ...sketch,
    points: [
      point('p-1', 0, 0),
      point('p-2', safeWidth, 0),
      point('p-3', safeWidth, safeDepth),
      point('p-4', 0, safeDepth),
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function updateCeilingSketchPoint(sketch: CeilingSketch, pointId: string, patch: CeilingSketchPointRef): CeilingSketch {
  return {
    ...sketch,
    points: sketch.points.map((sketchPoint) => (
      sketchPoint.id === pointId
        ? { ...sketchPoint, xMm: Math.round(patch.xMm), yMm: Math.round(patch.yMm) }
        : sketchPoint
    )),
    updatedAt: new Date().toISOString(),
  };
}

export function setCeilingWallLength(sketch: CeilingSketch, startIndex: number, lengthMm: number): CeilingSketch {
  const points = normalizedPoints(sketch.points);
  const nextIndex = (startIndex + 1) % points.length;
  const start = points[startIndex];
  const end = points[nextIndex];
  const currentLength = distanceMm(start, end);

  if (currentLength <= 0) return sketch;

  const nextLength = Math.max(100, Number(lengthMm || currentLength));
  const ratio = nextLength / currentLength;
  const nextEnd = {
    xMm: start.xMm + (end.xMm - start.xMm) * ratio,
    yMm: start.yMm + (end.yMm - start.yMm) * ratio,
  };

  return updateCeilingSketchPoint(sketch, end.id, nextEnd);
}

export function addCeilingCorner(sketch: CeilingSketch): CeilingSketch {
  const points = normalizedPoints(sketch.points);
  let longestIndex = 0;
  let longestLength = 0;

  points.forEach((current, index) => {
    const next = points[(index + 1) % points.length];
    const length = distanceMm(current, next);

    if (length > longestLength) {
      longestLength = length;
      longestIndex = index;
    }
  });

  const start = points[longestIndex];
  const end = points[(longestIndex + 1) % points.length];
  const midpoint = point(
    id('p'),
    Math.round((start.xMm + end.xMm) / 2),
    Math.round((start.yMm + end.yMm) / 2)
  );

  return {
    ...sketch,
    points: [
      ...points.slice(0, longestIndex + 1),
      midpoint,
      ...points.slice(longestIndex + 1),
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function removeCeilingCorner(sketch: CeilingSketch, pointId: string): CeilingSketch {
  if (sketch.points.length <= 3) return sketch;

  return {
    ...sketch,
    points: sketch.points.filter((sketchPoint) => sketchPoint.id !== pointId),
    updatedAt: new Date().toISOString(),
  };
}

export function addFixture(sketch: CeilingSketch, kind: CeilingSketchFixture['kind']): CeilingSketch {
  const bounds = sketchBounds(sketch);
  const fixture: CeilingSketchFixture = {
    id: id(kind),
    kind,
    point: {
      xMm: bounds.minX + bounds.width / 2,
      yMm: bounds.minY + bounds.height / 2,
    },
    diameterMm: kind === 'chandelier' ? 160 : 80,
  };

  return {
    ...sketch,
    fixtures: [...sketch.fixtures, fixture],
    updatedAt: new Date().toISOString(),
  };
}

export function updateFixture(sketch: CeilingSketch, fixtureId: string, pointPatch: CeilingSketchPointRef): CeilingSketch {
  return {
    ...sketch,
    fixtures: sketch.fixtures.map((fixture) => (
      fixture.id === fixtureId
        ? { ...fixture, point: { xMm: Math.round(pointPatch.xMm), yMm: Math.round(pointPatch.yMm) } }
        : fixture
    )),
    updatedAt: new Date().toISOString(),
  };
}

export function addObstacle(sketch: CeilingSketch, kind: CeilingSketchObstacle['kind']): CeilingSketch {
  const bounds = sketchBounds(sketch);
  const obstacle: CeilingSketchObstacle = {
    id: id(kind),
    kind,
    point: {
      xMm: bounds.minX + bounds.width * 0.25,
      yMm: bounds.minY + bounds.height * 0.25,
    },
    diameterMm: kind === 'pipe' || kind === 'riser' ? 110 : 240,
    widthMm: kind === 'column' ? 360 : undefined,
    depthMm: kind === 'column' ? 360 : undefined,
    clearanceMm: 30,
  };

  return {
    ...sketch,
    obstacles: [...sketch.obstacles, obstacle],
    updatedAt: new Date().toISOString(),
  };
}

export function updateObstacle(sketch: CeilingSketch, obstacleId: string, pointPatch: CeilingSketchPointRef): CeilingSketch {
  return {
    ...sketch,
    obstacles: sketch.obstacles.map((obstacle) => (
      obstacle.id === obstacleId
        ? { ...obstacle, point: { xMm: Math.round(pointPatch.xMm), yMm: Math.round(pointPatch.yMm) } }
        : obstacle
    )),
    updatedAt: new Date().toISOString(),
  };
}

export function addLinearFeature(sketch: CeilingSketch, kind: CeilingSketchLinearFeature['kind']): CeilingSketch {
  const bounds = sketchBounds(sketch);
  const y = bounds.minY + bounds.height * (kind === 'curtain_track' ? 0.12 : 0.5);
  const feature: CeilingSketchLinearFeature = {
    id: id(kind),
    kind,
    start: { xMm: bounds.minX + bounds.width * 0.22, yMm: y },
    end: { xMm: bounds.minX + bounds.width * 0.78, yMm: y },
    widthMm: kind === 'light_line' ? 60 : kind === 'niche' ? 120 : 80,
  };

  return {
    ...sketch,
    linearFeatures: [...sketch.linearFeatures, feature],
    updatedAt: new Date().toISOString(),
  };
}

export function updateLinearFeaturePoint(
  sketch: CeilingSketch,
  featureId: string,
  endpoint: 'start' | 'end',
  pointPatch: CeilingSketchPointRef
): CeilingSketch {
  return {
    ...sketch,
    linearFeatures: sketch.linearFeatures.map((feature) => (
      feature.id === featureId
        ? { ...feature, [endpoint]: { xMm: Math.round(pointPatch.xMm), yMm: Math.round(pointPatch.yMm) } }
        : feature
    )),
    updatedAt: new Date().toISOString(),
  };
}

export function addCeilingLevel(sketch: CeilingSketch): CeilingSketch {
  const bounds = sketchBounds(sketch);
  const inset = Math.min(bounds.width, bounds.height) * 0.18;

  return {
    ...sketch,
    levels: [
      ...sketch.levels,
      {
        id: id('level'),
        name: `Уровень ${sketch.levels.length + 2}`,
        elevationMm: -80,
        insetMm: Math.round(inset),
        points: [
          point(id('lp'), bounds.minX + inset, bounds.minY + inset),
          point(id('lp'), bounds.maxX - inset, bounds.minY + inset),
          point(id('lp'), bounds.maxX - inset, bounds.maxY - inset),
          point(id('lp'), bounds.minX + inset, bounds.maxY - inset),
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function addFabricSeam(sketch: CeilingSketch): CeilingSketch {
  const bounds = sketchBounds(sketch);
  const x = bounds.minX + bounds.width / 2;

  return {
    ...sketch,
    fabric: {
      ...sketch.fabric,
      seams: [
        ...sketch.fabric.seams,
        {
          id: id('seam'),
          start: { xMm: x, yMm: bounds.minY },
          end: { xMm: x, yMm: bounds.maxY },
        },
      ],
    },
    updatedAt: new Date().toISOString(),
  };
}

export function updateFabric(sketch: CeilingSketch, patch: Partial<{
  texture: CeilingFabricTexture;
  rollWidthMm: number;
  directionDeg: number;
}>): CeilingSketch {
  return {
    ...sketch,
    fabric: {
      ...sketch.fabric,
      ...patch,
      rollWidthMm: Math.max(1000, Number(patch.rollWidthMm ?? sketch.fabric.rollWidthMm)),
      directionDeg: Number(patch.directionDeg ?? sketch.fabric.directionDeg),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function removeSketchObject(sketch: CeilingSketch, objectId: string): CeilingSketch {
  return {
    ...sketch,
    fixtures: sketch.fixtures.filter((fixture) => fixture.id !== objectId),
    obstacles: sketch.obstacles.filter((obstacle) => obstacle.id !== objectId),
    linearFeatures: sketch.linearFeatures.filter((feature) => feature.id !== objectId),
    levels: sketch.levels.filter((level) => level.id !== objectId),
    fabric: {
      ...sketch.fabric,
      seams: sketch.fabric.seams.filter((seam) => seam.id !== objectId),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function sketchBounds(sketch: CeilingSketch) {
  const allPoints: CeilingSketchPointRef[] = [
    ...normalizedPoints(sketch.points),
    ...sketch.fixtures.map((fixture) => fixture.point),
    ...sketch.obstacles.map((obstacle) => obstacle.point),
    ...sketch.linearFeatures.flatMap((feature) => [feature.start, feature.end]),
    ...sketch.levels.flatMap((level) => level.points.map(refOf)),
    ...sketch.fabric.seams.flatMap((seam) => [seam.start, seam.end]),
  ];

  const xs = allPoints.map((sketchPoint) => sketchPoint.xMm);
  const ys = allPoints.map((sketchPoint) => sketchPoint.yMm);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return { minX, maxX, minY, maxY, width, height };
}

export function wallLengthsMm(sketch: CeilingSketch) {
  const points = normalizedPoints(sketch.points);

  return points.map((current, index) => ({
    id: `${current.id}-${points[(index + 1) % points.length].id}`,
    label: `${index + 1}`,
    startIndex: index,
    lengthMm: Math.round(distanceMm(current, points[(index + 1) % points.length])),
  }));
}

export function buildCeilingProjectSnapshot(rooms: Array<{
  id: string;
  name: string;
  ceilingSketch?: CeilingSketch | null;
}>): EstimateSettingsSnapshot['ceiling_project'] {
  const sketchRooms = rooms.reduce<NonNullable<EstimateSettingsSnapshot['ceiling_project']>['rooms']>((acc, room) => {
    if (!room.ceilingSketch) return acc;

    acc.push({
      room_id: room.id,
      room_name: room.name,
      sketch: room.ceilingSketch,
      metrics: calculateCeilingSketchMetrics(room.ceilingSketch),
    });

    return acc;
  }, []);

  if (sketchRooms.length === 0) return null;

  return {
    version: 1 as const,
    source: 'ceiling_sketcher' as const,
    rooms: sketchRooms,
    updated_at: new Date().toISOString(),
  };
}
