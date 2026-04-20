import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { EstimateDocumentType, EstimatePdfTemplate } from './types';

Font.register({
  family: 'NotoSans',
  fonts: [
    {
      src: 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
      fontWeight: 700,
    },
  ],
});

Font.registerHyphenationCallback(word => {
  if (word.length <= 18) return [word];
  return word.match(/.{1,14}/g) || [word];
});

export interface EstimateItem {
  name: string;
  type: string;
  section?: string;
  qty: number;
  price: number;
  unit: string;
  image?: string | null;
  description?: string | null;
  components?: Array<{
    type: string;
    name: string;
    qty: number;
    unit: string;
    price: number;
  }>;
}

interface PdfOptions {
  title?: string;
  documentType?: EstimateDocumentType;
  template?: EstimatePdfTemplate;
  accentColor?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  objectAddress?: string;
  clientComment?: string;
  total: number;
  companyName: string;
  managerName: string;
  phone: string;
  email: string;
  note: string;
  marginPercent?: number;
  discountPercent?: number;
}

interface Theme {
  template: EstimatePdfTemplate;
  accent: string;
  accentSoft: string;
  accentPale: string;
  pageBg: string;
  text: string;
  muted: string;
  line: string;
  panel: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  rowAlt: string;
  inverseBg: string;
  inverseText: string;
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const clean = /^#[0-9A-F]{6}$/i.test(hex) ? hex.slice(1) : 'D4146A';
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map(value => clamp(value).toString(16).padStart(2, '0')).join('')}`;
}

function mix(hex: string, target: string, amount: number) {
  const from = hexToRgb(hex);
  const to = hexToRgb(target);
  return rgbToHex(
    from.r + (to.r - from.r) * amount,
    from.g + (to.g - from.g) * amount,
    from.b + (to.b - from.b) * amount
  );
}

function isDarkColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 120;
}

function buildTheme(template: EstimatePdfTemplate = 'wave', accentColor = '#D4146A'): Theme {
  const accent = /^#[0-9A-F]{6}$/i.test(accentColor) ? accentColor : '#D4146A';
  const dark = template === 'dark';
  const inverseBg = dark ? mix(accent, '#000000', 0.6) : (isDarkColor(accent) ? accent : mix(accent, '#000000', 0.28));

  return {
    template,
    accent,
    accentSoft: mix(accent, '#FFFFFF', 0.78),
    accentPale: mix(accent, '#FFFFFF', 0.91),
    pageBg: dark ? mix(accent, '#000000', 0.68) : '#FFFFFF',
    text: dark ? '#FFFFFF' : '#252525',
    muted: dark ? '#D6D6D6' : '#6F6F6F',
    line: dark ? mix(accent, '#FFFFFF', 0.24) : '#D8D8D8',
    panel: dark ? mix(accent, '#000000', 0.47) : '#F4F4F4',
    tableHeaderBg: dark ? mix(accent, '#FFFFFF', 0.18) : (template === 'classic' ? '#2F2F2F' : accent),
    tableHeaderText: '#FFFFFF',
    rowAlt: dark ? mix(accent, '#FFFFFF', 0.1) : mix(accent, '#FFFFFF', 0.9),
    inverseBg,
    inverseText: '#FFFFFF',
  };
}

function createStyles(theme: Theme) {
  const dark = theme.template === 'dark';

  return StyleSheet.create({
    page: {
      padding: dark ? 30 : 38,
      fontFamily: 'NotoSans',
      fontSize: 9.4,
      color: theme.text,
      backgroundColor: theme.pageBg,
    },
    accentTop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: theme.template === 'stripe' ? 16 : 0,
      backgroundColor: theme.accent,
    },
    accentBottom: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 290,
      height: theme.template === 'stripe' ? 16 : 0,
      backgroundColor: theme.accent,
    },
    headerWave: {
      margin: -38,
      marginBottom: 30,
      padding: 26,
      paddingBottom: 34,
      backgroundColor: theme.template === 'wave' ? theme.accent : 'transparent',
      color: theme.template === 'wave' ? '#FFFFFF' : theme.text,
    },
    top: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 30,
    },
    title: {
      fontSize: 20,
      letterSpacing: 2.4,
      fontWeight: 700,
      textTransform: 'uppercase',
    },
    badge: {
      marginTop: 9,
      paddingVertical: 4,
      paddingHorizontal: 8,
      alignSelf: 'flex-start',
      backgroundColor: theme.template === 'wave' ? mix(theme.accent, '#FFFFFF', 0.2) : theme.panel,
      color: theme.template === 'wave' ? '#FFFFFF' : theme.text,
      fontSize: 8.3,
      fontWeight: 700,
    },
    logo: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.template === 'wave' ? '#FFFFFF' : theme.inverseBg,
      color: theme.template === 'wave' ? theme.accent : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      fontWeight: 700,
    },
    meta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    companyBox: {
      flexDirection: 'row',
      gap: 12,
      width: '56%',
    },
    logoBox: {
      width: 62,
      height: 62,
      borderWidth: 2,
      borderColor: dark ? theme.line : '#FFFFFF',
      backgroundColor: dark ? mix(theme.accent, '#FFFFFF', 0.18) : '#999999',
      color: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: 12,
    },
    metaRight: {
      width: '34%',
      textAlign: 'right',
    },
    client: {
      width: '46%',
    },
    label: {
      color: theme.muted,
      fontSize: 7.8,
      fontWeight: 700,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    strong: {
      fontWeight: 700,
    },
    muted: {
      color: theme.muted,
    },
    table: {
      marginTop: 12,
      borderWidth: dark ? 1 : 0,
      borderColor: theme.line,
      borderRadius: dark ? 4 : 0,
    },
    sectionTitle: {
      marginTop: 12,
      paddingVertical: 7,
      paddingHorizontal: 8,
      backgroundColor: dark ? mix(theme.accent, '#FFFFFF', 0.18) : theme.panel,
      color: theme.text,
      fontWeight: 700,
    },
    row: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.line,
      minHeight: 46,
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    rowAlt: {
      backgroundColor: theme.rowAlt,
    },
    headerRow: {
      backgroundColor: theme.tableHeaderBg,
      color: theme.tableHeaderText,
      fontSize: 7.8,
      fontWeight: 700,
      textTransform: 'uppercase',
      minHeight: 24,
      paddingVertical: 6,
    },
    colName: {
      width: '54%',
      paddingRight: 10,
    },
    colPrice: {
      width: '16%',
      textAlign: 'right',
    },
    colQty: {
      width: '12%',
      textAlign: 'right',
    },
    colTotal: {
      width: '18%',
      textAlign: 'right',
    },
    itemHead: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    itemImage: {
      width: 46,
      height: 46,
      borderRadius: 4,
      objectFit: 'cover',
      borderWidth: 1,
      borderColor: theme.line,
    },
    itemDescription: {
      marginTop: 4,
      color: theme.muted,
      fontSize: 7.8,
      lineHeight: 1.3,
    },
    components: {
      paddingVertical: 6,
      paddingHorizontal: 8,
      color: theme.muted,
      borderBottomWidth: 1,
      borderBottomColor: theme.line,
      fontSize: 7.3,
    },
    componentsTitle: {
      fontSize: 7.5,
      fontWeight: 700,
      marginBottom: 2,
      color: theme.text,
    },
    componentLine: {
      marginBottom: 1.5,
    },
    bottom: {
      flexDirection: 'row',
      gap: 24,
      marginTop: 28,
    },
    payment: {
      width: '48%',
      minHeight: 94,
    },
    summary: {
      width: '48%',
      marginLeft: 'auto',
    },
    summaryLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.line,
    },
    dueLine: {
      marginTop: 6,
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: dark ? mix(theme.accent, '#FFFFFF', 0.14) : theme.accentPale,
      borderTopWidth: 1,
      borderTopColor: theme.accent,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dueText: {
      fontWeight: 700,
      textTransform: 'uppercase',
    },
    dueValue: {
      fontSize: 13,
      fontWeight: 700,
    },
    note: {
      marginTop: 10,
      color: theme.muted,
      fontSize: 7.6,
      lineHeight: 1.35,
    },
    footer: {
      position: 'absolute',
      left: dark ? 30 : 38,
      right: dark ? 30 : 38,
      bottom: 26,
      borderTopWidth: 1,
      borderTopColor: theme.line,
      paddingTop: 10,
      color: theme.muted,
      fontSize: 7.4,
    },
  });
}

function money(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString('ru-RU')} ₽`;
}

function qty(value: number) {
  return Number(value || 0).toLocaleString('ru-RU', {
    maximumFractionDigits: 3,
  });
}

function documentLabel(type?: EstimateDocumentType) {
  return type === 'final' ? 'Итоговый расчет' : 'Предварительная смета';
}

function renderableImage(value?: string | null) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (image.startsWith('data:image/')) return image;
  if (/^https?:\/\//i.test(image)) return image;
  return '';
}

function shortText(value: string | null | undefined, max = 180) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function groupedItems(items: EstimateItem[]) {
  const groups = new Map<string, EstimateItem[]>();
  items.forEach(item => {
    const section = item.section || 'Общие работы';
    groups.set(section, [...(groups.get(section) || []), item]);
  });

  return [...groups.entries()].map(([section, rows]) => ({
    section,
    rows,
    total: rows.reduce((sum, row) => sum + row.qty * row.price, 0),
  }));
}

function componentLines(item: EstimateItem) {
  const components = item.components || [];
  const visible = components.slice(0, 5);
  const hidden = components.length - visible.length;
  return {
    visible,
    hidden,
  };
}

const EstimateDocument = ({ items, options }: { items: EstimateItem[]; options: PdfOptions }) => {
  const template = options.template || 'wave';
  const theme = buildTheme(template, options.accentColor);
  const styles = createStyles(theme);
  const groups = groupedItems(items);
  const companyName = options.companyName || 'SmartCeiling';
  const logoText = companyName.trim().slice(0, 2).toUpperCase() || 'SM';
  const dateText = new Date().toLocaleDateString('ru-RU');
  const subtotal = groups.reduce((sum, group) => sum + group.total, 0);
  const dark = template === 'dark';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentTop} fixed />
        <View style={styles.accentBottom} fixed />

        {(template === 'classic' || template === 'stripe') && (
          <View style={styles.top}>
            <View>
              <Text style={styles.title}>Коммерческое предложение</Text>
              <Text style={styles.badge}>{documentLabel(options.documentType)}</Text>
            </View>
            <View style={styles.logo}>
              <Text>{logoText}</Text>
            </View>
          </View>
        )}

        {template === 'wave' && (
          <View style={styles.headerWave}>
            <View style={styles.top}>
              <View>
                <Text style={styles.title}>Коммерческое предложение</Text>
                <Text style={styles.badge}>{documentLabel(options.documentType)}</Text>
              </View>
              <View style={styles.logo}>
                <Text>{logoText}</Text>
              </View>
            </View>
          </View>
        )}

        {template === 'dark' && (
          <View style={styles.top}>
            <View>
              <Text style={styles.title}>Коммерческое предложение</Text>
              <Text style={styles.badge}>{documentLabel(options.documentType)}</Text>
            </View>
            <View style={styles.logo}>
              <Text>{logoText}</Text>
            </View>
          </View>
        )}

        <View style={styles.meta} wrap={false}>
          <View style={styles.companyBox}>
            {(template === 'wave' || template === 'dark') && (
              <View style={styles.logoBox}>
                <Text>LOGO</Text>
              </View>
            )}
            <View style={{ flexGrow: 1 }}>
              <Text style={styles.strong}>{companyName}</Text>
              {options.managerName ? <Text>{options.managerName}</Text> : null}
              {options.phone ? <Text>{options.phone}</Text> : null}
              {options.email ? <Text>{options.email}</Text> : null}
            </View>
          </View>

          <View style={styles.metaRight}>
            <Text style={styles.label}>Документ</Text>
            <Text>{documentLabel(options.documentType)}</Text>
            <Text style={{ marginTop: 7 }}>Дата: {dateText}</Text>
            {options.title ? <Text style={styles.muted}>Смета: {shortText(options.title, 54)}</Text> : null}
            <Text style={{ marginTop: 7 }}>К оплате: {money(options.total)}</Text>
          </View>
        </View>

        <View style={styles.meta} wrap={false}>
          <View style={styles.client}>
            <Text style={styles.label}>Клиент</Text>
            <Text style={styles.strong}>{options.clientName || 'Клиент не указан'}</Text>
            {options.clientPhone ? <Text>{options.clientPhone}</Text> : null}
            {options.clientEmail ? <Text>{options.clientEmail}</Text> : null}
            {options.objectAddress ? <Text style={{ marginTop: 5 }}>{shortText(options.objectAddress, 90)}</Text> : null}
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.label}>Объект</Text>
            <Text>{options.objectAddress ? shortText(options.objectAddress, 90) : 'Адрес не указан'}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} fixed>
            <Text style={styles.colName}>Наименование</Text>
            <Text style={styles.colPrice}>Стоимость</Text>
            <Text style={styles.colQty}>Кол-во</Text>
            <Text style={styles.colTotal}>Сумма</Text>
          </View>

          {groups.map(group => (
            <View key={group.section}>
              <Text style={styles.sectionTitle}>{group.section} · {money(group.total)}</Text>
              {group.rows.map((item, index) => {
                const image = renderableImage(item.image);
                const components = componentLines(item);

                return (
                  <View key={`${group.section}-${item.name}-${index}`} wrap={false}>
                    <View style={[styles.row, index % 2 === 1 ? styles.rowAlt : {}]}>
                      <View style={styles.colName}>
                        <View style={styles.itemHead}>
                          {image ? <Image src={image} style={styles.itemImage} /> : null}
                          <View style={{ flexGrow: 1 }}>
                            <Text style={styles.strong}>{shortText(item.name, 95)}</Text>
                            <Text style={styles.muted}>{item.type}</Text>
                            {item.description ? <Text style={styles.itemDescription}>{shortText(item.description, 140)}</Text> : null}
                          </View>
                        </View>
                      </View>
                      <Text style={styles.colPrice}>{money(item.price)}</Text>
                      <Text style={styles.colQty}>{qty(item.qty)} {item.unit}</Text>
                      <Text style={styles.colTotal}>{money(item.price * item.qty)}</Text>
                    </View>

                    {components.visible.length > 0 && (
                      <View style={styles.components}>
                        <Text style={styles.componentsTitle}>Состав узла</Text>
                        {components.visible.map((component, componentIndex) => (
                          <Text key={`${component.name}-${componentIndex}`} style={styles.componentLine}>
                            {component.type}: {shortText(component.name, 86)} | {qty(component.qty)} {component.unit} x {money(component.price)} = {money(component.qty * component.price)}
                          </Text>
                        ))}
                        {components.hidden > 0 ? <Text style={styles.componentLine}>Еще компонентов: {components.hidden}</Text> : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {groups.length === 0 ? <Text style={[styles.row, styles.muted]}>В смете пока нет позиций.</Text> : null}
        </View>

        <View style={styles.bottom} wrap={false}>
          <View style={styles.payment}>
            <Text style={styles.strong}>Информация об оплате</Text>
            <Text style={[styles.label, { marginTop: 12 }]}>Условия</Text>
            <Text style={styles.note}>
              {shortText(options.note || 'Стоимость указана для согласования объема работ и комплектации. Сроки и условия выполнения фиксируются после подтверждения сметы.', 260)}
            </Text>
            {options.clientComment ? <Text style={styles.note}>{shortText(options.clientComment, 180)}</Text> : null}
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryLine}>
              <Text>Промежуточный итог</Text>
              <Text>{money(subtotal)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text>Итого</Text>
              <Text>{money(options.total)}</Text>
            </View>
            <View style={styles.dueLine}>
              <Text style={styles.dueText}>Сумма к оплате</Text>
              <Text style={styles.dueValue}>{money(options.total)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{companyName} · {options.phone || options.email || documentLabel(options.documentType)}</Text>
          {dark ? <Text style={{ marginTop: 3 }}>Документ сформирован в SmartCeiling</Text> : null}
        </View>
      </Page>
    </Document>
  );
};

export const generatePdf = async (items: EstimateItem[], options: PdfOptions) => {
  let blob: Blob;
  try {
    blob = await pdf(<EstimateDocument items={items} options={options} />).toBlob();
  } catch {
    const withoutImages = items.map(item => ({ ...item, image: null }));
    blob = await pdf(<EstimateDocument items={withoutImages} options={options} />).toBlob();
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeDate = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
  link.href = url;
  link.download = `Smeta_${safeDate}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
