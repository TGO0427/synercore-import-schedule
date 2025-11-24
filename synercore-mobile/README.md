# Synercore Mobile App

A production-ready React Native/Expo application for shipment management with cross-platform support (Web, iOS, Android).

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run web          # Web on http://localhost:8081
npm start            # Expo Go (for mobile testing)
```

## Features

✅ **Authentication**
- Login/Register with email & password
- Token-based auth with JWT
- Persistent session management

✅ **Navigation**
- Bottom tab navigation
- 5 main screens (Dashboard, Shipments, Products, Warehouse, Profile)
- Smooth screen transitions

✅ **Shipment Tracking**
- List view with status indicators
- Detail view with tracking timeline
- Pull-to-refresh functionality
- Origin/destination route visualization

✅ **Inventory Management**
- Product catalog display
- Warehouse capacity tracking
- Zone-based storage management

✅ **User Management**
- Profile display
- Settings preferences
- Logout functionality

✅ **Cross-Platform**
- Works on Web, iOS, and Android
- Responsive design
- Material Design UI

## Project Structure

```
app/                    # Expo Router pages
├── _layout.tsx        # Root navigation
├── index.tsx          # Auth redirect
├── login.tsx          # Login screen
├── register.tsx       # Register screen
└── (app)/             # Main app with tabs
    ├── index.tsx      # Dashboard
    ├── products.tsx   # Products
    ├── warehouse.tsx  # Warehouse
    ├── profile.tsx    # Profile
    └── shipments/     # Shipments feature

components/            # Reusable UI components
config/               # Configuration
services/             # API client
utils/                # Utilities (storage, alerts)
constants/            # Theme & colors
hooks/                # Custom React hooks
```

## API Configuration

Update `config/api.ts` with your backend URL:

```typescript
export const BASE_URL = 'https://your-api.com';
```

Expected response format for login/register:
```json
{
  "token": "jwt-token-string",
  "user": {
    "id": "user-id",
    "name": "User Name",
    "email": "user@example.com"
  }
}
```

## Available Scripts

```bash
npm run web           # Start web dev server
npm start             # Start Expo Go
npm run build:web     # Build for web
npm run test          # Run tests
npm run lint          # Run linter
```

## Building for Production

### Web
```bash
npm run build:web
```

### iOS/Android
```bash
# Requires Expo Paid Account
eas build --platform ios
eas build --platform android
```

## Documentation

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Full deployment instructions
- [../REACT_NATIVE_QUICK_START.md](../REACT_NATIVE_QUICK_START.md) - Quick setup
- [../REACT_NATIVE_IMPLEMENTATION_GUIDE.md](../REACT_NATIVE_IMPLEMENTATION_GUIDE.md) - Implementation details
- [../REACT_NATIVE_COMPONENTS.md](../REACT_NATIVE_COMPONENTS.md) - Component library
- [../REACT_NATIVE_CUSTOM_HOOKS.md](../REACT_NATIVE_CUSTOM_HOOKS.md) - Custom hooks

## Authentication Flow

1. User enters credentials on login/register screen
2. API call to backend (`POST /api/auth/login` or `POST /api/auth/register`)
3. Backend returns token and user data
4. Token stored in secure storage
5. User redirected to main app (Dashboard)
6. On app restart, auth check loads previous session

## Technologies

- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform
- **Expo Router** - File-based routing
- **TypeScript** - Type safety
- **React Navigation** - Navigation library
- **AsyncStorage** - Secure storage (mobile)
- **Material Design Icons** - UI icons

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Performance

- Code splitting by route
- Lazy loading of screens
- Optimized list rendering
- Efficient state management

## Security

- HTTPS only for production
- Token-based authentication
- Secure token storage
- Input validation
- CORS configuration

## Troubleshooting

### Port already in use
```bash
# Kill process on port 8081
lsof -i :8081 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Clear cache
```bash
npm start -- --clear
```

### Reinstall dependencies
```bash
rm -rf node_modules && npm install
```

## Support

For issues or questions:
1. Check the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
2. Review the troubleshooting section
3. Check Expo documentation: https://docs.expo.dev

## License

All rights reserved © 2025 Synercore

## Version

Current: 1.0.0
Last Updated: 2025-11-14
Status: Production Ready

---

**Next Steps:**
1. Update `config/api.ts` with your backend URL
2. Run `npm install`
3. Test with `npm run web`
4. Build for production
