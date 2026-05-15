export type CatalogType = 'tovar' | 'usluga' | 'uzel';
export type ComponentType = 'tovar' | 'usluga';
export type EstimateDocumentType = 'preliminary' | 'final';
export type EstimatePdfTemplate = 'classic' | 'wave' | 'stripe' | 'dark';
export type EstimateCalculationMetric =
  | 'area'
  | 'perimeter'
  | 'corners'
  | 'light_points'
  | 'light_lines'
  | 'pipes'
  | 'curtain_tracks'
  | 'niches'
  | 'levels'
  | 'seams'
  | 'fixed';

export type CeilingFixtureKind = 'spot' | 'chandelier' | 'vent' | 'sensor';
export type CeilingObstacleKind = 'pipe' | 'riser' | 'column' | 'hood';
export type CeilingLinearFeatureKind = 'light_line' | 'curtain_track' | 'niche' | 'profile' | 'level_edge';
export type CeilingFabricTexture = 'matte' | 'satin' | 'gloss' | 'fabric';
export type CeilingBuilderMode = 'shape' | 'dimensions' | 'diagonals' | 'objects' | 'fabric' | 'summary';
export type CeilingShapeTemplate = 'rectangle' | 'l_shape' | 'u_shape' | 'polygon' | 'free';
export type CeilingBuilderAngleType = 'inner' | 'outer' | 'straight';
export type CeilingBuilderObjectType =
  | 'pipe'
  | 'chandelier'
  | 'spotlight'
  | 'spotlight_group'
  | 'vent'
  | 'cornice'
  | 'niche'
  | 'column'
  | 'bypass'
  | 'sensor'
  | 'custom';
export type CeilingBuilderMaterial = '' | 'pvc' | 'fabric' | 'other';
export type CeilingBuilderTexture = '' | 'matte' | 'satin' | 'gloss' | 'fabric' | 'translucent' | 'photo' | 'other';
export type CeilingBuilderOrientationMode = 'auto' | 'longest_wall' | 'wall' | 'manual';
export type CeilingBuilderSeamMode = 'auto' | 'none' | 'manual';
export type CeilingBuilderHarpoonType = '' | 'standard' | 'slim' | 'other';

export interface CeilingSketchPointRef {
  xMm: number;
  yMm: number;
}

export interface CeilingSketchPoint extends CeilingSketchPointRef {
  id: string;
}

export interface CeilingSketchFixture {
  id: string;
  kind: CeilingFixtureKind;
  point: CeilingSketchPointRef;
  diameterMm: number;
}

export interface CeilingSketchObstacle {
  id: string;
  kind: CeilingObstacleKind;
  point: CeilingSketchPointRef;
  diameterMm: number;
  widthMm?: number;
  depthMm?: number;
  clearanceMm: number;
}

export interface CeilingSketchLinearFeature {
  id: string;
  kind: CeilingLinearFeatureKind;
  start: CeilingSketchPointRef;
  end: CeilingSketchPointRef;
  widthMm: number;
}

export interface CeilingSketchLevel {
  id: string;
  name: string;
  elevationMm: number;
  insetMm: number;
  points: CeilingSketchPoint[];
}

export interface CeilingFabricSeam {
  id: string;
  start: CeilingSketchPointRef;
  end: CeilingSketchPointRef;
}

export interface CeilingFabricPlan {
  texture: CeilingFabricTexture;
  rollWidthMm: number;
  directionDeg: number;
  seams: CeilingFabricSeam[];
}

export interface CeilingSketch {
  version: 1;
  points: CeilingSketchPoint[];
  levels: CeilingSketchLevel[];
  fixtures: CeilingSketchFixture[];
  obstacles: CeilingSketchObstacle[];
  linearFeatures: CeilingSketchLinearFeature[];
  fabric: CeilingFabricPlan;
  builderState?: CeilingShapeBuilderState | null;
  updatedAt?: string;
}

export interface CeilingSketchMetrics {
  areaM2: number;
  perimeterM: number;
  corners: number;
  lightPoints: number;
  lightLinesM: number;
  pipes: number;
  curtainTracksM: number;
  nichesM: number;
  levels: number;
  seamsM: number;
}

export interface CeilingBuilderPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  locked: boolean;
}

export interface CeilingBuilderWall {
  id: string;
  fromPointId: string;
  toPointId: string;
  label: string;
  lengthMm: number | null;
  isMeasured: boolean;
  comment: string;
}

export interface CeilingBuilderDiagonal {
  id: string;
  fromPointId: string;
  toPointId: string;
  label: string;
  lengthMm: number | null;
  comment: string;
}

export interface CeilingBuilderAngle {
  id: string;
  pointId: string;
  degrees: number;
  type: CeilingBuilderAngleType;
  isManual: boolean;
}

export interface CeilingBuilderObject {
  id: string;
  type: CeilingBuilderObjectType;
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  diameterMm?: number;
  widthMm?: number;
  heightMm?: number;
  lengthMm?: number;
  quantity: number;
  linkedWallId?: string;
  linkedPointId?: string;
  offsetFromWall1Mm?: number;
  offsetFromWall2Mm?: number;
  comment: string;
  meta?: {
    mountingType?: string;
    platformDiameterMm?: number;
    spotlightType?: string;
    thermalRing?: boolean;
    corniceType?: string;
    nicheType?: string;
    customLabel?: string;
  };
}

export interface CeilingBuilderFabricSettings {
  material: CeilingBuilderMaterial;
  texture: CeilingBuilderTexture;
  color: string;
  manufacturer: string;
  rollWidthMm: number | null;
  orientationMode: CeilingBuilderOrientationMode;
  orientationWallId: string | null;
  orientationAngle: number | null;
  seamMode: CeilingBuilderSeamMode;
  allowanceMm: number;
  shrinkPercent: number;
  harpoonEnabled: boolean;
  harpoonType: CeilingBuilderHarpoonType;
  productionComment: string;
}

export interface CeilingBuilderSeam {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  offsetMm: number;
  angle: number;
  isManual: boolean;
  comment: string;
}

export interface CeilingBuilderViewState {
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  showLabels: boolean;
  selectedElementId: string | null;
  selectedElementType: 'point' | 'wall' | 'diagonal' | 'object' | 'seam' | null;
  activeMode: CeilingBuilderMode;
}

export interface CeilingBuilderValidationIssue {
  id: string;
  severity: 'critical' | 'warning';
  message: string;
  relatedElementType?: CeilingBuilderViewState['selectedElementType'];
  relatedElementId?: string;
  actionMode?: CeilingBuilderMode;
}

export interface CeilingShapeBuilderState {
  id: string;
  roomId: string | null;
  calculationId: string | null;
  template: CeilingShapeTemplate;
  isClosed: boolean;
  points: CeilingBuilderPoint[];
  walls: CeilingBuilderWall[];
  diagonals: CeilingBuilderDiagonal[];
  angles: CeilingBuilderAngle[];
  objects: CeilingBuilderObject[];
  fabricSettings: CeilingBuilderFabricSettings;
  seams: CeilingBuilderSeam[];
  viewState: CeilingBuilderViewState;
  validationIssues: CeilingBuilderValidationIssue[];
  notes: {
    productionComment: string;
    installerComment: string;
    measurementComment: string;
  };
  updatedAt: string;
}

export interface CalculationTransferPayload {
  areaM2: number;
  perimeterM: number;
  cornerCount: number;
  wallCount: number;
  innerCornerCount: number;
  outerCornerCount: number;
  walls: CeilingBuilderWall[];
  diagonals: CeilingBuilderDiagonal[];
  hasNonStandardAngles: boolean;
  pipeCount: number;
  chandelierCount: number;
  spotlightCount: number;
  corniceLengthM: number;
  fabricSettings: CeilingBuilderFabricSettings;
  objects: CeilingBuilderObject[];
  notes: {
    productionComment: string;
    installerComment: string;
    measurementComment: string;
  };
}

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
  ceilingSketch?: CeilingSketch;
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
  ceiling_project?: {
    version: 1;
    source: 'ceiling_sketcher';
    rooms: Array<{
      room_id: string;
      room_name: string;
      sketch: CeilingSketch;
      metrics: CeilingSketchMetrics;
    }>;
    updated_at: string;
  } | null;
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
  ceilingSketch?: CeilingSketch | null;
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
