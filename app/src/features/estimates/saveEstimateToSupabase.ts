import { restInsert } from '../../supabaseRest';
import type { CartRow, CompanySettings, EstimateSaveDraft } from '../../types';
import {
  buildEstimatePersistenceRows,
  buildEstimateRecordPayloads,
  calculateEstimate,
} from './calculationEngine';

interface SaveEstimateParams {
  userId: string;
  cartRows: CartRow[];
  settings: CompanySettings;
  draft: EstimateSaveDraft;
}

interface SaveEstimateResult {
  notice: string;
  shouldClearCart: boolean;
}

function isSchemaCacheError(error: unknown): boolean {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: string }).message || '')
    : String(error || '');

  return message.includes('schema cache')
    || message.includes('Could not find')
    || message.includes('does not exist');
}

export async function saveEstimateToSupabase({
  userId,
  cartRows,
  settings,
  draft,
}: SaveEstimateParams): Promise<SaveEstimateResult> {
  // Calculation Engine собирает итоговую смету без участия UI.
  // Компонент только передаёт ввод пользователя.
  const calculatedEstimate = calculateEstimate({
    draft,
    settings,
    cartRows,
  });

  if (calculatedEstimate.summary.itemsCount === 0) {
    throw new Error('Смета пустая. Добавьте позиции вручную или включите умные правила расчёта.');
  }

  const { baseEstimatePayload, extendedEstimatePayload } = buildEstimateRecordPayloads(userId, calculatedEstimate);

  let degradedMode = false;
  let roomsWarning = '';
  let estimateRows: Array<{ id: string }> = [];

  try {
    estimateRows = await restInsert<{ id: string }>('smety', extendedEstimatePayload, { select: 'id' });
  } catch (error) {
    if (!isSchemaCacheError(error)) {
      throw new Error(`${error instanceof Error ? error.message : String(error)} Проверь, что выполнен supabase_estimates_rooms.sql.`);
    }

    degradedMode = true;
    estimateRows = await restInsert<{ id: string }>('smety', baseEstimatePayload, { select: 'id' });
  }

  if (!estimateRows[0]?.id) {
    throw new Error('Supabase не вернул ID сметы. Проверь, что выполнен supabase_estimates_rooms.sql.');
  }

  const estimateId = estimateRows[0].id;
  const { roomRows, basePositionRows, extendedPositionRows } = buildEstimatePersistenceRows(estimateId, calculatedEstimate);

  if (!degradedMode) {
    try {
      await restInsert('smeta_komnaty', roomRows, { returning: 'minimal' });
    } catch (roomsError) {
      if (!isSchemaCacheError(roomsError)) {
        throw new Error(`${roomsError instanceof Error ? roomsError.message : String(roomsError)} Проверь, что выполнен supabase_estimates_rooms.sql.`);
      }

      degradedMode = true;
      roomsWarning = 'Комнаты не сохранились, потому что Supabase ещё не видит таблицу smeta_komnaty.';
    }
  }

  try {
    await restInsert('smeta_pozicii', degradedMode ? basePositionRows : extendedPositionRows, { returning: 'minimal' });
  } catch (positionsError) {
    if (degradedMode || !isSchemaCacheError(positionsError)) {
      throw new Error(`${positionsError instanceof Error ? positionsError.message : String(positionsError)} Проверь, что выполнен supabase_estimates_rooms.sql.`);
    }

    degradedMode = true;
    await restInsert('smeta_pozicii', basePositionRows, { returning: 'minimal' });
  }

  return {
    shouldClearCart: !degradedMode,
    notice: degradedMode
      ? `Смета сохранена в базовом режиме. ${roomsWarning} Выполни supabase_estimates_rooms.sql, чтобы сохранялись комнаты и составы узлов.`
      : 'Смета сохранена. Она появилась в разделе "Сметы".',
  };
}
