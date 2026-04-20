import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CompanySettings } from '../types';

interface LoginPageProps {
  settings: CompanySettings;
  onLogin: (email: string, password: string) => Promise<{ error?: string; notice?: string }>;
  onRegister: (email: string, password: string) => Promise<{ error?: string; notice?: string }>;
}

export default function LoginPage({ settings, onLogin, onRegister }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleAuth(action: 'login' | 'register') {
    setError('');
    setNotice('');
    setBusy(true);

    try {
      const res = action === 'login' 
        ? await onLogin(email, password)
        : await onRegister(email, password);
        
      if (res.error) setError(res.error);
      if (res.notice) setNotice(res.notice);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'background.default', p: 3 }}>
      <Card sx={{ maxWidth: 440, width: '100%' }}>
        <CardContent>
          <Stack spacing={2}>
            <Avatar src={settings.avatarDataUrl || undefined} sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
              {settings.companyName.slice(0, 1)}
            </Avatar>
            <Box>
              <Typography variant="h4">Вход в каталог</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Ассортимент, цены, услуги и узлы доступны после входа и подтверждения администратором.
              </Typography>
            </Box>
            <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <TextField label="Пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            {error && <Alert severity="error">{error}</Alert>}
            {notice && <Alert severity="info">{notice}</Alert>}
            <Alert severity="info">
              После регистрации аккаунт попадёт на подтверждение. Доступ к каталогу выдаёт администратор.
            </Alert>
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="outlined" disabled={busy} onClick={() => handleAuth('register')}>
                {busy ? 'Ждём...' : 'Регистрация'}
              </Button>
              <Button fullWidth variant="contained" disabled={busy} onClick={() => handleAuth('login')}>
                {busy ? 'Ждём...' : 'Войти'}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
