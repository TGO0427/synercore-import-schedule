// Route configuration mapping view names to URL paths
export const VIEW_ROUTES = {
  shipping:          '/shipping',
  dashboard:         '/dashboard',
  suppliers:         '/suppliers',
  workflow:          '/workflow',
  capacity:          '/capacity',
  stored:            '/stored',
  archives:          '/archives',
  rates:             '/rates',
  costing:           '/costing',
  'costing-requests': '/costing-requests',
  reports:           '/reports',
  'advanced-reports': '/advanced-reports',
  users:             '/users',
  audit:             '/audit',
};

// Reverse map: path -> view name
export const ROUTE_VIEWS = Object.fromEntries(
  Object.entries(VIEW_ROUTES).map(([view, path]) => [path, view])
);
