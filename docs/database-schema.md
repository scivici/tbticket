# Database Schema

Database: **PostgreSQL 16**

---

## Core Tables

### tickets

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `ticket_number` | TEXT UNIQUE | Unique ID (e.g., TKT-20260323-ABC123) |
| `product_id` | INT FK | References products |
| `category_id` | INT FK | References product_categories |
| `subject` | TEXT | One-line summary |
| `description` | TEXT | Detailed issue description |
| `product_key` | TEXT | Device serial number / license key |
| `status` | TEXT | new, analyzing, assigned, in_progress, pending_info, escalated_to_jira, resolved, closed |
| `priority` | TEXT | low, medium, high, critical |
| `assigned_engineer_id` | INT FK | References engineers |
| `customer_id` | INT FK | References customers (user who created) |
| `ai_analysis` | TEXT | JSON — full Claude analysis result |
| `ai_confidence` | REAL | 0.0 to 1.0 |
| `jira_issue_key` | TEXT | Linked Jira issue (e.g., PROJ-123) |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Last update time |
| `resolved_at` | TIMESTAMP | Resolution time |
| `closed_at` | TIMESTAMP | Close time |
| `first_response_at` | TIMESTAMP | First response time (SLA tracking) |

### engineers

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `name` | TEXT | Full name |
| `email` | TEXT UNIQUE | Email address |
| `location` | TEXT | Office / timezone |
| `is_active` | INT | 0 = inactive, 1 = active |
| `current_workload` | INT | Current active ticket count |
| `max_workload` | INT | Maximum ticket capacity |
| `shift_start` | TEXT | Shift start time (HH:MM) |
| `shift_end` | TEXT | Shift end time (HH:MM) |
| `timezone` | TEXT | Engineer's timezone |

### engineer_skills

| Column | Type | Description |
|--------|------|-------------|
| `engineer_id` | INT FK | References engineers |
| `skill_id` | INT FK | References skill_definitions |
| `proficiency` | INT | 1-5 rating |

### engineer_product_expertise

| Column | Type | Description |
|--------|------|-------------|
| `engineer_id` | INT FK | References engineers |
| `product_id` | INT FK | References products |
| `category_id` | INT FK | References product_categories |
| `expertise_level` | INT | 1-5 rating |

---

## Product Configuration

### products

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `name` | TEXT | Product name (e.g., ProSBC) |
| `model` | TEXT | Model name |
| `description` | TEXT | Product description |
| `is_active` | INT | 0/1 |
| `required_fields` | TEXT (JSON) | Required fields per product |

### product_categories

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `product_id` | INT FK | References products |
| `name` | TEXT | Category name |
| `display_order` | INT | Sort order |

### question_templates

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `product_id` | INT FK | References products |
| `category_id` | INT FK | References product_categories |
| `question_text` | TEXT | The question |
| `question_type` | TEXT | text, textarea, select, multiselect, radio, checkbox, number, date |
| `options` | TEXT (JSON) | Options for select/radio types |
| `is_required` | INT | 0/1 |
| `display_order` | INT | Sort order |
| `conditional_on` | TEXT (JSON) | Conditional display logic |

---

## Ticket Related Tables

### ticket_answers

| Column | Type | Description |
|--------|------|-------------|
| `ticket_id` | INT FK | References tickets |
| `question_id` | INT FK | References question_templates |
| `answer` | TEXT | Customer's answer |

### ticket_attachments

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `ticket_id` | INT FK | References tickets |
| `filename` | TEXT | Original filename |
| `filepath` | TEXT | Storage path |
| `mimetype` | TEXT | MIME type |
| `size` | INT | File size in bytes |

### ticket_responses

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `ticket_id` | INT FK | References tickets |
| `user_id` | INT FK | References users |
| `message` | TEXT | Response content |
| `is_internal` | INT | 0 = public, 1 = internal note |
| `created_at` | TIMESTAMP | Response time |

### ticket_activity_log

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `ticket_id` | INT FK | References tickets |
| `action` | TEXT | Action type (created, status_changed, assigned, etc.) |
| `details` | TEXT (JSON) | Action details |
| `performed_by` | INT FK | References users |
| `created_at` | TIMESTAMP | Action time |

### ticket_tags

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `ticket_id` | INT FK | References tickets |
| `tag` | TEXT | Tag label |

### ticket_satisfaction

| Column | Type | Description |
|--------|------|-------------|
| `ticket_id` | INT FK | References tickets |
| `rating` | INT | 1-5 score |
| `comment` | TEXT | Customer feedback |

### ticket_links

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `source_ticket_id` | INT FK | References tickets |
| `target_ticket_id` | INT FK | References tickets |
| `link_type` | TEXT | related, parent, child, duplicate, references |

### ticket_cc

| Column | Type | Description |
|--------|------|-------------|
| `ticket_id` | INT FK | References tickets |
| `email` | TEXT | CC recipient email |

---

## Time & SLA

### time_entries

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `ticket_id` | INT FK | References tickets |
| `engineer_id` | INT FK | References engineers |
| `hours` | REAL | Time spent |
| `description` | TEXT | Work description |
| `is_chargeable` | INT | 0 = non-chargeable, 1 = chargeable |
| `entry_date` | DATE | Date of work |

### sla_policies

| Column | Type | Description |
|--------|------|-------------|
| `priority` | TEXT PK | low, medium, high, critical |
| `response_time_hours` | INT | Max first response time |
| `resolution_time_hours` | INT | Max resolution time |

### escalation_rules

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `priority` | TEXT | Trigger priority |
| `hours_threshold` | INT | Hours before escalation |
| `action` | TEXT | Escalation action |

---

## Users & Customers

### users

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `email` | TEXT UNIQUE | Email |
| `password_hash` | TEXT | Bcrypt hashed password |
| `name` | TEXT | Full name |
| `company` | TEXT | Company name |
| `role` | TEXT | admin, customer |

### customers (extended user info)

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | INT FK | References users |
| `company_ticket_visibility` | INT | 0/1 — can see company-wide tickets |
| `environment_notes` | TEXT | Technical environment info |
| `external_links` | TEXT (JSON) | Links to Odoo, dashboards, etc. |
| `professional_service_hours` | REAL | Remaining PS hours |

### customer_diagrams

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `customer_id` | INT FK | References customers |
| `filename` | TEXT | Image filename |
| `filepath` | TEXT | Storage path |
| `description` | TEXT | Diagram description |

---

## Other Tables

### knowledge_base

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `title` | TEXT | Article title |
| `content` | TEXT | Article body |
| `source_ticket_id` | INT FK | Originating ticket |
| `product_id` | INT FK | Related product |
| `tags` | TEXT (JSON) | Article tags |

### release_notes

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `product_id` | INT FK | References products |
| `version` | TEXT | Version number |
| `content` | TEXT | Release notes body |
| `published_at` | TIMESTAMP | Publish date |

### canned_responses

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `title` | TEXT | Template name |
| `content` | TEXT | Template body |
| `category` | TEXT | Template category |

### settings

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT PK | Setting key |
| `value` | TEXT | Setting value |

### notifications

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `user_id` | INT FK | References users |
| `type` | TEXT | Notification type |
| `message` | TEXT | Notification text |
| `is_read` | INT | 0/1 |
| `created_at` | TIMESTAMP | Notification time |
