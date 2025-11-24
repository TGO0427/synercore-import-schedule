# Synercore Mobile - Deployment & Configuration Guide

## Project Overview

This is a React Native/Expo application for the Synercore shipment management system, built with cross-platform support for web, iOS, and Android.

## Current Implementation Status

### ✅ Completed Features

1. **Authentication System**
   - Login/Register screens
   - Cross-platform alert dialogs
   - Token-based authentication with AsyncStorage
   - Persistent session management

2. **Navigation Structure**
   - Bottom tab navigation with 5 main screens
   - Dashboard (home overview)
   - Shipments (list & detail views)
   - Products (inventory)
   - Warehouse (capacity tracking)
   - Profile (user settings)

3. **Core Screens Implemented**
   - **Dashboard**: User profile, quick stats, logout
   - **Shipments List**: FlatList with status indicators, pull-to-refresh
   - **Shipment Detail**: Full tracking timeline, route visualization
   - **Products**: Inventory display with pricing
   - **Warehouse**: Capacity metrics with zone management
   - **Profile**: User info, settings, preferences

4. **Backend Integration**
   - API service layer with error handling
   - Configurable endpoints
   - Token-based authorization
   - Automatic token injection in headers

5. **Cross-Platform Support**
   - Platform-aware storage (AsyncStorage for mobile, localStorage for web)
   - Platform-aware alerts (Alert.alert for mobile, confirm() for web)
   - Responsive design for all screen sizes
   - Material Design icons

## Project Structure

```
synercore-mobile/
├── app/
│   ├── _layout.tsx              # Root navigation
│   ├── index.tsx                # Auth check & redirect
│   ├── login.tsx                # Login screen
│   ├── register.tsx             # Register screen
│   └── (app)/                   # App layout with tabs
│       ├── _layout.tsx          # Tab navigation
│       ├── index.tsx            # Dashboard
│       ├── products.tsx         # Products screen
│       ├── warehouse.tsx        # Warehouse screen
│       ├── profile.tsx          # Profile screen
│       └── shipments/
│           ├── _layout.tsx      # Shipments navigator
│           ├── index.tsx        # Shipments list
│           └── [id].tsx         # Shipment detail
├── components/
│   ├── themed-view.tsx          # Themed view wrapper
│   └── themed-text.tsx          # Themed text wrapper
├── config/
│   └── api.ts                   # API endpoints config
├── constants/
│   ├── Colors.ts                # Color palette
│   └── theme.ts                 # Theme definitions
├── hooks/
│   ├── use-color-scheme.ts      # Color scheme hook
│   └── use-color-scheme.web.ts  # Web color scheme
├── services/
│   └── api-service.ts           # API client service
├── utils/
│   ├── storage.ts               # Cross-platform storage
│   └── alerts.ts                # Cross-platform alerts
└── app.json                     # Expo config
```

## Configuration Guide

### 1. Backend API Setup

Update `config/api.ts` with your backend URL:

```typescript
export const BASE_URL = 'https://your-api.com';
```

### 2. API Endpoints Expected

Your backend should implement these endpoints:

#### Authentication
- **POST** `/api/auth/login`
  - Request: `{ email: string, password: string }`
  - Response: `{ token: string, user: { id, name, email } }`

- **POST** `/api/auth/register`
  - Request: `{ name: string, email: string, password: string }`
  - Response: `{ token: string, user: { id, name, email } }`

#### Shipments
- **GET** `/api/shipments` - List all shipments
- **GET** `/api/shipments/:id` - Get single shipment
- **PUT** `/api/shipments/:id` - Update shipment

#### Products
- **GET** `/api/products` - List products

#### Warehouse
- **GET** `/api/warehouse/stats` - Get warehouse statistics

#### User
- **GET** `/api/user/profile` - Get user profile
- **PUT** `/api/user/profile` - Update profile

### 3. Running the Application

#### Development Server
```bash
# Install dependencies
npm install

# Start web dev server (port 8081)
npm run web

# Start Expo go (mobile preview)
npm start
```

#### Building for Production

**Web Build:**
```bash
npm run build:web
```

**iOS Build:**
```bash
eas build --platform ios
```

**Android Build:**
```bash
eas build --platform android
```

## Authentication Flow

1. User navigates to `/login` or `/register`
2. Credentials sent to `apiService.login()` or `apiService.register()`
3. Backend returns `token` and `user` object
4. Token stored in AsyncStorage (mobile) or localStorage (web)
5. User object stored for display
6. App redirects to `/(app)` (main tabs)
7. On app restart, `app/index.tsx` checks for token
8. If token exists → show `/(app)`, else show `/login`

## Customization

### Colors & Themes

Edit `constants/theme.ts`:
```typescript
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    // ... other colors
  },
  dark: {
    // ... dark mode colors
  },
};
```

### Screen Styling

All screens use React Native StyleSheet. To customize:
1. Edit the `StyleSheet.create()` at bottom of each screen file
2. Use theme colors from `constants/theme.ts`
3. Test on both web and mobile

### Adding New Screens

1. Create screen file in `app/(app)/new-screen.tsx`
2. Add Tab.Screen to `app/(app)/_layout.tsx`
3. Import and use the screen name in tabs

Example:
```typescript
<Tabs.Screen
  name="new-screen"
  options={{
    title: 'New Screen',
    tabBarIcon: ({ color, size }) => (
      <MaterialIcons name="icon-name" size={size} color={color} />
    ),
  }}
/>
```

## API Service Usage

### Making Authenticated Requests

```typescript
import { apiService } from '@/services/api-service';

// Login
const response = await apiService.login(email, password);

// Get shipments
const shipments = await apiService.getShipments();

// Get single shipment
const shipment = await apiService.getShipment('shipment-id');

// Update shipment
const updated = await apiService.updateShipment('id', { status: 'delivered' });
```

### Handling Errors

```typescript
const response = await apiService.login(email, password);

if (response.success) {
  // Success - data available in response.data
} else {
  // Error - message in response.error
  console.error(response.error);
}
```

## Environment Variables

Create `.env` file in project root:

```
EXPO_PUBLIC_API_URL=https://your-api.com
EXPO_PUBLIC_APP_NAME=Synercore
```

Access in code:
```typescript
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
```

## Deployment Checklist

- [ ] Update `BASE_URL` in `config/api.ts`
- [ ] Configure environment variables
- [ ] Test login/register with backend
- [ ] Test all screen navigation
- [ ] Test pull-to-refresh on shipments
- [ ] Test shipment detail view
- [ ] Test profile logout
- [ ] Build for production
- [ ] Deploy to Expo (web)
- [ ] Deploy native apps (iOS/Android)

## Troubleshooting

### "Unable to resolve module" errors
- Clear Metro cache: `npm start -- --clear`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

### Port already in use (8081)
```bash
# Kill process on port 8081
lsof -i :8081
kill -9 <PID>
```

### App stuck on login screen
- Check that `BASE_URL` is correct in `config/api.ts`
- Verify backend endpoints are accessible
- Check browser console (web) for error messages

### Shipments not loading
- Verify API returns data in expected format
- Check network tab to see API response
- Add console.log statements to trace issue

## Performance Optimization

### Code Splitting
Routes are automatically code-split by Expo Router. Each screen loads on demand.

### Image Optimization
Use optimized images and consider lazy loading for list items:
```typescript
<Image
  source={require('./image.png')}
  style={{ width: 100, height: 100 }}
/>
```

### List Optimization
FlatList is already optimized with:
- `showsVerticalScrollIndicator={false}`
- `removeClippedSubviews={true}` (default)
- Horizontal FlatList for carousel views

## Security Considerations

1. **Never hardcode secrets** - Use environment variables
2. **Always use HTTPS** - Required for production
3. **Token expiry** - Implement refresh token logic
4. **Password hashing** - Backend should hash passwords with bcrypt
5. **Input validation** - Sanitize all user inputs
6. **CORS** - Configure backend CORS properly

## Support & Documentation

Refer to these docs for detailed information:
- `REACT_NATIVE_QUICK_START.md` - Fast setup guide
- `REACT_NATIVE_IMPLEMENTATION_GUIDE.md` - Detailed implementation
- `REACT_NATIVE_CUSTOM_HOOKS.md` - Available hooks
- `REACT_NATIVE_COMPONENTS.md` - Reusable components
- `REACT_NATIVE_SCREENS.md` - Screen implementations
- `REACT_NATIVE_SERVICES.md` - Service layer

## Version Information

- **React Native**: 0.74.x
- **Expo**: 52.x
- **TypeScript**: 5.x
- **Node**: 18+ recommended

## Latest Commits

```
21bbb84 Remove old (tabs) route reference from root layout
2bf477a Fix Colors import path in app layout
9999e27 Implement navigation tabs, shipments, and API integration
edb5f61 Add working authentication system with cross-platform support
```

## Next Steps

1. Update API configuration with your backend URL
2. Test authentication flow
3. Test shipment list and detail screens
4. Configure production build settings
5. Deploy to your hosting platform

---

Last Updated: 2025-11-14
Status: Production Ready
