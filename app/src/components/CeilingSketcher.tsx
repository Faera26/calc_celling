import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Layers as LayersIcon,
  Lightbulb as LightbulbIcon,
  LinearScale as LinearScaleIcon,
  Plumbing as PlumbingIcon,
  Texture as TextureIcon,
} from '@mui/icons-material';
import type {
  CeilingFabricTexture,
  CeilingSketch,
  CeilingSketchLevel,
  CeilingSketchFixture,
  CeilingSketchLinearFeature,
  CeilingSketchMetrics,
  CeilingSketchObstacle,
  CeilingSketchPointRef,
} from '../types';
import {
  addCeilingCorner,
  addCeilingLevel,
  addFabricSeam,
  addFixture,
  addLinearFeature,
  addObstacle,
  calculateCeilingSketchMetrics,
  formatSketchNumber,
  removeCeilingCorner,
  removeSketchObject,
  resizeCeilingSketch,
  setCeilingWallLength,
  sketchBounds,
  updateCeilingSketchPoint,
  updateCeilingLevelDetails,
  updateCeilingLevelPoint,
  updateFabric,
  updateFabricSeamPoint,
  updateFixture,
  updateFixtureDetails,
  updateLinearFeatureDetails,
  updateLinearFeaturePoint,
  updateObstacle,
  updateObstacleDetails,
  wallLengthsMm,
} from '../features/ceilingSketch/ceilingSketch';

type DragTarget =
  | { kind: 'corner'; id: string }
  | { kind: 'fixture'; id: string }
  | { kind: 'obstacle'; id: string }
  | { kind: 'linear'; id: string; endpoint: 'start' | 'end' }
  | { kind: 'level'; id: string; pointId: string }
  | { kind: 'seam'; id: string; endpoint: 'start' | 'end' };

interface ViewBoxState {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SnapGuide {
  axis: 'x' | 'y';
  value: number;
  label: string;
}

interface SnapSettings {
  grid: boolean;
  objects: boolean;
  orthogonal: boolean;
}

interface CeilingSketcherProps {
  value: CeilingSketch;
  onChange: (nextSketch: CeilingSketch, metrics: CeilingSketchMetrics) => void;
}

const GRID_STEP_MM = 50;
const OBJECT_SNAP_DISTANCE_MM = 70;
const ORTHO_SNAP_DISTANCE_MM = 55;

function lineLengthMm(start: CeilingSketchPointRef, end: CeilingSketchPointRef) {
  return Math.round(Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm));
}

function roundToStep(value: number, step: number) {
  return Math.round(value / step) * step;
}

function featureLabel(kind: string) {
  if (kind === 'light_line') return 'Световая линия';
  if (kind === 'curtain_track') return 'Карниз';
  if (kind === 'niche') return 'Ниша';
  if (kind === 'pipe') return 'Труба';
  if (kind === 'riser') return 'Стояк';
  if (kind === 'column') return 'Колонна';
  if (kind === 'chandelier') return 'Люстра';
  if (kind === 'vent') return 'Вентиляция';
  return 'Светильник';
}

function textureLabel(texture: CeilingFabricTexture) {
  if (texture === 'satin') return 'Сатин';
  if (texture === 'gloss') return 'Глянец';
  if (texture === 'fabric') return 'Ткань';
  return 'Матовая';
}

function sketchPointList(points: CeilingSketchPointRef[]) {
  return points.map((point) => `${point.xMm},${point.yMm}`).join(' ');
}

function viewBoxString(viewBox: ViewBoxState) {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}

function selectedPointOf(sketch: CeilingSketch, selectedObjectId: string): CeilingSketchPointRef | null {
  const corner = sketch.points.find((point) => point.id === selectedObjectId);
  if (corner) return corner;

  const fixture = sketch.fixtures.find((item) => item.id === selectedObjectId);
  if (fixture) return fixture.point;

  const obstacle = sketch.obstacles.find((item) => item.id === selectedObjectId);
  if (obstacle) return obstacle.point;

  return null;
}

function selectedFixtureOf(sketch: CeilingSketch, selectedObjectId: string) {
  return sketch.fixtures.find((item) => item.id === selectedObjectId) || null;
}

function selectedObstacleOf(sketch: CeilingSketch, selectedObjectId: string) {
  return sketch.obstacles.find((item) => item.id === selectedObjectId) || null;
}

function selectedLinearFeatureOf(sketch: CeilingSketch, selectedObjectId: string) {
  return sketch.linearFeatures.find((item) => item.id === selectedObjectId) || null;
}

function selectedLevelOf(sketch: CeilingSketch, selectedObjectId: string) {
  return sketch.levels.find((item) => item.id === selectedObjectId) || null;
}

function selectedSeamOf(sketch: CeilingSketch, selectedObjectId: string) {
  return sketch.fabric.seams.find((item) => item.id === selectedObjectId) || null;
}

function offsetFromBounds(point: CeilingSketchPointRef, bounds: ReturnType<typeof sketchBounds>) {
  return {
    left: Math.round(point.xMm - bounds.minX),
    right: Math.round(bounds.maxX - point.xMm),
    top: Math.round(point.yMm - bounds.minY),
    bottom: Math.round(bounds.maxY - point.yMm),
  };
}

function collectSnapPoints(sketch: CeilingSketch, target: DragTarget): Array<CeilingSketchPointRef & { label: string }> {
  const points: Array<CeilingSketchPointRef & { label: string }> = [];

  sketch.points.forEach((point, index) => {
    if (target.kind === 'corner' && point.id === target.id) return;
    points.push({ xMm: point.xMm, yMm: point.yMm, label: `угол ${index + 1}` });
  });

  sketch.fixtures.forEach((fixture, index) => {
    if (target.kind === 'fixture' && fixture.id === target.id) return;
    points.push({ ...fixture.point, label: `свет ${index + 1}` });
  });

  sketch.obstacles.forEach((obstacle, index) => {
    if (target.kind === 'obstacle' && obstacle.id === target.id) return;
    points.push({ ...obstacle.point, label: `труба ${index + 1}` });
  });

  sketch.linearFeatures.forEach((feature, index) => {
    if (!(target.kind === 'linear' && feature.id === target.id && target.endpoint === 'start')) {
      points.push({ ...feature.start, label: `линия ${index + 1}` });
    }

    if (!(target.kind === 'linear' && feature.id === target.id && target.endpoint === 'end')) {
      points.push({ ...feature.end, label: `линия ${index + 1}` });
    }
  });

  sketch.levels.forEach((level, levelIndex) => {
    level.points.forEach((levelPoint, pointIndex) => {
      if (target.kind === 'level' && level.id === target.id && levelPoint.id === target.pointId) return;
      points.push({ ...levelPoint, label: `${level.name || `уровень ${levelIndex + 2}`} т.${pointIndex + 1}` });
    });
  });

  sketch.fabric.seams.forEach((seam, index) => {
    if (!(target.kind === 'seam' && seam.id === target.id && target.endpoint === 'start')) {
      points.push({ ...seam.start, label: `шов ${index + 1}` });
    }

    if (!(target.kind === 'seam' && seam.id === target.id && target.endpoint === 'end')) {
      points.push({ ...seam.end, label: `шов ${index + 1}` });
    }
  });

  return points;
}

function snapPoint(
  sketch: CeilingSketch,
  rawPoint: CeilingSketchPointRef,
  target: DragTarget,
  settings: SnapSettings
): { point: CeilingSketchPointRef; guides: SnapGuide[] } {
  const snapped = settings.grid
    ? {
      xMm: roundToStep(rawPoint.xMm, GRID_STEP_MM),
      yMm: roundToStep(rawPoint.yMm, GRID_STEP_MM),
    }
    : { ...rawPoint };
  const guides: SnapGuide[] = [];

  const snapPoints = collectSnapPoints(sketch, target);

  if (settings.objects) {
    snapPoints.forEach((point) => {
      if (Math.abs(point.xMm - snapped.xMm) <= OBJECT_SNAP_DISTANCE_MM) {
        snapped.xMm = point.xMm;
        guides.push({ axis: 'x', value: point.xMm, label: `X: ${point.label}` });
      }

      if (Math.abs(point.yMm - snapped.yMm) <= OBJECT_SNAP_DISTANCE_MM) {
        snapped.yMm = point.yMm;
        guides.push({ axis: 'y', value: point.yMm, label: `Y: ${point.label}` });
      }
    });
  }

  if (settings.orthogonal && target.kind === 'corner') {
    const currentIndex = sketch.points.findIndex((point) => point.id === target.id);

    if (currentIndex !== -1) {
      const previous = sketch.points[(currentIndex - 1 + sketch.points.length) % sketch.points.length];
      const next = sketch.points[(currentIndex + 1) % sketch.points.length];

      [previous, next].forEach((point, index) => {
        const label = index === 0 ? 'соседний угол' : 'следующий угол';

        if (Math.abs(point.xMm - snapped.xMm) <= ORTHO_SNAP_DISTANCE_MM) {
          snapped.xMm = point.xMm;
          guides.push({ axis: 'x', value: point.xMm, label: `вертикаль: ${label}` });
        }

        if (Math.abs(point.yMm - snapped.yMm) <= ORTHO_SNAP_DISTANCE_MM) {
          snapped.yMm = point.yMm;
          guides.push({ axis: 'y', value: point.yMm, label: `горизонталь: ${label}` });
        }
      });
    }
  }

  return {
    point: snapped,
    guides: guides.slice(-3),
  };
}

export default function CeilingSketcher({ value, onChange }: CeilingSketcherProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const [frozenViewBox, setFrozenViewBox] = useState<ViewBoxState | null>(null);
  const [lockedViewBox, setLockedViewBox] = useState<ViewBoxState | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [snapSettings, setSnapSettings] = useState<SnapSettings>({
    grid: true,
    objects: false,
    orthogonal: false,
  });

  const bounds = useMemo(() => sketchBounds(value), [value]);
  const metrics = useMemo(() => calculateCeilingSketchMetrics(value), [value]);
  const walls = useMemo(() => wallLengthsMm(value), [value]);
  const padding = Math.max(900, Math.min(bounds.width, bounds.height) * 0.22);
  const liveViewBox = useMemo<ViewBoxState>(() => ({
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  }), [bounds, padding]);
  const activeViewBox = frozenViewBox || lockedViewBox || liveViewBox;
  const selectedPoint = selectedPointOf(value, selectedObjectId);
  const selectedFixture = selectedFixtureOf(value, selectedObjectId);
  const selectedObstacle = selectedObstacleOf(value, selectedObjectId);
  const selectedLinearFeature = selectedLinearFeatureOf(value, selectedObjectId);
  const selectedLevel = selectedLevelOf(value, selectedObjectId);
  const selectedSeam = selectedSeamOf(value, selectedObjectId);
  const selectedAnchorPoint = selectedFixture?.point || selectedObstacle?.point || selectedPoint;
  const selectedOffsets = selectedAnchorPoint ? offsetFromBounds(selectedAnchorPoint, bounds) : null;

  useEffect(() => {
    if (!dragTarget) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    const previousOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      document.documentElement.style.overscrollBehavior = previousOverscroll;
    };
  }, [dragTarget]);

  function emit(nextSketch: CeilingSketch, options?: { fitView?: boolean }) {
    if (options?.fitView) {
      setLockedViewBox(null);
      setFrozenViewBox(null);
    }

    onChange(nextSketch, calculateCeilingSketchMetrics(nextSketch));
  }

  function pointerToSketchPoint(event: PointerEvent<SVGSVGElement>): CeilingSketchPointRef {
    const svg = svgRef.current;
    if (!svg) return { xMm: 0, yMm: 0 };

    const rect = svg.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / Math.max(1, rect.width);
    const relativeY = (event.clientY - rect.top) / Math.max(1, rect.height);

    return {
      xMm: activeViewBox.x + relativeX * activeViewBox.width,
      yMm: activeViewBox.y + relativeY * activeViewBox.height,
    };
  }

  function updatePointLikeObject(target: DragTarget, point: CeilingSketchPointRef) {
    if (target.kind === 'corner') {
      emit(updateCeilingSketchPoint(value, target.id, point));
    }

    if (target.kind === 'fixture') {
      emit(updateFixture(value, target.id, point));
    }

    if (target.kind === 'obstacle') {
      emit(updateObstacle(value, target.id, point));
    }

    if (target.kind === 'linear') {
      emit(updateLinearFeaturePoint(value, target.id, target.endpoint, point));
    }

    if (target.kind === 'level') {
      emit(updateCeilingLevelPoint(value, target.id, target.pointId, point));
    }

    if (target.kind === 'seam') {
      emit(updateFabricSeamPoint(value, target.id, target.endpoint, point));
    }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragTarget) return;

    event.preventDefault();
    const rawPoint = pointerToSketchPoint(event);
    const snapped = snapPoint(value, rawPoint, dragTarget, snapSettings);
    setSnapGuides(snapped.guides);
    updatePointLikeObject(dragTarget, snapped.point);
  }

  function finishDrag() {
    setDragTarget(null);
    setFrozenViewBox(null);
    setSnapGuides([]);
  }

  function startDrag(event: PointerEvent<SVGElement>, target: DragTarget) {
    event.preventDefault();
    event.stopPropagation();
    setLockedViewBox(activeViewBox);
    setFrozenViewBox(activeViewBox);
    setDragTarget(target);
    setSelectedObjectId(target.id);
    setSnapGuides([]);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function removeSelected() {
    if (!selectedObjectId || selectedObjectId === 'base') return;

    const isCorner = value.points.some((point) => point.id === selectedObjectId);
    const nextSketch = isCorner
      ? removeCeilingCorner(value, selectedObjectId)
      : removeSketchObject(value, selectedObjectId);

    setSelectedObjectId('');
    emit(nextSketch);
  }

  function updateSelectedPoint(axis: 'xMm' | 'yMm', nextValue: number) {
    if (!selectedPoint) return;

    const nextPoint = {
      ...selectedPoint,
      [axis]: roundToStep(Number(nextValue || 0), 10),
    };
    const corner = value.points.find((point) => point.id === selectedObjectId);
    const fixture = value.fixtures.find((item) => item.id === selectedObjectId);
    const obstacle = value.obstacles.find((item) => item.id === selectedObjectId);

    if (corner) emit(updateCeilingSketchPoint(value, selectedObjectId, nextPoint));
    if (fixture) emit(updateFixture(value, selectedObjectId, nextPoint));
    if (obstacle) emit(updateObstacle(value, selectedObjectId, nextPoint));
  }

  function updateSelectedOffset(side: 'left' | 'right' | 'top' | 'bottom', nextValue: number) {
    const targetPoint = selectedFixture?.point || selectedObstacle?.point;
    if (!targetPoint) return;

    const nextPoint = {
      ...targetPoint,
      xMm: side === 'left'
        ? bounds.minX + Number(nextValue || 0)
        : side === 'right'
          ? bounds.maxX - Number(nextValue || 0)
          : targetPoint.xMm,
      yMm: side === 'top'
        ? bounds.minY + Number(nextValue || 0)
        : side === 'bottom'
          ? bounds.maxY - Number(nextValue || 0)
          : targetPoint.yMm,
    };

    if (selectedFixture) emit(updateFixture(value, selectedFixture.id, nextPoint));
    if (selectedObstacle) emit(updateObstacle(value, selectedObstacle.id, nextPoint));
  }

  function updateLinearEndpoint(endpoint: 'start' | 'end', axis: 'xMm' | 'yMm', nextValue: number) {
    if (!selectedLinearFeature) return;
    emit(updateLinearFeaturePoint(value, selectedLinearFeature.id, endpoint, {
      ...selectedLinearFeature[endpoint],
      [axis]: roundToStep(Number(nextValue || 0), 10),
    }));
  }

  function updateSeamEndpoint(endpoint: 'start' | 'end', axis: 'xMm' | 'yMm', nextValue: number) {
    if (!selectedSeam) return;
    emit(updateFabricSeamPoint(value, selectedSeam.id, endpoint, {
      ...selectedSeam[endpoint],
      [axis]: roundToStep(Number(nextValue || 0), 10),
    }));
  }

  function updateLevelPoint(level: CeilingSketchLevel, pointId: string, axis: 'xMm' | 'yMm', nextValue: number) {
    const levelPoint = level.points.find((point) => point.id === pointId);
    if (!levelPoint) return;

    emit(updateCeilingLevelPoint(value, level.id, pointId, {
      ...levelPoint,
      [axis]: roundToStep(Number(nextValue || 0), 10),
    }));
  }

  function toggleSnap(setting: keyof SnapSettings) {
    setSnapSettings((prev) => ({ ...prev, [setting]: !prev[setting] }));
  }

  function renderToolButtons() {
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mx: -0.5,
          px: 0.5,
          pb: 0.5,
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          '& .MuiButton-root': {
            minHeight: 50,
            flexShrink: 0,
            borderRadius: 2,
            whiteSpace: 'nowrap',
          },
        }}
      >
        <Button size="large" variant={snapSettings.grid ? 'contained' : 'outlined'} onClick={() => toggleSnap('grid')}>
          Сетка
        </Button>
        <Button size="large" variant={snapSettings.objects ? 'contained' : 'outlined'} onClick={() => toggleSnap('objects')}>
          Объекты
        </Button>
        <Button size="large" variant={snapSettings.orthogonal ? 'contained' : 'outlined'} onClick={() => toggleSnap('orthogonal')}>
          90°
        </Button>
        <Button size="large" variant="outlined" onClick={() => setLockedViewBox(null)}>
          Вписать
        </Button>
        <Button size="large" variant="outlined" startIcon={<AddIcon />} onClick={() => emit(addCeilingCorner(value))}>
          Угол
        </Button>
        <Button size="large" variant="outlined" startIcon={<LightbulbIcon />} onClick={() => emit(addFixture(value, 'spot'))}>
          Свет
        </Button>
        <Button size="large" variant="outlined" startIcon={<LinearScaleIcon />} onClick={() => emit(addLinearFeature(value, 'light_line'))}>
          Линия
        </Button>
        <Button size="large" variant="outlined" startIcon={<PlumbingIcon />} onClick={() => emit(addObstacle(value, 'pipe'))}>
          Труба
        </Button>
        <Button size="large" variant="outlined" startIcon={<LinearScaleIcon />} onClick={() => emit(addLinearFeature(value, 'curtain_track'))}>
          Карниз
        </Button>
        <Button size="large" variant="outlined" startIcon={<LayersIcon />} onClick={() => emit(addCeilingLevel(value))}>
          Уровень
        </Button>
        <Button size="large" variant="outlined" startIcon={<TextureIcon />} onClick={() => emit(addFabricSeam(value))}>
          Шов
        </Button>
      </Stack>
    );
  }

  function renderHandle(target: DragTarget, point: CeilingSketchPointRef, color: string, label?: string) {
    const selected = selectedObjectId === target.id;
    const keySuffix = 'endpoint' in target ? target.endpoint : 'pointId' in target ? target.pointId : 'point';

    return (
      <g key={`${target.kind}-${target.id}-${keySuffix}`}>
        <circle
          cx={point.xMm}
          cy={point.yMm}
          r="430"
          fill="transparent"
          onPointerDown={(event) => startDrag(event, target)}
          style={{ cursor: 'grab' }}
        />
        <circle
          cx={point.xMm}
          cy={point.yMm}
          r="185"
          fill={selected ? color : '#FFFFFF'}
          stroke={color}
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        {label && (
          <text
            x={point.xMm}
            y={point.yMm + 42}
            textAnchor="middle"
            fontSize="130"
            fontWeight="800"
            fill={selected ? '#FFFFFF' : color}
            pointerEvents="none"
          >
            {label}
          </text>
        )}
      </g>
    );
  }

  const polygonPoints = sketchPointList(value.points);

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ minHeight: { xs: 'calc(100dvh - 146px)', lg: 600 } }}>
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack
            sx={{
              gap: 1,
              p: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 1 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Chip color="primary" label={`${metrics.areaM2} м²`} />
                <Chip label={`${metrics.perimeterM} м`} />
                <Chip label={`${metrics.corners} угл.`} />
                <Chip label={snapSettings.grid ? 'Сетка 50 мм' : 'Сетка выкл.'} />
                <Chip label={snapSettings.orthogonal ? '90° вкл.' : '90° выкл.'} />
              </Stack>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {snapGuides.map((guide) => (
                  <Chip key={`${guide.axis}-${guide.value}-${guide.label}`} color="success" label={guide.label} />
                ))}
              </Stack>
            </Stack>

            {renderToolButtons()}
          </Stack>

          <Box sx={{ flexGrow: 1, minHeight: { xs: 360, md: 520 } }}>
            <svg
              ref={svgRef}
              viewBox={viewBoxString(activeViewBox)}
              role="img"
              aria-label="Чертеж потолка"
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onPointerLeave={finishDrag}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                background: '#F8FAFC',
              }}
            >
              <defs>
                <pattern id="ceiling-grid-small" width="250" height="250" patternUnits="userSpaceOnUse">
                  <path d="M 250 0 L 0 0 0 250" fill="none" stroke="#E2E8F0" strokeWidth="1" />
                </pattern>
                <pattern id="ceiling-grid-large" width="1000" height="1000" patternUnits="userSpaceOnUse">
                  <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#94A3B8" strokeWidth="2" />
                </pattern>
                <pattern id="fabric-lines" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform={`rotate(${value.fabric.directionDeg})`}>
                  <path d="M 0 0 L 0 260" fill="none" stroke="#60A5FA" strokeWidth="2" opacity="0.5" />
                </pattern>
              </defs>

              <rect x={activeViewBox.x} y={activeViewBox.y} width={activeViewBox.width} height={activeViewBox.height} fill="url(#ceiling-grid-small)" />
              <rect x={activeViewBox.x} y={activeViewBox.y} width={activeViewBox.width} height={activeViewBox.height} fill="url(#ceiling-grid-large)" />

              {snapGuides.map((guide) => (
                guide.axis === 'x'
                  ? (
                    <line
                      key={`${guide.axis}-${guide.value}-${guide.label}`}
                      x1={guide.value}
                      y1={activeViewBox.y}
                      x2={guide.value}
                      y2={activeViewBox.y + activeViewBox.height}
                      stroke="#16A34A"
                      strokeWidth="4"
                      strokeDasharray="22 14"
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                  : (
                    <line
                      key={`${guide.axis}-${guide.value}-${guide.label}`}
                      x1={activeViewBox.x}
                      y1={guide.value}
                      x2={activeViewBox.x + activeViewBox.width}
                      y2={guide.value}
                      stroke="#16A34A"
                      strokeWidth="4"
                      strokeDasharray="22 14"
                      vectorEffect="non-scaling-stroke"
                    />
                  )
              ))}

              <polygon
                points={polygonPoints}
                fill={selectedObjectId === 'base' ? '#BFDBFE' : '#DBEAFE'}
                stroke="#0F172A"
                strokeWidth="5"
                vectorEffect="non-scaling-stroke"
                onPointerDown={() => setSelectedObjectId('base')}
              />
              <polygon
                points={polygonPoints}
                fill="url(#fabric-lines)"
                opacity="0.45"
                pointerEvents="none"
              />

              {value.levels.map((level) => (
                <g key={level.id}>
                  <polygon
                    points={sketchPointList(level.points)}
                    fill={selectedObjectId === level.id ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.12)'}
                    stroke="#B45309"
                    strokeWidth="5"
                    strokeDasharray="20 12"
                    vectorEffect="non-scaling-stroke"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelectedObjectId(level.id);
                    }}
                  />
                  {level.points.map((levelPoint, index) => (
                    renderHandle({ kind: 'level', id: level.id, pointId: levelPoint.id }, levelPoint, '#B45309', String(index + 1))
                  ))}
                </g>
              ))}

              {value.fabric.seams.map((seam) => (
                <g key={seam.id}>
                  <line
                    x1={seam.start.xMm}
                    y1={seam.start.yMm}
                    x2={seam.end.xMm}
                    y2={seam.end.yMm}
                    stroke="#7C3AED"
                    strokeWidth={selectedObjectId === seam.id ? '8' : '5'}
                    strokeDasharray="18 14"
                    vectorEffect="non-scaling-stroke"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelectedObjectId(seam.id);
                    }}
                  />
                  {renderHandle({ kind: 'seam', id: seam.id, endpoint: 'start' }, seam.start, '#7C3AED')}
                  {renderHandle({ kind: 'seam', id: seam.id, endpoint: 'end' }, seam.end, '#7C3AED')}
                </g>
              ))}

              {value.linearFeatures.map((feature: CeilingSketchLinearFeature) => {
                const color = feature.kind === 'light_line'
                  ? '#F59E0B'
                  : feature.kind === 'curtain_track'
                    ? '#0EA5E9'
                    : '#10B981';

                return (
                  <g key={feature.id}>
                    <line
                      x1={feature.start.xMm}
                      y1={feature.start.yMm}
                      x2={feature.end.xMm}
                      y2={feature.end.yMm}
                      stroke={color}
                      strokeWidth="9"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setSelectedObjectId(feature.id);
                      }}
                    />
                    {renderHandle({ kind: 'linear', id: feature.id, endpoint: 'start' }, feature.start, color)}
                    {renderHandle({ kind: 'linear', id: feature.id, endpoint: 'end' }, feature.end, color)}
                  </g>
                );
              })}

              {value.obstacles.map((obstacle: CeilingSketchObstacle) => (
                <g key={obstacle.id}>
                  <circle
                    cx={obstacle.point.xMm}
                    cy={obstacle.point.yMm}
                    r={Math.max(150, obstacle.diameterMm / 2)}
                    fill={selectedObjectId === obstacle.id ? '#FEE2E2' : '#FFFFFF'}
                    stroke="#DC2626"
                    strokeWidth="6"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <circle cx={obstacle.point.xMm} cy={obstacle.point.yMm} r="28" fill="#DC2626" pointerEvents="none" />
                  {renderHandle({ kind: 'obstacle', id: obstacle.id }, obstacle.point, '#DC2626')}
                </g>
              ))}

              {value.fixtures.map((fixture: CeilingSketchFixture) => (
                <g key={fixture.id}>
                  <circle
                    cx={fixture.point.xMm}
                    cy={fixture.point.yMm}
                    r={Math.max(130, fixture.diameterMm / 2)}
                    fill={selectedObjectId === fixture.id ? '#FEF3C7' : '#FFFFFF'}
                    stroke="#F59E0B"
                    strokeWidth="6"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <path
                    d={`M ${fixture.point.xMm - 65} ${fixture.point.yMm} L ${fixture.point.xMm + 65} ${fixture.point.yMm} M ${fixture.point.xMm} ${fixture.point.yMm - 65} L ${fixture.point.xMm} ${fixture.point.yMm + 65}`}
                    stroke="#F59E0B"
                    strokeWidth="5"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  {renderHandle({ kind: 'fixture', id: fixture.id }, fixture.point, '#F59E0B')}
                </g>
              ))}

              {selectedAnchorPoint && selectedOffsets && (
                <g pointerEvents="none">
                  <line
                    x1={bounds.minX}
                    y1={selectedAnchorPoint.yMm}
                    x2={selectedAnchorPoint.xMm}
                    y2={selectedAnchorPoint.yMm}
                    stroke="#475569"
                    strokeWidth="4"
                    strokeDasharray="16 12"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={selectedAnchorPoint.xMm}
                    y1={bounds.minY}
                    x2={selectedAnchorPoint.xMm}
                    y2={selectedAnchorPoint.yMm}
                    stroke="#475569"
                    strokeWidth="4"
                    strokeDasharray="16 12"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={(bounds.minX + selectedAnchorPoint.xMm) / 2}
                    y={selectedAnchorPoint.yMm - 120}
                    textAnchor="middle"
                    fontSize="150"
                    fontWeight="800"
                    fill="#334155"
                  >
                    {selectedOffsets.left} мм
                  </text>
                  <text
                    x={selectedAnchorPoint.xMm + 120}
                    y={(bounds.minY + selectedAnchorPoint.yMm) / 2}
                    fontSize="150"
                    fontWeight="800"
                    fill="#334155"
                  >
                    {selectedOffsets.top} мм
                  </text>
                </g>
              )}

              {value.points.map((sketchPoint, index) => (
                renderHandle({ kind: 'corner', id: sketchPoint.id }, sketchPoint, '#1D4ED8', String(index + 1))
              ))}
            </svg>
          </Box>
        </Box>

        <Box sx={{ width: { xs: '100%', lg: 390 }, borderLeft: { lg: '1px solid' }, borderTop: { xs: '1px solid', lg: 0 }, borderColor: 'divider', p: 1.5 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Chip color="primary" label={`${metrics.areaM2} м²`} />
              <Chip label={`${metrics.perimeterM} м`} />
              <Chip label={`${metrics.lightPoints} свет.`} />
              <Chip label={`${metrics.lightLinesM} м линий`} />
              <Chip label={`${metrics.pipes} труб`} />
              <Chip label={`${metrics.levels + 1} ур.`} />
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Ширина, мм"
                type="number"
                value={Math.round(bounds.width)}
                onChange={(event) => emit(resizeCeilingSketch(value, Number(event.target.value), bounds.height), { fitView: true })}
                fullWidth
              />
              <TextField
                size="small"
                label="Глубина, мм"
                type="number"
                value={Math.round(bounds.height)}
                onChange={(event) => emit(resizeCeilingSketch(value, bounds.width, Number(event.target.value)), { fitView: true })}
                fullWidth
              />
            </Stack>

            {selectedPoint && (
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  label="X, мм"
                  type="number"
                  value={Math.round(selectedPoint.xMm)}
                  onChange={(event) => updateSelectedPoint('xMm', Number(event.target.value))}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Y, мм"
                  type="number"
                  value={Math.round(selectedPoint.yMm)}
                  onChange={(event) => updateSelectedPoint('yMm', Number(event.target.value))}
                  fullWidth
                />
              </Stack>
            )}

            {selectedObjectId === 'base' && (
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.100' }}>
                <Typography variant="subtitle2">Основное полотно</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  <Chip size="small" label={`${metrics.areaM2} м²`} />
                  <Chip size="small" label={`${metrics.perimeterM} м периметр`} />
                  <Chip size="small" label={`${metrics.seamsM} м швов`} />
                </Stack>
              </Box>
            )}

            {(selectedFixture || selectedObstacle) && selectedOffsets && (
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Привязки от стен
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    size="small"
                    label="Слева, мм"
                    type="number"
                    value={selectedOffsets.left}
                    onChange={(event) => updateSelectedOffset('left', Number(event.target.value))}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Сверху, мм"
                    type="number"
                    value={selectedOffsets.top}
                    onChange={(event) => updateSelectedOffset('top', Number(event.target.value))}
                    fullWidth
                  />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Справа, мм"
                    type="number"
                    value={selectedOffsets.right}
                    onChange={(event) => updateSelectedOffset('right', Number(event.target.value))}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Снизу, мм"
                    type="number"
                    value={selectedOffsets.bottom}
                    onChange={(event) => updateSelectedOffset('bottom', Number(event.target.value))}
                    fullWidth
                  />
                </Stack>
              </Box>
            )}

            {selectedFixture && (
              <TextField
                size="small"
                label="Диаметр светильника, мм"
                type="number"
                value={selectedFixture.diameterMm}
                onChange={(event) => emit(updateFixtureDetails(value, selectedFixture.id, { diameterMm: Number(event.target.value) }))}
              />
            )}

            {selectedObstacle && (
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  label="Диаметр, мм"
                  type="number"
                  value={selectedObstacle.diameterMm}
                  onChange={(event) => emit(updateObstacleDetails(value, selectedObstacle.id, { diameterMm: Number(event.target.value) }))}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Зазор, мм"
                  type="number"
                  value={selectedObstacle.clearanceMm}
                  onChange={(event) => emit(updateObstacleDetails(value, selectedObstacle.id, { clearanceMm: Number(event.target.value) }))}
                  fullWidth
                />
              </Stack>
            )}

            {selectedLinearFeature && (
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{featureLabel(selectedLinearFeature.kind)}</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    size="small"
                    label="Ширина, мм"
                    type="number"
                    value={selectedLinearFeature.widthMm}
                    onChange={(event) => emit(updateLinearFeatureDetails(value, selectedLinearFeature.id, { widthMm: Number(event.target.value) }))}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Длина, м"
                    value={formatSketchNumber(lineLengthMm(selectedLinearFeature.start, selectedLinearFeature.end) / 1000)}
                    slotProps={{ input: { readOnly: true } }}
                    fullWidth
                  />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField size="small" label="Старт X" type="number" value={Math.round(selectedLinearFeature.start.xMm)} onChange={(event) => updateLinearEndpoint('start', 'xMm', Number(event.target.value))} fullWidth />
                  <TextField size="small" label="Старт Y" type="number" value={Math.round(selectedLinearFeature.start.yMm)} onChange={(event) => updateLinearEndpoint('start', 'yMm', Number(event.target.value))} fullWidth />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Финиш X" type="number" value={Math.round(selectedLinearFeature.end.xMm)} onChange={(event) => updateLinearEndpoint('end', 'xMm', Number(event.target.value))} fullWidth />
                  <TextField size="small" label="Финиш Y" type="number" value={Math.round(selectedLinearFeature.end.yMm)} onChange={(event) => updateLinearEndpoint('end', 'yMm', Number(event.target.value))} fullWidth />
                </Stack>
              </Box>
            )}

            {selectedSeam && (
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Шов / разделитель полотна</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField size="small" label="Старт X" type="number" value={Math.round(selectedSeam.start.xMm)} onChange={(event) => updateSeamEndpoint('start', 'xMm', Number(event.target.value))} fullWidth />
                  <TextField size="small" label="Старт Y" type="number" value={Math.round(selectedSeam.start.yMm)} onChange={(event) => updateSeamEndpoint('start', 'yMm', Number(event.target.value))} fullWidth />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Финиш X" type="number" value={Math.round(selectedSeam.end.xMm)} onChange={(event) => updateSeamEndpoint('end', 'xMm', Number(event.target.value))} fullWidth />
                  <TextField size="small" label="Финиш Y" type="number" value={Math.round(selectedSeam.end.yMm)} onChange={(event) => updateSeamEndpoint('end', 'yMm', Number(event.target.value))} fullWidth />
                </Stack>
              </Box>
            )}

            {selectedLevel && (
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Многоуровневый участок</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    size="small"
                    label="Название"
                    value={selectedLevel.name}
                    onChange={(event) => emit(updateCeilingLevelDetails(value, selectedLevel.id, { name: event.target.value }))}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Перепад, мм"
                    type="number"
                    value={selectedLevel.elevationMm}
                    onChange={(event) => emit(updateCeilingLevelDetails(value, selectedLevel.id, { elevationMm: Number(event.target.value) }))}
                    fullWidth
                  />
                </Stack>
                <Stack spacing={1}>
                  {selectedLevel.points.map((levelPoint, index) => (
                    <Stack key={levelPoint.id} direction="row" spacing={1}>
                      <TextField size="small" label={`Т${index + 1} X`} type="number" value={Math.round(levelPoint.xMm)} onChange={(event) => updateLevelPoint(selectedLevel, levelPoint.id, 'xMm', Number(event.target.value))} fullWidth />
                      <TextField size="small" label={`Т${index + 1} Y`} type="number" value={Math.round(levelPoint.yMm)} onChange={(event) => updateLevelPoint(selectedLevel, levelPoint.id, 'yMm', Number(event.target.value))} fullWidth />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={!selectedObjectId || selectedObjectId === 'base'}
              onClick={removeSelected}
              sx={{ minHeight: 48 }}
            >
              Удалить выбранное
            </Button>

            <Divider />

            <Typography variant="subtitle2">Стены</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {walls.map((wall) => (
                <TextField
                  key={wall.id}
                  size="small"
                  label={`Стена ${wall.label}, мм`}
                  type="number"
                  value={wall.lengthMm}
                  onChange={(event) => emit(setCeilingWallLength(value, wall.startIndex, Number(event.target.value)))}
                  sx={{ width: 158 }}
                />
              ))}
            </Stack>

            <Divider />

            <Typography variant="subtitle2">Полотно</Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                select
                size="small"
                label="Фактура"
                value={value.fabric.texture}
                onChange={(event) => emit(updateFabric(value, { texture: event.target.value as CeilingFabricTexture }))}
                fullWidth
              >
                {(['matte', 'satin', 'gloss', 'fabric'] as CeilingFabricTexture[]).map((texture) => (
                  <MenuItem key={texture} value={texture}>{textureLabel(texture)}</MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Рулон, мм"
                type="number"
                value={value.fabric.rollWidthMm}
                onChange={(event) => emit(updateFabric(value, { rollWidthMm: Number(event.target.value) }))}
                sx={{ width: 130 }}
              />
            </Stack>
            <TextField
              size="small"
              label="Направление полотна, °"
              type="number"
              value={value.fabric.directionDeg}
              onChange={(event) => emit(updateFabric(value, { directionDeg: Number(event.target.value) }))}
            />

            <Divider />

            <Typography variant="subtitle2">Объекты</Typography>
            <Stack spacing={0.75} sx={{ maxHeight: 190, overflow: 'auto' }}>
              <Chip
                variant={selectedObjectId === 'base' ? 'filled' : 'outlined'}
                color={selectedObjectId === 'base' ? 'primary' : 'default'}
                label={`Основное полотно · ${metrics.areaM2} м²`}
                onClick={() => setSelectedObjectId('base')}
              />
              {value.linearFeatures.map((feature) => (
                <Chip
                  key={feature.id}
                  variant={selectedObjectId === feature.id ? 'filled' : 'outlined'}
                  color={selectedObjectId === feature.id ? 'primary' : 'default'}
                  label={`${featureLabel(feature.kind)} · ${formatSketchNumber(lineLengthMm(feature.start, feature.end) / 1000)} м`}
                  onClick={() => setSelectedObjectId(feature.id)}
                />
              ))}
              {value.fixtures.map((fixture) => (
                <Chip
                  key={fixture.id}
                  variant={selectedObjectId === fixture.id ? 'filled' : 'outlined'}
                  color={selectedObjectId === fixture.id ? 'primary' : 'default'}
                  label={featureLabel(fixture.kind)}
                  onClick={() => setSelectedObjectId(fixture.id)}
                />
              ))}
              {value.obstacles.map((obstacle) => (
                <Chip
                  key={obstacle.id}
                  variant={selectedObjectId === obstacle.id ? 'filled' : 'outlined'}
                  color={selectedObjectId === obstacle.id ? 'primary' : 'default'}
                  label={featureLabel(obstacle.kind)}
                  onClick={() => setSelectedObjectId(obstacle.id)}
                />
              ))}
              {value.levels.map((level) => (
                <Chip
                  key={level.id}
                  variant={selectedObjectId === level.id ? 'filled' : 'outlined'}
                  color={selectedObjectId === level.id ? 'primary' : 'default'}
                  label={level.name}
                  onClick={() => setSelectedObjectId(level.id)}
                />
              ))}
              {value.fabric.seams.map((seam, index) => (
                <Chip
                  key={seam.id}
                  variant={selectedObjectId === seam.id ? 'filled' : 'outlined'}
                  color={selectedObjectId === seam.id ? 'primary' : 'default'}
                  label={`Шов ${index + 1} · ${formatSketchNumber(lineLengthMm(seam.start, seam.end) / 1000)} м`}
                  onClick={() => setSelectedObjectId(seam.id)}
                />
              ))}
              {value.linearFeatures.length + value.fixtures.length + value.obstacles.length + value.levels.length + value.fabric.seams.length === 0 && (
                <Typography variant="body2" color="text.secondary">Пока только контур.</Typography>
              )}
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
