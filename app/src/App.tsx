import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './hooks/useAuth';
import { useSettings } from './hooks/useSettings';
import { useCart } from './hooks/useCart';

import AppLayout from './components/AppLayout';
import CartDrawer from './components/CartDrawer';
import SettingsDrawer from './components/SettingsDrawer';

import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/CatalogPage';
import EstimatesPage from './pages/EstimatesPage';
import ProfilePage from './pages/ProfilePage';
import PendingAccessPage from './pages/PendingAccessPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const auth = useAuth();
  const settingsHook = useSettings();
  const cartHook = useCart(settingsHook.settings);

  const [search, setSearch] = useState('');
  const [catalogRefreshToggle, setCatalogRefreshToggle] = useState(0);
  const [loadError, setLoadError] = useState('');

  if (!auth.ready) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!auth.userEmail) {
    return (
      <LoginPage 
        settings={settingsHook.settings} 
        onLogin={auth.login} 
        onRegister={auth.register} 
      />
    );
  }

  if (!auth.profileReady) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!auth.isApproved) {
    return (
      <PendingAccessPage
        auth={auth}
        settings={settingsHook.settings}
      />
    );
  }

  function handleRefresh() {
    setCatalogRefreshToggle(prev => prev + 1);
  }

  return (
    <>
      <Routes>
        <Route 
          element={
            <AppLayout
              auth={auth}
              settings={settingsHook.settings}
              search={search}
              onSearchChange={setSearch}
              cartCount={cartHook.cartCount}
              onCartOpen={() => cartHook.setIsCartOpen(true)}
              onSettingsOpen={() => settingsHook.setIsSettingsOpen(true)}
              onRefresh={handleRefresh}
              loadError={loadError}
              onClearError={() => setLoadError('')}
            />
          }
        >
          <Route 
            index 
            element={
              <CatalogPage 
                auth={auth} 
                settings={settingsHook.settings}
                cart={cartHook.cart}
                onAddToCart={cartHook.addToCart}
                onRemoveFromCart={cartHook.removeFromCart}
                search={search}
                catalogRefreshToggle={catalogRefreshToggle}
                onClearError={() => setLoadError('')}
              />
            } 
          />
          <Route path="estimates" element={<EstimatesPage auth={auth} settings={settingsHook.settings} />} />
          <Route path="profile" element={<ProfilePage auth={auth} />} />
          <Route path="admin" element={<AdminPage auth={auth} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      <CartDrawer
        open={cartHook.isCartOpen}
        onClose={() => cartHook.setIsCartOpen(false)}
        userId={auth.userId}
        cartRows={cartHook.cartRows}
        cartCount={cartHook.cartCount}
        subtotal={cartHook.subtotal}
        settings={settingsHook.settings}
        onAddToCart={cartHook.addToCart}
        onRemoveFromCart={cartHook.removeFromCart}
        onClearCart={cartHook.clearCart}
      />

      <SettingsDrawer
        open={settingsHook.isSettingsOpen}
        onClose={() => settingsHook.setIsSettingsOpen(false)}
        settings={settingsHook.settings}
        onUpdate={settingsHook.updateSettings}
        onAvatar={settingsHook.handleAvatar}
      />
    </>
  );
}
