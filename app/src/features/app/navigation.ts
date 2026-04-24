export const APP_ROUTES = {
  home: '/',
  catalog: '/catalog',
  estimates: '/estimates',
  profile: '/profile',
  admin: '/admin',
  catalogManager: '/admin/catalog',
  catalogProducts: '/catalog/tovary',
  catalogServices: '/catalog/uslugi',
  catalogNodes: '/catalog/uzly',
} as const;

export type AppRoute = typeof APP_ROUTES[keyof typeof APP_ROUTES];

export interface AppNavItem {
  href: AppRoute;
  label: string;
  adminOnly?: boolean;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: APP_ROUTES.home, label: 'Главная' },
  { href: APP_ROUTES.catalog, label: 'Каталог' },
  { href: APP_ROUTES.estimates, label: 'Сметы' },
  { href: APP_ROUTES.profile, label: 'Профиль' },
  { href: APP_ROUTES.admin, label: 'Админка', adminOnly: true },
];
