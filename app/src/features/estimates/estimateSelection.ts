interface EstimateIdentity {
  id: string;
}

export function resolveEstimateSelectionId<T extends EstimateIdentity>(
  estimates: ReadonlyArray<T>,
  preferredEstimateId?: string | null
) {
  if (preferredEstimateId && estimates.some((estimate) => estimate.id === preferredEstimateId)) {
    return preferredEstimateId;
  }

  return estimates[0]?.id || '';
}

export function getNextEstimateSelectionId<T extends EstimateIdentity>(
  estimates: ReadonlyArray<T>,
  removedEstimateId: string
) {
  const removedIndex = estimates.findIndex((estimate) => estimate.id === removedEstimateId);

  if (removedIndex === -1) {
    return resolveEstimateSelectionId(estimates);
  }

  const nextEstimate = estimates[removedIndex + 1] || estimates[removedIndex - 1];
  return nextEstimate?.id || '';
}
