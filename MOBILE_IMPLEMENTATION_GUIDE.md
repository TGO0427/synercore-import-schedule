# Mobile Implementation Guide

## Overview

This guide covers the mobile-responsive web app implementation (Option 2 of the mobile development strategy). This phase includes responsive CSS, mobile components, hooks, and utilities that enhance the web app for all screen sizes.

## Completed Components

### 1. **Mobile CSS System** (`src/styles/mobile.css`)

A comprehensive mobile-first CSS framework with:

- **Responsive Breakpoints:**
  - Mobile (base): 320px+
  - Small: 576px+
  - Tablet (Medium): 768px+
  - Large: 1024px+
  - XL: 1440px+

- **CSS Variables:**
  ```css
  --breakpoint-sm: 576px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1440px;
  --touch-target: 48px;
  --touch-target-min: 44px;
  ```

- **Key Features:**
  - Touch-friendly buttons and inputs (48px minimum)
  - Table-to-card conversion on mobile
  - Sidebar hidden on mobile, visible on tablet+
  - Bottom navigation for mobile only
  - Modal bottom-sheet style on mobile
  - Proper spacing and typography at each breakpoint

### 2. **Mobile Navigation** (`src/components/MobileNavigation.jsx`)

Complete navigation system with:

- **MobileNavigation**: Full-featured with hamburger, sidebar, and bottom tabs
- **MobileHeader**: Standalone header component
- **BottomTabNavigation**: Tab navigation for quick access (5 main items)
- **SidebarNavigation**: Flexible sidebar with custom items

**Usage Example:**
```jsx
import { MobileNavigation } from './components/MobileNavigation';

function App() {
  const [activeView, setActiveView] = useState('shipping');

  return (
    <>
      <MobileNavigation activeView={activeView} onNavigate={setActiveView} />
      {/* Page content */}
    </>
  );
}
```

**Features:**
- Hamburger menu button (mobile only)
- Slide-in sidebar with overlay
- Bottom tab navigation with active states
- Touch-friendly hit targets (48px+)
- Accessibility: ARIA labels, keyboard support
- Logout functionality

### 3. **Shipment Card Component** (`src/components/MobileShipmentCard.jsx`)

Mobile-friendly shipment display with:

- **MobileShipmentCard**: Individual card component
  - Compact mode: Minimal info with action button
  - Expanded mode: Full details with grid layout
  - Status badge with color coding
  - Touch-friendly buttons

- **ShipmentCardList**: Container component
  - Multiple cards in responsive grid
  - Loading state with spinner
  - Empty state with helpful message
  - Handles all responsive sizes

**Status Color Mapping:**
```javascript
{
  'planned_*': '#6c757d' (Gray)
  'in_transit_*': '#ffc107' (Yellow)
  'arrived_*': '#17a2b8' (Teal)
  'stored': '#007bff' (Blue)
  'received': '#28a745' (Green)
  'inspection_failed': '#dc3545' (Red)
  'inspection_passed': '#20c997' (Teal)
}
```

**Responsive Grid:**
- Mobile (1 column): `grid-template-columns: 1fr`
- Tablet (2 columns): `grid-template-columns: repeat(2, 1fr)`
- Desktop (3 columns): `grid-template-columns: repeat(3, 1fr)`
- XL (4 columns): `grid-template-columns: repeat(4, 1fr)`

### 4. **Form Modal Component** (`src/components/MobileFormModal.jsx`)

Mobile-optimized forms with bottom-sheet modals:

- **MobileFormModal**: Base modal with slide-up animation
  - Customizable title and buttons
  - Error state display
  - Loading state with spinner
  - Touch-friendly layout

- **StatusUpdateForm**: Update shipment status
  - Status dropdown with all available statuses
  - Optional notes textarea
  - Character counter (500 max)

- **QuickActionForm**: Quick actions on shipments
  - 5 action buttons (Expedite, Inspect, Hold, Release, Redirect)
  - Optional comment field
  - Visual button feedback

- **FilterForm**: Filter shipments
  - Status, supplier, warehouse, date range filters
  - Reset and apply buttons
  - Mobile-optimized layout

**Modal Features:**
- Slide-up animation from bottom
- Backdrop click to close
- Keyboard-aware on mobile
- Loading states with spinner
- Error message display
- Dark mode support
- Accessibility features

### 5. **Shipment Detail View** (`src/components/MobileShipmentDetail.jsx`)

Comprehensive detail page with tabbed interface:

- **MobileShipmentDetail**: Full detail view
  - Back button navigation
  - Status banner with color
  - Tab navigation (Overview, Timeline, Documents)
  - Status history timeline
  - Document list with downloads
  - Related shipments carousel
  - Action buttons

- **MobileShipmentDetailModal**: Modal variant

**Tabs:**

1. **Overview Tab**
   - Shipment information grid
   - Supplier & location details
   - Timeline (created, updated dates)
   - Action buttons

2. **Timeline Tab**
   - Status history with timestamps
   - Notes for each status
   - Visual timeline marker

3. **Documents Tab**
   - Document list with icons
   - File size and upload date
   - Download buttons

**Related Shipments:** Horizontal carousel for quick navigation

### 6. **Mobile Utility Functions** (`src/utils/mobileHelpers.js`)

Comprehensive set of helper functions:

**Device Detection:**
- `isMobileDevice()`: Detects mobile user agent
- `isTouchDevice()`: Detects touch capability
- `isPortraitOrientation()`: Portrait vs landscape
- `getViewportSize()`: Current viewport dimensions

**Breakpoint Detection:**
- `matchesBreakpoint(breakpoint)`: Check if viewport matches breakpoint
- `shouldUseDesktopLayout()`: Helper for layout decisions

**User Preferences:**
- `prefersReducedMotion()`: Respects user's motion preferences
- `prefersDarkMode()`: Dark mode preference
- `prefersHighContrast()`: High contrast preference

**Formatting:**
- `formatFileSize(bytes)`: Convert bytes to readable format
- `formatMobileDate(date, includeTime)`: Smart date formatting
  - Shows "Today", "Yesterday", weekday names, or full date
  - Optional time display

**Performance:**
- `debounce(func, delay)`: Debounce function calls
- `throttle(func, delay)`: Throttle function calls
- `logMetric(label, value)`: Performance logging

**Clipboard & Share:**
- `copyToClipboard(text)`: Copy to clipboard
- `nativeShare(options)`: Native share API
- `isNativeShareAvailable()`: Check share support

**Scroll & Body:**
- `disableBodyScroll()`: Prevent body scroll
- `enableBodyScroll()`: Re-enable body scroll
- `scrollToElement(element, offset)`: Smooth scroll

**Safe Area (Notch):**
- `getSafeAreaInsets()`: Get notch/safe area insets
- `addSafeAreaPadding(element, side)`: Add padding for safe area

**Other:**
- `isKeyboardVisible()`: Heuristic keyboard detection
- `hapticFeedback(pattern)`: Vibration feedback
- `createMobileSafeUrl(url)`: Safe URL creation

### 7. **Mobile React Hooks** (`src/hooks/useMobileResponsive.js`)

Custom React hooks for mobile development:

**useMobileResponsive**
```jsx
const {
  viewport,           // { width, height }
  orientation,        // 'portrait' | 'landscape'
  isMobile,          // boolean
  isTablet,          // boolean
  isDesktop,         // boolean
  isTouchDevice,     // boolean
  prefersReducedMotion, // boolean
  prefersDarkMode    // boolean
} = useMobileResponsive();
```

**useMobileModal**
```jsx
const { isOpen, open, close, toggle } = useMobileModal(false);
// Automatically manages body scroll
```

**useMobileForm**
```jsx
const {
  values,
  errors,
  touched,
  isSubmitting,
  handleChange,
  handleBlur,
  handleFocus,
  handleSubmit,
  resetForm,
  setFieldValue,
  setFieldError
} = useMobileForm(initialValues, onSubmit);
```

**useMobileListScroll**
```jsx
const { scrollRef, isLoading, setIsLoading } = useMobileListScroll(
  loadMore,
  threshold // pixel threshold from bottom
);
// Use scrollRef on scrollable container
```

**useMobileOrientation**
```jsx
const orientation = useMobileOrientation((newOrientation) => {
  console.log('Orientation changed to:', newOrientation);
});
```

**useMobileDebounce**
```jsx
const debouncedValue = useMobileDebounce(searchInput, 500);
// Useful for search inputs
```

**useMobileTouch**
```jsx
const { handleTouchStart, handleTouchEnd } = useMobileTouch({
  onSwipeLeft: () => {},
  onSwipeRight: () => {},
  onLongPress: () => {},
  onDoubleTap: () => {}
});
```

**useMobileKeyboardVisible**
```jsx
const isKeyboardVisible = useMobileKeyboardVisible();
// Heuristic: based on viewport height reduction
```

## Integration Examples

### Example 1: Dashboard with Mobile Navigation

```jsx
import { useEffect, useState } from 'react';
import { MobileNavigation } from './components/MobileNavigation';
import { ShipmentCardList } from './components/MobileShipmentCard';
import { useMobileResponsive } from './hooks/useMobileResponsive';

export function Dashboard() {
  const { isMobile, isTablet } = useMobileResponsive();
  const [activeView, setActiveView] = useState('shipping');
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch shipments
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    setLoading(true);
    // API call
    setLoading(false);
  };

  const handleViewDetails = (shipmentId) => {
    // Navigate to detail view
  };

  const handleStatusChange = (shipmentId) => {
    // Open status modal
  };

  return (
    <>
      <MobileNavigation activeView={activeView} onNavigate={setActiveView} />

      <main className="page-content">
        <h1>Shipments</h1>

        <ShipmentCardList
          shipments={shipments}
          loading={loading}
          empty={shipments.length === 0}
          compact={isMobile && !isTablet}
          onViewDetails={handleViewDetails}
          onStatusChange={handleStatusChange}
        />
      </main>
    </>
  );
}
```

### Example 2: Using Forms with Modal

```jsx
import { useState } from 'react';
import { MobileFormModal } from './components/MobileFormModal';
import { StatusUpdateForm } from './components/MobileFormModal';
import { useMobileModal } from './hooks/useMobileResponsive';

export function ShipmentActions() {
  const { isOpen, open, close } = useMobileModal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentShipmentId, setCurrentShipmentId] = useState(null);

  const handleStatusChange = (shipmentId) => {
    setCurrentShipmentId(shipmentId);
    open();
  };

  const handleSubmit = async ({ status, notes }) => {
    setLoading(true);
    setError(null);

    try {
      // Update shipment status
      const response = await fetch(`/api/shipments/${currentShipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      });

      if (!response.ok) throw new Error('Failed to update');

      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MobileFormModal
        title="Update Shipment Status"
        isOpen={isOpen}
        onClose={close}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        submitLabel="Update Status"
      >
        <StatusUpdateForm currentStatus="stored" onStatusChange={() => {}} />
      </MobileFormModal>
    </>
  );
}
```

### Example 3: Responsive Detail View

```jsx
import { useState } from 'react';
import { MobileShipmentDetail } from './components/MobileShipmentDetail';
import { useMobileResponsive } from './hooks/useMobileResponsive';

export function ShipmentDetailPage({ shipmentId }) {
  const { isMobile, isTablet } = useMobileResponsive();
  const [shipment, setShipment] = useState(null);
  const [relatedShipments, setRelatedShipments] = useState([]);

  useEffect(() => {
    // Fetch shipment and related shipments
  }, [shipmentId]);

  const handleDownloadDocument = async (docId) => {
    // Download document
  };

  return (
    <MobileShipmentDetail
      shipment={shipment}
      onBack={() => navigate(-1)}
      onStatusChange={(shipmentId) => {
        // Open status modal
      }}
      onDownloadDocument={handleDownloadDocument}
      relatedShipments={relatedShipments}
    />
  );
}
```

### Example 4: Responsive Form with Hooks

```jsx
import { useState } from 'react';
import { useMobileForm, useMobileResponsive } from './hooks/useMobileResponsive';

export function AdvancedFilterForm() {
  const { isMobile } = useMobileResponsive();
  const { values, handleChange, handleSubmit } = useMobileForm(
    {
      status: '',
      supplier: '',
      warehouse: '',
      dateFrom: '',
      dateTo: ''
    },
    async (values) => {
      // Apply filters
      console.log('Filters applied:', values);
    }
  );

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="supplier"
        placeholder="Supplier name..."
        value={values.supplier}
        onChange={handleChange}
      />
      {/* More fields */}
      <button type="submit">Apply Filters</button>
    </form>
  );
}
```

## Mobile Best Practices

### 1. **Touch Targets**
- Minimum 44px (WCAG AA), preferably 48px
- CSS variable: `var(--touch-target)` = 48px
- Applied to all buttons and interactive elements

### 2. **Viewport Meta Tag**
```html
<meta name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### 3. **Safe Area Support**
```css
body {
  padding: max(0px, env(safe-area-inset-top))
           max(0px, env(safe-area-inset-right))
           max(0px, env(safe-area-inset-bottom))
           max(0px, env(safe-area-inset-left));
}
```

### 4. **Scrolling Performance**
- Use `-webkit-overflow-scrolling: touch` for smooth momentum scrolling
- Debounce/throttle scroll handlers (250ms default)
- Use `scroll-snap-type` for carousels

### 5. **Keyboard Management**
- Don't hide input on focus (causes zoom/scroll issues)
- Use `input.blur()` instead of JavaScript scroll
- Manage body scroll with `useMobileModal` hook

### 6. **Orientation Changes**
- Use `useMobileOrientation` hook
- Reset scrolling on orientation change
- Update layout based on `orientation` state

### 7. **Dark Mode**
- Use `prefersDarkMode()` hook
- CSS support: `@media (prefers-color-scheme: dark)`
- All components include dark mode styles

### 8. **Accessibility**
- Use semantic HTML (`button`, `nav`, `form`)
- Include ARIA labels (`aria-label`, `aria-current`)
- Focus management with `:focus-visible`
- High contrast mode support

## File Structure

```
src/
├── components/
│   ├── MobileNavigation.jsx
│   ├── MobileNavigation.css
│   ├── MobileShipmentCard.jsx
│   ├── MobileShipmentCard.css
│   ├── MobileFormModal.jsx
│   ├── MobileFormModal.css
│   ├── MobileShipmentDetail.jsx
│   └── MobileShipmentDetail.css
├── hooks/
│   └── useMobileResponsive.js
├── utils/
│   └── mobileHelpers.js
└── styles/
    └── mobile.css
```

## CSS Classes Reference

### Navigation Classes
- `.mobile-header` - Sticky header
- `.sidebar` - Side navigation
- `.bottom-nav` - Bottom tab navigation
- `.nav-link` - Navigation items
- `.menu-btn` - Hamburger button

### Card Classes
- `.shipment-card` - Full card
- `.shipment-card-compact` - Compact card
- `.card-header` - Card header
- `.card-body` - Card body
- `.card-footer` - Card footer
- `.status-badge` - Status indicator

### Form Classes
- `.mobile-modal-backdrop` - Modal overlay
- `.mobile-modal-content` - Modal container
- `.mobile-form` - Form container
- `.form-group` - Form group
- `.form-input`, `.form-select`, `.form-textarea` - Form inputs
- `.mobile-form-btn` - Form buttons

### Responsive Classes
- `.hide-mobile` - Hide on mobile
- `.show-mobile` - Show on mobile only
- `.hide-desktop` - Hide on desktop
- `.show-desktop` - Show on desktop only
- `.page-content` - Main content with bottom nav padding

## Performance Optimization

### Code Splitting
```jsx
const MobileNav = lazy(() => import('./components/MobileNavigation'));
```

### Image Optimization
```jsx
<img
  srcset="small.jpg 480w, medium.jpg 768w, large.jpg 1024w"
  alt="Description"
/>
```

### Lazy Loading
```jsx
{shipments.length > 0 && (
  <Suspense fallback={<LoadingSpinner />}>
    <ShipmentCardList shipments={shipments} />
  </Suspense>
)}
```

## Testing Mobile Experience

### Device Sizes
- iPhone SE (375px)
- iPhone 12 (390px)
- iPhone 12 Pro Max (428px)
- iPad (768px)
- iPad Pro (1024px)
- Desktop (1440px)

### Browser DevTools
- Chrome DevTools: Device Toolbar (Ctrl+Shift+M)
- Firefox: Responsive Design Mode (Ctrl+Shift+M)
- Safari: Develop → Enter Responsive Design Mode

### Testing Checklist
- [ ] Touch targets are 48px+
- [ ] Horizontal scroll not required
- [ ] Modal opens and closes properly
- [ ] Forms are usable on mobile keyboard
- [ ] Images are responsive
- [ ] Navigation is accessible
- [ ] Orientation changes work
- [ ] Dark mode displays correctly

## Next Steps

1. **Integrate into App.jsx**: Import and use MobileNavigation component
2. **Test on Devices**: Use real devices and emulators
3. **Implement React Native** (Phase 1): Native iOS/Android app
4. **Set up PWA** (Phase 3): Service worker and offline support
5. **Create Admin Dashboard** (Phase 4): Simplified admin view

## Resources

- [Mobile-First CSS Guidelines](https://www.w3.org/TR/mobile-bp/)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN: Responsive Web Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Web.dev: Mobile Performance](https://web.dev/performance/)

---

**Status**: Phase 2 (Mobile-Responsive Web) - Complete
**Next Phase**: Phase 1 (React Native) - Pending
**Last Updated**: 2025-11-14
