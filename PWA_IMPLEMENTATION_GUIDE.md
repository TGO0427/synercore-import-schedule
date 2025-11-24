# Progressive Web App (PWA) Implementation Guide

## Phase 3: Convert Existing Web App to PWA

This guide covers converting the Synercore web app into a fully-featured Progressive Web App with offline support, push notifications, and installability.

## What is a PWA?

A Progressive Web App is a web application that uses modern web capabilities to deliver an app-like experience. Key features:

- **Installable**: Can be installed on home screen
- **Works Offline**: Functions without internet connection
- **Push Notifications**: Send updates to users
- **Fast**: Pre-caches assets for instant loading
- **Responsive**: Works on all devices
- **Secure**: Served over HTTPS

## Implementation Steps

### Step 1: Service Worker Setup

Create a service worker file to handle offline functionality and caching.

```typescript
// public/sw.js
const CACHE_NAME = 'synercore-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/js/main.js',
  '/styles/mobile.css',
  '/manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Cache-first for static assets
  if (request.destination === 'image' ||
      request.destination === 'font' ||
      request.url.endsWith('.css') ||
      request.url.endsWith('.js')) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((response) => {
          // Cache new responses
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for API calls and HTML
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful API responses
        if (response.status === 200) {
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(request).then((response) => {
          return response || new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  try {
    const pending = await getPendingActions();
    for (const action of pending) {
      try {
        await executePendingAction(action);
        await removePendingAction(action.id);
      } catch (error) {
        console.error('Failed to sync action:', error);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'notification',
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Synercore', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
```

### Step 2: Web Manifest

Create a manifest file for app metadata and installation.

```json
// public/manifest.json
{
  "name": "Synercore Supply Chain Management",
  "short_name": "Synercore",
  "description": "Supply chain shipment tracking and management system",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#ffffff",
  "theme_color": "#003d82",
  "icons": [
    {
      "src": "/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshot-540x720.png",
      "sizes": "540x720",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshot-1280x720.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    }
  ],
  "shortcuts": [
    {
      "name": "View Shipments",
      "short_name": "Shipments",
      "description": "View all shipments",
      "url": "/shipments",
      "icons": [
        {
          "src": "/icon-192x192.png",
          "sizes": "192x192"
        }
      ]
    },
    {
      "name": "View Reports",
      "short_name": "Reports",
      "description": "View reports and analytics",
      "url": "/reports",
      "icons": [
        {
          "src": "/icon-192x192.png",
          "sizes": "192x192"
        }
      ]
    }
  ],
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        {
          "name": "file",
          "accept": ["image/*", "application/pdf"]
        }
      ]
    }
  }
}
```

### Step 3: Update HTML Head

Add manifest and service worker registration to your main HTML file.

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#003d82" />
  <meta name="description" content="Supply chain shipment tracking and management system" />

  <!-- PWA Manifest -->
  <link rel="manifest" href="/manifest.json" />

  <!-- App Icons -->
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
  <link rel="apple-touch-icon" href="/icon-180x180.png" />
  <link rel="shortcut icon" href="/favicon.ico" />

  <!-- Web App Meta Tags -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Synercore" />

  <title>Synercore</title>

  <!-- Stylesheets -->
  <link rel="stylesheet" href="/styles/main.css" />
  <link rel="stylesheet" href="/styles/mobile.css" />
</head>
<body>
  <div id="root"></div>

  <script type="module" src="/src/main.jsx"></script>

  <!-- Service Worker Registration -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered:', registration);
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }

    // Check for app updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Prompt user to reload for updates
        console.log('App updated. Reload to get the latest version.');
      });
    }

    // Handle install prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      // Show install button to user
      const installBtn = document.getElementById('install-btn');
      if (installBtn) {
        installBtn.style.display = 'block';
        installBtn.addEventListener('click', () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
              if (choiceResult.outcome === 'accepted') {
                console.log('App installed');
              }
              deferredPrompt = null;
              installBtn.style.display = 'none';
            });
          }
        });
      }
    });

    window.addEventListener('appinstalled', () => {
      console.log('App was installed');
      deferredPrompt = null;
    });
  </script>
</body>
</html>
```

### Step 4: Implement Offline Storage

Create a utility for managing offline data with IndexedDB.

```typescript
// src/utils/offlineStorage.ts
interface StorageItem {
  key: string;
  value: any;
  timestamp: number;
  ttl?: number;
}

class OfflineStorage {
  private dbName = 'synercore-offline';
  private storeName = 'data';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async set(key: string, value: any, ttlMs?: number): Promise<void> {
    if (!this.db) await this.init();

    const item: StorageItem = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttlMs
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async get(key: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const item = request.result as StorageItem | undefined;

        if (!item) {
          resolve(null);
          return;
        }

        // Check if expired
        if (item.ttl && Date.now() - item.timestamp > item.ttl) {
          this.remove(key).catch(console.error);
          resolve(null);
          return;
        }

        resolve(item.value);
      };
    });
  }

  async remove(key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const offlineStorage = new OfflineStorage();
```

### Step 5: Implement Offline Queue

Create a service for queuing actions while offline.

```typescript
// src/services/offlineQueue.ts
import { offlineStorage } from '../utils/offlineStorage';

interface QueuedAction {
  id: string;
  type: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  private queueKey = 'offline-queue';
  private maxRetries = 5;

  async add(
    type: string,
    endpoint: string,
    method: string = 'POST',
    data?: any
  ): Promise<QueuedAction> {
    const queue = await this.getQueue();
    const action: QueuedAction = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      endpoint,
      method: method as any,
      data,
      timestamp: Date.now(),
      retries: 0
    };

    queue.push(action);
    await offlineStorage.set(this.queueKey, queue);

    return action;
  }

  async getQueue(): Promise<QueuedAction[]> {
    const queue = await offlineStorage.get(this.queueKey);
    return queue || [];
  }

  async remove(id: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(a => a.id !== id);
    await offlineStorage.set(this.queueKey, filtered);
  }

  async updateRetries(id: string, retries: number): Promise<void> {
    const queue = await this.getQueue();
    const action = queue.find(a => a.id === id);
    if (action) {
      action.retries = retries;
      await offlineStorage.set(this.queueKey, queue);
    }
  }

  async process(): Promise<void> {
    const queue = await this.getQueue();

    for (const action of queue) {
      if (action.retries >= this.maxRetries) {
        // Remove action after max retries
        await this.remove(action.id);
        continue;
      }

      try {
        const response = await fetch(action.endpoint, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: action.data ? JSON.stringify(action.data) : undefined
        });

        if (response.ok) {
          await this.remove(action.id);
        } else {
          await this.updateRetries(action.id, action.retries + 1);
        }
      } catch (error) {
        await this.updateRetries(action.id, action.retries + 1);
      }
    }
  }
}

export const offlineQueue = new OfflineQueue();
```

### Step 6: React Hook for Offline Support

```typescript
// src/hooks/useOffline.ts
import { useState, useEffect } from 'react';
import { offlineQueue } from '../services/offlineQueue';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Process offline queue when coming back online
      await offlineQueue.process();
      await updateQueueCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update queue count periodically
    const interval = setInterval(updateQueueCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const updateQueueCount = async () => {
    const queue = await offlineQueue.getQueue();
    setQueuedCount(queue.length);
  };

  const processQueue = async () => {
    await offlineQueue.process();
    await updateQueueCount();
  };

  return {
    isOnline,
    queuedCount,
    processQueue
  };
}
```

## Performance Optimization

### 1. Lazy Load Routes

```typescript
// src/App.jsx
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from './components/LoadingSpinner';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Shipments = lazy(() => import('./pages/Shipments'));
const Reports = lazy(() => import('./pages/Reports'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {/* Routes */}
    </Suspense>
  );
}
```

### 2. Code Splitting with Vite

```typescript
// vite.config.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          components: ['./src/components'],
          pages: ['./src/pages']
        }
      }
    }
  }
});
```

## Testing PWA Features

### Testing Offline Functionality

```bash
# 1. Open DevTools (F12)
# 2. Go to Application > Service Workers
# 3. Check "Offline" checkbox
# 4. Navigate app - it should still work

# 5. Test offline queue
# - Make changes while offline
# - Go online
# - Changes should sync automatically
```

### Testing Installation

```bash
# Chrome:
# 1. Open DevTools
# 2. Go to Application > Manifest
# 3. Click "Add to homescreen" link

# Android:
# 1. Browser menu > Install app

# iOS:
# 1. Share > Add to Home Screen
```

## Deployment Checklist

- [ ] HTTPS enabled (PWAs require HTTPS)
- [ ] Service Worker registered successfully
- [ ] Manifest.json is valid
- [ ] App icons are provided (all sizes)
- [ ] Offline page works
- [ ] Push notifications configured
- [ ] Background sync implemented
- [ ] Performance metrics good (LCP < 2.5s)
- [ ] Lighthouse score > 90
- [ ] Tested on multiple devices

## Lighthouse Score Improvement

Run Lighthouse audit in Chrome DevTools:

```
Target Scores:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 95
- PWA: Complete
```

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Service Workers | ✅ | ✅ | ✅ (iOS 11.3+) | ✅ |
| Web App Manifest | ✅ | ✅ | ❌ | ✅ |
| Push Notifications | ✅ | ✅ | ❌ | ✅ |
| Background Sync | ✅ | ❌ | ❌ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Installability | ✅ | ✅ | ✅ (iOS 15.1+) | ✅ |

## Next Steps

1. Set up HTTPS (required for PWA)
2. Implement service worker
3. Create manifest.json
4. Test offline functionality
5. Configure push notifications
6. Optimize performance
7. Test on devices
8. Deploy to production

## Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev PWA Course](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

**Status**: Phase 3 - PWA Implementation
**Estimated Duration**: 2-3 weeks
**Last Updated**: 2025-11-14
