import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import type { AuthState, CompanySettings } from '../types';

interface PendingAccessPageProps {
  auth: AuthState & { logout: () => Promise<void> };
  settings: CompanySettings;
}

export default function PendingAccessPage({ auth, settings }: PendingAccessPageProps) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'background.default', p: 3 }}>
      <Card sx={{ maxWidth: 520, width: '100%' }}>
        <CardContent>
          <Stack spacing={2}>
            <Avatar src={settings.avatarDataUrl || undefined} sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
              {settings.companyName.slice(0, 1)}
            </Avatar>

            <Box>
              <Typography variant="h4">Доступ ожидает подтверждения</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Аккаунт вошёл в систему, но каталог открывается только после утверждения администратором.
              </Typography>
            </Box>

            <Alert severity="info">
              Текущий email: {auth.userEmail}. Администратор должен назначить роль `manager` или `admin`.
            </Alert>

            <Button variant="outlined" onClick={auth.logout}>
              Выйти
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
