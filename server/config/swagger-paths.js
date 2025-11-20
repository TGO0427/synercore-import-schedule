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
