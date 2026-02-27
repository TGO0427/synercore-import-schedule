/**
 * Swagger Path Definitions
 * Documents all API endpoints with request/response examples
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags:
 *       - System
 *     summary: Health check endpoint
 *     description: Returns server health status. No authentication required.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 ready:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login user
 *     description: Authenticates user with username and password. Returns JWT tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john.doe"
 *               password:
 *                 type: string
 *                 example: "SecurePassword123!"
 *             required:
 *               - username
 *               - password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register new user
 *     description: Creates a new user account. Automatically logs in after registration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john.doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "SecurePassword123!"
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *             required:
 *               - username
 *               - email
 *               - password
 *               - fullName
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user
 *     description: Logs out the current user and invalidates their refresh token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token
 *     description: Uses refresh token to obtain a new access token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *             required:
 *               - refreshToken
 *     responses:
 *       200:
 *         description: Token refreshed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Change user password
 *     description: Allows authenticated user to change their password.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "OldPassword123!"
 *               newPassword:
 *                 type: string
 *                 example: "NewPassword456!"
 *             required:
 *               - currentPassword
 *               - newPassword
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password changed successfully"
 *       401:
 *         description: Invalid current password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */

/**
 * @swagger
 * /api/shipments:
 *   get:
 *     tags:
 *       - Shipments
 *     summary: Get all shipments
 *     description: Returns paginated list of shipments. Supports filtering and sorting.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum:
 *             - planned_airfreight
 *             - planned_seafreight
 *             - in_transit_airfreight
 *             - in_transit_seafreight
 *             - arrived_klm
 *             - arrived_pta
 *             - clearing_customs
 *             - in_warehouse
 *             - unloading
 *             - inspection_in_progress
 *             - inspection_passed
 *             - inspection_failed
 *             - receiving_goods
 *             - stored
 *             - archived
 *         description: Filter by shipment status
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: List of shipments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 shipments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Shipment'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/shipments:
 *   post:
 *     tags:
 *       - Shipments
 *     summary: Create new shipment
 *     description: Creates a new shipment record.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderRef:
 *                 type: string
 *                 example: "ORD123456"
 *               supplier:
 *                 type: string
 *                 example: "ABC Corp"
 *               quantity:
 *                 type: integer
 *                 example: 100
 *               weekNumber:
 *                 type: integer
 *                 example: 42
 *             required:
 *               - orderRef
 *               - supplier
 *               - quantity
 *     responses:
 *       201:
 *         description: Shipment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Shipment'
 *       401:
 *         description: Not authenticated
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */

/**
 * @swagger
 * /api/shipments/{id}:
 *   get:
 *     tags:
 *       - Shipments
 *     summary: Get shipment by ID
 *     description: Returns a single shipment with full details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment ID
 *     responses:
 *       200:
 *         description: Shipment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Shipment'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Shipment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/shipments/{id}:
 *   put:
 *     tags:
 *       - Shipments
 *     summary: Update shipment
 *     description: Updates an existing shipment record.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latestStatus:
 *                 type: string
 *                 example: "in_warehouse"
 *               notes:
 *                 type: string
 *                 example: "Updated shipment notes"
 *     responses:
 *       200:
 *         description: Shipment updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Shipment'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Shipment not found
 *       422:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/shipments/{id}:
 *   delete:
 *     tags:
 *       - Shipments
 *     summary: Delete shipment
 *     description: Deletes a shipment record.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment ID
 *     responses:
 *       200:
 *         description: Shipment deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Shipment deleted successfully"
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Shipment not found
 */

/**
 * @swagger
 * /api/suppliers:
 *   get:
 *     tags:
 *       - Suppliers
 *     summary: Get all suppliers
 *     description: Returns list of all suppliers.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of suppliers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Supplier'
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/suppliers:
 *   post:
 *     tags:
 *       - Suppliers
 *     summary: Create new supplier
 *     description: Creates a new supplier record.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "ABC Manufacturing"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contact@abc-mfg.com"
 *               phone:
 *                 type: string
 *                 example: "+86-571-1234-5678"
 *               country:
 *                 type: string
 *                 example: "China"
 *             required:
 *               - name
 *               - email
 *     responses:
 *       201:
 *         description: Supplier created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Supplier'
 *       401:
 *         description: Not authenticated
 *       409:
 *         description: Supplier already exists
 *       422:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/quotes:
 *   get:
 *     tags:
 *       - Quotes
 *     summary: Get all quotes
 *     description: Returns list of supplier quotes.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of quotes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/quotes:
 *   post:
 *     tags:
 *       - Quotes
 *     summary: Create new quote
 *     description: Creates a new supplier quote.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               supplierId:
 *                 type: string
 *               productName:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               price:
 *                 type: number
 *             required:
 *               - supplierId
 *               - productName
 *               - quantity
 *               - price
 *     responses:
 *       201:
 *         description: Quote created
 *       401:
 *         description: Not authenticated
 *       422:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/warehouse-capacity:
 *   get:
 *     tags:
 *       - Warehouse
 *     summary: Get warehouse capacity
 *     description: Returns warehouse storage capacity information.
 *     responses:
 *       200:
 *         description: Warehouse capacity data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Warehouse not found
 */

/**
 * @swagger
 * /api/warehouse-capacity:
 *   put:
 *     tags:
 *       - Warehouse
 *     summary: Update warehouse capacity
 *     description: Updates warehouse storage capacity. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               totalCapacity:
 *                 type: integer
 *               availableBins:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Warehouse capacity updated
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       422:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/reports:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Get reports
 *     description: Returns generated reports for shipments and suppliers.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [shipments, suppliers, weekly, monthly]
 *         description: Report type
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for report period
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for report period
 *     responses:
 *       200:
 *         description: Report data
 *       401:
 *         description: Not authenticated
 *       422:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get user notifications
 *     description: Returns notifications for the current user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Max number of notifications to return
 *     responses:
 *       200:
 *         description: List of notifications
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Create notification
 *     description: Creates a new notification.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [info, warning, error, success]
 *               message:
 *                 type: string
 *               userId:
 *                 type: string
 *             required:
 *               - type
 *               - message
 *     responses:
 *       201:
 *         description: Notification created
 *       401:
 *         description: Not authenticated
 *       422:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/email-import/test-connection:
 *   post:
 *     tags:
 *       - Email Import
 *     summary: Test email connection
 *     description: Tests email account connection settings. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailAddress:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *             required:
 *               - emailAddress
 *               - password
 *               - host
 *               - port
 *     responses:
 *       200:
 *         description: Connection successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Not authenticated
 *       422:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/admin/scheduler:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get scheduler status
 *     description: Returns the status of background job scheduler. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduler status
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */

/**
 * @swagger
 * /api/admin/scheduler/configure:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Configure scheduler
 *     description: Configures the background job scheduler. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency:
 *                 type: string
 *                 enum: [hourly, daily, weekly, monthly]
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Scheduler configured
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       422:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/supplier/register:
 *   post:
 *     tags:
 *       - Supplier Portal
 *     summary: Register supplier account
 *     description: Creates a new supplier portal account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               supplierId:
 *                 type: string
 *             required:
 *               - email
 *               - password
 *               - supplierId
 *     responses:
 *       201:
 *         description: Account created
 *       409:
 *         description: Account already exists
 */

/**
 * @swagger
 * /api/supplier/login:
 *   post:
 *     tags:
 *       - Supplier Portal
 *     summary: Supplier login
 *     description: Authenticates a supplier and returns a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */

/**
 * @swagger
 * /api/supplier/shipments:
 *   get:
 *     tags:
 *       - Supplier Portal
 *     summary: Get supplier's shipments
 *     description: Returns shipments associated with the authenticated supplier.
 *     security:
 *       - supplierAuth: []
 *     responses:
 *       200:
 *         description: List of supplier shipments
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/supplier/documents:
 *   post:
 *     tags:
 *       - Supplier Portal
 *     summary: Upload document
 *     description: Upload a document for a shipment.
 *     security:
 *       - supplierAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               shipmentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document uploaded
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/supplier/reports:
 *   get:
 *     tags:
 *       - Supplier Portal
 *     summary: Get supplier reports
 *     description: Returns analytics and reports for the authenticated supplier.
 *     security:
 *       - supplierAuth: []
 *     responses:
 *       200:
 *         description: Supplier reports data
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/supplier/stats:
 *   get:
 *     tags:
 *       - Supplier Portal
 *     summary: Get supplier statistics
 *     description: Returns shipment statistics for the authenticated supplier.
 *     security:
 *       - supplierAuth: []
 *     responses:
 *       200:
 *         description: Supplier statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalShipments:
 *                   type: integer
 *                 inTransit:
 *                   type: integer
 *                 arrived:
 *                   type: integer
 *                 stored:
 *                   type: integer
 *                 onTimePercent:
 *                   type: number
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/supplier/quotes/{id}/respond:
 *   put:
 *     tags:
 *       - Supplier Portal
 *     summary: Respond to quote
 *     description: Supplier responds to a quote request (accept, reject, or counter).
 *     security:
 *       - supplierAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               response:
 *                 type: string
 *                 enum: [accepted, rejected, counter]
 *               price:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Response submitted
 *       404:
 *         description: Quote not found
 */

/**
 * @swagger
 * /api/costing:
 *   get:
 *     tags:
 *       - Import Costing
 *     summary: Get cost estimates
 *     description: Returns list of import cost estimates.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of cost estimates
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/costing:
 *   post:
 *     tags:
 *       - Import Costing
 *     summary: Create cost estimate
 *     description: Creates a new import cost estimate.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shipmentId:
 *                 type: string
 *               supplierId:
 *                 type: string
 *               containerType:
 *                 type: string
 *               portOfDischarge:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cost estimate created
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/costing/{id}:
 *   get:
 *     tags:
 *       - Import Costing
 *     summary: Get cost estimate by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cost estimate details
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /api/costing/{id}:
 *   put:
 *     tags:
 *       - Import Costing
 *     summary: Update cost estimate
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cost estimate updated
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /api/costing/{id}:
 *   delete:
 *     tags:
 *       - Import Costing
 *     summary: Delete cost estimate
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cost estimate deleted
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /api/costing-requests:
 *   get:
 *     tags:
 *       - Costing Requests
 *     summary: Get costing requests
 *     description: Returns list of costing requests. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of costing requests
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */

/**
 * @swagger
 * /api/costing-requests:
 *   post:
 *     tags:
 *       - Costing Requests
 *     summary: Create costing request
 *     description: Submit a new costing request.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Request created
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/costing-requests/count:
 *   get:
 *     tags:
 *       - Costing Requests
 *     summary: Get pending request count
 *     description: Returns count of pending costing requests. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Request count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 */

/**
 * @swagger
 * /api/audit:
 *   get:
 *     tags:
 *       - Audit Log
 *     summary: Get audit log entries
 *     description: Returns paginated audit log entries with optional filters. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: entityType
 *         in: query
 *         schema:
 *           type: string
 *           enum: [shipment, supplier]
 *       - name: action
 *         in: query
 *         schema:
 *           type: string
 *           enum: [create, update, delete, archive, restore]
 *       - name: userId
 *         in: query
 *         schema:
 *           type: string
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Audit log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       user_id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       action:
 *                         type: string
 *                       entity_type:
 *                         type: string
 *                       entity_id:
 *                         type: string
 *                       entity_label:
 *                         type: string
 *                       changes:
 *                         type: object
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */

/**
 * @swagger
 * /api/shipments/search:
 *   get:
 *     tags:
 *       - Shipments
 *     summary: Full-text search shipments
 *     description: Search shipments using PostgreSQL full-text search with ranking.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Shipment'
 *                 total:
 *                   type: integer
 *                 query:
 *                   type: string
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/shipments/bulk/archive:
 *   post:
 *     tags:
 *       - Shipments
 *     summary: Bulk archive shipments
 *     description: Archives multiple shipments at once.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *             required:
 *               - ids
 *     responses:
 *       200:
 *         description: Bulk archive results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 archived:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *                 results:
 *                   type: array
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/shipments/bulk/delete:
 *   post:
 *     tags:
 *       - Shipments
 *     summary: Bulk delete shipments
 *     description: Deletes multiple shipments at once.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *             required:
 *               - ids
 *     responses:
 *       200:
 *         description: Bulk delete results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/shipments/{id}/restore:
 *   post:
 *     tags:
 *       - Shipments
 *     summary: Restore archived shipment
 *     description: Restores a shipment from archived status back to stored.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shipment restored
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Shipment not found
 */

/**
 * @swagger
 * /api/reports/scheduled:
 *   get:
 *     tags:
 *       - Scheduled Reports
 *     summary: Get scheduled reports
 *     description: Returns the user's configured scheduled reports.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of scheduled reports
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/reports/scheduled:
 *   post:
 *     tags:
 *       - Scheduled Reports
 *     summary: Create scheduled report
 *     description: Configures a new automated report schedule.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [shipments, suppliers, warehouse, weekly, monthly]
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *               config:
 *                 type: object
 *             required:
 *               - reportType
 *               - frequency
 *     responses:
 *       201:
 *         description: Scheduled report created
 *       401:
 *         description: Not authenticated
 */

/**
 * @swagger
 * /api/reports/scheduled/{id}:
 *   put:
 *     tags:
 *       - Scheduled Reports
 *     summary: Update scheduled report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency:
 *                 type: string
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Scheduled report updated
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /api/reports/scheduled/{id}:
 *   delete:
 *     tags:
 *       - Scheduled Reports
 *     summary: Delete scheduled report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Scheduled report deleted
 *       404:
 *         description: Not found
 */
