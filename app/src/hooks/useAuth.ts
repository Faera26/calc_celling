import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { AuthState, UserProfile } from '../types';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id || '');
      setUserEmail(data.session?.user.email || '');
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || '');
      setUserEmail(session?.user.email || '');
      setReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!userEmail || !userId) {
        setProfile(null);
        setProfileReady(true);
        return;
      }

      setProfileReady(false);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, role')
          .eq('id', userId)
          .single();

        if (error) {
          setProfile({ id: userId, role: 'viewer', display_name: userEmail });
          return;
        }

        setProfile(data as UserProfile);
      } catch {
        setProfile({ id: userId, role: 'viewer', display_name: userEmail });
        return;
      } finally {
        setProfileReady(true);
      }
    }

    loadProfile();
  }, [userEmail, userId]);

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
