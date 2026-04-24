'use client';

import { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import AppLayout from '../../components/AppLayout';
import CartDrawer from '../../components/CartDrawer';
import SettingsDrawer from '../../components/SettingsDrawer';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useSettings } from '../../hooks/useSettings';
import AdminPage from '../../screens/AdminPage';
import CatalogPage from '../../screens/CatalogPage';
import CatalogManagerPage from '../../screens/CatalogManagerPage';
import EstimatesPage from '../../screens/EstimatesPage';
import HomePage from '../../screens/HomePage';
import LoginPage from '../../screens/LoginPage';
import PendingAccessPage from '../../screens/PendingAccessPage';
import ProfilePage from '../../screens/ProfilePage';
import type { CatalogType } from '../../types';

type SmartCeilingPage = 'home' | 'catalog' | 'catalog-manager' | 'estimates' | 'profile' | 'admin';

interface SmartCeilingAppProps {
  page: SmartCeilingPage;
  catalogType?: CatalogType;
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

export default function SmartCeilingApp({ page, catalogType = 'tovar' }: SmartCeilingAppProps) {
  const auth = useAuth();
  const settings = useSettings({
    userId: auth.userId,
    isAdmin: auth.isAdmin,
    profileReady: auth.profileReady,
  });
  const cart = useCart(settings.settings);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogManagerSearch, setCatalogManagerSearch] = useState('');
  const [catalogRefreshToggle, setCatalogRefreshToggle] = useState(0);
  const activeSearch = page === 'catalog-manager' ? catalogManagerSearch : catalogSearch;
  const setActiveSearch = page === 'catalog-manager' ? setCatalogManagerSearch : setCatalogSearch;

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
    if (page === 'home') {
      return <HomePage auth={auth} settings={settings.settings} />;
    }

    if (page === 'estimates') {
      return <EstimatesPage auth={auth} settings={settings.settings} />;
    }

    if (page === 'profile') {
      return <ProfilePage auth={auth} />;
    }

    if (page === 'admin') {
      return <AdminPage auth={auth} />;
    }

    if (page === 'catalog-manager') {
      return (
        <CatalogManagerPage
          auth={auth}
          settings={settings.settings}
          search={catalogManagerSearch}
          onSearchChange={setCatalogManagerSearch}
          catalogRefreshToggle={catalogRefreshToggle}
        />
      );
    }

    return (
      <CatalogPage
        auth={auth}
        settings={settings.settings}
        cart={cart.cart}
        initialType={catalogType}
        onAddToCart={cart.addToCart}
        onRemoveFromCart={cart.removeFromCart}
        search={catalogSearch}
        onSearchChange={setCatalogSearch}
        catalogRefreshToggle={catalogRefreshToggle}
      />
    );
  }

  return (
    <>
      <AppLayout
        auth={auth}
        settings={settings.settings}
        search={activeSearch}
        onSearchChange={setActiveSearch}
        cartCount={cart.cartCount}
        onCartOpen={() => cart.setIsCartOpen(true)}
        onSettingsOpen={() => settings.setIsSettingsOpen(true)}
        onRefresh={handleRefresh}
        searchEnabled={page === 'catalog' || page === 'catalog-manager'}
        searchPlaceholder={page === 'catalog-manager' ? 'Поиск по админскому каталогу...' : 'Поиск по каталогу...'}
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
