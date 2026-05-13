import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Providers from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

export const metadata: Metadata = {
  applicationName: 'SmartCeiling',
  title: 'SmartCeiling',
  description: 'Калькулятор натяжных потолков с каталогом, сметами и административной панелью.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'SmartCeiling',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
