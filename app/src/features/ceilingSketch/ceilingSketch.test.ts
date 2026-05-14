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
  updateCeilingLevelPoint,
  updateFabricSeamPoint,
  updateFixture,
  updateFixtureDetails,
  updateLinearFeatureDetails,
  updateObstacle,
  updateObstacleDetails,
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

  it('редактирует монтажные объекты и разделители точными координатами', () => {
    let sketch = createDefaultCeilingSketch(5000, 4000);
    sketch = addFixture(sketch, 'spot');
    sketch = addObstacle(sketch, 'pipe');
    sketch = addLinearFeature(sketch, 'light_line');
    sketch = addCeilingLevel(sketch);
    sketch = addFabricSeam(sketch);

    const fixtureId = sketch.fixtures[0].id;
    const obstacleId = sketch.obstacles[0].id;
    const featureId = sketch.linearFeatures[0].id;
    const level = sketch.levels[0];
    const seamId = sketch.fabric.seams[0].id;

    sketch = updateFixture(sketch, fixtureId, { xMm: 1200, yMm: 900 });
    sketch = updateFixtureDetails(sketch, fixtureId, { diameterMm: 95 });
    sketch = updateObstacle(sketch, obstacleId, { xMm: 4300, yMm: 350 });
    sketch = updateObstacleDetails(sketch, obstacleId, { diameterMm: 130, clearanceMm: 45 });
    sketch = updateLinearFeatureDetails(sketch, featureId, { widthMm: 75 });
    sketch = updateCeilingLevelPoint(sketch, level.id, level.points[0].id, { xMm: 700, yMm: 650 });
    sketch = updateFabricSeamPoint(sketch, seamId, 'start', { xMm: 1800, yMm: 0 });

    expect(sketch.fixtures[0]).toMatchObject({ point: { xMm: 1200, yMm: 900 }, diameterMm: 95 });
    expect(sketch.obstacles[0]).toMatchObject({ point: { xMm: 4300, yMm: 350 }, diameterMm: 130, clearanceMm: 45 });
    expect(sketch.linearFeatures[0].widthMm).toBe(75);
    expect(sketch.levels[0].points[0]).toMatchObject({ xMm: 700, yMm: 650 });
    expect(sketch.fabric.seams[0].start).toMatchObject({ xMm: 1800, yMm: 0 });
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
