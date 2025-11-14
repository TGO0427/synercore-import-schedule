# Mobile Development Quick Reference

## Components at a Glance

### Navigation
```jsx
import { MobileNavigation } from './components/MobileNavigation';

<MobileNavigation activeView="shipping" onNavigate={setView} />
```

### Cards
```jsx
import { ShipmentCardList } from './components/MobileShipmentCard';

<ShipmentCardList
  shipments={data}
  loading={false}
  compact={isMobile}
  onViewDetails={viewDetails}
/>
```

### Forms & Modals
```jsx
import { MobileFormModal, StatusUpdateForm } from './components/MobileFormModal';

<MobileFormModal
  title="Update Status"
  isOpen={isOpen}
  onClose={close}
  onSubmit={handleSubmit}
  loading={loading}
  error={error}
>
  <StatusUpdateForm currentStatus="stored" />
</MobileFormModal>
```

### Details
```jsx
import { MobileShipmentDetail } from './components/MobileShipmentDetail';

<MobileShipmentDetail
  shipment={data}
  onBack={goBack}
  onStatusChange={update}
  relatedShipments={related}
/>
```

## Hooks Quick Reference

### Responsive State
```jsx
const { isMobile, isTablet, isDesktop, orientation } = useMobileResponsive();
```

### Modal Control
```jsx
const { isOpen, open, close, toggle } = useMobileModal();
```

### Form Management
```jsx
const { values, errors, handleChange, handleSubmit } = useMobileForm(
  initialValues,
  onSubmit
);
```

### Infinite Scroll
```jsx
const { scrollRef, isLoading } = useMobileListScroll(loadMore, 200);
<div ref={scrollRef}>{/* content */}</div>
```

### Touch Gestures
```jsx
const { handleTouchStart, handleTouchEnd } = useMobileTouch({
  onSwipeLeft: () => {},
  onSwipeRight: () => {}
});
```

## Utility Functions Quick Reference

### Device Detection
```jsx
isMobileDevice()        // boolean
isTouchDevice()         // boolean
isPortraitOrientation() // boolean
matchesBreakpoint('md') // boolean
```

### Formatting
```jsx
formatFileSize(bytes)      // "2.5 MB"
formatMobileDate(date)     // "Today" | "Yesterday" | "Mon" | "11/14/2025"
```

### Performance
```jsx
debounce(func, 250)  // Delayed execution
throttle(func, 250)  // Rate-limited execution
```

### Clipboard & Share
```jsx
copyToClipboard("text")     // Promise<boolean>
nativeShare({title, text})  // Promise<boolean>
isNativeShareAvailable()    // boolean
```

### Preferences
```jsx
prefersReducedMotion()  // boolean
prefersDarkMode()       // boolean
prefersHighContrast()   // boolean
```

### Scroll Control
```jsx
disableBodyScroll()     // Prevent scrolling
enableBodyScroll()      // Resume scrolling
scrollToElement(el, offset) // Smooth scroll
```

### Other
```jsx
hapticFeedback(20)      // Vibration
getViewportSize()       // { width, height }
```

## CSS Classes Quick Reference

### Layout
```css
.page-content          /* Main content with bottom nav padding */
.mobile-header         /* Sticky header */
.sidebar              /* Side navigation */
.bottom-nav           /* Bottom tab navigation */
```

### Cards
```css
.shipment-card        /* Full card */
.shipment-card-compact /* Compact card */
.card-header          /* Card header */
.status-badge         /* Status indicator */
```

### Forms
```css
.mobile-form-modal-content  /* Modal box */
.form-group                 /* Form field group */
.form-input                 /* Input field */
.form-select                /* Select field */
.form-textarea              /* Textarea field */
.mobile-form-btn            /* Form button */
```

### Visibility
```css
.hide-mobile      /* Hide on mobile */
.show-mobile      /* Show on mobile only */
.hide-desktop     /* Hide on desktop */
.show-desktop     /* Show on desktop only */
```

## Responsive Breakpoints

```javascript
xs:  320px+   (base, no media query needed)
sm:  576px+   (small devices)
md:  768px+   (tablets)
lg:  1024px+  (desktops)
xl:  1440px+  (large screens)
```

**Using Media Queries:**
```css
@media (min-width: 576px) { /* Small and up */ }
@media (min-width: 768px) { /* Tablet and up */ }
@media (min-width: 1024px) { /* Desktop and up */ }
@media (min-width: 1440px) { /* Large and up */ }
```

## Common Patterns

### Pattern 1: Modal Form
```jsx
const { isOpen, open, close } = useMobileModal();
const [loading, setLoading] = useState(false);

const handleSubmit = async (data) => {
  setLoading(true);
  try {
    await api.post('/update', data);
    close();
  } finally {
    setLoading(false);
  }
};

return (
  <>
    <button onClick={open}>Open Form</button>
    <MobileFormModal
      isOpen={isOpen}
      onClose={close}
      onSubmit={handleSubmit}
      loading={loading}
    >
      {/* Form content */}
    </MobileFormModal>
  </>
);
```

### Pattern 2: Responsive List
```jsx
const { isMobile } = useMobileResponsive();

return (
  <ShipmentCardList
    shipments={items}
    compact={isMobile}
    onViewDetails={handleView}
  />
);
```

### Pattern 3: Detail Navigation
```jsx
const { isMobile } = useMobileResponsive();

return isMobile ? (
  <MobileShipmentDetail shipment={data} onBack={goBack} />
) : (
  <DesktopDetailView shipment={data} />
);
```

### Pattern 4: Infinite Scroll
```jsx
const { scrollRef, isLoading } = useMobileListScroll((done) => {
  loadMore().finally(done);
}, 200);

return <div ref={scrollRef}>{/* items */}</div>;
```

### Pattern 5: Conditional Rendering
```jsx
const { isMobile, isTablet } = useMobileResponsive();

return (
  <>
    {isMobile && <MobileNav />}
    {isTablet && <TabletNav />}
    {!isMobile && !isTablet && <DesktopNav />}
  </>
);
```

## Touch-Friendly Sizing

```css
/* Buttons & Interactive */
min-height: 48px;
min-width: 48px;
padding: 12px 16px;

/* Spacing */
gap: 12px;              /* Mobile */
gap: 16px;              /* Tablet+ */
gap: 20px;              /* Desktop+ */

/* Text */
font-size: 16px;        /* Mobile input size (prevents zoom) */
font-size: 14px;        /* Body text */
font-size: 18px;        /* Headers */
```

## Status Colors

```javascript
Planned:     #6c757d (Gray)
In Transit:  #ffc107 (Yellow)
Arrived:     #17a2b8 (Teal)
Stored:      #007bff (Blue)
Received:    #28a745 (Green)
Failed:      #dc3545 (Red)
Passed:      #20c997 (Green)
```

## Accessibility Checklist

- [ ] Touch targets are 48px minimum
- [ ] ARIA labels on buttons
- [ ] Focus states visible (`:focus-visible`)
- [ ] Semantic HTML used
- [ ] Keyboard navigation works
- [ ] Color contrast >= 4.5:1 (AA standard)
- [ ] Reduced motion respected
- [ ] Form labels associated
- [ ] Error messages clear

## Performance Tips

```jsx
// ✅ Good: Debounced search
const debouncedSearch = useMobileDebounce(query, 500);

// ❌ Bad: Search on every keystroke
// onChange triggers API call for each character

// ✅ Good: Lazy load images
<img loading="lazy" src="..." />

// ✅ Good: Code split modals
const Modal = lazy(() => import('./Modal'));

// ✅ Good: Memoize expensive calculations
const memoized = useMemo(() => expensiveCalc(), [deps]);
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Input zooms on focus | Use `font-size: 16px` on inputs |
| Keyboard hides content | Use `useMobileKeyboardVisible()` |
| Scroll jumps on modal | Use `useMobileModal()` (auto scroll management) |
| Touch events lag | Use `throttle()` for scroll/resize handlers |
| Safe area ignored | Use `getSafeAreaInsets()` or CSS env variables |
| Dark mode not working | Check `@media (prefers-color-scheme: dark)` |
| Animation janky | Respect `prefersReducedMotion()` |

## File Locations

```
Component         File
─────────────────────────────────────────────
MobileNavigation  src/components/MobileNavigation.jsx
ShipmentCard      src/components/MobileShipmentCard.jsx
FormModal         src/components/MobileFormModal.jsx
DetailView        src/components/MobileShipmentDetail.jsx
Hooks             src/hooks/useMobileResponsive.js
Utils             src/utils/mobileHelpers.js
Styles            src/styles/mobile.css
CSS (Component)   src/components/Mobile*.css
```

## Environment Setup

```bash
# Install dependencies (already done)
npm install

# Development server
npm run dev

# Build for production
npm run build

# Test on mobile (use DevTools)
# Chrome: Ctrl+Shift+M
# Firefox: Ctrl+Shift+M
```

## Debugging Tips

```jsx
// Log responsive state
const mobile = useMobileResponsive();
console.log('Mobile state:', mobile);

// Check viewport
console.log('Viewport:', getViewportSize());

// Test breakpoint
console.log('Is tablet?', matchesBreakpoint('md'));

// Check preferences
console.log('Prefers dark mode?', prefersDarkMode());
```

## Import Cheat Sheet

```jsx
// Components
import { MobileNavigation, MobileHeader } from './components/MobileNavigation';
import { MobileShipmentCard, ShipmentCardList } from './components/MobileShipmentCard';
import { MobileFormModal, StatusUpdateForm } from './components/MobileFormModal';
import { MobileShipmentDetail } from './components/MobileShipmentDetail';

// Hooks
import { useMobileResponsive, useMobileModal, useMobileForm } from './hooks/useMobileResponsive';

// Utils
import { isMobileDevice, formatFileSize, debounce } from './utils/mobileHelpers';
```

## Next Development Phases

1. **Phase 1**: React Native App
2. **Phase 3**: Progressive Web App (PWA)
3. **Phase 4**: Mobile Admin Dashboard

---

**Last Updated**: 2025-11-14
**Version**: 1.0 - Phase 2 Complete
