'use client';

import { CssBaseline, ThemeProvider } from '@mui/material';
import type { ReactNode } from 'react';
import theme from '../theme';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
