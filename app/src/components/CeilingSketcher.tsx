import { useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Architecture as ArchitectureIcon,
  Delete as DeleteIcon,
  Layers as LayersIcon,
  Lightbulb as LightbulbIcon,
  LinearScale as LinearScaleIcon,
  Plumbing as PlumbingIcon,
  Texture as TextureIcon,
  ViewInAr as ViewInArIcon,
} from '@mui/icons-material';
import type {
  CeilingFabricTexture,
  CeilingSketch,
  CeilingSketchMetrics,
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

interface CeilingSketcherProps {
  value: CeilingSketch;
  onChange: (nextSketch: CeilingSketch, metrics: CeilingSketchMetrics) => void;
}

function lineLengthMm(start: CeilingSketchPointRef, end: CeilingSketchPointRef) {
  return Math.round(Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm));
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

export default function CeilingSketcher({ value, onChange }: CeilingSketcherProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const [viewMode, setViewMode] = useState<'plan' | 'preview'>('plan');

  const bounds = useMemo(() => sketchBounds(value), [value]);
  const metrics = useMemo(() => calculateCeilingSketchMetrics(value), [value]);
  const walls = useMemo(() => wallLengthsMm(value), [value]);
  const padding = Math.max(650, Math.min(bounds.width, bounds.height) * 0.18);
  const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;

  function emit(nextSketch: CeilingSketch) {
    onChange(nextSketch, calculateCeilingSketchMetrics(nextSketch));
  }

  function pointerToSketchPoint(event: PointerEvent<SVGSVGElement>): CeilingSketchPointRef {
    const svg = svgRef.current;
    if (!svg) return { xMm: 0, yMm: 0 };

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM()?.inverse();
    const transformed = matrix ? point.matrixTransform(matrix) : point;

    return {
      xMm: Math.round(transformed.x / 10) * 10,
      yMm: Math.round(transformed.y / 10) * 10,
    };
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragTarget) return;

    event.preventDefault();
    const point = pointerToSketchPoint(event);

    if (dragTarget.kind === 'corner') {
      emit(updateCeilingSketchPoint(value, dragTarget.id, point));
    }

    if (dragTarget.kind === 'fixture') {
      emit(updateFixture(value, dragTarget.id, point));
    }

    if (dragTarget.kind === 'obstacle') {
      emit(updateObstacle(value, dragTarget.id, point));
    }

    if (dragTarget.kind === 'linear') {
      emit(updateLinearFeaturePoint(value, dragTarget.id, dragTarget.endpoint, point));
    }
  }

  function startDrag(event: PointerEvent<SVGElement>, target: DragTarget) {
    event.preventDefault();
    event.stopPropagation();
    setDragTarget(target);
    setSelectedObjectId(target.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function selectedCanBeRemoved() {
    return Boolean(selectedObjectId);
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

  function renderPlan() {
    const polygonPoints = sketchPointList(value.points);

    return (
      <svg
        ref={svgRef}
        viewBox={viewBox}
        role="img"
        aria-label="Чертеж потолка"
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragTarget(null)}
        onPointerCancel={() => setDragTarget(null)}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
          background: '#F8FAFC',
        }}
      >
        <defs>
          <pattern id="ceiling-grid" width="500" height="500" patternUnits="userSpaceOnUse">
            <path d="M 500 0 L 0 0 0 500" fill="none" stroke="#CBD5E1" strokeWidth="1" />
          </pattern>
          <pattern id="fabric-lines" width="240" height="240" patternUnits="userSpaceOnUse" patternTransform={`rotate(${value.fabric.directionDeg})`}>
            <path d="M 0 0 L 0 240" fill="none" stroke="#93C5FD" strokeWidth="2" opacity="0.55" />
          </pattern>
        </defs>

        <rect x={bounds.minX - padding} y={bounds.minY - padding} width={bounds.width + padding * 2} height={bounds.height + padding * 2} fill="url(#ceiling-grid)" />
        <polygon points={polygonPoints} fill="#DBEAFE" stroke="#0F172A" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        <polygon points={polygonPoints} fill="url(#fabric-lines)" opacity="0.55" />

        {value.levels.map((level) => (
          <polygon
            key={level.id}
            points={sketchPointList(level.points)}
            fill="rgba(245, 158, 11, 0.12)"
            stroke="#B45309"
            strokeWidth="4"
            strokeDasharray="16 12"
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
            strokeWidth="4"
            strokeDasharray="18 14"
            vectorEffect="non-scaling-stroke"
            onPointerDown={(event) => {
              event.stopPropagation();
              setSelectedObjectId(seam.id);
            }}
          />
        ))}

        {value.linearFeatures.map((feature) => {
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
                strokeWidth="8"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedObjectId(feature.id);
                }}
              />
              <circle
                cx={feature.start.xMm}
                cy={feature.start.yMm}
                r="110"
                fill="#FFFFFF"
                stroke={color}
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
                onPointerDown={(event) => startDrag(event, { kind: 'linear', id: feature.id, endpoint: 'start' })}
              />
              <circle
                cx={feature.end.xMm}
                cy={feature.end.yMm}
                r="110"
                fill="#FFFFFF"
                stroke={color}
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
                onPointerDown={(event) => startDrag(event, { kind: 'linear', id: feature.id, endpoint: 'end' })}
              />
            </g>
          );
        })}

        {value.obstacles.map((obstacle) => (
          <g key={obstacle.id} onPointerDown={(event) => startDrag(event, { kind: 'obstacle', id: obstacle.id })}>
            <circle
              cx={obstacle.point.xMm}
              cy={obstacle.point.yMm}
              r={Math.max(120, obstacle.diameterMm / 2)}
              fill={selectedObjectId === obstacle.id ? '#FEE2E2' : '#FFFFFF'}
              stroke="#DC2626"
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={obstacle.point.xMm} cy={obstacle.point.yMm} r="24" fill="#DC2626" />
          </g>
        ))}

        {value.fixtures.map((fixture) => (
          <g key={fixture.id} onPointerDown={(event) => startDrag(event, { kind: 'fixture', id: fixture.id })}>
            <circle
              cx={fixture.point.xMm}
              cy={fixture.point.yMm}
              r={Math.max(105, fixture.diameterMm / 2)}
              fill={selectedObjectId === fixture.id ? '#FEF3C7' : '#FFFFFF'}
              stroke="#F59E0B"
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M ${fixture.point.xMm - 55} ${fixture.point.yMm} L ${fixture.point.xMm + 55} ${fixture.point.yMm} M ${fixture.point.xMm} ${fixture.point.yMm - 55} L ${fixture.point.xMm} ${fixture.point.yMm + 55}`}
              stroke="#F59E0B"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {value.points.map((sketchPoint, index) => (
          <g key={sketchPoint.id}>
            <circle
              cx={sketchPoint.xMm}
              cy={sketchPoint.yMm}
              r="135"
              fill={selectedObjectId === sketchPoint.id ? '#1D4ED8' : '#FFFFFF'}
              stroke="#1D4ED8"
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
              onPointerDown={(event) => startDrag(event, { kind: 'corner', id: sketchPoint.id })}
            />
            <text
              x={sketchPoint.xMm}
              y={sketchPoint.yMm + 34}
              textAnchor="middle"
              fontSize="120"
              fontWeight="800"
              fill={selectedObjectId === sketchPoint.id ? '#FFFFFF' : '#1D4ED8'}
              pointerEvents="none"
            >
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  function renderPreview() {
    const offsetX = Math.max(280, bounds.width * 0.1);
    const offsetY = Math.max(220, bounds.height * 0.1);
    const topPoints = value.points.map((point) => ({ xMm: point.xMm + offsetX, yMm: point.yMm - offsetY }));
    const sidePaths = value.points.map((point, index) => {
      const next = value.points[(index + 1) % value.points.length];
      const top = topPoints[index];
      const nextTop = topPoints[(index + 1) % topPoints.length];
      return `${point.xMm},${point.yMm} ${next.xMm},${next.yMm} ${nextTop.xMm},${nextTop.yMm} ${top.xMm},${top.yMm}`;
    });

    return (
      <svg
        viewBox={`${bounds.minX - padding} ${bounds.minY - padding - offsetY} ${bounds.width + padding * 2 + offsetX} ${bounds.height + padding * 2 + offsetY}`}
        role="img"
        aria-label="3D предпросмотр потолка"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: '#EFF6FF',
        }}
      >
        {sidePaths.map((path, index) => (
          <polygon key={index} points={path} fill={index % 2 === 0 ? '#BFDBFE' : '#93C5FD'} stroke="#2563EB" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        ))}
        <polygon points={sketchPointList(topPoints)} fill="#F8FAFC" stroke="#0F172A" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        {value.levels.map((level) => (
          <polygon
            key={level.id}
            points={sketchPointList(level.points.map((point) => ({ xMm: point.xMm + offsetX * 0.95, yMm: point.yMm - offsetY * 0.95 })))}
            fill="rgba(245, 158, 11, 0.15)"
            stroke="#B45309"
            strokeWidth="4"
            strokeDasharray="16 12"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    );
  }

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
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        sx={{ minHeight: { xs: 680, lg: 560 } }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              p: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <ButtonGroup size="large" variant="outlined">
              <Button
                variant={viewMode === 'plan' ? 'contained' : 'outlined'}
                startIcon={<ArchitectureIcon />}
                onClick={() => setViewMode('plan')}
              >
                План
              </Button>
              <Button
                variant={viewMode === 'preview' ? 'contained' : 'outlined'}
                startIcon={<ViewInArIcon />}
                onClick={() => setViewMode('preview')}
              >
                3D
              </Button>
            </ButtonGroup>

            <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
              <Chip color="primary" label={`${metrics.areaM2} м²`} />
              <Chip label={`${metrics.perimeterM} м`} />
              <Chip label={`${metrics.corners} угл.`} />
            </Stack>
          </Stack>

          <Box sx={{ flexGrow: 1, minHeight: { xs: 360, md: 460 } }}>
            {viewMode === 'plan' ? renderPlan() : renderPreview()}
          </Box>
        </Box>

        <Box sx={{ width: { xs: '100%', lg: 380 }, borderLeft: { lg: '1px solid' }, borderTop: { xs: '1px solid', lg: 0 }, borderColor: 'divider', p: 1.5 }}>
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
              disabled={!selectedCanBeRemoved()}
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
                  sx={{ width: 154 }}
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
            <Stack spacing={0.75} sx={{ maxHeight: 180, overflow: 'auto' }}>
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
