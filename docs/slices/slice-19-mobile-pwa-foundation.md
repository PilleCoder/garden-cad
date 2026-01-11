# Slice 19: Mobile PWA Foundation

## User Value

As a user, I need the application to work as a Progressive Web App on mobile devices, so that I can install it on my phone, use it offline in the field, and access it quickly without browser chrome, making on-site garden measurements and planning seamless.

## Slice Features

1. **Service Worker** - Cache assets for offline functionality
2. **Web App Manifest** - Enable "Add to Home Screen" installation
3. **Offline mode** - Work without internet connection
4. **Touch controls** - Touch-optimized pan, zoom, and selection
5. **Mobile-responsive UI** - Layouts adapt to phone screens
6. **Installable app** - Native-like installation experience
7. **Splash screen** - Branded loading screen on mobile
8. **App icons** - Multiple sizes for different devices
9. **Cache management** - Smart caching strategy for assets and data
10. **Update notifications** - Alert when new version available
11. **Mobile viewport** - Proper meta tags for mobile rendering
12. **Touch gestures** - Pinch-to-zoom, two-finger pan
13. **Mobile toolbar** - Compact tool selection for small screens
14. **Background sync** - Sync data when connection restored
15. **Share target** - Receive photos from camera/gallery

## Technical Implementation Sketch

### File Structure

```
public/
├── manifest.json                # PWA manifest
├── service-worker.js           # Service worker for offline
├── icons/
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   └── icon-512x512.png
src/
├── pwa/
│   ├── ServiceWorkerManager.ts  # Service worker lifecycle
│   ├── UpdateManager.ts         # Handle app updates
│   └── CacheStrategy.ts         # Caching logic
├── mobile/
│   ├── TouchControls.ts         # Touch gesture handling
│   ├── MobileUI.ts              # Mobile-optimized interface
│   └── GestureRecognizer.ts     # Pinch, pan, rotate gestures
└── index.html                   # Updated with PWA meta tags
```

### Core Concepts

**Progressive Web App**:
- Installable: Works like native app
- Offline-capable: Service worker caches resources
- Responsive: Adapts to any screen size
- Discoverable: Can be found in app stores (Google Play, etc.)

**Service Worker**:
- Runs in background, separate from main thread
- Intercepts network requests
- Implements cache-first or network-first strategies
- Enables offline functionality
- Can sync data in background

**Touch Gestures**:
- Single finger: Pan viewport
- Two fingers: Pinch to zoom
- Two finger twist: Rotate viewport (optional)
- Tap: Select object
- Long press: Context menu

**Caching Strategy**:
- App shell (HTML/CSS/JS): Cache first, update in background
- Project data: Network first, fallback to cache
- Attachments: Cache on demand
- API calls: Network only

### public/manifest.json

```json
{
  "name": "GardenCAD",
  "short_name": "GardenCAD",
  "description": "Professional 2D CAD for garden planning with centimeter precision",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0066ff",
  "orientation": "any",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "categories": ["productivity", "utilities"],
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "files": [
        {
          "name": "image",
          "accept": ["image/*"]
        }
      ]
    }
  }
}
```

### public/service-worker.js

```javascript
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `gardencad-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('gardencad-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Different strategies for different resources
  if (isStaticAsset(url)) {
    // Static assets: Cache first
    event.respondWith(cacheFirst(request));
  } else if (isProjectData(url)) {
    // Project data: Network first with cache fallback
    event.respondWith(networkFirst(request));
  } else if (isAttachment(url)) {
    // Attachments: Cache on demand
    event.respondWith(cacheOnDemand(request));
  } else {
    // Default: Network only
    event.respondWith(fetch(request));
  }
});

// Cache first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Serving from cache:', request.url);
    return cached;
  }
  
  console.log('[SW] Fetching from network:', request.url);
  const response = await fetch(request);
  
  // Cache successful responses
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  
  return response;
}

// Network first strategy
async function networkFirst(request) {
  try {
    console.log('[SW] Fetching from network:', request.url);
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    
    if (cached) {
      return cached;
    }
    
    // Return offline fallback page
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

// Cache on demand strategy
async function cacheOnDemand(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Serving attachment from cache:', request.url);
    return cached;
  }
  
  console.log('[SW] Fetching attachment:', request.url);
  const response = await fetch(request);
  
  // Cache attachments for offline access
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  
  return response;
}

// Helper functions
function isStaticAsset(url) {
  return (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname === '/' ||
    url.pathname === '/index.html'
  );
}

function isProjectData(url) {
  return url.pathname.includes('/api/projects');
}

function isAttachment(url) {
  return url.pathname.includes('/api/attachments');
}

// Background sync (when connection restored)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-projects') {
    event.waitUntil(syncProjects());
  }
});

async function syncProjects() {
  // Sync pending changes when connection restored
  console.log('[SW] Syncing projects...');
  
  // Implementation would check IndexedDB for pending changes
  // and POST them to server
}

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'GardenCAD', {
      body: data.body || 'New update available',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png'
    })
  );
});
```

### src/pwa/ServiceWorkerManager.ts

```typescript
export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private onUpdateAvailable: () => void;

  constructor(onUpdateAvailable: () => void = () => {}) {
    this.onUpdateAvailable = onUpdateAvailable;
  }

  async register(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', this.registration.scope);

      // Check for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New version available
              console.log('New version available');
              this.onUpdateAvailable();
            }
          });
        }
      });

      // Check for updates every hour
      setInterval(() => {
        this.registration?.update();
      }, 60 * 60 * 1000);

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async unregister(): Promise<boolean> {
    if (this.registration) {
      return this.registration.unregister();
    }
    return false;
  }

  async update(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
    }
  }

  skipWaiting(): void {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  async clearCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );
      console.log('All caches cleared');
    }
  }

  isOffline(): boolean {
    return !navigator.onLine;
  }
}
```

### src/pwa/UpdateManager.ts

```typescript
export class UpdateManager {
  private updateBanner: HTMLElement | null = null;
  private swManager: ServiceWorkerManager;

  constructor(swManager: ServiceWorkerManager) {
    this.swManager = swManager;
    this.createUpdateBanner();
    this.setupOnlineOfflineHandlers();
  }

  private createUpdateBanner(): void {
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #0066ff;
      color: white;
      padding: 12px 16px;
      text-align: center;
      z-index: 10000;
      display: none;
      font-family: Arial, sans-serif;
      font-size: 14px;
    `;

    const message = document.createElement('span');
    message.textContent = 'A new version is available. ';
    banner.appendChild(message);

    const updateBtn = document.createElement('button');
    updateBtn.textContent = 'Update Now';
    updateBtn.style.cssText = `
      background: white;
      color: #0066ff;
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      margin-left: 12px;
      cursor: pointer;
      font-weight: bold;
    `;
    updateBtn.addEventListener('click', () => this.applyUpdate());
    banner.appendChild(updateBtn);

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '✕';
    dismissBtn.style.cssText = `
      background: transparent;
      color: white;
      border: none;
      padding: 6px 12px;
      margin-left: 12px;
      cursor: pointer;
      font-size: 18px;
    `;
    dismissBtn.addEventListener('click', () => this.hideUpdateBanner());
    banner.appendChild(dismissBtn);

    document.body.appendChild(banner);
    this.updateBanner = banner;
  }

  showUpdateBanner(): void {
    if (this.updateBanner) {
      this.updateBanner.style.display = 'block';
    }
  }

  hideUpdateBanner(): void {
    if (this.updateBanner) {
      this.updateBanner.style.display = 'none';
    }
  }

  applyUpdate(): void {
    this.swManager.skipWaiting();
    window.location.reload();
  }

  private setupOnlineOfflineHandlers(): void {
    window.addEventListener('online', () => {
      this.showOnlineNotification();
    });

    window.addEventListener('offline', () => {
      this.showOfflineNotification();
    });
  }

  private showOnlineNotification(): void {
    console.log('Connection restored');
    this.showToast('Connection restored', 'success');
  }

  private showOfflineNotification(): void {
    console.log('Connection lost - working offline');
    this.showToast('Working offline', 'warning');
  }

  private showToast(message: string, type: 'success' | 'warning' | 'error'): void {
    const colors = {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336'
    };

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: ${colors[type]};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}
```

### src/mobile/TouchControls.ts

```typescript
import { ViewportTransform } from '../viewport/ViewportTransform';

export class TouchControls {
  private transform: ViewportTransform;
  private element: HTMLElement;
  private onUpdate: () => void;

  private touches: Map<number, { x: number; y: number }> = new Map();
  private initialPinchDistance: number = 0;
  private initialZoom: number = 1;
  private isPinching: boolean = false;

  constructor(
    element: HTMLElement,
    transform: ViewportTransform,
    onUpdate: () => void
  ) {
    this.element = element;
    this.transform = transform;
    this.onUpdate = onUpdate;
    this.setupTouchHandlers();
  }

  private setupTouchHandlers(): void {
    // Prevent default touch behaviors
    this.element.addEventListener('touchstart', (e) => this.handleTouchStart(e), {
      passive: false
    });

    this.element.addEventListener('touchmove', (e) => this.handleTouchMove(e), {
      passive: false
    });

    this.element.addEventListener('touchend', (e) => this.handleTouchEnd(e), {
      passive: false
    });

    this.element.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), {
      passive: false
    });
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    // Store touch positions
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      this.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY
      });
    }

    // Start pinch gesture
    if (e.touches.length === 2) {
      this.isPinching = true;
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      this.initialPinchDistance = this.getDistance(
        touch1.clientX, touch1.clientY,
        touch2.clientX, touch2.clientY
      );
      this.initialZoom = this.transform.getZoom();
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    if (e.touches.length === 1 && !this.isPinching) {
      // Single finger pan
      this.handlePan(e.touches[0]);
    } else if (e.touches.length === 2) {
      // Two finger pinch to zoom
      this.handlePinch(e.touches[0], e.touches[1]);
    }

    // Update stored positions
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      this.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY
      });
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    // Remove ended touches
    const touchIds = Array.from(this.touches.keys());
    const activeTouchIds = new Set(
      Array.from(e.touches).map(t => t.identifier)
    );

    for (const id of touchIds) {
      if (!activeTouchIds.has(id)) {
        this.touches.delete(id);
      }
    }

    // End pinch if less than 2 touches
    if (e.touches.length < 2) {
      this.isPinching = false;
    }
  }

  private handlePan(touch: Touch): void {
    const prev = this.touches.get(touch.identifier);
    if (!prev) return;

    const dx = touch.clientX - prev.x;
    const dy = touch.clientY - prev.y;

    this.transform.pan(dx, dy);
    this.onUpdate();
  }

  private handlePinch(touch1: Touch, touch2: Touch): void {
    const currentDistance = this.getDistance(
      touch1.clientX, touch1.clientY,
      touch2.clientX, touch2.clientY
    );

    const scale = currentDistance / this.initialPinchDistance;
    const newZoom = this.initialZoom * scale;

    // Calculate center point
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;

    // Set zoom at pinch center
    const rect = this.element.getBoundingClientRect();
    this.transform.setZoom(
      newZoom,
      centerX - rect.left,
      centerY - rect.top,
      rect.width,
      rect.height
    );

    this.onUpdate();
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  destroy(): void {
    // Remove event listeners if needed
    this.touches.clear();
  }
}
```

### src/mobile/MobileUI.ts

```typescript
export class MobileUI {
  private isMobile: boolean;
  private toolbar: HTMLElement | null = null;

  constructor() {
    this.isMobile = this.detectMobile();
    
    if (this.isMobile) {
      this.setupMobileUI();
    }
  }

  private detectMobile(): boolean {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
      window.innerWidth < 768
    );
  }

  private setupMobileUI(): void {
    // Add mobile-specific CSS class
    document.body.classList.add('mobile');

    // Hide desktop-only elements
    this.hideDesktopElements();

    // Create mobile toolbar
    this.createMobileToolbar();

    // Adjust viewport meta tag
    this.setupViewport();

    // Add mobile-specific styles
    this.injectMobileStyles();
  }

  private hideDesktopElements(): void {
    // Hide property panel by default on mobile
    const propertyPanel = document.getElementById('property-panel');
    if (propertyPanel) {
      propertyPanel.style.display = 'none';
    }

    // Make status bar more compact
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
      statusBar.style.fontSize = '10px';
      statusBar.style.height = '28px';
    }
  }

  private createMobileToolbar(): void {
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'mobile-toolbar';
    this.toolbar.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-top: 1px solid #ccc;
      padding: 8px;
      display: flex;
      justify-content: space-around;
      z-index: 1000;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    `;

    // Tool buttons
    const tools = [
      { id: 'select', icon: '↖', label: 'Select' },
      { id: 'point', icon: '•', label: 'Point' },
      { id: 'line', icon: '/', label: 'Line' },
      { id: 'circle', icon: '○', label: 'Circle' },
      { id: 'polyline', icon: '⌇', label: 'Path' },
      { id: 'measure', icon: '📏', label: 'Measure' },
      { id: 'more', icon: '⋯', label: 'More' }
    ];

    for (const tool of tools) {
      const btn = this.createToolButton(tool.id, tool.icon, tool.label);
      this.toolbar.appendChild(btn);
    }

    document.body.appendChild(this.toolbar);
  }

  private createToolButton(id: string, icon: string, label: string): HTMLElement {
    const btn = document.createElement('button');
    btn.id = `mobile-tool-${id}`;
    btn.style.cssText = `
      flex: 1;
      min-width: 60px;
      padding: 12px 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 20px;
      color: #666;
    `;

    const iconEl = document.createElement('div');
    iconEl.textContent = icon;
    btn.appendChild(iconEl);

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 10px;';
    btn.appendChild(labelEl);

    btn.addEventListener('click', () => {
      // Dispatch tool selection event
      window.dispatchEvent(new CustomEvent('tool-selected', {
        detail: { tool: id }
      }));

      // Update active state
      document.querySelectorAll('#mobile-toolbar button').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#666';
      });
      btn.style.background = '#e3f2fd';
      btn.style.color = '#0066ff';
    });

    return btn;
  }

  private setupViewport(): void {
    let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }

    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
  }

  private injectMobileStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        body.mobile {
          touch-action: none;
        }

        #toolbar {
          display: none;
        }

        #property-panel {
          width: 100% !important;
          right: 0 !important;
          left: 0 !important;
          top: auto !important;
          bottom: 60px !important;
          max-height: 300px !important;
        }

        #viewport {
          padding-bottom: 60px;
        }

        .tool-btn {
          min-width: 44px;
          min-height: 44px;
        }

        /* Improve tap targets */
        button, a, input, select {
          min-width: 44px;
          min-height: 44px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  isMobileDevice(): boolean {
    return this.isMobile;
  }

  showMobileToolbar(): void {
    if (this.toolbar) {
      this.toolbar.style.display = 'flex';
    }
  }

  hideMobileToolbar(): void {
    if (this.toolbar) {
      this.toolbar.style.display = 'none';
    }
  }
}
```

### Updated index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="description" content="Professional 2D CAD for garden planning with centimeter precision">
  <meta name="theme-color" content="#0066ff">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="GardenCAD">
  
  <!-- Icons for iOS -->
  <link rel="apple-touch-icon" href="/icons/icon-152x152.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png">
  
  <!-- PWA Manifest -->
  <link rel="manifest" href="/manifest.json">
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png">
  
  <title>GardenCAD - Professional Garden Planning</title>
</head>
<body>
  <div id="app"></div>
  
  <noscript>
    <div style="text-align: center; padding: 40px;">
      <h1>JavaScript Required</h1>
      <p>GardenCAD requires JavaScript to run. Please enable JavaScript in your browser.</p>
    </div>
  </noscript>
  
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### Integration in main.ts

```typescript
import { ServiceWorkerManager } from './pwa/ServiceWorkerManager';
import { UpdateManager } from './pwa/UpdateManager';
import { TouchControls } from './mobile/TouchControls';
import { MobileUI } from './mobile/MobileUI';

// Initialize mobile UI
const mobileUI = new MobileUI();

// Initialize PWA
const swManager = new ServiceWorkerManager(() => {
  updateManager.showUpdateBanner();
});

const updateManager = new UpdateManager(swManager);

// Register service worker
if ('serviceWorker' in navigator) {
  swManager.register().then((registered) => {
    if (registered) {
      console.log('✓ PWA features enabled');
      console.log('✓ Offline mode available');
      console.log('✓ Install prompt available');
    }
  });
}

// Setup touch controls for mobile
if (mobileUI.isMobileDevice()) {
  const touchControls = new TouchControls(
    viewport.getSVG(),
    viewport.getTransform(),
    updateView
  );
  console.log('✓ Touch controls enabled');
}

// Install prompt
let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  const installBtn = document.createElement('button');
  installBtn.textContent = 'Install App';
  installBtn.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #0066ff;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    z-index: 1000;
    font-size: 14px;
  `;
  
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      
      if (result.outcome === 'accepted') {
        console.log('App installed');
      }
      
      deferredPrompt = null;
      installBtn.remove();
    }
  });
  
  document.body.appendChild(installBtn);
}

// Detect app installed
window.addEventListener('appinstalled', () => {
  console.log('✓ GardenCAD installed');
  deferredPrompt = null;
});

// Share target handler (for receiving photos)
if ('share' in navigator || 'canShare' in navigator) {
  const shareParams = new URLSearchParams(window.location.search);
  
  if (shareParams.has('title') || shareParams.has('text')) {
    console.log('Received shared content');
    // Handle shared images from camera/gallery
  }
}

console.log('PWA and mobile features initialized');
```

## Test Plan

### Manual Testing Steps

1. **Service worker registration test**
   - Open app in browser
   - Open DevTools → Application → Service Workers
   - Verify service worker registered
   - Verify status "activated"

2. **Offline mode test**
   - Load app normally
   - Open DevTools → Network
   - Check "Offline" checkbox
   - Reload page
   - Verify app still loads
   - Verify basic functionality works

3. **Install prompt test (Chrome/Edge)**
   - Open app in Chrome
   - Verify install button appears (or address bar icon)
   - Click install
   - Verify app installs
   - Verify app opens in standalone window

4. **iOS install test**
   - Open in Safari on iPhone
   - Tap Share button
   - Tap "Add to Home Screen"
   - Verify icon added
   - Open from home screen
   - Verify opens fullscreen

5. **Touch pan test (mobile)**
   - Open on phone
   - Place one finger on canvas
   - Drag around
   - Verify viewport pans smoothly

6. **Pinch zoom test (mobile)**
   - Place two fingers on canvas
   - Pinch outward
   - Verify zooms in
   - Pinch inward
   - Verify zooms out
   - Verify smooth animation

7. **Mobile toolbar test**
   - Open on phone (or resize browser to <768px)
   - Verify mobile toolbar appears at bottom
   - Tap each tool button
   - Verify tool activates
   - Verify button highlights

8. **Update notification test**
   - Load app (v1.0.0)
   - Deploy new version (v1.0.1)
   - Wait or trigger service worker update
   - Verify update banner appears
   - Click "Update Now"
   - Verify app reloads with new version

9. **Online/offline indicator test**
   - Open app
   - Disable network in DevTools
   - Verify "Working offline" toast appears
   - Re-enable network
   - Verify "Connection restored" toast appears

10. **Cache storage test**
    - Open DevTools → Application → Cache Storage
    - Verify "gardencad-v1.0.0" cache exists
    - Verify static assets cached (HTML, JS, CSS)
    - Verify images cached

11. **Manifest test**
    - Open DevTools → Application → Manifest
    - Verify manifest.json loaded
    - Verify icons present (192x192, 512x512)
    - Verify display: "standalone"
    - Verify theme color correct

12. **Touch target size test (mobile)**
    - Open on phone
    - Try tapping small objects
    - Verify tap targets minimum 44x44px
    - Verify buttons easily tappable

13. **Performance on mobile test**
    - Open on mid-range phone
    - Add 100 objects
    - Pan and zoom
    - Verify smooth (>30 FPS)
    - Verify no lag

14. **App icons test**
    - Install app
    - Check home screen icon
    - Verify icon renders correctly
    - Verify no white borders (maskable)

15. **Share target test (Android)**
    - Take photo with camera
    - Tap Share
    - Select "GardenCAD"
    - Verify app opens
    - Verify photo received

## Acceptance Criteria

- [ ] Service worker implemented and registered
- [ ] Manifest.json configured with all required fields
- [ ] App icons created for all sizes (72-512px)
- [ ] Offline mode works (app loads without network)
- [ ] Static assets cached (HTML, JS, CSS, icons)
- [ ] Install prompt works on Chrome/Edge
- [ ] Add to Home Screen works on iOS Safari
- [ ] App opens in standalone mode when installed
- [ ] Touch controls implemented for mobile
- [ ] Single finger pan gesture works
- [ ] Pinch-to-zoom gesture works
- [ ] Mobile toolbar created with tool buttons
- [ ] Mobile-responsive styles applied (<768px)
- [ ] Update notification shown when new version available
- [ ] Online/offline status indicators work
- [ ] Cache versioning implemented
- [ ] Old caches cleaned up on update
- [ ] Viewport meta tags configured for mobile
- [ ] Touch targets minimum 44x44px
- [ ] Theme color matches brand (#0066ff)
- [ ] Splash screen configured (via manifest)
- [ ] Share target configured for receiving photos
- [ ] No TypeScript compilation errors
- [ ] Works on iOS Safari, Chrome Android, Chrome Desktop

## Deliverables

1. **public/manifest.json** - PWA manifest configuration
2. **public/service-worker.js** - Service worker with caching
3. **public/icons/** - App icons in all required sizes
4. **src/pwa/ServiceWorkerManager.ts** - Service worker lifecycle management
5. **src/pwa/UpdateManager.ts** - Update notifications and online/offline handling
6. **src/mobile/TouchControls.ts** - Touch gesture handling (pan, pinch)
7. **src/mobile/MobileUI.ts** - Mobile-responsive interface
8. **Updated index.html** - PWA meta tags and manifest link
9. **Updated main.ts** - PWA and mobile initialization
10. **Working PWA** - Installable, offline-capable application

---

**Estimated effort**: 6-7 hours  
**Dependencies**: All previous slices (full app functionality required)  
**Risk**: Medium - Service worker complexity, mobile browser compatibility, iOS quirks

