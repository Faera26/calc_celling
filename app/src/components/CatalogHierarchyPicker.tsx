import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import type { CategoryGroup } from '../types';
import { ALL_OPTION } from '../constants';

interface CatalogHierarchyPickerProps {
  title: string;
  categories: CategoryGroup[];
  categoriesLoaded: boolean;
  categoriesLoading: boolean;
  subcategories: Array<{ name: string; count: number }>;
  subcategoriesLoading: boolean;
  activeCategory: string;
  activeSubcategory: string;
  onOpenCategories: () => void;
  onOpenSubcategories: () => void;
  onSelectCategory: (category: string) => void;
  onSelectSubcategory: (subcategory: string) => void;
}

function summaryLabel(value: string, fallback: string) {
  return value === ALL_OPTION ? fallback : value;
}

export default function CatalogHierarchyPicker({
  title,
  categories,
  categoriesLoaded,
  categoriesLoading,
  subcategories,
  subcategoriesLoading,
  activeCategory,
  activeSubcategory,
  onOpenCategories,
  onOpenSubcategories,
  onSelectCategory,
  onSelectSubcategory,
}: CatalogHierarchyPickerProps) {
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [subcategoriesExpanded, setSubcategoriesExpanded] = useState(false);

  function handleCategoryExpand(expanded: boolean) {
    setCategoriesExpanded(expanded);
    if (expanded) {
      onOpenCategories();
    }
  }

  function handleSubcategoryExpand(expanded: boolean) {
    setSubcategoriesExpanded(expanded);
    if (expanded && activeCategory !== ALL_OPTION) {
      onOpenSubcategories();
    }
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Сначала выбираем раздел, затем подкатегорию. Список позиций подгружается только после этого шага.
      </Typography>

      <Stack spacing={2}>
        <Accordion
          expanded={categoriesExpanded}
          onChange={(_, expanded) => handleCategoryExpand(expanded)}
          disableGutters
          sx={{ borderRadius: '20px', overflow: 'hidden', '&::before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', fontWeight: 700 }}>
                Шаг 1
              </Typography>
              <Typography sx={{ fontWeight: 800 }}>
                Категория: {summaryLabel(activeCategory, 'нажми, чтобы открыть список')}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {categoriesLoading && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 2, px: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="body2">Загружаю категории...</Typography>
              </Stack>
            )}

            {!categoriesLoading && categoriesLoaded && categories.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, px: 1 }}>
                В этом каталоге пока нет категорий.
              </Typography>
            )}

            {!categoriesLoading && categories.length > 0 && (
              <List disablePadding>
                {categories.map((group) => (
                  <ListItemButton
                    key={group.category}
                    selected={activeCategory === group.category}
                    onClick={() => {
                      onSelectCategory(group.category);
                      setCategoriesExpanded(false);
                      setSubcategoriesExpanded(true);
                    }}
                    sx={{
                      borderRadius: '14px',
                      mb: 0.5,
                      alignItems: 'center',
                    }}
                  >
                    <ListItemText
                      primary={<Typography sx={{ fontWeight: 700 }}>{group.category}</Typography>}
                      secondary={`Категория каталога • ${group.total.toLocaleString('ru-RU')} поз.`}
                    />
                    <ChevronRightIcon color="action" />
                  </ListItemButton>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion
          expanded={subcategoriesExpanded}
          onChange={(_, expanded) => handleSubcategoryExpand(expanded)}
          disableGutters
          disabled={activeCategory === ALL_OPTION}
          sx={{ borderRadius: '20px', overflow: 'hidden', '&::before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', fontWeight: 700 }}>
                Шаг 2
              </Typography>
              <Typography sx={{ fontWeight: 800 }}>
                Подкатегория: {summaryLabel(activeSubcategory, activeCategory === ALL_OPTION ? 'сначала выбери категорию' : 'нажми, чтобы открыть список')}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {subcategoriesLoading && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 2, px: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="body2">Загружаю подкатегории...</Typography>
              </Stack>
            )}

            {!subcategoriesLoading && activeCategory !== ALL_OPTION && subcategories.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, px: 1 }}>
                Для выбранной категории не найдено подкатегорий.
              </Typography>
            )}

            {!subcategoriesLoading && subcategories.length > 0 && (
              <List disablePadding>
                {subcategories.map((subcategory) => (
                  <ListItemButton
                    key={subcategory.name}
                    selected={activeSubcategory === subcategory.name}
                    onClick={() => {
                      onSelectSubcategory(subcategory.name);
                      setSubcategoriesExpanded(false);
                    }}
                    sx={{ borderRadius: '14px', mb: 0.5 }}
                  >
                    <ListItemText
                      primary={<Typography sx={{ fontWeight: 700 }}>{subcategory.name}</Typography>}
                      secondary={`Подкатегория • ${subcategory.count.toLocaleString('ru-RU')} поз.`}
                    />
                    <ChevronRightIcon color="action" />
                  </ListItemButton>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Box>
  );
}
