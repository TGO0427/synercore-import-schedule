import express from 'express';
import { ShipmentsController } from '../controllers/shipmentsController.js';

const router = express.Router();

router.get('/', ShipmentsController.getAllShipments);
router.get('/archives', ShipmentsController.getArchives);
router.get('/archives/:fileName', ShipmentsController.getArchiveData);
router.put('/archives/:fileName/rename', ShipmentsController.renameArchive);
router.post('/bulk-import', ShipmentsController.bulkImportEndpoint);
router.get('/status/:status', ShipmentsController.getShipmentsByStatus);
router.get('/delayed/list', ShipmentsController.getDelayedShipments);
router.get('/auto-archive/stats', ShipmentsController.getAutoArchiveStats);
router.post('/auto-archive/perform', ShipmentsController.performAutoArchive);
router.post('/manual-archive', ShipmentsController.performManualArchive);

// Post-arrival workflow routes
router.get('/post-arrival', ShipmentsController.getPostArrivalShipments);

// Parameterized routes (must come after specific routes)
router.get('/:id', ShipmentsController.getShipmentById);
router.post('/', ShipmentsController.createShipment);
router.put('/:id', ShipmentsController.updateShipment);
router.delete('/:id', ShipmentsController.deleteShipment);
router.post('/:id/start-unloading', ShipmentsController.startUnloading);
router.post('/:id/complete-unloading', ShipmentsController.completeUnloading);
router.post('/:id/start-inspection', ShipmentsController.startInspection);
router.post('/:id/complete-inspection', ShipmentsController.completeInspection);
router.post('/:id/start-receiving', ShipmentsController.startReceiving);
router.post('/:id/complete-receiving', ShipmentsController.completeReceiving);
router.post('/:id/mark-stored', ShipmentsController.markAsStored);
router.post('/:id/reject-shipment', ShipmentsController.rejectShipment);

export default router;