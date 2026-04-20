import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { CategoryGroup } from '../types';
import { ALL_OPTION } from '../constants';

interface CategoryNavProps {
  categories: CategoryGroup[];
  categoriesLoading: boolean;
  activeCategory: string;
  activeSubcategory: string;
  onFilterChange: (category: string, subcategory: string) => void;
}

export default function CategoryNav({
  categories,
  categoriesLoading,
  activeCategory,
  activeSubcategory,
  onFilterChange,
}: CategoryNavProps) {
  const activeGroup = categories.find(group => group.category === activeCategory);
  const subcategories = activeGroup?.subcategories || [];

  return (
    <Box sx={{ width: '100%', mb: 4, display: 'flex', justifyContent: 'center' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{
          width: '100%',
          maxWidth: 920,
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'center',
        }}
      >
        <FormControl fullWidth>
          <InputLabel id="category-select-label">Категория</InputLabel>
          <Select
            labelId="category-select-label"
            value={activeCategory}
            label="Категория"
            onChange={(event) => onFilterChange(event.target.value, ALL_OPTION)}
            disabled={categoriesLoading}
            sx={{ bgcolor: 'background.paper' }}
          >
            <MenuItem value={ALL_OPTION}>
              <Typography sx={{ fontWeight: 700 }}>Все категории</Typography>
            </MenuItem>
            {categories.map(group => (
              <MenuItem key={group.category} value={group.category}>
                {group.total > 0 ? `${group.category} • ${group.total}` : group.category}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth disabled={activeCategory === ALL_OPTION || categoriesLoading}>
          <InputLabel id="subcategory-select-label">Подкатегория</InputLabel>
          <Select
            labelId="subcategory-select-label"
            value={activeCategory === ALL_OPTION ? ALL_OPTION : activeSubcategory}
            label="Подкатегория"
            onChange={(event) => onFilterChange(activeCategory, event.target.value)}
            sx={{ bgcolor: 'background.paper' }}
          >
            <MenuItem value={ALL_OPTION}>
              <Typography sx={{ fontWeight: 700 }}>
                {activeCategory === ALL_OPTION ? 'Сначала выбери категорию' : `Вся категория (${activeGroup?.total || 0})`}
              </Typography>
            </MenuItem>
            {subcategories.map(subcategory => (
              <MenuItem key={subcategory.name} value={subcategory.name}>
                {subcategory.count > 0 ? `${subcategory.name} • ${subcategory.count}` : subcategory.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {categoriesLoading && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', minWidth: 150 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Категории</Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
