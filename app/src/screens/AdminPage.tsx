import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon, ArrowOutward as ArrowOutwardIcon } from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import type { AuthState, UserProfile } from '../types';
import { APP_ROUTES } from '../features/app/navigation';
import { formatError } from '../utils';

interface AdminPageProps {
  auth: AuthState;
}

interface AdminUserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: UserProfile['role'];
  created_at: string | null;
  updated_at: string | null;
}

const roleLabels: Record<UserProfile['role'], string> = {
  admin: 'Администратор',
  manager: 'Подтверждён',
  viewer: 'Ждёт подтверждения',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function AdminPage({ auth }: AdminPageProps) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const pendingCount = useMemo(
    () => users.filter((user) => user.role === 'viewer').length,
    [users],
  );

  const loadUsers = useCallback(async () => {
    if (!auth.isAdmin) return;

    setLoading(true);
    setError('');

    const { data, error: loadError } = await supabase.rpc('admin_list_profiles');

    if (loadError) {
      setError(formatError(loadError));
      setUsers([]);
    } else {
      setUsers((data || []) as AdminUserRow[]);
    }

    setLoading(false);
  }, [auth.isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleRoleChange(userId: string, role: UserProfile['role']) {
    setSavingId(userId);
    setError('');

    const { error: saveError } = await supabase.rpc('set_user_role', {
      target_user_id: userId,
      target_role: role,
    });

    if (saveError) {
      setError(`Ошибка сохранения: ${formatError(saveError)}`);
    } else {
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)));
    }

    setSavingId('');
  }

  if (!auth.isAdmin) {
    return (
      <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
        <Alert severity="warning">
          Эта страница доступна только администратору.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1320, mx: 'auto' }}>
      <Box
        sx={{
          mb: 3,
          p: '1px',
          borderRadius: '32px',
          background: 'linear-gradient(140deg, rgba(11,92,173,0.18), rgba(35,156,140,0.12), rgba(255,255,255,0.8))',
        }}
      >
        <Box
          sx={{
            borderRadius: '31px',
            px: { xs: 2, md: 3 },
            py: { xs: 2.5, md: 3.25 },
            bgcolor: 'rgba(255,255,255,0.94)',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ alignItems: { lg: 'flex-end' }, justifyContent: 'space-between' }}>
            <Box sx={{ maxWidth: 760 }}>
              <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.6rem' }, fontWeight: 900, color: '#082B4C', lineHeight: 1 }}>
                Админка управления доступом и каталогом.
              </Typography>
              <Typography sx={{ mt: 1.5, color: 'rgba(8,43,76,0.68)', lineHeight: 1.7 }}>
                Здесь ты подтверждаешь пользователей и раздаёшь роли. Каталог теперь редактируется прямо в обычной кассе: открываешь карточку и меняешь товар без отдельной панели.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                variant="contained"
                component={Link}
                href={APP_ROUTES.catalog}
                endIcon={<ArrowOutwardIcon />}
                sx={{ borderRadius: '999px', px: 2.5, py: 1.15, textTransform: 'none' }}
              >
                Открыть каталог
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadUsers}
                disabled={loading}
                sx={{ borderRadius: '999px', px: 2.5, py: 1.15, textTransform: 'none' }}
              >
                Обновить
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ minWidth: 220, borderRadius: '24px' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Всего пользователей</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{users.length}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 220, borderRadius: '24px' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Ждут подтверждения</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{pendingCount}</Typography>
          </CardContent>
        </Card>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card sx={{ borderRadius: '28px' }}>
        <CardContent>
          {loading ? (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <CircularProgress size={22} />
              <Typography color="text.secondary">Загружаю пользователей...</Typography>
            </Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Пользователь</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Роль</TableCell>
                    <TableCell>Создан</TableCell>
                    <TableCell>ID</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }}>{user.email || user.display_name || 'Без email'}</Typography>
                        {user.display_name && user.display_name !== user.email && (
                          <Typography variant="body2" color="text.secondary">{user.display_name}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={roleLabels[user.role]}
                          color={user.role === 'viewer' ? 'warning' : user.role === 'admin' ? 'secondary' : 'success'}
                          variant={user.role === 'viewer' ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 220 }}>
                        <TextField
                          select
                          size="small"
                          value={user.role}
                          disabled={savingId === user.id}
                          onChange={(event) => void handleRoleChange(user.id, event.target.value as UserProfile['role'])}
                          fullWidth
                        >
                          <MenuItem value="viewer">Ждёт подтверждения</MenuItem>
                          <MenuItem value="manager">Подтверждён</MenuItem>
                          <MenuItem value="admin">Администратор</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {user.id}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
