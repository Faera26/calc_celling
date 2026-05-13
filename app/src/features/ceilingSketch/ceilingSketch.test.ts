import { describe, expect, it } from 'vitest';
import {
  addCeilingCorner,
  addCeilingLevel,
  addFabricSeam,
  addFixture,
  addLinearFeature,
  addObstacle,
  buildCeilingProjectSnapshot,
  calculateCeilingSketchMetrics,
  createDefaultCeilingSketch,
  resizeCeilingSketch,
  setCeilingWallLength,
} from './ceilingSketch';

describe('ceilingSketch', () => {
  it('считает базовую геометрию контура в метрах и квадратных метрах', () => {
    const sketch = createDefaultCeilingSketch(4000, 3000);

    expect(calculateCeilingSketchMetrics(sketch)).toMatchObject({
      areaM2: 12,
      perimeterM: 14,
      corners: 4,
      lightPoints: 0,
      pipes: 0,
    });
  });

  it('обновляет метрики для профессиональных объектов потолка', () => {
    let sketch = createDefaultCeilingSketch(5000, 4000);
    sketch = addFixture(sketch, 'spot');
    sketch = addFixture(sketch, 'chandelier');
    sketch = addObstacle(sketch, 'pipe');
    sketch = addLinearFeature(sketch, 'light_line');
    sketch = addLinearFeature(sketch, 'curtain_track');
    sketch = addCeilingLevel(sketch);
    sketch = addFabricSeam(sketch);

    const metrics = calculateCeilingSketchMetrics(sketch);

    expect(metrics.lightPoints).toBe(2);
    expect(metrics.pipes).toBe(1);
    expect(metrics.lightLinesM).toBeGreaterThan(0);
    expect(metrics.curtainTracksM).toBeGreaterThan(0);
    expect(metrics.levels).toBe(1);
    expect(metrics.seamsM).toBe(4);
  });

  it('меняет размер и длину стены без участия UI', () => {
    let sketch = resizeCeilingSketch(createDefaultCeilingSketch(), 6000, 2500);
    sketch = setCeilingWallLength(sketch, 0, 5500);
    sketch = addCeilingCorner(sketch);

    const metrics = calculateCeilingSketchMetrics(sketch);

    expect(metrics.perimeterM).toBeGreaterThan(15);
    expect(metrics.corners).toBe(5);
  });

  it('собирает JSON проекта для snapshot сметы', () => {
    const sketch = createDefaultCeilingSketch(3000, 3000);
    const snapshot = buildCeilingProjectSnapshot([{
      id: 'room-1',
      name: 'Кухня',
      ceilingSketch: sketch,
    }]);

    expect(snapshot).toMatchObject({
      version: 1,
      source: 'ceiling_sketcher',
      rooms: [{
        room_id: 'room-1',
        room_name: 'Кухня',
        metrics: {
          areaM2: 9,
          perimeterM: 12,
        },
      }],
    });
  });
});
