/**
 * Central export for all Zustand stores
 * Makes it easy to import stores across the application with full type safety
 */

export { useShipmentStore } from './shipmentStore';
export type { Shipment, ShipmentState } from './shipmentStore';

export { useSupplierStore } from './supplierStore';
export type { Supplier, SupplierState } from './supplierStore';

export { useUIStore } from './uiStore';
export type { Alert, Notification, UIState } from './uiStore';

export { useAuthStore } from './authStore';
export type { AuthState } from './authStore';

/**
 * Example usage in components (TypeScript):
 *
 * import { useShipmentStore, useUIStore, type Shipment } from '../stores';
 *
 * function MyComponent() {
 *   const { shipments, loading, fetchShipments } = useShipmentStore();
 *   const { activeView, setActiveView } = useUIStore();
 *
 *   useEffect(() => {
 *     fetchShipments();
 *   }, []);
 *
 *   const handleCreateShipment = async (data: Partial<Shipment>) => {
 *     try {
 *       await createShipment(data);
 *     } catch (error) {
 *       console.error('Failed to create shipment:', error);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {loading ? 'Loading...' : shipments.length}
 *     </div>
 *   );
 * }
 */
