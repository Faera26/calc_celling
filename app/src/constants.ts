import type { CatalogCounts, CompanySettings, ItemForm, ComponentDraft } from './types';

export const PAGE_SIZE = 24;
export const ALL_OPTION = 'Все';
export const SETTINGS_KEY = 'smartceiling.settings.v2';

export const EMPTY_COUNTS: CatalogCounts = {
  tovar: 0,
  usluga: 0,
  uzel: 0,
  komplektaciya: 0,
};

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'SmartCeiling',
  managerName: '',
  phone: '',
  email: '',
  avatarDataUrl: '',
  marginPercent: 0,
  discountPercent: 0,
  defaultPdfTemplate: 'wave',
  defaultPdfAccentColor: '#D4146A',
  pdfNote: 'Смета носит предварительный характер. Финальная стоимость уточняется после замера.',
};

export const EMPTY_ITEM_FORM: ItemForm = {
  id: '',
  name: '',
  category: '',
  subcategory: '',
  price: '0',
  unit: '',
  image: '',
  description: '',
};

export const EMPTY_COMPONENT_DRAFT: ComponentDraft = {
  itemType: 'tovar',
  itemId: '',
  qty: '1',
};

export const PLACEHOLDER_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" fill="none">'
  + '<rect width="240" height="160" rx="8" fill="%23F1F5F9"/>'
  + '<text x="120" y="76" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="600" fill="%230F766E">SmartCeiling</text>'
  + '<text x="120" y="96" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" fill="%2394A3B8">Нет изображения</text>'
  + '</svg>'
)}`;
