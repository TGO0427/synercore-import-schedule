# React Native Mobile App Setup Guide

## Phase 1: React Native Implementation

This guide provides step-by-step instructions for setting up and developing the Synercore React Native mobile app for iOS and Android.

## Prerequisites

Before starting, ensure you have:

- **Node.js**: v18.0.0 or later
- **npm**: v9.0.0 or later
- **Expo CLI**: Latest version (`npm install -g expo-cli`)
- **Mobile Device or Emulator**:
  - **iOS**: Xcode and iOS Simulator (Mac only) OR physical iPhone
  - **Android**: Android Studio and Android Emulator OR physical Android device
  - **iOS**: TestFlight (beta testing) or Expo Go app
  - **Android**: Google Play (distribution) or Expo Go app

## Project Structure

```
synercore-mobile/
├── app/
│   ├── _layout.tsx              # Root navigation layout
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (app)/
│   │   ├── _layout.tsx          # Bottom tab navigation
│   │   ├── shipments/
│   │   │   ├── index.tsx
│   │   │   ├── [id].tsx         # Detail view
│   │   │   └── filter.tsx
│   │   ├── products/
│   │   │   └── index.tsx
│   │   ├── warehouse/
│   │   │   └── index.tsx
│   │   ├── reports/
│   │   │   └── index.tsx
│   │   ├── admin/
│   │   │   └── index.tsx
│   │   └── profile/
│   │       └── index.tsx
│   └── (modals)/
│       ├── status-update.tsx
│       └── quick-action.tsx
├── components/
│   ├── ShipmentCard.tsx
│   ├── ShipmentList.tsx
│   ├── StatusBadge.tsx
│   ├── FormModal.tsx
│   ├── LoadingSpinner.tsx
│   └── ErrorBoundary.tsx
├── screens/
│   ├── ShipmentsScreen.tsx
│   ├── ProductsScreen.tsx
│   ├── WarehouseScreen.tsx
│   ├── ReportsScreen.tsx
│   ├── AdminScreen.tsx
│   └── ProfileScreen.tsx
├── hooks/
│   ├── useShipments.ts
│   ├── useAuth.ts
│   ├── usePush.ts
│   └── useOfflineSync.ts
├── services/
│   ├── api.ts                   # API client configuration
│   ├── auth.ts                  # Authentication service
│   ├── storage.ts               # AsyncStorage wrapper
│   ├── notifications.ts         # Push notification service
│   └── sync.ts                  # Offline sync service
├── types/
│   ├── index.ts
│   ├── shipment.ts
│   ├── auth.ts
│   └── api.ts
├── utils/
│   ├── formatters.ts
│   ├── validators.ts
│   └── constants.ts
├── theme/
│   ├── colors.ts
│   ├── spacing.ts
│   └── typography.ts
├── app.json                      # Expo configuration
├── package.json
├── tsconfig.json
└── .env.example
```

## Step 1: Create React Native Project with Expo

```bash
# Create new Expo project with TypeScript
npx create-expo-app synercore-mobile --template
cd synercore-mobile

# Install Expo Router for navigation
npm install expo-router react-native-safe-area-context react-native-screens

# Install UI libraries
npm install @react-native-async-storage/async-storage
npm install react-native-gesture-handler react-native-reanimated
npm install @react-native-community/netinfo
npm install expo-notifications
npm install expo-secure-store
npm install axios
npm install zustand react-query
npm install date-fns
npm install react-native-svg
```

## Step 2: Setup TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["components/*"],
      "@screens/*": ["screens/*"],
      "@services/*": ["services/*"],
      "@hooks/*": ["hooks/*"],
      "@types/*": ["types/*"],
      "@utils/*": ["utils/*"],
      "@theme/*": ["theme/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

## Step 3: Configure Expo (app.json)

```json
{
  "expo": {
    "name": "Synercore",
    "slug": "synercore-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#003d82"
    },
    "updates": {
      "fallbackToCacheTimeout": 0
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTabletMode": true,
      "bundleIdentifier": "com.synercore.mobile",
      "buildNumber": "1.0.0"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#003d82"
      },
      "package": "com.synercore.mobile",
      "versionCode": 1
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#003d82",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ],
      [
        "expo-secure-store",
        {
          "faceIDPermission": "Allow $(PRODUCT_NAME) to unlock your shipments using Face ID."
        }
      ]
    ],
    "schemes": ["synercore"],
    "extra": {
      "router": {
        "origin": false
      }
    }
  }
}
```

## Step 4: Create Core Services

### Authentication Service (`services/auth.ts`)

```typescript
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

class AuthService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 10000
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use(async (config) => {
      const token = await this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  async login(email: string, password: string) {
    try {
      const response = await this.api.post('/auth/login', { email, password });
      const { token, user } = response.data;

      await SecureStore.setItemAsync('authToken', token);
      await SecureStore.setItemAsync('user', JSON.stringify(user));

      return { token, user };
    } catch (error) {
      throw error;
    }
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
  }) {
    try {
      const response = await this.api.post('/auth/register', userData);
      const { token, user } = response.data;

      await SecureStore.setItemAsync('authToken', token);
      await SecureStore.setItemAsync('user', JSON.stringify(user));

      return { token, user };
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    try {
      await this.api.post('/auth/logout');
    } finally {
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('user');
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('authToken');
    } catch (error) {
      return null;
    }
  }

  async getUser() {
    try {
      const userJson = await SecureStore.getItemAsync('user');
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      return null;
    }
  }

  async refreshToken() {
    try {
      const response = await this.api.post('/auth/refresh');
      const { token } = response.data;

      await SecureStore.setItemAsync('authToken', token);
      return token;
    } catch (error) {
      await this.logout();
      throw error;
    }
  }
}

export const authService = new AuthService();
```

### API Service (`services/api.ts`)

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import { authService } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 10000
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use(async (config) => {
      const token = await authService.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          try {
            await authService.refreshToken();
            return this.api.request(error.config!);
          } catch (refreshError) {
            await authService.logout();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Shipments
  async getShipments(filters?: Record<string, any>) {
    try {
      const response = await this.api.get('/shipments', { params: filters });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getShipment(id: string) {
    try {
      const response = await this.api.get(`/shipments/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateShipmentStatus(id: string, status: string, notes?: string) {
    try {
      const response = await this.api.put(`/shipments/${id}`, {
        status,
        notes
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async uploadDocument(shipmentId: string, document: FormData) {
    try {
      const response = await this.api.post(
        `/shipments/${shipmentId}/documents`,
        document,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Products
  async getProducts(filters?: Record<string, any>) {
    try {
      const response = await this.api.get('/products', { params: filters });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Reports
  async getReports(type: string, filters?: Record<string, any>) {
    try {
      const response = await this.api.get(`/reports/${type}`, {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Warehouse
  async getWarehouseStatus() {
    try {
      const response = await this.api.get('/warehouse/status');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any) {
    if (error.response) {
      return new Error(
        error.response.data?.message || 'An error occurred'
      );
    }
    return new Error('Network error. Please check your connection.');
  }
}

export const apiService = new ApiService();
```

## Step 5: Environment Configuration

```bash
# .env.example
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_APP_NAME=Synercore
EXPO_PUBLIC_VERSION=1.0.0
```

## Step 6: Running the App

### Development

```bash
# Start Expo development server
npm start

# Run on iOS Simulator (Mac only)
npm run ios

# Run on Android Emulator
npm run android

# Run on physical device via Expo Go
# Scan QR code with Expo Go app
```

### Testing

```bash
# Install testing dependencies
npm install --save-dev jest @testing-library/react-native

# Run tests
npm test
```

### Build for Production

```bash
# Build for iOS (requires Apple Developer account)
eas build --platform ios

# Build for Android
eas build --platform android

# Build both platforms
eas build
```

## Step 7: Code Formatting and Linting

```bash
# Install dev dependencies
npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-react-native

# Create .eslintrc.json
# Create .prettierrc.json

# Format code
npm run format

# Lint code
npm run lint
```

## Features to Implement

### Phase 1a: Core Features (Weeks 1-2)
- [ ] Authentication (Login/Register)
- [ ] Shipment list and detail views
- [ ] Real-time updates via WebSocket
- [ ] Offline sync capability
- [ ] Push notifications

### Phase 1b: Advanced Features (Weeks 3-4)
- [ ] Status update functionality
- [ ] Document upload and download
- [ ] Advanced filtering and search
- [ ] Export functionality
- [ ] User preferences and settings

### Phase 1c: Performance & Polish (Week 5)
- [ ] App performance optimization
- [ ] Testing (unit, integration, e2e)
- [ ] Error handling and logging
- [ ] App Store and Play Store submission

## API Integration Strategy

All API endpoints are configured in `services/api.ts` with automatic token refresh and error handling.

```typescript
// Example usage in components
const { data, isLoading, error } = useQuery(
  ['shipments'],
  () => apiService.getShipments()
);
```

## State Management (Zustand)

```typescript
// Example store
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  token: string | null;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  logout: () => set({ user: null, token: null })
}));
```

## Navigation Structure

The app uses Expo Router for file-based routing:

```
/                           # Root
├── (auth)                  # Auth tab (login, register)
│   ├── login
│   ├── register
│   └── forgot-password
├── (app)                   # Main app (bottom tabs)
│   ├── shipments
│   │   ├── index
│   │   └── [id]           # Detail view
│   ├── products
│   ├── warehouse
│   ├── reports
│   ├── admin
│   └── profile
└── (modals)                # Modal routes
    ├── status-update
    └── quick-action
```

## Deployment Process

### iOS (TestFlight)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for TestFlight
eas build --platform ios --auto-submit

# View builds
eas build:list
```

### Android (Google Play)

```bash
# Build for Google Play
eas build --platform android

# Submit to Play Store
eas submit --platform android
```

## Performance Optimization Tips

1. **Code Splitting**: Use dynamic imports
2. **Image Optimization**: Use optimized image formats
3. **Lazy Loading**: Lazy load screens and components
4. **Caching**: Implement smart cache strategies
5. **Network**: Use request batching and debouncing

## Common Troubleshooting

| Issue | Solution |
|-------|----------|
| "Metro Bundler" errors | Clear cache: `expo start --clear` |
| Emulator won't start | Check Android Studio configuration |
| Build fails on iOS | Run `eas build:list` to check build status |
| API calls timeout | Check network connectivity, increase timeout |
| Notifications not working | Verify service configuration in app.json |

## Next Steps

1. Complete Step 1-7 above
2. Start implementing screens and components
3. Integrate with API backend
4. Implement offline functionality
5. Add push notifications
6. Test thoroughly on devices
7. Submit to app stores

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router Guide](https://docs.expo.dev/routing/introduction/)
- [TypeScript in React Native](https://reactnative.dev/docs/typescript)
- [Testing React Native](https://reactnative.dev/docs/testing-overview)

---

**Status**: Phase 1 - Setup & Planning
**Estimated Duration**: 4-5 weeks
**Team Size**: 1-2 developers
**Last Updated**: 2025-11-14
