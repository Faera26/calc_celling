import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  FitScreen as FitScreenIcon,
  GridOn as GridOnIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  MoreHoriz as MoreHorizIcon,
  Redo as RedoIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import type {
  CalculationTransferPayload,
  CeilingBuilderMode,
  CeilingBuilderObject,
  CeilingBuilderObjectType,
  CeilingBuilderPoint,
  CeilingBuilderWall,
  CeilingShapeBuilderState,
  CeilingShapeTemplate,
  CeilingSketch,
  CeilingSketchMetrics,
} from '../types';
import {
  addBuilderDiagonal,
  addBuilderObject,
  addBuilderPoint,
  addBuilderSeam,
  applyTemplate,
  buildCalculationTransferPayload,
  calculateBuilderBounds,
  calculateBuilderMetrics,
  closeBuilderContour,
  createBuilderStateFromSketch,
  defaultBuilderViewport,
  fabricOrientationAngle,
  fabricNeedsSeam,
  insertBuilderPointAfter,
  measuredWallLengthText,
  moveBuilderPoint,
  parseDimensionInput,
  pointInsideContour,
  projectedFabricWidthMm,
  removeBuilderDiagonal,
  removeBuilderObject,
  removeBuilderPoint,
  renameBuilderPoint,
  setBuilderPointLocked,
  setBuilderWallComment,
  setBuilderWallLength,
  syncBuilderIntoSketch,
  updateBuilderDiagonal,
  updateBuilderFabricSettings,
  updateBuilderNotes,
  updateBuilderObject,
  validateBuilderState,
} from '../features/ceilingBuilder/ceilingBuilder';

type SheetState = 'collapsed' | 'half' | 'full';

interface ViewBoxState {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragTarget {
  kind: 'point' | 'object';
  id: string;
}

interface CeilingBuilderDialogProps {
  open: boolean;
  roomName: string;
  value: CeilingSketch;
  roomId?: string | null;
  calculationId?: string | null;
  onClose: () => void;
  onSaveDraft?: (sketch: CeilingSketch, metrics: CeilingSketchMetrics, payload: CalculationTransferPayload) => void;
  onApply: (sketch: CeilingSketch, metrics: CeilingSketchMetrics, payload: CalculationTransferPayload) => void;
}

const MODES: Array<{ id: CeilingBuilderMode; label: string }> = [
  { id: 'shape', label: 'Форма' },
  { id: 'dimensions', label: 'Размеры' },
  { id: 'diagonals', label: 'Диагонали' },
  { id: 'objects', label: 'Объекты' },
  { id: 'fabric', label: 'Полотно' },
  { id: 'summary', label: 'Итог' },
];

const OBJECT_OPTIONS: Array<{ id: CeilingBuilderObjectType; label: string }> = [
  { id: 'pipe', label: 'Труба' },
  { id: 'chandelier', label: 'Люстра' },
  { id: 'spotlight', label: 'Светильник' },
  { id: 'spotlight_group', label: 'Группа светильников' },
  { id: 'vent', label: 'Вентиляция' },
  { id: 'cornice', label: 'Карниз' },
  { id: 'niche', label: 'Ниша' },
  { id: 'column', label: 'Колонна / выступ' },
  { id: 'bypass', label: 'Обход' },
  { id: 'sensor', label: 'Датчик' },
  { id: 'custom', label: 'Другое' },
];

function cloneState(state: CeilingShapeBuilderState) {
  return structuredClone(state);
}

function pointLabel(point: CeilingBuilderPoint | undefined) {
  return point?.label || '?';
}

function objectLabel(object: CeilingBuilderObject) {
  if (object.type === 'pipe') return `Труба Ø${object.diameterMm || 25}`;
  if (object.type === 'chandelier') return 'Люстра';
  if (object.type === 'spotlight') return 'Светильник';
  if (object.type === 'spotlight_group') return `Свет ${object.quantity} шт.`;
  if (object.type === 'cornice') return 'Карниз';
  if (object.type === 'niche') return 'Ниша';
  if (object.type === 'vent') return 'Вентиляция';
  if (object.type === 'sensor') return 'Датчик';
  if (object.type === 'column') return 'Колонна';
  return object.meta?.customLabel || 'Объект';
}

function viewBoxString(viewBox: ViewBoxState) {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pointToSegmentDistance(
  point: Pick<CeilingBuilderPoint, 'x' | 'y'>,
  start: Pick<CeilingBuilderPoint, 'x' | 'y'>,
  end: Pick<CeilingBuilderPoint, 'x' | 'y'>
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx ** 2 + dy ** 2;
  const ratio = lengthSq === 0 ? 0 : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
  const projection = { x: start.x + dx * ratio, y: start.y + dy * ratio };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function wallMidpoint(wall: CeilingBuilderWall, points: CeilingBuilderPoint[]) {
  const from = points.find((point) => point.id === wall.fromPointId);
  const to = points.find((point) => point.id === wall.toPointId);
  if (!from || !to) return null;
  return {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
}

function wallAngle(wall: CeilingBuilderWall, points: CeilingBuilderPoint[]) {
  const from = points.find((point) => point.id === wall.fromPointId);
  const to = points.find((point) => point.id === wall.toPointId);
  if (!from || !to) return 0;
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

function templateLabel(template: CeilingShapeTemplate) {
  if (template === 'l_shape') return 'Г-образная';
  if (template === 'u_shape') return 'П-образная';
  if (template === 'polygon') return 'Многоугольник';
  if (template === 'free') return 'Свободная';
  return 'Прямоугольник';
}

function modeTitle(mode: CeilingBuilderMode) {
  return MODES.find((item) => item.id === mode)?.label || 'Форма';
}

function buildViewBox(state: CeilingShapeBuilderState): ViewBoxState {
  const base = defaultBuilderViewport(state);
  const zoom = clamp(state.viewState.zoom, 0.5, 5);
  const width = base.width / zoom;
  const height = base.height / zoom;

  return {
    x: base.x + (base.width - width) / 2 + state.viewState.panX,
    y: base.y + (base.height - height) / 2 + state.viewState.panY,
    width,
    height,
  };
}

export default function CeilingBuilderDialog({
  open,
  roomName,
  value,
  roomId = null,
  calculationId = null,
  onClose,
  onSaveDraft,
  onApply,
}: CeilingBuilderDialogProps) {
  const [builder, setBuilder] = useState(() => createBuilderStateFromSketch(value, roomId, calculationId));
  const [history, setHistory] = useState<CeilingShapeBuilderState[]>([]);
  const [future, setFuture] = useState<CeilingShapeBuilderState[]>([]);
  const [sheetState, setSheetState] = useState<SheetState>('half');
  const [dimensionCursor, setDimensionCursor] = useState(0);
  const [dimensionInput, setDimensionInput] = useState(() => {
    const initial = createBuilderStateFromSketch(value, roomId, calculationId);
    return initial.walls[0]?.lengthMm ? String(initial.walls[0].lengthMm) : '';
  });
  const [diagonalStartId, setDiagonalStartId] = useState<string>('');
  const [diagonalEndId, setDiagonalEndId] = useState<string>('');
  const [diagonalInput, setDiagonalInput] = useState('');
  const [selectedObjectType, setSelectedObjectType] = useState<CeilingBuilderObjectType>('pipe');
  const [showWarningConfirm, setShowWarningConfirm] = useState(false);
  const [preciseStepMm, setPreciseStepMm] = useState(50);
  const [frozenViewBox, setFrozenViewBox] = useState<ViewBoxState | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const dragStartStateRef = useRef<CeilingShapeBuilderState | null>(null);
  const pendingDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{
    distance: number;
    centerX: number;
    centerY: number;
    zoom: number;
    panX: number;
    panY: number;
    viewBox: ViewBoxState;
  } | null>(null);
  const tapStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyPosition: body.style.position,
      bodyWidth: body.style.width,
      overscrollBehavior: body.style.overscrollBehavior,
    };

    html.style.height = '100%';
    html.style.overflow = 'hidden';
    body.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
    body.style.overscrollBehavior = 'none';

    const updateViewportHeight = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--ceiling-builder-vh', `${height}px`);
    };

    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);

    const surface = surfaceRef.current;
    const preventTouchMove = (event: TouchEvent) => event.preventDefault();
    surface?.addEventListener('touchmove', preventTouchMove, { passive: false });

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;
      body.style.position = previous.bodyPosition;
      body.style.width = previous.bodyWidth;
      body.style.overscrollBehavior = previous.overscrollBehavior;
      document.documentElement.style.removeProperty('--ceiling-builder-vh');
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      surface?.removeEventListener('touchmove', preventTouchMove);
    };
  }, [open]);

  useEffect(() => () => {
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
    }
  }, []);

  const metrics = useMemo(() => calculateBuilderMetrics(builder), [builder]);
  const validationIssues = useMemo(() => validateBuilderState(builder), [builder]);
  const criticalIssues = validationIssues.filter((issue) => issue.severity === 'critical');
  const warningIssues = validationIssues.filter((issue) => issue.severity === 'warning');
  const selectedPoint = builder.viewState.selectedElementType === 'point'
    ? builder.points.find((point) => point.id === builder.viewState.selectedElementId) || null
    : null;
  const selectedWall = builder.viewState.selectedElementType === 'wall'
    ? builder.walls.find((wall) => wall.id === builder.viewState.selectedElementId) || null
    : null;
  const selectedObject = builder.viewState.selectedElementType === 'object'
    ? builder.objects.find((object) => object.id === builder.viewState.selectedElementId) || null
    : null;
  const viewBox = frozenViewBox || buildViewBox(builder);
  const currentWall = builder.walls[dimensionCursor] || null;

  function setMode(activeMode: CeilingBuilderMode) {
    setBuilder((prev) => ({
      ...prev,
      viewState: {
        ...prev.viewState,
        activeMode,
      },
    }));
    setSheetState(activeMode === 'summary' ? 'full' : 'half');
  }

  function commit(next: CeilingShapeBuilderState) {
    setHistory((prev) => [...prev, cloneState(builder)].slice(-60));
    setFuture([]);
    setBuilder(next);
  }

  function mutate(mutator: (state: CeilingShapeBuilderState) => CeilingShapeBuilderState) {
    commit(mutator(builder));
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;

    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [cloneState(builder), ...prev].slice(0, 60));
    setBuilder(cloneState(previous));
  }

  function redo() {
    const next = future[0];
    if (!next) return;

    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, cloneState(builder)].slice(-60));
    setBuilder(cloneState(next));
  }

  function fitToScreen() {
    setBuilder((prev) => ({
      ...prev,
      viewState: {
        ...prev.viewState,
        zoom: 1,
        panX: 0,
        panY: 0,
      },
    }));
  }

  function selectElement(type: CeilingShapeBuilderState['viewState']['selectedElementType'], id: string | null) {
    setBuilder((prev) => ({
      ...prev,
      viewState: {
        ...prev.viewState,
        selectedElementType: type,
        selectedElementId: id,
      },
    }));
  }

  function worldPointFromClient(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const rect = svg.getBoundingClientRect();
    const x = viewBox.x + ((clientX - rect.left) / Math.max(rect.width, 1)) * viewBox.width;
    const y = viewBox.y + ((clientY - rect.top) / Math.max(rect.height, 1)) * viewBox.height;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function scheduleDragUpdate() {
    if (dragRafRef.current !== null) return;

    dragRafRef.current = requestAnimationFrame(() => {
      const target = dragTargetRef.current;
      const point = pendingDragPointRef.current;
      dragRafRef.current = null;
      if (!target || !point) return;

      setBuilder((prev) => (
        target.kind === 'point'
          ? moveBuilderPoint(prev, target.id, point.x, point.y)
          : updateBuilderObject(prev, target.id, { x: point.x, y: point.y })
      ));
    });
  }

  function startDrag(event: ReactPointerEvent<SVGElement>, target: DragTarget) {
    event.preventDefault();
    event.stopPropagation();
    dragTargetRef.current = target;
    dragStartStateRef.current = cloneState(builder);
    setFrozenViewBox(buildViewBox(builder));
    pendingDragPointRef.current = worldPointFromClient(event.clientX, event.clientY);
    selectElement(target.kind, target.id);
    if (target.kind === 'point' && builder.viewState.activeMode !== 'shape') {
      setMode('shape');
    }
    if (target.kind === 'object' && builder.viewState.activeMode !== 'objects') {
      setMode('objects');
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function finishDrag() {
    if (dragTargetRef.current && dragStartStateRef.current) {
      setHistory((prev) => [...prev, dragStartStateRef.current as CeilingShapeBuilderState].slice(-60));
      setFuture([]);
    }

    dragTargetRef.current = null;
    dragStartStateRef.current = null;
    setFrozenViewBox(null);
    pendingDragPointRef.current = null;
  }

  function beginGestureIfNeeded() {
    if (pointersRef.current.size !== 2) return;
    const [first, second] = [...pointersRef.current.values()];
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    const centerX = (first.x + second.x) / 2;
    const centerY = (first.y + second.y) / 2;

    gestureRef.current = {
      distance,
      centerX,
      centerY,
      zoom: builder.viewState.zoom,
      panX: builder.viewState.panX,
      panY: builder.viewState.panY,
      viewBox: buildViewBox(builder),
    };
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    tapStartRef.current = { x: event.clientX, y: event.clientY, moved: false };
    if (pointersRef.current.size === 2) beginGestureIfNeeded();
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    event.preventDefault();
    if (dragTargetRef.current) {
      pendingDragPointRef.current = worldPointFromClient(event.clientX, event.clientY);
      scheduleDragUpdate();
      return;
    }

    const pointer = pointersRef.current.get(event.pointerId);
    if (pointer) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (tapStartRef.current) {
      const moved = Math.hypot(event.clientX - tapStartRef.current.x, event.clientY - tapStartRef.current.y) > 8;
      tapStartRef.current.moved ||= moved;
    }

    if (pointersRef.current.size === 2 && gestureRef.current) {
      const [first, second] = [...pointersRef.current.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      const svg = svgRef.current;
      const rect = svg?.getBoundingClientRect();
      const worldPerPixelX = gestureRef.current.viewBox.width / Math.max(rect?.width || 1, 1);
      const worldPerPixelY = gestureRef.current.viewBox.height / Math.max(rect?.height || 1, 1);
      const zoom = clamp(gestureRef.current.zoom * (distance / Math.max(gestureRef.current.distance, 1)), 0.5, 5);

      setBuilder((prev) => ({
        ...prev,
        viewState: {
          ...prev.viewState,
          zoom,
          panX: gestureRef.current!.panX - (centerX - gestureRef.current!.centerX) * worldPerPixelX,
          panY: gestureRef.current!.panY - (centerY - gestureRef.current!.centerY) * worldPerPixelY,
        },
      }));
    }
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    event.preventDefault();
    pointersRef.current.delete(event.pointerId);

    if (dragTargetRef.current) {
      finishDrag();
      return;
    }

    if (pointersRef.current.size < 2) {
      gestureRef.current = null;
    }

    const wasTap = tapStartRef.current && !tapStartRef.current.moved;
    tapStartRef.current = null;
    if (!wasTap) return;

    if (builder.viewState.activeMode === 'shape' && builder.template === 'free' && !builder.isClosed) {
      const point = worldPointFromClient(event.clientX, event.clientY);
      mutate((state) => addBuilderPoint(state, point.x, point.y));
      return;
    }

    selectElement(null, null);
  }

  function moveSelectedPointBy(dx: number, dy: number) {
    if (!selectedPoint) return;
    mutate((state) => moveBuilderPoint(state, selectedPoint.id, selectedPoint.x + dx, selectedPoint.y + dy));
  }

  function handleQuickWallSave() {
    if (!currentWall) return;
    const parsed = parseDimensionInput(dimensionInput);
    mutate((state) => setBuilderWallLength(state, currentWall.id, parsed));
  }

  function handleNextWall() {
    handleQuickWallSave();
    const nextCursor = Math.min(builder.walls.length - 1, dimensionCursor + 1);
    const nextWall = builder.walls[nextCursor];
    setDimensionCursor(nextCursor);
    setDimensionInput(nextWall?.lengthMm ? String(nextWall.lengthMm) : '');
  }

  function handlePreviousWall() {
    handleQuickWallSave();
    const nextCursor = Math.max(0, dimensionCursor - 1);
    const nextWall = builder.walls[nextCursor];
    setDimensionCursor(nextCursor);
    setDimensionInput(nextWall?.lengthMm ? String(nextWall.lengthMm) : '');
  }

  function addDiagonalFromForm() {
    if (!diagonalStartId || !diagonalEndId) return;
    mutate((state) => addBuilderDiagonal(state, diagonalStartId, diagonalEndId, parseDimensionInput(diagonalInput)));
    setDiagonalInput('');
  }

  function handleDraftSave() {
    const synced = syncBuilderIntoSketch(builder, value);
    onSaveDraft?.(synced.sketch, synced.metrics, synced.payload);
  }

  function applyToCalculation(force = false) {
    const issues = validateBuilderState(builder);
    const critical = issues.filter((issue) => issue.severity === 'critical');
    const warnings = issues.filter((issue) => issue.severity === 'warning');
    if (critical.length > 0) {
      setMode('summary');
      return;
    }

    if (!force && warnings.length > 0) {
      setShowWarningConfirm(true);
      return;
    }

    const synced = syncBuilderIntoSketch(builder, value);
    onApply(synced.sketch, synced.metrics, synced.payload);
    setShowWarningConfirm(false);
  }

  function renderShapePanel() {
    return (
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Шаблон</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {(['rectangle', 'l_shape', 'u_shape', 'polygon', 'free'] as CeilingShapeTemplate[]).map((template) => (
              <Button
                key={template}
                variant={builder.template === template ? 'contained' : 'outlined'}
                onClick={() => mutate((state) => applyTemplate(state, template))}
                sx={{ minHeight: 44 }}
              >
                {templateLabel(template)}
              </Button>
            ))}
          </Stack>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {builder.template === 'free' && !builder.isClosed && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => mutate((state) => addBuilderPoint(state, 400 + state.points.length * 500, 400 + state.points.length * 250))}
              sx={{ minHeight: 48 }}
            >
              Добавить точку
            </Button>
          )}
          <Button
            variant={builder.isClosed ? 'outlined' : 'contained'}
            disabled={builder.isClosed || builder.points.length < 3}
            onClick={() => mutate(closeBuilderContour)}
            sx={{ minHeight: 48 }}
          >
            {builder.isClosed ? 'Контур замкнут' : 'Замкнуть контур'}
          </Button>
        </Stack>

        <Alert severity={builder.isClosed ? 'success' : 'warning'}>
          {builder.isClosed ? 'Контур замкнут.' : 'Контур не замкнут.'}
        </Alert>

        {selectedPoint && (
          <Stack spacing={1.25}>
            <Divider />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Точка {selectedPoint.label}</Typography>
            <TextField
              label="Имя точки"
              value={selectedPoint.label}
              onChange={(event) => mutate((state) => renameBuilderPoint(state, selectedPoint.id, event.target.value))}
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button onClick={() => mutate((state) => setBuilderPointLocked(state, selectedPoint.id, !selectedPoint.locked))}>
                {selectedPoint.locked ? 'Разблокировать' : 'Зафиксировать'}
              </Button>
              <Button onClick={() => mutate((state) => insertBuilderPointAfter(state, selectedPoint.id))}>
                Добавить после
              </Button>
              <Button color="error" onClick={() => mutate((state) => removeBuilderPoint(state, selectedPoint.id))}>
                Удалить
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <TextField
                select
                label="Шаг"
                size="small"
                value={preciseStepMm}
                onChange={(event) => setPreciseStepMm(Number(event.target.value))}
                sx={{ width: 110 }}
              >
                <MenuItem value={10}>10 мм</MenuItem>
                <MenuItem value={50}>50 мм</MenuItem>
                <MenuItem value={100}>100 мм</MenuItem>
              </TextField>
              <Button onClick={() => moveSelectedPointBy(0, -preciseStepMm)}>Вверх</Button>
              <Button onClick={() => moveSelectedPointBy(0, preciseStepMm)}>Вниз</Button>
              <Button onClick={() => moveSelectedPointBy(-preciseStepMm, 0)}>Влево</Button>
              <Button onClick={() => moveSelectedPointBy(preciseStepMm, 0)}>Вправо</Button>
            </Stack>
          </Stack>
        )}
      </Stack>
    );
  }

  function renderDimensionsPanel() {
    return (
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Стены</Typography>
          <Stack spacing={1}>
            {builder.walls.map((wall, index) => (
              <Button
                key={wall.id}
                variant={selectedWall?.id === wall.id ? 'contained' : 'outlined'}
                onClick={() => {
                  selectElement('wall', wall.id);
                  setDimensionCursor(index);
                  setDimensionInput(wall.lengthMm ? String(wall.lengthMm) : '');
                }}
                sx={{ minHeight: 44, justifyContent: 'space-between' }}
              >
                <span>{wall.label}</span>
                <span>{measuredWallLengthText(wall)} мм</span>
              </Button>
            ))}
          </Stack>
        </Box>

        {currentWall && (
          <Stack spacing={1.25}>
            <Divider />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Быстрый ввод: {currentWall.label}</Typography>
            <TextField
              autoFocus
              label="Длина стены"
              value={dimensionInput}
              inputMode="decimal"
              onChange={(event) => setDimensionInput(event.target.value)}
              helperText="Можно вводить 3200, 3.2, 3,2 или 3.20 м"
            />
            <Stack direction="row" spacing={1}>
              <Button onClick={handlePreviousWall} disabled={dimensionCursor === 0}>Назад</Button>
              <Button onClick={handleQuickWallSave}>Сохранить</Button>
              <Button variant="contained" onClick={handleNextWall} disabled={dimensionCursor >= builder.walls.length - 1}>
                Следующая
              </Button>
            </Stack>
          </Stack>
        )}

        {selectedWall && (
          <TextField
            label={`Комментарий к стене ${selectedWall.label}`}
            value={selectedWall.comment}
            onChange={(event) => mutate((state) => setBuilderWallComment(state, selectedWall.id, event.target.value))}
            multiline
            minRows={2}
          />
        )}
      </Stack>
    );
  }

  function renderDiagonalsPanel() {
    return (
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Добавить диагональ</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            select
            label="Точка 1"
            value={diagonalStartId}
            onChange={(event) => setDiagonalStartId(event.target.value)}
            fullWidth
          >
            {builder.points.map((pointValue) => <MenuItem key={pointValue.id} value={pointValue.id}>{pointValue.label}</MenuItem>)}
          </TextField>
          <TextField
            select
            label="Точка 2"
            value={diagonalEndId}
            onChange={(event) => setDiagonalEndId(event.target.value)}
            fullWidth
          >
            {builder.points.map((pointValue) => <MenuItem key={pointValue.id} value={pointValue.id}>{pointValue.label}</MenuItem>)}
          </TextField>
        </Stack>
        <TextField
          label="Длина, мм"
          value={diagonalInput}
          inputMode="decimal"
          onChange={(event) => setDiagonalInput(event.target.value)}
        />
        <Button variant="contained" onClick={addDiagonalFromForm} sx={{ minHeight: 48 }}>
          + Диагональ
        </Button>

        <Divider />
        <Stack spacing={1}>
          {builder.diagonals.length === 0 && <Typography color="text.secondary">Диагоналей пока нет.</Typography>}
          {builder.diagonals.map((diagonal) => (
            <Stack key={diagonal.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                label={diagonal.label}
                value={diagonal.lengthMm || ''}
                inputMode="numeric"
                onChange={(event) => mutate((state) => updateBuilderDiagonal(state, diagonal.id, {
                  lengthMm: parseDimensionInput(event.target.value),
                }))}
                fullWidth
              />
              <IconButton color="error" onClick={() => mutate((state) => removeBuilderDiagonal(state, diagonal.id))}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Stack>
    );
  }

  function renderObjectEditor(object: CeilingBuilderObject) {
    return (
      <Stack spacing={1.25}>
        <Divider />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{objectLabel(object)}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {(object.type === 'pipe' || object.type === 'spotlight' || object.type === 'spotlight_group' || object.type === 'chandelier') && (
            <TextField
              label="Диаметр, мм"
              type="number"
              value={object.diameterMm || ''}
              onChange={(event) => mutate((state) => updateBuilderObject(state, object.id, { diameterMm: Number(event.target.value || 0) }))}
              fullWidth
            />
          )}
          <TextField
            label="Количество"
            type="number"
            value={object.quantity}
            onChange={(event) => mutate((state) => updateBuilderObject(state, object.id, { quantity: Number(event.target.value || 1) }))}
            fullWidth
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Отступ от стены 1, мм"
            type="number"
            value={object.offsetFromWall1Mm ?? ''}
            onChange={(event) => mutate((state) => updateBuilderObject(state, object.id, {
              offsetFromWall1Mm: event.target.value === '' ? undefined : Number(event.target.value),
            }))}
            fullWidth
          />
          <TextField
            label="Отступ от стены 2, мм"
            type="number"
            value={object.offsetFromWall2Mm ?? ''}
            onChange={(event) => mutate((state) => updateBuilderObject(state, object.id, {
              offsetFromWall2Mm: event.target.value === '' ? undefined : Number(event.target.value),
            }))}
            fullWidth
          />
        </Stack>
        {(object.type === 'cornice' || object.type === 'niche') && (
          <TextField
            label="Длина, мм"
            type="number"
            value={object.lengthMm || ''}
            onChange={(event) => mutate((state) => updateBuilderObject(state, object.id, { lengthMm: Number(event.target.value || 0) }))}
          />
        )}
        <TextField
          label="Комментарий"
          value={object.comment}
          onChange={(event) => mutate((state) => updateBuilderObject(state, object.id, { comment: event.target.value }))}
          multiline
          minRows={2}
        />
        <Button color="error" onClick={() => mutate((state) => removeBuilderObject(state, object.id))}>
          Удалить объект
        </Button>
      </Stack>
    );
  }

  function renderObjectsPanel() {
    return (
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            select
            label="Тип объекта"
            value={selectedObjectType}
            onChange={(event) => setSelectedObjectType(event.target.value as CeilingBuilderObjectType)}
            fullWidth
          >
            {OBJECT_OPTIONS.map((option) => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
          </TextField>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => mutate((state) => addBuilderObject(state, selectedObjectType))}
            sx={{ minHeight: 48, minWidth: 140 }}
          >
            + Объект
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {builder.objects.map((object) => (
            <Chip
              key={object.id}
              label={objectLabel(object)}
              color={selectedObject?.id === object.id ? 'primary' : 'default'}
              onClick={() => selectElement('object', object.id)}
            />
          ))}
        </Stack>

        {selectedObject && renderObjectEditor(selectedObject)}
      </Stack>
    );
  }

  function renderFabricPanel() {
    return (
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            select
            label="Материал"
            value={builder.fabricSettings.material}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, {
              material: event.target.value as CeilingShapeBuilderState['fabricSettings']['material'],
            }))}
            fullWidth
          >
            <MenuItem value="pvc">ПВХ</MenuItem>
            <MenuItem value="fabric">Тканевое</MenuItem>
            <MenuItem value="other">Другое</MenuItem>
          </TextField>
          <TextField
            select
            label="Фактура"
            value={builder.fabricSettings.texture}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, {
              texture: event.target.value as CeilingShapeBuilderState['fabricSettings']['texture'],
            }))}
            fullWidth
          >
            <MenuItem value="">Не выбрана</MenuItem>
            <MenuItem value="matte">Мат</MenuItem>
            <MenuItem value="satin">Сатин</MenuItem>
            <MenuItem value="gloss">Глянец</MenuItem>
            <MenuItem value="fabric">Ткань</MenuItem>
            <MenuItem value="translucent">Светопропускное</MenuItem>
            <MenuItem value="photo">Фотопечать</MenuItem>
            <MenuItem value="other">Другое</MenuItem>
          </TextField>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Цвет"
            value={builder.fabricSettings.color}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, { color: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Производитель"
            value={builder.fabricSettings.manufacturer}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, { manufacturer: event.target.value }))}
            fullWidth
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            select
            label="Ширина рулона"
            value={builder.fabricSettings.rollWidthMm || ''}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, {
              rollWidthMm: Number(event.target.value || 0) || null,
            }))}
            fullWidth
          >
            <MenuItem value="">Не выбрана</MenuItem>
            <MenuItem value={3200}>3200 мм</MenuItem>
            <MenuItem value={3500}>3500 мм</MenuItem>
            <MenuItem value={4000}>4000 мм</MenuItem>
            <MenuItem value={5000}>5000 мм</MenuItem>
          </TextField>
          <TextField
            select
            label="Ориентация"
            value={builder.fabricSettings.orientationMode}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, {
              orientationMode: event.target.value as CeilingShapeBuilderState['fabricSettings']['orientationMode'],
            }))}
            fullWidth
          >
            <MenuItem value="auto">Автоматически</MenuItem>
            <MenuItem value="longest_wall">Вдоль длинной стены</MenuItem>
            <MenuItem value="wall">Вдоль выбранной стены</MenuItem>
            <MenuItem value="manual">Вручную</MenuItem>
          </TextField>
        </Stack>

        {builder.fabricSettings.orientationMode === 'wall' && (
          <TextField
            select
            label="Стена ориентации"
            value={builder.fabricSettings.orientationWallId || ''}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, {
              orientationWallId: event.target.value || null,
            }))}
          >
            {builder.walls.map((wall) => <MenuItem key={wall.id} value={wall.id}>{wall.label}</MenuItem>)}
          </TextField>
        )}

        {builder.fabricSettings.orientationMode === 'manual' && (
          <TextField
            label="Угол ориентации"
            type="number"
            value={builder.fabricSettings.orientationAngle ?? 0}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, {
              orientationAngle: Number(event.target.value || 0),
            }))}
          />
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            select
            label="Швы"
            value={builder.fabricSettings.seamMode}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, {
              seamMode: event.target.value as CeilingShapeBuilderState['fabricSettings']['seamMode'],
            }))}
            fullWidth
          >
            <MenuItem value="auto">Авто</MenuItem>
            <MenuItem value="none">Без шва</MenuItem>
            <MenuItem value="manual">Ручное расположение</MenuItem>
          </TextField>
          <TextField
            label="Припуск, мм"
            type="number"
            value={builder.fabricSettings.allowanceMm}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, { allowanceMm: Number(event.target.value || 0) }))}
            fullWidth
          />
          <TextField
            label="Усадка, %"
            type="number"
            value={builder.fabricSettings.shrinkPercent}
            onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, { shrinkPercent: Number(event.target.value || 0) }))}
            fullWidth
          />
        </Stack>

        <Alert severity={fabricNeedsSeam(builder) ? 'warning' : 'success'}>
          {fabricNeedsSeam(builder)
            ? `При выбранной ширине рулона нужен шов. Поперечный размер фигуры: ${projectedFabricWidthMm(builder)} мм.`
            : 'По текущей ориентации полотно помещается в рулон без обязательного шва.'}
        </Alert>

        <Button variant="outlined" onClick={() => mutate(addBuilderSeam)}>
          Добавить ручной шов
        </Button>

        <TextField
          label="Комментарий для производства"
          value={builder.fabricSettings.productionComment}
          onChange={(event) => mutate((state) => updateBuilderFabricSettings(state, { productionComment: event.target.value }))}
          multiline
          minRows={3}
        />
      </Stack>
    );
  }

  function renderSummaryPanel() {
    const payload = buildCalculationTransferPayload(builder);

    return (
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip label={`${metrics.areaM2} м²`} color="primary" />
          <Chip label={`${metrics.perimeterM} м.п.`} />
          <Chip label={`${metrics.corners} угл.`} />
          <Chip label={`${payload.pipeCount} труб`} />
          <Chip label={`${payload.spotlightCount} свет.`} />
        </Stack>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Проверка</Typography>
          <Stack spacing={1}>
            {validationIssues.length === 0 && <Alert severity="success">Ошибок нет.</Alert>}
            {validationIssues.map((issue) => (
              <Alert key={issue.id} severity={issue.severity === 'critical' ? 'error' : 'warning'}>
                {issue.message}
              </Alert>
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Стены</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {builder.walls.map((wall) => <Chip key={wall.id} label={`${wall.label}: ${measuredWallLengthText(wall)} мм`} />)}
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Диагонали</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {builder.diagonals.length === 0 && <Chip label="Нет диагоналей" variant="outlined" />}
            {builder.diagonals.map((diagonal) => <Chip key={diagonal.id} label={`${diagonal.label}: ${diagonal.lengthMm || '?'} мм`} />)}
          </Stack>
        </Box>

        <Stack spacing={1}>
          <TextField
            label="Комментарий монтажнику"
            value={builder.notes.installerComment}
            onChange={(event) => mutate((state) => updateBuilderNotes(state, { installerComment: event.target.value }))}
            multiline
            minRows={2}
          />
          <TextField
            label="Комментарий по замеру"
            value={builder.notes.measurementComment}
            onChange={(event) => mutate((state) => updateBuilderNotes(state, { measurementComment: event.target.value }))}
            multiline
            minRows={2}
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button onClick={() => setMode('shape')}>Вернуться к редактированию</Button>
          <Button
            variant="contained"
            disabled={criticalIssues.length > 0}
            onClick={() => applyToCalculation(false)}
            sx={{ minHeight: 50 }}
          >
            Применить в расчете
          </Button>
        </Stack>
      </Stack>
    );
  }

  function renderPanel() {
    if (builder.viewState.activeMode === 'dimensions') return renderDimensionsPanel();
    if (builder.viewState.activeMode === 'diagonals') return renderDiagonalsPanel();
    if (builder.viewState.activeMode === 'objects') return renderObjectsPanel();
    if (builder.viewState.activeMode === 'fabric') return renderFabricPanel();
    if (builder.viewState.activeMode === 'summary') return renderSummaryPanel();
    return renderShapePanel();
  }

  const bounds = calculateBuilderBounds(builder);
  const orientationAngle = fabricOrientationAngle(builder);
  const orientationLength = Math.max(bounds.width, bounds.height) * 0.45;
  const orientationRadians = (orientationAngle * Math.PI) / 180;
  const orientationCenter = {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  };

  return (
    <>
      <Dialog
        open={open}
        fullScreen
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#f4f7fb',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            height: 'var(--ceiling-builder-vh, 100dvh)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#f4f7fb',
            color: '#17202a',
          }}
        >
          <Box
            sx={{
              pt: 'env(safe-area-inset-top)',
              minHeight: 72,
              px: 1,
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              flexShrink: 0,
            }}
          >
            <IconButton onClick={onClose} aria-label="Назад" sx={{ width: 48, height: 48 }}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
                {roomName || 'Построитель потолка'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Построитель потолка
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5}>
              <IconButton aria-label="Проверить" onClick={() => setMode('summary')} sx={{ width: 48, height: 48 }}>
                <CheckCircleIcon />
              </IconButton>
              <IconButton aria-label="Сохранить" onClick={handleDraftSave} sx={{ width: 48, height: 48 }}>
                <SaveIcon />
              </IconButton>
              <IconButton aria-label="Меню" sx={{ width: 48, height: 48 }}>
                <MoreHorizIcon />
              </IconButton>
            </Stack>
          </Box>

          <Box
            ref={surfaceRef}
            sx={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              touchAction: 'none',
              overscrollBehavior: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent',
              bgcolor: '#f7fafc',
            }}
            onContextMenu={(event) => event.preventDefault()}
            onDoubleClick={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                zIndex: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 1,
                pointerEvents: 'none',
              }}
            >
              <Stack direction="row" spacing={1} sx={{ pointerEvents: 'auto' }}>
                <Button variant="outlined" onClick={undo} disabled={history.length === 0} sx={{ minWidth: 48, minHeight: 44 }}>
                  <UndoIcon />
                </Button>
                <Button variant="outlined" onClick={redo} disabled={future.length === 0} sx={{ minWidth: 48, minHeight: 44 }}>
                  <RedoIcon />
                </Button>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ pointerEvents: 'auto' }}>
                <Button variant="outlined" onClick={fitToScreen} startIcon={<FitScreenIcon />} sx={{ minHeight: 44 }}>
                  Вписать
                </Button>
                <Button
                  variant={builder.viewState.showGrid ? 'contained' : 'outlined'}
                  onClick={() => setBuilder((prev) => ({
                    ...prev,
                    viewState: { ...prev.viewState, showGrid: !prev.viewState.showGrid },
                  }))}
                  sx={{ minWidth: 48, minHeight: 44 }}
                >
                  <GridOnIcon />
                </Button>
                <Button
                  variant={builder.viewState.showLabels ? 'contained' : 'outlined'}
                  onClick={() => setBuilder((prev) => ({
                    ...prev,
                    viewState: { ...prev.viewState, showLabels: !prev.viewState.showLabels },
                  }))}
                  sx={{ minWidth: 48, minHeight: 44 }}
                >
                  {builder.viewState.showLabels ? <VisibilityIcon /> : <VisibilityOffIcon />}
                </Button>
              </Stack>
            </Box>

            <svg
              ref={svgRef}
              viewBox={viewBoxString(viewBox)}
              preserveAspectRatio="xMidYMid meet"
              width="100%"
              height="100%"
              style={{
                display: 'block',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
            >
              <defs>
                <pattern id="builder-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#d9e2ec" strokeWidth="1" />
                </pattern>
                <marker id="builder-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
                </marker>
              </defs>

              {builder.viewState.showGrid && (
                <rect
                  x={viewBox.x}
                  y={viewBox.y}
                  width={viewBox.width}
                  height={viewBox.height}
                  fill="url(#builder-grid)"
                />
              )}

              {builder.isClosed && builder.points.length >= 3 && (
                <polygon
                  points={builder.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="#dbeafe"
                  stroke="#17202a"
                  strokeWidth="28"
                  strokeLinejoin="round"
                />
              )}

              {!builder.isClosed && builder.points.length > 1 && (
                <polyline
                  points={builder.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke="#17202a"
                  strokeWidth="28"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {builder.walls.map((wall) => {
                const from = builder.points.find((point) => point.id === wall.fromPointId);
                const to = builder.points.find((point) => point.id === wall.toPointId);
                const midpoint = wallMidpoint(wall, builder.points);
                if (!from || !to || !midpoint) return null;

                return (
                  <g key={wall.id}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="transparent"
                      strokeWidth="120"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectElement('wall', wall.id);
                        if (builder.viewState.activeMode !== 'dimensions') {
                          setMode('dimensions');
                        }
                      }}
                    />
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={selectedWall?.id === wall.id ? '#2563eb' : '#17202a'}
                      strokeWidth={selectedWall?.id === wall.id ? 36 : 28}
                      strokeLinecap="round"
                    />
                    {builder.viewState.showLabels && (
                      <g transform={`translate(${midpoint.x} ${midpoint.y}) rotate(${wallAngle(wall, builder.points)})`}>
                        <rect x="-165" y="-78" width="330" height="104" rx="12" fill="#ffffff" opacity="0.96" />
                        <text textAnchor="middle" y="-6" fontSize="64" fontWeight="700" fill={wall.isMeasured ? '#17202a' : '#64748b'}>
                          {wall.label} · {measuredWallLengthText(wall)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {builder.diagonals.map((diagonal) => {
                const from = builder.points.find((point) => point.id === diagonal.fromPointId);
                const to = builder.points.find((point) => point.id === diagonal.toPointId);
                if (!from || !to) return null;
                const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

                return (
                  <g key={diagonal.id}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="#64748b"
                      strokeWidth="20"
                      strokeDasharray="60 40"
                    />
                    {builder.viewState.showLabels && (
                      <text x={midpoint.x} y={midpoint.y - 40} textAnchor="middle" fontSize="58" fill="#475569">
                        {diagonal.label} · {diagonal.lengthMm || '?'}
                      </text>
                    )}
                  </g>
                );
              })}

              {builder.seams.map((seam) => (
                <line
                  key={seam.id}
                  x1={seam.startX}
                  y1={seam.startY}
                  x2={seam.endX}
                  y2={seam.endY}
                  stroke="#2563eb"
                  strokeWidth="18"
                  strokeDasharray="54 28"
                />
              ))}

              {builder.viewState.showLabels && (
                <line
                  x1={orientationCenter.x - Math.cos(orientationRadians) * orientationLength}
                  y1={orientationCenter.y - Math.sin(orientationRadians) * orientationLength}
                  x2={orientationCenter.x + Math.cos(orientationRadians) * orientationLength}
                  y2={orientationCenter.y + Math.sin(orientationRadians) * orientationLength}
                  stroke="#2563eb"
                  strokeWidth="18"
                  markerEnd="url(#builder-arrow)"
                />
              )}

              {builder.objects.map((object) => {
                const outside = !pointInsideContour(builder, object.x, object.y);
                const isSelected = selectedObject?.id === object.id;
                const radius = object.type === 'cornice' || object.type === 'niche' ? 42 : Math.max(55, (object.diameterMm || 80) / 2);

                return (
                  <g key={object.id}>
                    {object.endX !== undefined && object.endY !== undefined && (
                      <line
                        x1={object.x}
                        y1={object.y}
                        x2={object.endX}
                        y2={object.endY}
                        stroke={isSelected ? '#2563eb' : '#0f766e'}
                        strokeWidth="26"
                        strokeLinecap="round"
                      />
                    )}
                    <circle
                      cx={object.x}
                      cy={object.y}
                      r={radius}
                      fill={outside ? '#fee2e2' : isSelected ? '#bfdbfe' : '#ffffff'}
                      stroke={outside ? '#dc2626' : isSelected ? '#2563eb' : '#0f766e'}
                      strokeWidth="24"
                      onPointerDown={(event) => startDrag(event, { kind: 'object', id: object.id })}
                    />
                    {builder.viewState.showLabels && (
                      <text x={object.x} y={object.y - radius - 42} textAnchor="middle" fontSize="58" fill="#0f172a">
                        {objectLabel(object)}
                      </text>
                    )}
                  </g>
                );
              })}

              {builder.points.map((point) => {
                const selected = selectedPoint?.id === point.id;
                return (
                  <g key={point.id}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={selected ? 92 : 76}
                      fill={selected ? '#2563eb' : '#ffffff'}
                      stroke={selected ? '#1d4ed8' : '#17202a'}
                      strokeWidth="24"
                      onPointerDown={(event) => startDrag(event, { kind: 'point', id: point.id })}
                    />
                    <text
                      x={point.x}
                      y={point.y + 22}
                      textAnchor="middle"
                      fontSize="74"
                      fontWeight="700"
                      fill={selected ? '#ffffff' : '#17202a'}
                      pointerEvents="none"
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            <Box
              sx={{
                position: 'absolute',
                left: 12,
                bottom: sheetState === 'collapsed' ? 108 : sheetState === 'half' ? 332 : 'calc(62vh)',
                zIndex: 1,
                display: 'flex',
                gap: 1,
                pointerEvents: 'none',
              }}
            >
              <Chip label={`${metrics.areaM2} м²`} color="primary" />
              <Chip label={`${metrics.perimeterM} м.п.`} />
              <Chip label={`${bounds.width} x ${bounds.height} мм`} />
            </Box>

            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 3,
                height: sheetState === 'collapsed'
                  ? 104
                  : sheetState === 'half'
                    ? 328
                    : '62vh',
                minHeight: 104,
                maxHeight: 'calc(var(--ceiling-builder-vh, 100dvh) - 154px)',
                bgcolor: 'background.paper',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                borderTop: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 -10px 28px rgba(15, 23, 42, 0.12)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 54,
                  px: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{modeTitle(builder.viewState.activeMode)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {criticalIssues.length > 0 ? `${criticalIssues.length} крит. ошибок` : warningIssues.length > 0 ? `${warningIssues.length} предупреждений` : 'Готово к передаче'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5}>
                  {sheetState !== 'collapsed' && (
                    <IconButton onClick={() => setSheetState('collapsed')}>
                      <KeyboardArrowDownIcon />
                    </IconButton>
                  )}
                  {sheetState !== 'full' && (
                    <IconButton onClick={() => setSheetState(sheetState === 'collapsed' ? 'half' : 'full')}>
                      <KeyboardArrowUpIcon />
                    </IconButton>
                  )}
                </Stack>
              </Box>
              {sheetState !== 'collapsed' && (
                <Box sx={{ p: 1.5, overflowY: 'auto', minHeight: 0 }}>
                  {renderPanel()}
                </Box>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              px: 0.75,
              pb: 'calc(env(safe-area-inset-bottom) + 8px)',
              pt: 0.75,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: 0.5,
              flexShrink: 0,
            }}
          >
            {MODES.map((mode) => (
              <Button
                key={mode.id}
                variant={builder.viewState.activeMode === mode.id ? 'contained' : 'text'}
                onClick={() => setMode(mode.id)}
                sx={{
                  minWidth: 0,
                  minHeight: 54,
                  px: 0.5,
                  fontSize: 12,
                  lineHeight: 1.1,
                  whiteSpace: 'normal',
                }}
              >
                {mode.label}
              </Button>
            ))}
          </Box>
        </Box>
      </Dialog>

      <Dialog open={showWarningConfirm} onClose={() => setShowWarningConfirm(false)} fullWidth maxWidth="xs">
        <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="h6">Есть предупреждения</Typography>
              <IconButton onClick={() => setShowWarningConfirm(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Alert severity="warning">
              В построителе есть предупреждения. Проверьте их перед заказом полотна.
            </Alert>
            <Stack spacing={1}>
              {warningIssues.map((issue) => <Typography key={issue.id} variant="body2">• {issue.message}</Typography>)}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button onClick={() => {
                setShowWarningConfirm(false);
                setMode('summary');
              }}>
                Проверить
              </Button>
              <Button variant="contained" onClick={() => applyToCalculation(true)}>
                Все равно применить
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Dialog>
    </>
  );
}
