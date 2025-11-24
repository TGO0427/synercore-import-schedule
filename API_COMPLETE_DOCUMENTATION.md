# Synercore Import Schedule - Complete API Documentation

**Base URL (Production)**: `https://synercore-import-schedule-production.up.railway.app`
**API Version**: v1
**Documentation Generated**: 2025-11-24

---

## Table of Contents
1. [Authentication](#authentication)
2. [Shipments API](#shipments-api)
3. [Suppliers API](#suppliers-api)
4. [Reports API](#reports-api)
5. [Quotes API](#quotes-api)
6. [Warehouse Capacity API](#warehouse-capacity-api)
7. [Admin API](#admin-api)
8. [Health & Status](#health--status)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)

---

## Authentication

### Login Endpoint
**POST** `/api/auth/login`

Authenticate a user and receive JWT tokens.

**Request:**
```json
{
  "username": "admin@synercore.co.za",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "user_123",
    "username": "admin@synercore.co.za",
    "email": "admin@synercore.co.za",
    "role": "admin",
    "fullName": "Admin User"
  }
}
```

**Error Response (400):**
```json
{
  "error": "Username and password are required"
}
```

### Logout Endpoint
**POST** `/api/auth/logout`

Logout user and revoke refresh token.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### Refresh Token Endpoint
**POST** `/api/auth/refresh-token`

Get a new access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

---

## Shipments API

### List All Shipments
**GET** `/api/shipments`

Retrieve all shipments with filtering and pagination.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `page` (optional, default: 1): Page number for pagination
- `limit` (optional, default: 20): Items per page (max: 100)
- `status` (optional): Filter by status (e.g., `stored`, `in_transit_seaway`)
- `supplier` (optional): Filter by supplier name
- `weekNumber` (optional): Filter by week number (1-53)
- `search` (optional): Search in order_ref, supplier, notes

**Response (200):**
```json
{
  "data": [
    {
      "id": "ship_1761044306185_zvmgvn03w",
      "order_ref": "APO0016491",
      "supplier": "QIDA CHEMICAL",
      "product_name": "Sodium Hexametaphosphate",
      "quantity": 15600,
      "pallet_qty": 13,
      "cbm": null,
      "latest_status": "stored",
      "week_number": "51",
      "week_date": "2025-12-14T22:00:00.000Z",
      "final_pod": "PRETORIA",
      "receiving_warehouse": "PRETORIA",
      "forwarding_agent": "OOCL",
      "vessel_name": "Bear Mountain Bridge V. 130W",
      "incoterm": "CIF",
      "notes": "Invoice details...",
      "created_at": "2025-11-20T08:44:13.250Z",
      "updated_at": "2025-11-20T12:00:30.519Z",
      "inspection_date": null,
      "receiving_date": null,
      "rejection_date": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 28,
    "pages": 2
  }
}
```

### Get Single Shipment
**GET** `/api/shipments/:id`

Get detailed information for a specific shipment.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "data": {
    "id": "ship_1761044306185_zvmgvn03w",
    "order_ref": "APO0016491",
    "supplier": "QIDA CHEMICAL",
    "product_name": "Sodium Hexametaphosphate",
    "quantity": 15600,
    "pallet_qty": 13,
    "cbm": null,
    "latest_status": "stored",
    "week_number": "51",
    "week_date": "2025-12-14T22:00:00.000Z",
    "final_pod": "PRETORIA",
    "receiving_warehouse": "PRETORIA",
    "forwarding_agent": "OOCL",
    "vessel_name": "Bear Mountain Bridge V. 130W",
    "incoterm": "CIF",
    "notes": "Invoice details...",
    "created_at": "2025-11-20T08:44:13.250Z",
    "updated_at": "2025-11-20T12:00:30.519Z",
    "inspection_status": null,
    "inspection_notes": null,
    "receiving_status": null,
    "receiving_notes": null,
    "rejection_reason": null
  }
}
```

**Error Response (404):**
```json
{
  "error": "Shipment with ID ship_invalid not found",
  "code": "NOT_FOUND"
}
```

### Create Shipment
**POST** `/api/shipments`

Create a new shipment.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "orderRef": "APO0017300",
  "supplier": "NEW SUPPLIER",
  "quantity": 1000,
  "weekNumber": 52,
  "notes": "Optional notes"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "ship_1764523819456_xyz789",
    "order_ref": "APO0017300",
    "supplier": "NEW SUPPLIER",
    "quantity": 1000,
    "latest_status": "planned_airfreight",
    "week_number": 52,
    "notes": "Optional notes",
    "created_at": "2025-11-24T13:30:19.456Z",
    "updated_at": "2025-11-24T13:30:19.456Z"
  },
  "message": "Shipment created successfully"
}
```

### Update Shipment
**PUT** `/api/shipments/:id`

Update shipment details.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "latestStatus": "stored",
  "quantity": 1200,
  "notes": "Updated notes"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "ship_1764523819456_xyz789",
    "order_ref": "APO0017300",
    "supplier": "NEW SUPPLIER",
    "quantity": 1200,
    "latest_status": "stored",
    "notes": "Updated notes",
    "updated_at": "2025-11-24T13:35:00.000Z"
  },
  "message": "Shipment updated successfully"
}
```

### Update Shipment Status
**PATCH** `/api/shipments/:id/status`

Update only the shipment status.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "status": "in_warehouse",
  "notes": "Moved to warehouse"
}
```

**Valid Statuses:**
- `planned_airfreight`
- `planned_seafreight`
- `in_transit_airfreight`
- `in_transit_seafreight`
- `arrived_klm`
- `arrived_pta`
- `clearing_customs`
- `in_warehouse`
- `unloading`
- `inspection_in_progress`
- `inspection_passed`
- `inspection_failed`
- `receiving_goods`
- `stored`
- `archived`

**Response (200):**
```json
{
  "data": {
    "id": "ship_1764523819456_xyz789",
    "latest_status": "in_warehouse",
    "updated_at": "2025-11-24T13:40:00.000Z"
  },
  "message": "Shipment status updated successfully"
}
```

### Delete Shipment
**DELETE** `/api/shipments/:id`

Delete a shipment (permanent).

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "message": "Shipment deleted successfully"
}
```

### Archive Shipment
**POST** `/api/shipments/:id/archive`

Archive a shipment (soft delete).

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "data": {
    "id": "ship_1764523819456_xyz789",
    "latest_status": "archived",
    "updated_at": "2025-11-24T13:45:00.000Z"
  },
  "message": "Shipment archived successfully"
}
```

### Unarchive Shipment
**POST** `/api/shipments/:id/unarchive`

Restore an archived shipment.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "data": {
    "id": "ship_1764523819456_xyz789",
    "latest_status": "stored",
    "updated_at": "2025-11-24T13:50:00.000Z"
  },
  "message": "Shipment unarchived successfully"
}
```

### Get Shipment Statistics
**GET** `/api/shipments/statistics`

Get aggregated shipment statistics.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "data": {
    "total": 28,
    "stored": 8,
    "inTransit": 12,
    "arrived": 5,
    "archived": 3
  }
}
```

---

## Suppliers API

### List All Suppliers
**GET** `/api/suppliers`

Get all suppliers.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search supplier name

**Response (200):**
```json
{
  "data": [
    {
      "id": "supp_123",
      "name": "QIDA CHEMICAL",
      "contact_person": "John Doe",
      "email": "contact@qidachem.com",
      "phone": "+86 123 4567 8900",
      "address": "123 Chemical Road, Shanghai",
      "country": "China",
      "notes": "Primary chemical supplier",
      "created_at": "2025-01-15T10:00:00.000Z",
      "updated_at": "2025-11-20T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Get Supplier by ID
**GET** `/api/suppliers/:id`

Get specific supplier details.

**Response (200):**
```json
{
  "data": {
    "id": "supp_123",
    "name": "QIDA CHEMICAL",
    "contact_person": "John Doe",
    "email": "contact@qidachem.com",
    "phone": "+86 123 4567 8900",
    "address": "123 Chemical Road, Shanghai",
    "country": "China",
    "notes": "Primary chemical supplier",
    "created_at": "2025-01-15T10:00:00.000Z",
    "updated_at": "2025-11-20T12:00:00.000Z"
  }
}
```

---

## Reports API

### Get Advanced Reports
**GET** `/api/reports/advanced`

Get detailed analysis and metrics.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `warehouse` (optional): Filter by warehouse

**Response (200):**
```json
{
  "data": {
    "summary": {
      "totalShipments": 28,
      "totalQuantity": 250000,
      "avgDeliveryTime": 25.5
    },
    "byWarehouse": {
      "PRETORIA": {
        "count": 18,
        "quantity": 180000
      },
      "KLAPMUTS": {
        "count": 10,
        "quantity": 70000
      }
    },
    "byStatus": {
      "stored": 8,
      "in_transit": 12,
      "arrived": 5,
      "archived": 3
    }
  }
}
```

---

## Warehouse Capacity API

### Get Warehouse Capacity
**GET** `/api/warehouse-capacity`

Get current warehouse capacity status.

**Response (200):**
```json
{
  "data": [
    {
      "warehouse_name": "PRETORIA",
      "total_capacity": 650,
      "bins_used": 320,
      "available_bins": 330,
      "utilization_percent": 49.2
    },
    {
      "warehouse_name": "KLAPMUTS",
      "total_capacity": 384,
      "bins_used": 220,
      "available_bins": 164,
      "utilization_percent": 57.3
    }
  ]
}
```

### Update Warehouse Capacity
**PUT** `/api/warehouse-capacity/:warehouse`

Update warehouse bin usage.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "bins_used": 350
}
```

**Response (200):**
```json
{
  "data": {
    "warehouse_name": "PRETORIA",
    "total_capacity": 650,
    "bins_used": 350,
    "available_bins": 300,
    "updated_at": "2025-11-24T14:00:00.000Z"
  }
}
```

---

## Admin API

### Get All Users
**GET** `/api/admin/users`

Get all system users (admin only).

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "user_123",
      "username": "admin@synercore.co.za",
      "email": "admin@synercore.co.za",
      "full_name": "Admin User",
      "role": "admin",
      "is_active": true,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-11-24T00:00:00.000Z"
    }
  ]
}
```

### Create User
**POST** `/api/admin/users`

Create a new user (admin only).

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "username": "newuser@synercore.co.za",
  "email": "newuser@synercore.co.za",
  "password": "SecurePassword123!",
  "full_name": "New User",
  "role": "user"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "user_456",
    "username": "newuser@synercore.co.za",
    "email": "newuser@synercore.co.za",
    "full_name": "New User",
    "role": "user"
  },
  "message": "User created successfully"
}
```

---

## Health & Status

### Health Check
**GET** `/health`

Check if API is running and ready.

**Response (200):**
```json
{
  "status": "OK",
  "ready": true,
  "timestamp": "2025-11-24T14:15:30.000Z"
}
```

### Swagger Documentation
**GET** `/api-docs`

View interactive API documentation (Swagger UI).

Browse to: `https://synercore-import-schedule-production.up.railway.app/api-docs`

---

## Error Handling

### Error Response Format
All errors follow this format:

```json
{
  "error": "Human readable error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | Invalid request parameters |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource already exists |
| 422 | UNPROCESSABLE_ENTITY | Validation failed |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Server not ready |

### Example Error Response
```json
{
  "error": "Shipment with ID ship_invalid not found",
  "code": "NOT_FOUND"
}
```

---

## Rate Limiting

### Rate Limit Headers
All responses include rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1732010400
```

### Limits

| Endpoint | Limit |
|----------|-------|
| Auth endpoints | 20 requests per 15 minutes |
| API endpoints | 1000 requests per 15 minutes |

### Rate Limit Exceeded Response
```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 300
}
```

---

## Best Practices

### 1. Authentication
```javascript
// Always include token in Authorization header
fetch('/api/shipments', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 2. Pagination
```javascript
// Always paginate large result sets
fetch('/api/shipments?page=1&limit=50');
```

### 3. Error Handling
```javascript
try {
  const response = await fetch('/api/shipments/:id');
  if (!response.ok) {
    const error = await response.json();
    console.error(`Error: ${error.code} - ${error.message}`);
  }
} catch (error) {
  console.error('Network error:', error);
}
```

### 4. Token Refresh
```javascript
// Handle token expiration and refresh
if (response.status === 401) {
  const newToken = await refreshToken(refreshToken);
  // Retry request with new token
}
```

---

## Support

- **Documentation**: https://synercore-import-schedule-production.up.railway.app/api-docs
- **Status**: https://synercore-import-schedule-production.up.railway.app/health
- **Issues**: Report via Sentry dashboard

---

**Last Updated**: 2025-11-24
**API Version**: v1
**Status**: Production Ready ✅
