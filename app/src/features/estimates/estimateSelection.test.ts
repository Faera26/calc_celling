import { describe, expect, it } from 'vitest';
import {
  getNextEstimateSelectionId,
  resolveEstimateSelectionId,
} from './estimateSelection';

const estimates = [
  { id: 'estimate-1' },
  { id: 'estimate-2' },
  { id: 'estimate-3' },
];

describe('estimateSelection', () => {
  it('keeps the preferred selection when it still exists', () => {
    expect(resolveEstimateSelectionId(estimates, 'estimate-2')).toBe('estimate-2');
  });

  it('falls back to the first estimate when the preferred one is missing', () => {
    expect(resolveEstimateSelectionId(estimates, 'missing')).toBe('estimate-1');
  });

  it('selects the next estimate after deleting the current one', () => {
    expect(getNextEstimateSelectionId(estimates, 'estimate-2')).toBe('estimate-3');
  });

  it('falls back to the previous estimate when the last one is removed', () => {
    expect(getNextEstimateSelectionId(estimates, 'estimate-3')).toBe('estimate-2');
  });

  it('returns an empty selection when the list becomes empty', () => {
    expect(getNextEstimateSelectionId([{ id: 'estimate-1' }], 'estimate-1')).toBe('');
  });
});
