import { useEffect, useState } from 'react';
import type { CompanySettings } from '../types';
import { SETTINGS_KEY } from '../constants';
import { readSettings } from '../utils';
import { supabase } from '../supabaseClient';

interface UseSettingsOptions {
  userId?: string;
  isAdmin?: boolean;
  profileReady?: boolean;
}

interface CompanySettingsRow {
  company_name?: string | null;
  manager_name?: string | null;
  phone?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  default_margin_percent?: number | null;
  default_discount_percent?: number | null;
  pdf_note?: string | null;
}

const SETTINGS_ROW_ID = 'default';

function toNumber(value: number | null | undefined) {
  return Number(value || 0);
}

function mapRowToSettings(row: CompanySettingsRow | null, cached: CompanySettings): CompanySettings {
  if (!row) {
    return cached;
  }

  return {
    ...cached,
    companyName: row.company_name || cached.companyName,
    managerName: row.manager_name || '',
    phone: row.phone || '',
    email: row.email || '',
    // Аватар пока оставляем локальным: в проекте ещё нет отдельного потока
    // загрузки файлов и безопасного ресайза перед сохранением в базе.
    avatarDataUrl: cached.avatarDataUrl || row.avatar_url || '',
    marginPercent: toNumber(row.default_margin_percent),
    discountPercent: toNumber(row.default_discount_percent),
    pdfNote: row.pdf_note || '',
  };
}

function buildRowPatch(settings: CompanySettings) {
  return {
    id: SETTINGS_ROW_ID,
    company_name: settings.companyName.trim() || 'SmartCeiling',
    manager_name: settings.managerName.trim() || null,
    phone: settings.phone.trim() || null,
    email: settings.email.trim() || null,
    default_margin_percent: toNumber(settings.marginPercent),
    default_discount_percent: toNumber(settings.discountPercent),
    pdf_note: settings.pdfNote.trim() || null,
  };
}

export function useSettings({ userId, isAdmin, profileReady }: UseSettingsOptions = {}) {
  const [settings, setSettings] = useState<CompanySettings>(() => readSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [syncSource, setSyncSource] = useState<'local' | 'supabase'>('local');
  const [syncError, setSyncError] = useState('');
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    if (!profileReady) return;

    let cancelled = false;

    async function loadCompanySettings() {
      const cached = readSettings();

      if (!userId) {
        setSettings(cached);
        setSyncSource('local');
        setSyncError('');
        setRemoteReady(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('nastroiki_kompanii')
          .select('company_name, manager_name, phone, email, avatar_url, default_margin_percent, default_discount_percent, pdf_note')
          .eq('id', SETTINGS_ROW_ID)
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        setSettings(mapRowToSettings((data || null) as CompanySettingsRow | null, cached));
        setSyncSource('supabase');
        setSyncError('');
      } catch (error) {
        if (cancelled) return;

        setSettings(cached);
        setSyncSource('local');
        setSyncError(
          isAdmin
            ? `Не удалось загрузить общие настройки компании из Supabase: ${error instanceof Error ? error.message : String(error)}`
            : ''
        );
      } finally {
        if (!cancelled) {
          setRemoteReady(true);
        }
      }
    }

    loadCompanySettings();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, profileReady, userId]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!remoteReady || !userId || !isAdmin) return;

    const timer = window.setTimeout(async () => {
      const { error } = await supabase.from('nastroiki_kompanii').upsert(buildRowPatch(settings), {
        onConflict: 'id',
      });

      if (error) {
        setSyncError(`Не удалось сохранить общие настройки компании в Supabase: ${error.message}`);
        return;
      }

      setSyncSource('supabase');
      setSyncError('');
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    isAdmin,
    remoteReady,
    settings,
    userId,
  ]);

  function updateSettings(patch: Partial<CompanySettings>) {
    setSettings(prev => ({ ...prev, ...patch }));
  }

  function handleAvatar(file?: File) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSettings(prev => ({ ...prev, avatarDataUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  }

  return {
    settings,
    isSettingsOpen,
    setIsSettingsOpen,
    updateSettings,
    handleAvatar,
    syncSource,
    syncError,
  };
}
