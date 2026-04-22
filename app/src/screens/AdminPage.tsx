import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import type { AuthState, UserProfile } from '../types';
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
    () => users.filter(user => user.role === 'viewer').length,
    [users]
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
    loadUsers();
  }, [loadUsers]);

  async function handleRoleChange(userId: string, role: UserProfile['role']) {
    setSavingId(userId);
    setError('');

    const { error: saveError } = await supabase.rpc('set_user_role', {
      target_user_id: userId,
      target_role: role,
    });

    if (saveError) {
      console.error('Error setting role:', saveError);
      setError(`Ошибка сохранения: ${saveError.message || JSON.stringify(saveError)}`);
    } else {
      setUsers(prev => prev.map(user => user.id === userId ? { ...user, role } : user));
      const user = users.find(u => u.id === userId);
      const name = user?.display_name || user?.email || 'Пользователь';
      alert(`Роль для ${name} успешно изменена на ${role}`);
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
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4">Админка</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Подтверждай пользователей и закрывай доступ тем, кому каталог больше не нужен.
          </Typography>
        </Box>

        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadUsers} disabled={loading}>
          Обновить
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ minWidth: 220 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Всего пользователей</Typography>
            <Typography variant="h4">{users.length}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 220 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Ждут подтверждения</Typography>
            <Typography variant="h4">{pendingCount}</Typography>
          </CardContent>
        </Card>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
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
                  {users.map(user => (
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
                          onChange={(event) => handleRoleChange(user.id, event.target.value as UserProfile['role'])}
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
