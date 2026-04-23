import { restDelete } from '../../supabaseRest';

export async function deleteEstimateDocument(estimateId: string) {
  await restDelete('smety', {
    filters: { id: estimateId },
    returning: 'minimal',
  });
}
