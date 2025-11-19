import express from 'express';
import { ShipmentsController } from '../controllers/shipmentsController.js';
import { validateShipmentCreate, validateShipmentQuery, validateId } from '../middleware/validation.js';

const router = express.Router();

router.get('/', ShipmentsController.getAllShipments);
router.get('/archives', ShipmentsController.getArchives);
router.get('/archives/:fileName', ShipmentsController.getArchiveData);
router.put('/archives/:fileName/rename', ShipmentsController.renameArchive);
router.put('/archives/:fileName', ShipmentsController.updateArchive);
router.post('/bulk-import', ShipmentsController.bulkImportEndpoint);
router.get('/status/:status', ShipmentsController.getShipmentsByStatus);
router.get('/delayed/list', ShipmentsController.getDelayedShipments);
router.get('/auto-archive/stats', ShipmentsController.getAutoArchiveStats);
router.post('/auto-archive/perform', ShipmentsController.performAutoArchive);
router.post('/manual-archive', ShipmentsController.performManualArchive);

// Post-arrival workflow routes
router.get('/post-arrival', ShipmentsController.getPostArrivalShipments);

// Parameterized routes (must come after specific routes)
router.get('/:id', validateId, ShipmentsController.getShipmentById);
router.post('/', validateShipmentCreate, ShipmentsController.createShipment);
router.put('/:id', validateId, ShipmentsController.updateShipment);
router.delete('/:id', validateId, ShipmentsController.deleteShipment);
router.post('/:id/start-unloading', validateId, ShipmentsController.startUnloading);
router.post('/:id/complete-unloading', validateId, ShipmentsController.completeUnloading);
router.post('/:id/start-inspection', validateId, ShipmentsController.startInspection);
router.post('/:id/complete-inspection', validateId, ShipmentsController.completeInspection);
router.post('/:id/start-receiving', validateId, ShipmentsController.startReceiving);
router.post('/:id/complete-receiving', validateId, ShipmentsController.completeReceiving);
router.post('/:id/mark-stored', validateId, ShipmentsController.markAsStored);
router.post('/:id/reject-shipment', validateId, ShipmentsController.rejectShipment);

export default router;