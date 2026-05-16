import { describe, expect, it } from 'vitest';
import {
  addBuilderDiagonal,
  addBuilderFabricRegion,
  addBuilderObject,
  applyTemplate,
  buildCalculationTransferPayload,
  closeBuilderContour,
  createFabricRegionFromCornice,
  createBuilderStateFromSketch,
  createDefaultCeilingBuilderState,
  calculateFabricPanels,
  fabricNeedsSeam,
  parseDimensionInput,
  snapCoordinateToNearestAxis,
  setBuilderWallLength,
  syncBuilderIntoSketch,
  validateBuilderState,
} from './ceilingBuilder';
import { createDefaultCeilingSketch } from '../ceilingSketch/ceilingSketch';

describe('ceilingBuilder', () => {
  it('создает замкнутый прямоугольник и считает передачу в калькулятор', () => {
    let state = createDefaultCeilingBuilderState('rectangle');
    state = state.walls.reduce((next, wall) => setBuilderWallLength(next, wall.id, wall.lengthMm), state);
    state = addBuilderDiagonal(state, state.points[0].id, state.points[2].id, 5280);
    state = addBuilderObject(state, 'pipe');
    state = addBuilderObject(state, 'spotlight');
    state.fabricSettings.texture = 'matte';

    const payload = buildCalculationTransferPayload(state);

    expect(payload.areaM2).toBe(13.44);
    expect(payload.perimeterM).toBe(14.8);
    expect(payload.cornerCount).toBe(4);
    expect(payload.wallCount).toBe(4);
    expect(payload.pipeCount).toBe(1);
    expect(payload.spotlightCount).toBe(1);
  });

  it('понимает ввод размеров в миллиметрах и метрах', () => {
    expect(parseDimensionInput('3200')).toBe(3200);
    expect(parseDimensionInput('3.2')).toBe(3200);
    expect(parseDimensionInput('3,2')).toBe(3200);
    expect(parseDimensionInput('3.20 м')).toBe(3200);
  });

  it('проверяет незамкнутый контур и отсутствие замеров как критические ошибки', () => {
    let state = createDefaultCeilingBuilderState('free');
    state = applyTemplate(state, 'free');
    state = closeBuilderContour(state);

    const issues = validateBuilderState(state);

    expect(issues.some((issue) => issue.id === 'contour-open')).toBe(true);
    expect(issues.some((issue) => issue.id === 'points-insufficient')).toBe(true);
  });

  it('умеет перенести старый эскиз в новый builder и обратно', () => {
    const sketch = createDefaultCeilingSketch(4000, 3000);
    const state = createBuilderStateFromSketch(sketch);
    const synced = syncBuilderIntoSketch(state, sketch);

    expect(state.points).toHaveLength(4);
    expect(synced.metrics.areaM2).toBe(12);
    expect(synced.sketch.builderState?.points).toHaveLength(4);
  });

  it('добавляет новые настройки viewState при чтении старого сохраненного builder', () => {
    const sketch = createDefaultCeilingSketch(4000, 3000);
    const savedState = createDefaultCeilingBuilderState('rectangle');
    const legacyViewState = { ...savedState.viewState } as Partial<typeof savedState.viewState>;
    delete legacyViewState.orthoEnabled;
    sketch.builderState = {
      ...savedState,
      viewState: legacyViewState as typeof savedState.viewState,
    };

    expect(createBuilderStateFromSketch(sketch).viewState.orthoEnabled).toBe(false);
    expect(createBuilderStateFromSketch(sketch).fabricRegions).toEqual([]);
  });

  it('помечает необходимость шва по ширине рулона', () => {
    const state = createDefaultCeilingBuilderState('rectangle');
    state.fabricSettings.texture = 'matte';
    state.fabricSettings.rollWidthMm = 2000;

    expect(fabricNeedsSeam(state)).toBe(true);
  });

  it('предупреждает о диагонали, которая расходится с текущей геометрией', () => {
    let state = createDefaultCeilingBuilderState('rectangle');
    state = state.walls.reduce((next, wall) => setBuilderWallLength(next, wall.id, wall.lengthMm), state);
    state.fabricSettings.texture = 'matte';
    state = addBuilderDiagonal(state, state.points[0].id, state.points[2].id, 1000);

    expect(validateBuilderState(state).some((issue) => issue.id.startsWith('diagonal-mismatch-'))).toBe(true);
  });

  it('считает внутренний контур отдельным полотном и вычитает его из внешнего', () => {
    let state = createDefaultCeilingBuilderState('rectangle');
    state = addBuilderFabricRegion(state, [
      { x: 1000, y: 800 },
      { x: 2200, y: 800 },
      { x: 2200, y: 1800 },
      { x: 1000, y: 1800 },
    ]);

    const panels = calculateFabricPanels(state);

    expect(panels).toHaveLength(2);
    expect(panels[0]).toMatchObject({ label: 'Полотно 1', areaM2: 12.24 });
    expect(panels[1]).toMatchObject({ label: 'Полотно 2', areaM2: 1.2 });
  });

  it('умеет создать отдельное полотно за карнизом', () => {
    let state = createDefaultCeilingBuilderState('rectangle');
    state = addBuilderObject(state, 'cornice');
    const cornice = state.objects.find((object) => object.type === 'cornice');
    if (!cornice) throw new Error('cornice missing');

    state = createFabricRegionFromCornice(state, cornice.id);

    expect(state.fabricRegions).toHaveLength(1);
    expect(calculateFabricPanels(state)).toHaveLength(2);
  });

  it('привязывает координату к ближайшей оси только внутри порога', () => {
    expect(snapCoordinateToNearestAxis(1190, [800, 1200, 2400])).toEqual({
      value: 1200,
      snapped: true,
      target: 1200,
    });
    expect(snapCoordinateToNearestAxis(1330, [800, 1200, 2400])).toEqual({
      value: 1330,
      snapped: false,
      target: null,
    });
  });
});
