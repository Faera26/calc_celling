import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { AuthState } from '../types';

interface ProfilePageProps {
  auth: AuthState;
}

export default function ProfilePage({ auth }: ProfilePageProps) {
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Профиль</Typography>
      
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">Email</Typography>
              <Typography variant="h6">{auth.userEmail}</Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Роль в системе</Typography>
              <Chip 
                label={auth.isAdmin ? 'Администратор' : auth.profile?.role === 'manager' ? 'Менеджер' : 'Только просмотр'} 
                color={auth.isAdmin ? 'secondary' : 'default'}
                variant={auth.isAdmin ? 'filled' : 'outlined'}
              />
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Доступ к каталогу</Typography>
              <Chip
                label={auth.isApproved ? 'Подтверждён' : 'Ожидает подтверждения'}
                color={auth.isApproved ? 'success' : 'warning'}
                variant={auth.isApproved ? 'filled' : 'outlined'}
              />
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">ID пользователя</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{auth.userId}</Typography>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              Управление доступом теперь вынесено в админку. Следующим этапом добавим историю смет,
              профиль компании и аккуратное коммерческое предложение.
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
