'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useSettings } from '../../hooks/useSettings';

type SmartCeilingPage = 'catalog' | 'estimates' | 'profile' | 'admin';

interface SmartCeilingAppProps {
  page: SmartCeilingPage;
}

function FullScreenLoader() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
      }}
    >
      <CircularProgress />
    </Box>
  );
}

const CartDrawer = dynamic(() => import('../../components/CartDrawer'));
const SettingsDrawer = dynamic(() => import('../../components/SettingsDrawer'));
const AdminPage = dynamic(() => import('../../screens/AdminPage'), { loading: () => <FullScreenLoader /> });
const CatalogPage = dynamic(() => import('../../screens/CatalogPage'), { loading: () => <FullScreenLoader /> });
const EstimatesPage = dynamic(() => import('../../screens/EstimatesPage'), { loading: () => <FullScreenLoader /> });
const LoginPage = dynamic(() => import('../../screens/LoginPage'), { loading: () => <FullScreenLoader /> });
const PendingAccessPage = dynamic(() => import('../../screens/PendingAccessPage'), { loading: () => <FullScreenLoader /> });
const ProfilePage = dynamic(() => import('../../screens/ProfilePage'), { loading: () => <FullScreenLoader /> });

export default function SmartCeilingApp({ page }: SmartCeilingAppProps) {
  const auth = useAuth();
  const settings = useSettings({
    userId: auth.userId,
    isAdmin: auth.isAdmin,
    profileReady: auth.profileReady,
  });
  const cart = useCart(settings.settings);
  const [search, setSearch] = useState('');
  const [catalogRefreshToggle, setCatalogRefreshToggle] = useState(0);

  // Сначала ждём auth и профиль. Пока они не готовы, нельзя надёжно решить,
  // какой экран нужно показать пользователю.
  if (!auth.ready) {
    return <FullScreenLoader />;
  }

  if (!auth.userEmail) {
    return (
      <LoginPage
        settings={settings.settings}
        onLogin={auth.login}
        onRegister={auth.register}
      />
    );
  }

  if (!auth.profileReady) {
    return <FullScreenLoader />;
  }

  if (!auth.isApproved) {
    return <PendingAccessPage auth={auth} settings={settings.settings} />;
  }

  function handleRefresh() {
    setCatalogRefreshToggle((previousValue) => previousValue + 1);
  }

  function renderPage() {
    if (page === 'estimates') {
      return <EstimatesPage auth={auth} settings={settings.settings} />;
    }

    if (page === 'profile') {
      return <ProfilePage auth={auth} />;
    }

    if (page === 'admin') {
      return <AdminPage auth={auth} />;
    }

    return (
      <CatalogPage
        auth={auth}
        settings={settings.settings}
        cart={cart.cart}
        onAddToCart={cart.addToCart}
        onRemoveFromCart={cart.removeFromCart}
        search={search}
        catalogRefreshToggle={catalogRefreshToggle}
      />
    );
  }

  return (
    <>
      <AppLayout
        auth={auth}
        settings={settings.settings}
        search={search}
        onSearchChange={setSearch}
        cartCount={cart.cartCount}
        onCartOpen={() => cart.setIsCartOpen(true)}
        onSettingsOpen={() => settings.setIsSettingsOpen(true)}
        onRefresh={handleRefresh}
      >
        {renderPage()}
      </AppLayout>

      {cart.isCartOpen && (
        <CartDrawer
          open={cart.isCartOpen}
          onClose={() => cart.setIsCartOpen(false)}
          userId={auth.userId}
          cartRows={cart.cartRows}
          cartCount={cart.cartCount}
          subtotal={cart.subtotal}
          settings={settings.settings}
          onAddToCart={cart.addToCart}
          onRemoveFromCart={cart.removeFromCart}
          onClearCart={cart.clearCart}
        />
      )}

      {settings.isSettingsOpen && (
        <SettingsDrawer
          open={settings.isSettingsOpen}
          onClose={() => settings.setIsSettingsOpen(false)}
          settings={settings.settings}
          onUpdate={settings.updateSettings}
          onAvatar={settings.handleAvatar}
          isAdmin={auth.isAdmin}
          onLogout={auth.logout}
          syncSource={settings.syncSource}
          syncError={settings.syncError}
        />
      )}
    </>
  );
}
