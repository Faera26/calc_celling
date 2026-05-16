'use client';

import { useEffect } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        bgcolor: '#f4f7fb',
      }}
    >
      <Stack spacing={2} sx={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Приложение споткнулось
        </Typography>
        <Typography color="text.secondary">
          Попробуйте открыть экран заново. Если ошибка была из-за старого кэша после обновления, это обычно чинится сразу.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" onClick={() => reset()} sx={{ minHeight: 48, flex: 1 }}>
            Повторить
          </Button>
          <Button variant="outlined" onClick={() => window.location.reload()} sx={{ minHeight: 48, flex: 1 }}>
            Перезагрузить
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
