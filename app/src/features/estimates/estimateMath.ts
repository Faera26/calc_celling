// Исторический файл оставлен как тонкая совместимость.
// Основная доменная логика расчёта теперь живёт в calculationEngine.ts.
export {
  buildEstimatePersistenceRows,
  buildEstimateRecordPayloads,
  calculateEstimate,
  createSavedEstimatePosition,
  buildEstimatePdfItemsFromCartRows,
  buildEstimatePdfItemsFromSavedPositions,
  buildSavedEstimatePositionPayloads,
  buildSavedEstimateRoomPayloads,
  normalizeSavedEstimatePositions,
  summarizeSavedEstimatePositions,
  toNumber,
} from './calculationEngine';
