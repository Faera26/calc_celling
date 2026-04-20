import { useEffect, useState } from 'react';
import type { CompanySettings } from '../types';
import { SETTINGS_KEY } from '../constants';
import { readSettings } from '../utils';

export function useSettings() {
  const [settings, setSettings] = useState<CompanySettings>(() => readSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

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
    handleAvatar
  };
}
