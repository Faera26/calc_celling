export type CatalogType = 'tovar' | 'usluga' | 'uzel';
export type ComponentType = 'tovar' | 'usluga';
export type EstimateDocumentType = 'preliminary' | 'final';
export type EstimatePdfTemplate = 'classic' | 'wave' | 'stripe' | 'dark';
export type EstimateCalculationMetric =
  | 'area'
  | 'perimeter'
  | 'corners'
  | 'light_points'
  | 'pipes'
  | 'curtain_tracks'
  | 'niches'
  | 'fixed';

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  unit: string;
  image?: string | null;
  description?: string | null;
  source?: string;
}

export interface UzelItem extends CatalogItem {
  stats?: Record<string, unknown> | null;
}

export interface UzelComponent {
  id: string;
  uzel_id: string;
  position_index: number;
  item_type: ComponentType;
  item_id: string;
  item_name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
  category?: string | null;
  subcategory?: string | null;
  image?: string | null;
  comment?: string | null;
}

export interface CompanySettings {
  companyName: string;
  managerName: string;
  phone: string;
  email: string;
  avatarDataUrl: string;
  marginPercent: number;
  discountPercent: number;
  defaultPdfTemplate: EstimatePdfTemplate;
  defaultPdfAccentColor: string;
  pdfNote: string;
}

export interface ItemForm {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: string;
  unit: string;
  image: string;
  description: string;
}

export interface UserProfile {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role: 'admin' | 'manager' | 'viewer';
}

export interface ConstructorState {
  node: UzelItem;
  rows: UzelComponent[];
}

export interface ComponentDraft {
  itemType: ComponentType;
  itemId: string;
  qty: string;
}

export interface CategoryRow {
  category: string;
  subcategory: string;
  items_count?: number | null;
}

export interface CategoryGroup {
  category: string;
  total: number;
  subcategories: Array<{
    name: string;
    count: number;
  }>;
}

export interface CatalogCounts {
  tovar: number;
  usluga: number;
  uzel: number;
  komplektaciya: number;
}

export interface CartEntry {
  type: CatalogType;
  item: CatalogItem;
  qty: number;
  components?: UzelComponent[];
}

export interface CartRow {
  cartKey: string;
  type: CatalogType;
  item: CatalogItem;
  qty: number;
  price: number;
  total: number;
  components?: UzelComponent[];
}

export interface AuthState {
  ready: boolean;
  profileReady: boolean;
  userId: string;
  userEmail: string;
  profile: UserProfile | null;
  isAdmin: boolean;
  isApproved: boolean;
}

export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'archived';

export interface EstimateRoomDraft {
  id: string;
  name: string;
  area: string;
  perimeter: string;
  corners: string;
  lightPoints: string;
  pipes: string;
  curtainTracks: string;
  niches: string;
  comment: string;
}

export interface EstimateSaveDraft {
  title: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  objectAddress: string;
  clientComment: string;
  status: EstimateStatus;
  documentType?: EstimateDocumentType;
  pdfTemplate?: EstimatePdfTemplate;
  pdfAccentColor?: string;
  rooms: EstimateRoomDraft[];
  calculationRules?: EstimateCalculationRule[];
}

export interface EstimateCalculationRule {
  id: string;
  enabled: boolean;
  label: string;
  metric: EstimateCalculationMetric;
  item_type: CatalogType;
  search: string;
  item_id: string;
  item_name: string;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  base_price?: number | null;
  image?: string | null;
  description?: string | null;
  multiplier: number;
  round_to: number;
}

export interface EstimateSettingsSnapshot {
  calculation_rules?: EstimateCalculationRule[];
  [key: string]: unknown;
}

export interface EstimateComponentSnapshot {
  item_type: ComponentType;
  item_id: string;
  item_name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
  base_price?: number | null;
  category?: string | null;
  subcategory?: string | null;
  image?: string | null;
  comment?: string | null;
}

export interface EstimateSourceSnapshot {
  image?: string | null;
  description?: string | null;
  source?: string | null;
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  base_price?: number | null;
  rule_id?: string | null;
  rule_label?: string | null;
  metric?: EstimateCalculationMetric | null;
  auto_generated?: boolean | null;
}

export interface EstimateItemSnapshot {
  item_type: CatalogType;
  item_id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  image?: string | null;
  description?: string | null;
  source?: string | null;
  base_price?: number | null;
  saved_price?: number | null;
  saved_at?: string | null;
  stats?: Record<string, unknown> | null;
}

export interface SavedEstimate {
  id: string;
  user_id: string;
  title?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  object_address?: string | null;
  client_comment?: string | null;
  margin_percent: number;
  discount_percent: number;
  subtotal: number;
  total: number;
  status: EstimateStatus;
  document_type?: EstimateDocumentType | null;
  pdf_template?: EstimatePdfTemplate | null;
  pdf_accent_color?: string | null;
  use_common_section?: boolean | null;
  room_count?: number | null;
  items_count?: number | null;
  components_count?: number | null;
  settings_snapshot?: EstimateSettingsSnapshot | null;
  created_at: string;
  updated_at?: string | null;
}

export interface SavedEstimateRoom {
  id: string;
  smeta_id: string;
  position_index: number;
  name: string;
  area: number;
  perimeter: number;
  corners: number;
  light_points: number;
  pipes: number;
  curtain_tracks: number;
  niches: number;
  comment?: string | null;
}

export interface SavedEstimatePosition {
  id: string;
  smeta_id: string;
  position_index: number;
  room_id?: string | null;
  item_type: CatalogType;
  item_id: string;
  item_name: string;
  qty: number;
  unit: string;
  base_price?: number | null;
  price: number;
  total: number;
  category?: string | null;
  subcategory?: string | null;
  item_snapshot?: EstimateItemSnapshot | null;
  source_snapshot?: EstimateSourceSnapshot | null;
  components_snapshot?: EstimateComponentSnapshot[] | null;
}
