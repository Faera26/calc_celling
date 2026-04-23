import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { AuthState, UserProfile } from '../types';

const PROFILE_CACHE_KEY = 'smartceiling.profile.v1';

interface CachedProfileState {
  userId: string;
  userEmail: string;
  profile: UserProfile;
}

function fallbackProfile(userId: string, userEmail: string): UserProfile {
  return {
    id: userId,
    role: 'viewer',
    display_name: userEmail,
  };
}

function readCachedProfile(userId: string, userEmail: string): UserProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<CachedProfileState>;
    if (
      parsed.userId !== userId
      || parsed.userEmail !== userEmail
      || !parsed.profile
      || typeof parsed.profile !== 'object'
    ) {
      return null;
    }

    if (
      parsed.profile.role !== 'admin'
      && parsed.profile.role !== 'manager'
      && parsed.profile.role !== 'viewer'
    ) {
      return null;
    }

    return {
      id: parsed.profile.id || userId,
      role: parsed.profile.role,
      display_name: parsed.profile.display_name || userEmail,
      avatar_url: parsed.profile.avatar_url || null,
    };
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string, userEmail: string, profile: UserProfile) {
  if (typeof window === 'undefined') return;

  const value: CachedProfileState = {
    userId,
    userEmail,
    profile,
  };

  window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(value));
}

function clearCachedProfile() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PROFILE_CACHE_KEY);
}

export function useAuth(): AuthState & {
  login: (email: string, password: string) => Promise<{ error?: string; notice?: string }>;
  register: (email: string, password: string) => Promise<{ error?: string; notice?: string }>;
  logout: () => Promise<void>;
} {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const userIdRef = useRef('');
  const userEmailRef = useRef('');
  const profileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    let isActive = true;
    let requestId = 0;

    async function applySession(
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'],
      options: { preferCache: boolean }
    ) {
      const nextRequestId = ++requestId;

      if (!isActive) return;

      const nextUserId = session?.user.id || '';
      const nextUserEmail = session?.user.email || '';

      const hasResolvedSameUser = Boolean(
        nextUserId
        && nextUserEmail
        && userIdRef.current === nextUserId
        && userEmailRef.current === nextUserEmail
        && profileRef.current
      );

      setUserId(nextUserId);
      setUserEmail(nextUserEmail);
      userIdRef.current = nextUserId;
      userEmailRef.current = nextUserEmail;

      if (!nextUserId || !nextUserEmail) {
        clearCachedProfile();
        setProfile(null);
        profileRef.current = null;
        setProfileReady(true);
        setReady(true);
        return;
      }

      const cachedProfile = options.preferCache
        ? readCachedProfile(nextUserId, nextUserEmail)
        : null;
      const initialProfile = cachedProfile || (hasResolvedSameUser ? profileRef.current : null);

      if (initialProfile) {
        setProfile(initialProfile);
        profileRef.current = initialProfile;
        setProfileReady(true);
        setReady(true);
      } else {
        setReady(false);
        setProfileReady(false);
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, role')
          .eq('id', nextUserId)
          .single();

        if (!isActive || nextRequestId !== requestId) return;

        const resolvedProfile = error
          ? fallbackProfile(nextUserId, nextUserEmail)
          : data as UserProfile;

        setProfile(resolvedProfile);
        profileRef.current = resolvedProfile;
        writeCachedProfile(nextUserId, nextUserEmail, resolvedProfile);
      } catch {
        if (!isActive || nextRequestId !== requestId) return;

        if (!initialProfile) {
          const resolvedProfile = fallbackProfile(nextUserId, nextUserEmail);
          setProfile(resolvedProfile);
          profileRef.current = resolvedProfile;
        }
      } finally {
        if (isActive && nextRequestId === requestId) {
          setProfileReady(true);
          setReady(true);
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session, { preferCache: true });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session, { preferCache: false });
    });

    return () => {
      isActive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) return { error: 'Введите email и пароль.' };
    if (trimmedPassword.length < 6) return { error: 'Пароль должен быть минимум 6 символов.' };

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPassword
    });

    if (error) return { error: error.message };

    if (!data.session) {
      return {
        notice: 'Данные приняты, но сессия не создана. Обычно это значит, что нужно подтвердить email в письме от Supabase.'
      };
    }

    return {};
  }

  async function register(email: string, password: string) {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) return { error: 'Введите email и пароль.' };
    if (trimmedPassword.length < 6) return { error: 'Пароль должен быть минимум 6 символов.' };

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: trimmedPassword
    });

    if (error) return { error: error.message };

    if (!data.session) {
      return {
        notice: 'Аккаунт создан, но Supabase ждёт подтверждение email. Проверь почту, затем вернись сюда и нажми "Войти". Для разработки можно отключить подтверждение в Supabase: Authentication → Providers → Email → Confirm email = off.'
      };
    }

    return {};
  }

  async function logout() {
    await supabase.auth.signOut();
    clearCachedProfile();
    setUserId('');
    setUserEmail('');
    setProfile(null);
  }

  return {
    ready,
    profileReady,
    userId,
    userEmail,
    profile,
    isAdmin: profile?.role === 'admin',
    isApproved: profile?.role === 'admin' || profile?.role === 'manager',
    login,
    register,
    logout
  };
}
