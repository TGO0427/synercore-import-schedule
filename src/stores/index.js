/**
 * Central export for all Zustand stores
 * Makes it easy to import stores across the application
 */

export { useShipmentStore } from './shipmentStore';
export { useSupplierStore } from './supplierStore';
export { useUIStore } from './uiStore';
export { useAuthStore } from './authStore';

/**
 * Example usage in components:
 *
 * import { useShipmentStore, useUIStore } from '../stores';
 *
 * function MyComponent() {
 *   const { shipments, loading, fetchShipments } = useShipmentStore();
 *   const { activeView, setActiveView } = useUIStore();
 *
 *   useEffect(() => {
 *     fetchShipments();
 *   }, []);
 *
 *   return (
 *     <div>
 *       {loading ? 'Loading...' : shipments.length}
 *     </div>
 *   );
 * }
 */
