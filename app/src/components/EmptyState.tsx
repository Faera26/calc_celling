import { Alert, Button, Stack, Typography } from '@mui/material';
import type { CatalogType } from '../types';
import { titleOf } from '../utils';

interface EmptyStateProps {
  activeType: CatalogType;
  activeCategory: string;
  activeSubcategory: string;
  debouncedSearch: string;
  filterIsActive: boolean;
  onResetFilters: () => void;
  onRefresh: () => void;
}

export default function EmptyState({
  activeType,
  activeCategory,
  activeSubcategory,
  debouncedSearch,
  filterIsActive,
  onResetFilters,
  onRefresh,
}: EmptyStateProps) {
  return (
    <Alert severity="info" sx={{ mt: 2 }}>
      <Stack spacing={1}>
        <Typography>
          {filterIsActive
            ? 'По этому фильтру ничего не найдено.'
            : 'Supabase вернул пустой список для текущего раздела. Если счётчики сверху не нулевые, обнови каталог кнопкой ниже.'}
        </Typography>
        <Typography variant="body2">
          Тип: {titleOf(activeType)} • категория: {activeCategory} • подкатегория: {activeSubcategory} • поиск: {debouncedSearch || 'пусто'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" variant="outlined" onClick={onResetFilters}>
            Сбросить фильтр
          </Button>
          <Button size="small" variant="contained" onClick={onRefresh}>
            Обновить из Supabase
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
