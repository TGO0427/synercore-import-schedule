# Synercore Import Schedule - API Documentation

Complete API documentation for the Synercore Supply Chain Management System.

## Quick Start

### Interactive API Documentation

Access the interactive Swagger UI at:
```
http://localhost:5001/api-docs
```

Or in production at:
```
https://synercore-import-schedule.com/api-docs
```

The Swagger interface provides:
- 📖 Complete endpoint documentation
- 🔍 Live request/response examples
- 🧪 Try-it-out functionality to test endpoints
- 🔐 Built-in authentication handling

### Raw OpenAPI Specification

Get the JSON specification at:
```
GET http://localhost:5001/api-docs/swagger.json
```

---

## Authentication

All protected endpoints require a JWT Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Getting a Token

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john.doe",
    "password": "SecurePassword123!"
  }'
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "username": "john.doe",
    "email": "john@example.com",
    "role": "admin"
  }
}
```

### Token Refresh

When your access token expires, use the refresh token:

```bash
curl -X POST http://localhost:5001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<your_refresh_token>"
  }'
```

---

## API Endpoints Overview

### System
- `GET /health` - Server health check (no auth required)

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/logout` - Logout and invalidate tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/change-password` - Change user password

### Shipments
- `GET /api/shipments` - List all shipments (with filtering & pagination)
- `POST /api/shipments` - Create new shipment
- `GET /api/shipments/{id}` - Get shipment details
- `PUT /api/shipments/{id}` - Update shipment
- `DELETE /api/shipments/{id}` - Delete shipment

### Suppliers
- `GET /api/suppliers` - List all suppliers
- `POST /api/suppliers` - Create new supplier
- `GET /api/suppliers/{id}` - Get supplier details
- `PUT /api/suppliers/{id}` - Update supplier
- `DELETE /api/suppliers/{id}` - Delete supplier

### Quotes
- `GET /api/quotes` - List all quotes
- `POST /api/quotes` - Create new quote
- `GET /api/quotes/{id}` - Get quote details
- `PUT /api/quotes/{id}` - Update quote
- `DELETE /api/quotes/{id}` - Delete quote

### Warehouse
- `GET /api/warehouse-capacity` - Get current warehouse capacity
- `PUT /api/warehouse-capacity` - Update warehouse capacity (admin only)

### Reports
- `GET /api/reports` - Generate reports (with filtering)
- `GET /api/reports/export` - Export report as PDF or Excel

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/{id}` - Mark notification as read
- `DELETE /api/notifications/{id}` - Delete notification

### Email Import
- `POST /api/email-import/test-connection` - Test email account connection
- `POST /api/email-import/start` - Start importing from email
- `GET /api/email-import/status` - Get import status

### Admin
- `GET /api/admin/scheduler` - Get scheduler status
- `POST /api/admin/scheduler/configure` - Configure background jobs
- `GET /api/admin/users` - List all users (admin only)
- `POST /api/admin/users/{id}/role` - Change user role (admin only)

---

## Response Format

### Success Response (2xx)
```json
{
  "data": { /* resource data */ },
  "message": "Operation successful"
}
```

### Error Response (4xx, 5xx)
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { /* additional context if available */ },
  "timestamp": "2024-11-20T12:00:00.000Z"
}
```

### Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Resource already exists or state conflict |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Common Patterns

### Paginated Endpoints

Many list endpoints support pagination:

```
GET /api/shipments?page=1&limit=20&status=planned_airfreight
```

Parameters:
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20) - Records per page
- `status` (string, optional) - Filter by status

Response:
```json
{
  "data": [
    { /* shipment 1 */ },
    { /* shipment 2 */ }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Filtering

Most endpoints support filtering through query parameters:

```
GET /api/shipments?status=in_warehouse&supplier=ABC+Corp
```

### Sorting

Some endpoints support sorting:

```
GET /api/shipments?sort=createdAt:desc
GET /api/shipments?sort=quantity:asc
```

### Searching

Search endpoints use the `q` parameter:

```
GET /api/suppliers?q=ABC
```

---

## Shipment Status Values

Shipments progress through the following status values:

**Planned Phase:**
- `planned_airfreight` - Scheduled for air freight
- `planned_seafreight` - Scheduled for sea freight

**In Transit Phase:**
- `in_transit_airfreight` - Traveling by air
- `in_transit_seafreight` - Traveling by sea

**Arrival Phase:**
- `arrived_klm` - Arrived at KLM distribution center
- `arrived_pta` - Arrived at PTA distribution center

**Customs Phase:**
- `clearing_customs` - Awaiting customs clearance

**Warehouse Phase:**
- `in_warehouse` - Received at warehouse
- `unloading` - Currently being unloaded
- `inspection_in_progress` - Quality inspection ongoing
- `inspection_passed` - Passed inspection
- `inspection_failed` - Failed inspection
- `receiving_goods` - Being formally received
- `stored` - Stored in warehouse

**Final:**
- `archived` - Historical record

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 login attempts per 15 minutes per IP
- **Admin Endpoints**: 50 requests per 15 minutes per IP

Rate limit info is returned in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 1642598400
```

---

## Example Requests

### Login
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john.doe",
    "password": "SecurePassword123!"
  }'
```

### List Shipments with Filtering
```bash
curl -X GET 'http://localhost:5001/api/shipments?status=in_warehouse&page=1&limit=20' \
  -H "Authorization: Bearer <token>"
```

### Create Shipment
```bash
curl -X POST http://localhost:5001/api/shipments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderRef": "ORD123456",
    "supplier": "ABC Corp",
    "quantity": 100,
    "weekNumber": 42
  }'
```

### Update Shipment Status
```bash
curl -X PUT http://localhost:5001/api/shipments/shipment-123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "latestStatus": "in_warehouse",
    "notes": "Received and inspected"
  }'
```

### Create Supplier
```bash
curl -X POST http://localhost:5001/api/suppliers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Manufacturing",
    "email": "contact@abc-mfg.com",
    "phone": "+86-571-1234-5678",
    "country": "China"
  }'
```

### Generate Report
```bash
curl -X GET 'http://localhost:5001/api/reports?type=shipments&startDate=2024-01-01&endDate=2024-12-31' \
  -H "Authorization: Bearer <token>"
```

---

## WebSocket Connection

For real-time updates, connect to WebSocket at:

```javascript
const socket = io('http://localhost:5001', {
  auth: {
    token: '<your_jwt_token>'
  }
});

// Listen for shipment updates
socket.on('shipment:updated', (data) => {
  console.log('Shipment updated:', data);
});

// Listen for new shipments
socket.on('shipment:created', (data) => {
  console.log('New shipment:', data);
});
```

Available WebSocket events:
- `shipment:created` - New shipment created
- `shipment:updated` - Shipment status changed
- `shipment:deleted` - Shipment deleted
- `notification:new` - New notification
- `warehouse:capacity-changed` - Warehouse capacity updated

---

## Troubleshooting

### 401 Unauthorized
- Token is missing or invalid
- Token has expired (use refresh endpoint)
- Wrong authentication scheme (should be `Bearer <token>`)

### 422 Validation Error
- Check request body against endpoint documentation
- Ensure all required fields are provided
- Validate field types (strings, numbers, etc.)

### 429 Too Many Requests
- You've exceeded rate limit
- Wait for the time specified in `X-RateLimit-Reset` header
- Consider batching requests or optimizing client code

### 503 Service Unavailable
- Server is starting up
- Database connection issue
- Server maintenance in progress
- Check `/health` endpoint for status

---

## Migration Guide: v1.0.0

This is the first version of the API. No migration needed for new implementations.

---

## Support

For API issues or questions:
- Check the interactive docs at `/api-docs`
- Review error codes and messages in responses
- Check server logs for detailed error information
- Contact: support@synercore.com

---

Last updated: 2024-11-20
