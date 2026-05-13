import { useMemo, useRef, useState, type PointerEvent } from 'react';
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
  updateFabric,
  updateFixture,
  updateLinearFeaturePoint,
  updateObstacle,
  wallLengthsMm,
} from '../features/ceilingSketch/ceilingSketch';

type DragTarget =
  | { kind: 'corner'; id: string }
  | { kind: 'fixture'; id: string }
  | { kind: 'obstacle'; id: string }
  | { kind: 'linear'; id: string; endpoint: 'start' | 'end' };

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

interface CeilingSketcherProps {
  value: CeilingSketch;
  onChange: (nextSketch: CeilingSketch, metrics: CeilingSketchMetrics) => void;
}

const GRID_STEP_MM = 50;
const SNAP_DISTANCE_MM = 140;

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

  return points;
}

function snapPoint(
  sketch: CeilingSketch,
  rawPoint: CeilingSketchPointRef,
  target: DragTarget
): { point: CeilingSketchPointRef; guides: SnapGuide[] } {
  const snapped = {
    xMm: roundToStep(rawPoint.xMm, GRID_STEP_MM),
    yMm: roundToStep(rawPoint.yMm, GRID_STEP_MM),
  };
  const guides: SnapGuide[] = [];

  collectSnapPoints(sketch, target).forEach((point) => {
    if (Math.abs(point.xMm - snapped.xMm) <= SNAP_DISTANCE_MM) {
      snapped.xMm = point.xMm;
      guides.push({ axis: 'x', value: point.xMm, label: `X: ${point.label}` });
    }

    if (Math.abs(point.yMm - snapped.yMm) <= SNAP_DISTANCE_MM) {
      snapped.yMm = point.yMm;
      guides.push({ axis: 'y', value: point.yMm, label: `Y: ${point.label}` });
    }
  });

  if (target.kind === 'corner') {
    const currentIndex = sketch.points.findIndex((point) => point.id === target.id);

    if (currentIndex !== -1) {
      const previous = sketch.points[(currentIndex - 1 + sketch.points.length) % sketch.points.length];
      const next = sketch.points[(currentIndex + 1) % sketch.points.length];

      [previous, next].forEach((point, index) => {
        const label = index === 0 ? 'соседний угол' : 'следующий угол';

        if (Math.abs(point.xMm - snapped.xMm) <= SNAP_DISTANCE_MM * 1.25) {
          snapped.xMm = point.xMm;
          guides.push({ axis: 'x', value: point.xMm, label: `вертикаль: ${label}` });
        }

        if (Math.abs(point.yMm - snapped.yMm) <= SNAP_DISTANCE_MM * 1.25) {
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
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

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
  const activeViewBox = frozenViewBox || liveViewBox;
  const selectedPoint = selectedPointOf(value, selectedObjectId);

  function emit(nextSketch: CeilingSketch) {
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
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragTarget) return;

    event.preventDefault();
    const rawPoint = pointerToSketchPoint(event);
    const snapped = snapPoint(value, rawPoint, dragTarget);
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
    setFrozenViewBox(activeViewBox);
    setDragTarget(target);
    setSelectedObjectId(target.id);
    setSnapGuides([]);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function removeSelected() {
    if (!selectedObjectId) return;

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

  function renderHandle(target: DragTarget, point: CeilingSketchPointRef, color: string, label?: string) {
    const selected = selectedObjectId === target.id;

    return (
      <g key={`${target.kind}-${target.id}-${'endpoint' in target ? target.endpoint : 'point'}`}>
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
      <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ minHeight: { xs: 720, lg: 600 } }}>
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            sx={{
              alignItems: { md: 'center' },
              justifyContent: 'space-between',
              gap: 1,
              p: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Chip color="primary" label={`${metrics.areaM2} м²`} />
              <Chip label={`${metrics.perimeterM} м`} />
              <Chip label={`${metrics.corners} угл.`} />
              <Chip label="Сетка 50 мм" />
              <Chip label="X/Y привязки" />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {snapGuides.map((guide) => (
                <Chip key={`${guide.axis}-${guide.value}-${guide.label}`} color="success" label={guide.label} />
              ))}
            </Stack>
          </Stack>

          <Box sx={{ flexGrow: 1, minHeight: { xs: 430, md: 520 } }}>
            <svg
              ref={svgRef}
              viewBox={viewBoxString(activeViewBox)}
              role="img"
              aria-label="Чертеж потолка"
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                touchAction: 'none',
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

              <polygon points={polygonPoints} fill="#DBEAFE" stroke="#0F172A" strokeWidth="5" vectorEffect="non-scaling-stroke" />
              <polygon points={polygonPoints} fill="url(#fabric-lines)" opacity="0.45" />

              {value.levels.map((level) => (
                <polygon
                  key={level.id}
                  points={sketchPointList(level.points)}
                  fill="rgba(245, 158, 11, 0.12)"
                  stroke="#B45309"
                  strokeWidth="5"
                  strokeDasharray="20 12"
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedObjectId(level.id);
                  }}
                />
              ))}

              {value.fabric.seams.map((seam) => (
                <line
                  key={seam.id}
                  x1={seam.start.xMm}
                  y1={seam.start.yMm}
                  x2={seam.end.xMm}
                  y2={seam.end.yMm}
                  stroke="#7C3AED"
                  strokeWidth="5"
                  strokeDasharray="18 14"
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedObjectId(seam.id);
                  }}
                />
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
                onChange={(event) => emit(resizeCeilingSketch(value, Number(event.target.value), bounds.height))}
                fullWidth
              />
              <TextField
                size="small"
                label="Глубина, мм"
                type="number"
                value={Math.round(bounds.height)}
                onChange={(event) => emit(resizeCeilingSketch(value, bounds.width, Number(event.target.value)))}
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

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
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

            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={!selectedObjectId}
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
