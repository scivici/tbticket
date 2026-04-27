# API Reference

Base URL: `http://localhost:4001/api`

All endpoints except public ones require a JWT token in the `Authorization: Bearer <token>` header.

---

## Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | - | Register a new customer account |
| POST | `/auth/login` | - | Login, returns JWT token |
| POST | `/auth/anonymous` | - | Create anonymous session |
| GET | `/auth/me` | JWT | Get current user info |
| PATCH | `/auth/profile` | JWT | Update profile (name, company) |
| PATCH | `/auth/password` | JWT | Change password |

### Login Example

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@telcobridges.com",
  "password": "your-password"
}

Response:
{
  "token": "eyJhbG...",
  "user": { "id": 1, "email": "...", "role": "admin" }
}
```

---

## Tickets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/tickets` | JWT | Create ticket (triggers AI analysis) |
| GET | `/tickets` | JWT | List user's tickets (with filters) |
| GET | `/tickets/track/:ticketNumber` | - | Public ticket tracking |
| GET | `/tickets/:id` | JWT | Get ticket details |
| GET | `/tickets/:id/responses` | JWT | Get conversation thread |
| POST | `/tickets/:id/responses` | JWT | Add response (public/private) |
| GET | `/tickets/:id/activities` | JWT | Get activity log |
| GET | `/tickets/:id/tags` | JWT | Get tags |
| POST | `/tickets/:id/tags` | Admin | Add tag |
| DELETE | `/tickets/:id/tags/:tagId` | Admin | Remove tag |
| POST | `/tickets/:id/satisfaction` | JWT | Submit satisfaction survey |
| PATCH | `/tickets/:id/status` | Admin | Update status |
| PATCH | `/tickets/:id/assign` | Admin | Assign to engineer |
| PATCH | `/tickets/:id/priority` | Admin | Change priority |
| POST | `/tickets/:id/analyze` | Admin | Re-trigger AI analysis |
| DELETE | `/tickets/:id` | Admin | Delete ticket |
| POST | `/tickets/bulk/status` | Admin | Bulk status update |
| POST | `/tickets/bulk/assign` | Admin | Bulk assign |
| POST | `/tickets/bulk/delete` | Admin | Bulk delete |

### Ticket Statuses

`new` → `analyzing` → `assigned` → `in_progress` → `pending_info` → `escalated_to_jira` → `resolved` → `closed`

### Priority Levels

`low`, `medium`, `high`, `critical`

---

## Engineers (Admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/engineers` | Admin | List all engineers |
| POST | `/engineers` | Admin | Create engineer |
| PATCH | `/engineers/:id` | Admin | Update engineer |
| DELETE | `/engineers/:id` | Admin | Delete engineer |
| PUT | `/engineers/:id/skills` | Admin | Set skill proficiencies (1-5) |
| PUT | `/engineers/:id/expertise` | Admin | Set product expertise (1-5) |
| GET | `/engineers/skills` | Admin | List available skill definitions |

---

## Admin Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/dashboard` | Admin | Dashboard stats and chart data |
| GET | `/admin/customers` | Admin | Customer list |
| GET | `/admin/sla-policies` | Admin | Get SLA policies |
| PATCH | `/admin/sla-policies` | Admin | Update SLA policies |
| GET | `/admin/sla-breached` | Admin | Tickets that breached SLA |
| GET | `/admin/escalation-rules` | Admin | Get escalation rules |
| POST | `/admin/escalation-rules` | Admin | Create escalation rule |
| PATCH | `/admin/escalation-rules/:id` | Admin | Update escalation rule |
| DELETE | `/admin/escalation-rules/:id` | Admin | Delete escalation rule |
| GET | `/admin/escalation-alerts` | Admin | Active escalation alerts |
| GET | `/admin/recurring-tickets` | Admin | Recurring ticket patterns |

---

## Admin Management (Products, Categories, Questions, Skills)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| CRUD | `/admin/manage/products` | Admin | Manage products |
| CRUD | `/admin/manage/categories` | Admin | Manage categories per product |
| CRUD | `/admin/manage/questions` | Admin | Manage question templates |
| CRUD | `/admin/manage/skills` | Admin | Manage skill definitions |

---

## Settings & Configuration

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/settings` | Admin | Get all system settings |
| PATCH | `/settings` | Admin | Update settings |

---

## Users (Admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/users` | Admin | List all users |
| POST | `/admin/users` | Admin | Create user |
| PATCH | `/admin/users/:id` | Admin | Update user |
| DELETE | `/admin/users/:id` | Admin | Delete user |

---

## Canned Responses

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/canned-responses` | Admin | List templates |
| POST | `/canned-responses` | Admin | Create template |
| PATCH | `/canned-responses/:id` | Admin | Update template |
| DELETE | `/canned-responses/:id` | Admin | Delete template |

---

## Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | JWT | Get user's notifications |
| PATCH | `/notifications` | JWT | Mark as read |

---

## Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | - | Server health check |
