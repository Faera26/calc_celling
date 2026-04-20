import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  Autocomplete,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PictureAsPdf as PdfIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import type {
  AuthState,
  CompanySettings,
  ComponentType,
  EstimateDocumentType,
  EstimatePdfTemplate,
  SavedEstimate,
  SavedEstimatePosition,
  SavedEstimateRoom,
} from '../types';
import { generatePdf } from '../PdfExport';
import { adjustedPrice, labelOf, money } from '../utils';
import { restDelete, restInsert, restSelect, restUpdate } from '../supabaseRest';
import { supabase } from '../supabaseClient';
import { cleanSearch, formatError, withTimeout } from '../utils';

interface EstimatesPageProps {
  auth: AuthState;
  settings: CompanySettings;
}

interface EstimateDraft {
  title: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  objectAddress: string;
  clientComment: string;
  status: SavedEstimate['status'];
  documentType: EstimateDocumentType;
  pdfTemplate: EstimatePdfTemplate;
  pdfAccentColor: string;
  marginPercent: string;
  discountPercent: string;
  useCommonSection: boolean;
}

interface AddLocalPositionDraft {
  name: string;
  price: string;
  qty: string;
  unit: string;
  description: string;
  image: string;
  roomId: string;
  item_id?: string;
  category?: string;
  subcategory?: string;
}

const COMMON_ROOM = 'common';

const pdfTemplates: Array<{ value: EstimatePdfTemplate; label: string; hint: string }> = [
  { value: 'wave', label: 'Волна', hint: 'Шапка цветом, как на мобильном шаблоне' },
  { value: 'stripe', label: 'Полосы', hint: 'Акцентные линии сверху и снизу' },
  { value: 'classic', label: 'Классика', hint: 'Минимальный белый документ' },
  { value: 'dark', label: 'Тёмный', hint: 'Контрастный цветной лист' },
];

const pdfPalette = [
  '#2F3133',
  '#505356',
  '#455A64',
  '#5D4037',
  '#C61F2B',
  '#D4146A',
  '#7B1FA2',
  '#4527A0',
  '#303F9F',
  '#1565C0',
  '#0277BD',
  '#00695C',
  '#2E7D32',
  '#558B2F',
];

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  sent: 'Отправлено',
  accepted: 'Принято',
  archived: 'Архив',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function componentLabel(type: ComponentType) {
  return type === 'tovar' ? 'Товар' : 'Услуга';
}

function componentSnapshots(position: SavedEstimatePosition) {
  return Array.isArray(position.components_snapshot) ? position.components_snapshot : [];
}

function sourceSnapshot(position: SavedEstimatePosition): NonNullable<SavedEstimatePosition['source_snapshot']> {
  const snapshot = position.source_snapshot;
  return snapshot && typeof snapshot === 'object' ? snapshot : {};
}

function isSchemaCacheError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: string }).message || '')
    : String(error || '');

  return message.includes('schema cache')
    || message.includes('Could not find')
    || message.includes('does not exist');
}

function num(value: string | number | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}


function estimateSettingsWithRules(estimate: SavedEstimate | undefined) {
  const snapshot = estimate?.settings_snapshot && typeof estimate.settings_snapshot === 'object'
    ? estimate.settings_snapshot
    : {};

  return {
    ...snapshot,
  };
}

function estimateDraftOf(estimate: SavedEstimate | undefined): EstimateDraft {
  return {
    title: estimate?.title || '',
    clientName: estimate?.client_name || '',
    clientPhone: estimate?.client_phone || '',
    clientEmail: estimate?.client_email || '',
    objectAddress: estimate?.object_address || '',
    clientComment: estimate?.client_comment || '',
    status: estimate?.status || 'draft',
    documentType: estimate?.document_type || 'preliminary',
    pdfTemplate: estimate?.pdf_template || 'wave',
    pdfAccentColor: estimate?.pdf_accent_color || '#D4146A',
    marginPercent: String(estimate?.margin_percent ?? 0),
    discountPercent: String(estimate?.discount_percent ?? 0),
    useCommonSection: estimate?.use_common_section !== false,
  };
}

function emptyAddDraft(): AddLocalPositionDraft {
  return {
    name: '',
    price: '',
    qty: '1',
    unit: 'шт.',
    description: '',
    image: '',
    roomId: COMMON_ROOM,
    category: 'Локальные',
    subcategory: '',
  };
}

export default function EstimatesPage({ auth, settings }: EstimatesPageProps) {
  const [estimates, setEstimates] = useState<SavedEstimate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [rooms, setRooms] = useState<SavedEstimateRoom[]>([]);
  const [positions, setPositions] = useState<SavedEstimatePosition[]>([]);
  const [estimateDraft, setEstimateDraft] = useState<EstimateDraft>(() => estimateDraftOf(undefined));
  const [roomDrafts, setRoomDrafts] = useState<SavedEstimateRoom[]>([]);
  const [positionDrafts, setPositionDrafts] = useState<SavedEstimatePosition[]>([]);
  const [deletedRoomIds, setDeletedRoomIds] = useState<string[]>([]);
  const [deletedPositionIds, setDeletedPositionIds] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Catalog search for adding positions
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogOptions, setCatalogOptions] = useState<any[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Debounce catalog search
  useEffect(() => {
    if (catalogSearch.length < 2) {
      setCatalogOptions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setOptionsLoading(true);
      try {
        const query = cleanSearch(catalogSearch);
        const [tovary, uslugi, uzly] = await Promise.all([
          supabase.from('tovary').select('id, name, price, unit, category, subcategory').ilike('name', `%${query}%`).limit(10),
          supabase.from('uslugi').select('id, name, price, unit, category, subcategory').ilike('name', `%${query}%`).limit(10),
          supabase.from('uzly').select('id, name, price, unit, category, subcategory').ilike('name', `%${query}%`).limit(10),
        ]);

        const combined = [
          ...(tovary.data || []).map(x => ({ ...x, type: 'tovar' })),
          ...(uslugi.data || []).map(x => ({ ...x, type: 'usluga' })),
          ...(uzly.data || []).map(x => ({ ...x, type: 'uzel' })),
        ];
        setCatalogOptions(combined);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setOptionsLoading(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [catalogSearch]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [addDraft, setAddDraft] = useState<AddLocalPositionDraft>(() => emptyAddDraft());
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);

  const selectedEstimate = useMemo(
    () => estimates.find(estimate => estimate.id === selectedId) || estimates[0],
    [estimates, selectedId]
  );

  const currentTotal = useMemo(
    () => positionDrafts.reduce((sum, position) => sum + num(position.total), 0),
    [positionDrafts]
  );

  const componentsCount = useMemo(
    () => positionDrafts.reduce((sum, position) => sum + componentSnapshots(position).length, 0),
    [positionDrafts]
  );

  const roomNameById = useMemo(
    () => new Map(roomDrafts.map(room => [room.id, room.name || 'Комната'])),
    [roomDrafts]
  );

  const sectionTotals = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; count: number; total: number }>();
    const commonName = estimateDraft.useCommonSection ? 'Общие работы' : 'Без комнаты';
    const hasCommonPositions = positionDrafts.some(position => !position.room_id || !roomNameById.has(position.room_id));

    if (estimateDraft.useCommonSection || hasCommonPositions) {
      groups.set(COMMON_ROOM, { key: COMMON_ROOM, name: commonName, count: 0, total: 0 });
    }

    roomDrafts.forEach(room => {
      groups.set(room.id, { key: room.id, name: room.name || 'Комната', count: 0, total: 0 });
    });

    positionDrafts.forEach(position => {
      const key = position.room_id && roomNameById.has(position.room_id) ? position.room_id : COMMON_ROOM;
      const group = groups.get(key) || { key, name: commonName, count: 0, total: 0 };
      group.count += 1;
      group.total += num(position.total);
      groups.set(key, group);
    });

    return [...groups.values()];
  }, [estimateDraft.useCommonSection, positionDrafts, roomDrafts, roomNameById]);

  const originalRoomIds = useMemo(() => new Set(rooms.map(room => room.id)), [rooms]);
  const originalPositionIds = useMemo(() => new Set(positions.map(position => position.id)), [positions]);

  function sectionNameOf(roomId?: string | null) {
    if (roomId && roomNameById.has(roomId)) return roomNameById.get(roomId)!;
    return estimateDraft.useCommonSection ? 'Общие работы' : 'Без комнаты';
  }

  function priceWithDraftMargin(basePrice: number) {
    return adjustedPrice(basePrice, {
      ...settings,
      marginPercent: num(estimateDraft.marginPercent),
      discountPercent: num(estimateDraft.discountPercent),
    });
  }

  async function loadEstimates() {
    setLoading(true);
    setError('');

    try {
      let rows: SavedEstimate[];

      try {
        rows = await restSelect<SavedEstimate>('smety', {
          select: 'id,user_id,title,client_name,client_phone,client_email,object_address,client_comment,margin_percent,discount_percent,subtotal,total,status,document_type,pdf_template,pdf_accent_color,use_common_section,room_count,items_count,components_count,settings_snapshot,created_at,updated_at',
          order: 'created_at.desc',
          limit: 50,
        });
      } catch (loadError) {
        if (!isSchemaCacheError(loadError)) throw loadError;

        rows = await restSelect<SavedEstimate>('smety', {
          select: 'id,user_id,client_name,client_phone,margin_percent,discount_percent,subtotal,total,status,created_at,updated_at',
          order: 'created_at.desc',
          limit: 50,
        });
      }

      setEstimates(rows);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(`${message} Проверь миграции смет.`);
      setEstimates([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (auth.userId) loadEstimates();
  }, [auth.userId]);

  useEffect(() => {
    setEstimateDraft(estimateDraftOf(selectedEstimate));
  }, [selectedEstimate?.id]);

  useEffect(() => {
    if (!selectedEstimate?.id) {
      setRooms([]);
      setPositions([]);
      setRoomDrafts([]);
      setPositionDrafts([]);
      return;
    }

    let cancelled = false;

    async function loadDetails() {
      setDetailsLoading(true);
      setError('');
      setNotice('');

      try {
        const roomsPromise = restSelect<SavedEstimateRoom>('smeta_komnaty', {
          select: 'id,smeta_id,position_index,name,area,perimeter,corners,light_points,pipes,curtain_tracks,niches,comment',
          filters: { smeta_id: selectedEstimate!.id },
          order: 'position_index.asc',
        }).catch(loadError => {
          if (isSchemaCacheError(loadError)) return [] as SavedEstimateRoom[];
          throw loadError;
        });

        const positionsPromise = restSelect<SavedEstimatePosition>('smeta_pozicii', {
          select: 'id,smeta_id,position_index,room_id,item_type,item_id,item_name,qty,unit,price,total,category,subcategory,base_price,components_snapshot,source_snapshot',
          filters: { smeta_id: selectedEstimate!.id },
          order: 'position_index.asc',
        }).catch(loadError => {
          if (!isSchemaCacheError(loadError)) throw loadError;

          return restSelect<SavedEstimatePosition>('smeta_pozicii', {
            select: 'id,smeta_id,item_type,item_id,item_name,qty,unit,price,total,created_at',
            filters: { smeta_id: selectedEstimate!.id },
            order: 'created_at.asc',
          });
        });

        const [roomRows, positionRows] = await Promise.all([roomsPromise, positionsPromise]);
        if (cancelled) return;

        setRooms(roomRows);
        setPositions(positionRows);
        setRoomDrafts(roomRows);
        setPositionDrafts(positionRows);
        setDeletedRoomIds([]);
        setDeletedPositionIds([]);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        setError(`${message} Проверь миграции смет.`);
        setRooms([]);
        setPositions([]);
        setRoomDrafts([]);
        setPositionDrafts([]);
      }

      setDetailsLoading(false);
    }

    loadDetails();
    return () => { cancelled = true; };
  }, [selectedEstimate?.id]);

  function updateRoom(roomId: string, patch: Partial<SavedEstimateRoom>) {
    setRoomDrafts(prev => prev.map(room => room.id === roomId ? { ...room, ...patch } : room));
  }

  function addRoom() {
    if (!selectedEstimate) return;
    setRoomDrafts(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        smeta_id: selectedEstimate.id,
        position_index: prev.length + 1,
        name: `Комната ${prev.length + 1}`,
        area: 0,
        perimeter: 0,
        corners: 0,
        light_points: 0,
        pipes: 0,
        curtain_tracks: 0,
        niches: 0,
        comment: '',
      },
    ]);
  }

  function removeRoom(roomId: string) {
    if (originalRoomIds.has(roomId)) setDeletedRoomIds(prev => [...new Set([...prev, roomId])]);
    setRoomDrafts(prev => prev.filter(room => room.id !== roomId));
    setPositionDrafts(prev => prev.map(position => position.room_id === roomId ? { ...position, room_id: null } : position));
  }

  function updatePosition(positionId: string, patch: Partial<SavedEstimatePosition>) {
    setPositionDrafts(prev => prev.map(position => {
      if (position.id !== positionId) return position;
      const next = { ...position, ...patch };
      const qty = num(next.qty);
      const price = num(next.price);
      return { ...next, qty, price, total: qty * price };
    }));
  }

  function updatePositionSource(positionId: string, patch: NonNullable<SavedEstimatePosition['source_snapshot']>) {
    setPositionDrafts(prev => prev.map(position => {
      if (position.id !== positionId) return position;
      return {
        ...position,
        source_snapshot: {
          ...sourceSnapshot(position),
          ...patch,
        },
      };
    }));
  }

  function removePosition(positionId: string) {
    if (originalPositionIds.has(positionId)) setDeletedPositionIds(prev => [...new Set([...prev, positionId])]);
    setPositionDrafts(prev => prev.filter(position => position.id !== positionId));
  }

  function recalcPricesFromMargin() {
    setPositionDrafts(prev => prev.map(position => {
      const basePrice = num(position.base_price ?? position.price);
      const price = priceWithDraftMargin(basePrice);
      const qty = num(position.qty);
      return {
        ...position,
        price,
        total: price * qty,
        components_snapshot: componentSnapshots(position).map(component => {
          const componentBasePrice = num(component.price);
          const componentPrice = priceWithDraftMargin(componentBasePrice);
          return {
            ...component,
            price: componentPrice,
            total: componentPrice * num(component.qty),
          };
        }),
      };
    }));
  }

  async function handleAddPosition() {
    if (!selectedEstimate) return;
    
    const qty = num(addDraft.qty) || 1;
    const price = num(addDraft.price) || 0;
    const name = addDraft.name.trim();

    if (!name) {
      setError('Введите название позиции');
      return;
    }
    
    const position: SavedEstimatePosition = {
      id: crypto.randomUUID(),
      smeta_id: selectedEstimate.id,
      position_index: positionDrafts.length + 1,
      room_id: addDraft.roomId === COMMON_ROOM ? null : addDraft.roomId,
      item_type: 'tovar',
      item_id: addDraft.item_id || `local-${crypto.randomUUID()}`,
      item_name: name,
      qty,
      unit: addDraft.unit.trim() || 'шт.',
      base_price: price,
      price,
      total: price * qty,
      category: addDraft.category || 'Локальные',
      subcategory: addDraft.subcategory || null,
      source_snapshot: {
        image: addDraft.image.trim() || null,
        description: addDraft.description.trim() || null,
        source: 'local',
      },
      components_snapshot: [],
    };

    try {
      await restInsert('smeta_pozicii', {
        id: position.id,
        smeta_id: position.smeta_id,
        position_index: position.position_index,
        room_id: position.room_id || null,
        item_type: position.item_type,
        item_id: position.item_id,
        item_name: position.item_name,
        qty: num(position.qty),
        unit: position.unit || 'шт.',
        base_price: num(position.base_price ?? position.price),
        price: num(position.price),
        total: num(position.total),
        category: position.category || null,
        subcategory: position.subcategory || null,
        components_snapshot: componentSnapshots(position),
        source_snapshot: sourceSnapshot(position),
      }, { returning: 'minimal' });

      const nextPositions = [...positionDrafts, position];
      await restUpdate('smety', {
        subtotal: nextPositions.reduce((sum, row) => sum + num(row.total), 0),
        total: nextPositions.reduce((sum, row) => sum + num(row.total), 0),
        room_count: roomDrafts.length,
        items_count: nextPositions.length,
        components_count: nextPositions.reduce((sum, row) => sum + componentSnapshots(row).length, 0),
        updated_at: new Date().toISOString(),
      }, {
        filters: { id: selectedEstimate.id },
        returning: 'minimal',
      });

      setPositions(prev => [...prev, position]);
      setPositionDrafts(nextPositions);
      setAddDraft(emptyAddDraft());
      setNotice('Позиция успешно добавлена.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveEstimateEditor() {
    if (!selectedEstimate) return;
    setSaving(true);
    setError('');
    setNotice('');

    const validRoomIds = new Set(roomDrafts.map(room => room.id));
    const normalizedPositions = positionDrafts.map((position, index) => {
      const qty = num(position.qty);
      const price = num(position.price);
      const roomId = position.room_id && validRoomIds.has(position.room_id) ? position.room_id : null;
      return {
        ...position,
        position_index: index + 1,
        room_id: roomId,
        qty,
        price,
        total: qty * price,
      };
    });

    try {
      await restUpdate('smety', {
        title: estimateDraft.title.trim() || 'Без названия',
        client_name: estimateDraft.clientName.trim() || null,
        client_phone: estimateDraft.clientPhone.trim() || null,
        client_email: estimateDraft.clientEmail.trim() || null,
        object_address: estimateDraft.objectAddress.trim() || null,
        client_comment: estimateDraft.clientComment.trim() || null,
        status: estimateDraft.status,
        document_type: estimateDraft.documentType,
        pdf_template: estimateDraft.pdfTemplate,
        pdf_accent_color: estimateDraft.pdfAccentColor,
        use_common_section: estimateDraft.useCommonSection,
        margin_percent: num(estimateDraft.marginPercent),
        discount_percent: num(estimateDraft.discountPercent),
        subtotal: normalizedPositions.reduce((sum, position) => sum + num(position.total), 0),
        total: normalizedPositions.reduce((sum, position) => sum + num(position.total), 0),
        room_count: roomDrafts.length,
        items_count: normalizedPositions.length,
        components_count: normalizedPositions.reduce((sum, position) => sum + componentSnapshots(position).length, 0),
        settings_snapshot: estimateSettingsWithRules(selectedEstimate),
        updated_at: new Date().toISOString(),
      }, {
        filters: { id: selectedEstimate.id },
        returning: 'minimal',
      });

      await Promise.all(deletedPositionIds.map(id => restDelete('smeta_pozicii', {
        filters: { id },
        returning: 'minimal',
      })));

      await Promise.all(deletedRoomIds.map(id => restDelete('smeta_komnaty', {
        filters: { id },
        returning: 'minimal',
      })));

      const roomPayloads = roomDrafts.map((room, index) => ({
        id: room.id,
        smeta_id: selectedEstimate.id,
        position_index: index + 1,
        name: room.name.trim() || `Комната ${index + 1}`,
        area: num(room.area),
        perimeter: num(room.perimeter),
        corners: num(room.corners),
        light_points: num(room.light_points),
        pipes: num(room.pipes),
        curtain_tracks: num(room.curtain_tracks),
        niches: num(room.niches),
        comment: room.comment || null,
      }));

      const newRooms = roomPayloads.filter(room => !originalRoomIds.has(room.id));
      const existingRooms = roomPayloads.filter(room => originalRoomIds.has(room.id));

      if (newRooms.length > 0) await restInsert('smeta_komnaty', newRooms, { returning: 'minimal' });
      await Promise.all(existingRooms.map(room => restUpdate('smeta_komnaty', room, {
        filters: { id: room.id },
        returning: 'minimal',
      })));

      const positionPayloads = normalizedPositions.map(position => ({
        id: position.id,
        smeta_id: selectedEstimate.id,
        position_index: position.position_index,
        room_id: position.room_id || null,
        item_type: position.item_type,
        item_id: position.item_id,
        item_name: position.item_name,
        qty: num(position.qty),
        unit: position.unit || 'шт.',
        base_price: num(position.base_price ?? position.price),
        price: num(position.price),
        total: num(position.total),
        category: position.category || null,
        subcategory: position.subcategory || null,
        components_snapshot: componentSnapshots(position),
        source_snapshot: sourceSnapshot(position),
      }));

      const newPositions = positionPayloads.filter(position => !originalPositionIds.has(position.id));
      const existingPositions = positionPayloads.filter(position => originalPositionIds.has(position.id));

      if (newPositions.length > 0) await restInsert('smeta_pozicii', newPositions, { returning: 'minimal' });
      await Promise.all(existingPositions.map(position => restUpdate('smeta_pozicii', position, {
        filters: { id: position.id },
        returning: 'minimal',
      })));

      const savedRooms: SavedEstimateRoom[] = roomPayloads.map(room => ({ ...room }));
      const savedPositions: SavedEstimatePosition[] = positionPayloads.map(position => ({ ...position }));

      setRooms(savedRooms);
      setPositions(savedPositions);
      setRoomDrafts(savedRooms);
      setPositionDrafts(savedPositions);
      setDeletedRoomIds([]);
      setDeletedPositionIds([]);
      setNotice('Изменения сохранены.');
      await loadEstimates();
      const keepId = selectedEstimate.id;
      setSelectedId(keepId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  function handlePdfExport() {
    if (!selectedEstimate) return;

    generatePdf(
      positionDrafts.map(position => ({
        name: position.item_name,
        type: labelOf(position.item_type),
        section: sectionNameOf(position.room_id),
        image: textValue(sourceSnapshot(position).image),
        description: textValue(sourceSnapshot(position).description),
        qty: num(position.qty),
        price: num(position.price),
        unit: position.unit || 'шт.',
        components: componentSnapshots(position).map(component => ({
          type: componentLabel(component.item_type),
          name: component.item_name,
          qty: num(component.qty),
          unit: component.unit || 'шт.',
          price: num(component.price),
        })),
      })),
      {
        title: estimateDraft.title,
        documentType: estimateDraft.documentType,
        template: estimateDraft.pdfTemplate,
        accentColor: estimateDraft.pdfAccentColor,
        clientName: estimateDraft.clientName,
        clientPhone: estimateDraft.clientPhone,
        clientEmail: estimateDraft.clientEmail,
        objectAddress: estimateDraft.objectAddress,
        clientComment: estimateDraft.clientComment,
        total: currentTotal,
        companyName: settings.companyName,
        managerName: settings.managerName,
        phone: settings.phone,
        email: settings.email,
        note: settings.pdfNote,
      }
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1500, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4">Сметы</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Редактор сохранённых смет.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadEstimates} disabled={loading}>
          Обновить
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

      {loading ? (
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Загружаю сметы...</Typography>
        </Stack>
      ) : estimates.length === 0 ? (
        <Card>
          <CardContent>
            <Alert severity="info" sx={{ mb: 2 }}>Пока нет сохранённых смет.</Alert>
          </CardContent>
        </Card>
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ alignItems: 'flex-start' }}>
          <Stack spacing={2} sx={{ width: { xs: '100%', lg: 360 }, flexShrink: 0 }}>
            {estimates.map(estimate => (
              <Card
                key={estimate.id}
                onClick={() => setSelectedId(estimate.id)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 3,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                  borderColor: selectedEstimate?.id === estimate.id ? 'primary.main' : 'divider',
                  borderWidth: selectedEstimate?.id === estimate.id ? 2 : 1,
                }}
              >
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="h6">{estimate.title || estimate.client_name || 'Без названия'}</Typography>
                    </Stack>
                    <Typography color="text.secondary">{estimate.client_name || 'Клиент не указан'}</Typography>
                    <Typography variant="body2" color="text.secondary">{formatDate(estimate.created_at)}</Typography>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        {estimate.items_count || 0} поз.
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>{money(num(estimate.total))}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>

          <Box sx={{ flexGrow: 1, width: '100%' }}>
            {selectedEstimate && (
              <Card sx={{ boxShadow: '0 8px 30px rgba(0,0,0,0.04)', borderRadius: 3 }}>
                <CardContent>
                  <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', gap: 2, mb: 2 }}>
                    <Box>
                      <Typography variant="h5">{estimateDraft.title || estimateDraft.clientName || 'Без названия'}</Typography>
                      <Typography variant="h4" color="primary.main">{money(currentTotal)}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" startIcon={<PdfIcon />} disabled={positionDrafts.length === 0} onClick={handlePdfExport}>
                        PDF
                      </Button>
                      <Button variant="contained" startIcon={<SaveIcon />} disabled={saving || detailsLoading} onClick={saveEstimateEditor}>
                        {saving ? 'Сохраняю...' : 'Сохранить изменения'}
                      </Button>
                    </Stack>
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  {detailsLoading ? (
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                      <CircularProgress size={22} />
                      <Typography color="text.secondary">Загружаю детали...</Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={3}>
                      {/* Позиции сметы */}
                      <Box>
                        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1, mb: 2 }}>
                          <Box>
                            <Typography variant="h6">Позиции сметы</Typography>
                            <Typography variant="body2" color="text.secondary">Можно вручную менять количество, цену, единицу и раздел.</Typography>
                          </Box>
                        </Stack>

                        {/* Блок добавления позиции */}
                        <Box sx={{ mb: 4, p: 2.5, bgcolor: 'primary.50', borderRadius: 3, border: '1px solid', borderColor: 'primary.100' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: 'primary.dark' }}>Добавить позицию</Typography>
                          <Stack spacing={2}>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                              <Autocomplete
                                fullWidth
                                options={catalogOptions}
                                loading={optionsLoading}
                                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                                onInputChange={(_, value) => {
                                  setCatalogSearch(value);
                                  setAddDraft(prev => ({ ...prev, name: value }));
                                }}
                                onChange={(_, newValue) => {
                                  if (newValue && typeof newValue !== 'string') {
                                    setAddDraft(prev => ({
                                      ...prev,
                                      name: newValue.name,
                                      price: String(newValue.price || ''),
                                      unit: newValue.unit || 'шт.',
                                      item_id: newValue.id,
                                      category: newValue.category,
                                      subcategory: newValue.subcategory,
                                    }));
                                  }
                                }}
                                freeSolo
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    label="Поиск в каталоге или своё название"
                                    placeholder="Начните вводить..."
                                    InputProps={{
                                      ...params.InputProps,
                                      endAdornment: (
                                        <>
                                          {optionsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                          {params.InputProps.endAdornment}
                                        </>
                                      ),
                                    }}
                                  />
                                )}
                              />
                              <TextField
                                select
                                label="Раздел"
                                value={addDraft.roomId}
                                onChange={e => setAddDraft(prev => ({ ...prev, roomId: e.target.value }))}
                                sx={{ minWidth: 200 }}
                              >
                                {estimateDraft.useCommonSection && <MenuItem value={COMMON_ROOM}>Общие работы</MenuItem>}
                                {roomDrafts.map(room => (
                                  <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>
                                ))}
                              </TextField>
                            </Stack>

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                              <TextField
                                label="Кол-во"
                                type="number"
                                value={addDraft.qty}
                                onChange={e => setAddDraft(prev => ({ ...prev, qty: e.target.value }))}
                                sx={{ width: { md: 120 } }}
                              />
                              <TextField
                                label="Ед. изм."
                                value={addDraft.unit}
                                onChange={e => setAddDraft(prev => ({ ...prev, unit: e.target.value }))}
                                sx={{ width: { md: 100 } }}
                              />
                              <TextField
                                label="Цена"
                                type="number"
                                value={addDraft.price}
                                onChange={e => setAddDraft(prev => ({ ...prev, price: e.target.value }))}
                                sx={{ width: { md: 150 } }}
                                InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
                              />
                              <TextField
                                label="Описание"
                                value={addDraft.description}
                                onChange={e => setAddDraft(prev => ({ ...prev, description: e.target.value }))}
                                fullWidth
                                placeholder="Доп. информация для сметы"
                              />
                            </Stack>

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
                              <TextField
                                label="URL картинки"
                                value={addDraft.image}
                                onChange={e => setAddDraft(prev => ({ ...prev, image: e.target.value }))}
                                fullWidth
                                placeholder="Ссылка на фото для локальной позиции"
                              />
                              <Button
                                variant="contained"
                                size="large"
                                onClick={handleAddPosition}
                                startIcon={<AddIcon />}
                                sx={{ height: 56, px: 4, borderRadius: 2, flexShrink: 0 }}
                              >
                                Добавить
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>

                        <Stack spacing={1.5}>
                          {positionDrafts.map(position => {
                            const components = componentSnapshots(position);
                            return (
                              <Box key={position.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
                                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography sx={{ fontWeight: 700 }}>{position.item_name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Раздел: {position.room_id ? roomNameById.get(position.room_id) : 'Общие работы'}
                                    </Typography>
                                  </Box>
                                  
                                  <Box sx={{ textAlign: { md: 'right' } }}>
                                    <Typography variant="body2" color="text.secondary">{position.qty} {position.unit} × {money(num(position.price))}</Typography>
                                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{money(num(position.total))}</Typography>
                                  </Box>

                                  <Stack direction="row" spacing={1}>
                                    <IconButton color="primary" onClick={() => setEditingPositionId(position.id)}>
                                      <EditIcon />
                                    </IconButton>
                                    <IconButton color="error" onClick={() => removePosition(position.id)}>
                                      <DeleteIcon />
                                    </IconButton>
                                  </Stack>
                                </Stack>
                              </Box>
                            );
                          })}
                          {positionDrafts.length === 0 && <Alert severity="info">В смете пока нет позиций.</Alert>}
                        </Stack>
                      </Box>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>
        </Stack>
      )}

      {editingPositionId && (
        <Dialog open onClose={() => setEditingPositionId(null)} maxWidth="md" fullWidth>
          <DialogTitle>Редактирование позиции</DialogTitle>
          <DialogContent dividers>
            {(() => {
              const position = positionDrafts.find(p => p.id === editingPositionId);
              if (!position) return null;
              const source = sourceSnapshot(position);
              return (
                <Stack spacing={3} sx={{ mt: 1 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Название позиции"
                      value={position.item_name}
                      onChange={event => updatePosition(position.id, { item_name: event.target.value })}
                      fullWidth
                    />
                    <TextField select label="Раздел" value={position.room_id || COMMON_ROOM} onChange={event => updatePosition(position.id, { room_id: event.target.value === COMMON_ROOM ? null : event.target.value })} sx={{ minWidth: 200 }}>
                      {estimateDraft.useCommonSection && <MenuItem value={COMMON_ROOM}>Общие работы</MenuItem>}
                      {roomDrafts.map(room => <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>)}
                    </TextField>
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField label="Кол-во" type="number" value={position.qty} onChange={event => updatePosition(position.id, { qty: num(event.target.value) })} sx={{ width: 130 }} />
                    <TextField label="Ед. изм." value={position.unit || ''} onChange={event => updatePosition(position.id, { unit: event.target.value })} sx={{ width: 100 }} />
                    <TextField label="Цена за ед." type="number" value={position.price} onChange={event => updatePosition(position.id, { price: num(event.target.value) })} sx={{ width: 150 }} />
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, flexGrow: 1, textAlign: 'right' }}>
                      <Typography variant="body2" color="text.secondary">Сумма</Typography>
                      <Typography variant="h6" color="primary.main">{money(num(position.total))}</Typography>
                    </Box>
                  </Stack>

                  <Divider />

                  <Typography variant="subtitle2" color="text.secondary">Дополнительные данные</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField label="Категория" value={position.category || ''} onChange={event => updatePosition(position.id, { category: event.target.value })} fullWidth />
                    <TextField label="Подкатегория" value={position.subcategory || ''} onChange={event => updatePosition(position.id, { subcategory: event.target.value })} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Фото для КП (URL)"
                      value={textValue(source.image)}
                      onChange={event => updatePositionSource(position.id, { image: event.target.value })}
                      fullWidth
                    />
                    <TextField
                      label="Описание для КП"
                      value={textValue(source.description)}
                      onChange={event => updatePositionSource(position.id, { description: event.target.value })}
                      multiline
                      minRows={2}
                      fullWidth
                    />
                  </Stack>
                </Stack>
              );
            })()}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingPositionId(null)} variant="contained" color="primary">Готово</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
