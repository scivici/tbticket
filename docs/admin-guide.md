# Admin Guide

This guide covers how to use the admin panel at `/admin`.

---

## Getting Started

1. Login with an admin account at `/login`
2. You will be redirected to the admin dashboard
3. The sidebar gives access to all admin features

## Dashboard

The main dashboard shows:
- **KPIs**: Total open tickets, avg resolution time, SLA compliance %, avg satisfaction
- **Charts**: Ticket volume over time, distribution by product, by priority
- **Engineer Stats**: Per-engineer resolved count and avg resolution time

---

## Ticket Management

### Ticket List (`/admin/tickets`)
- Filter by: status, product, assigned engineer, customer, priority, keywords, tags
- Default filter: "show all except closed"
- Sort by any column
- Bulk actions: select multiple tickets → change status / assign / delete
- Export to CSV

### Ticket Detail (`/admin/tickets/:id`)
- View full ticket info, AI analysis, and activity log
- **Actions**:
  - Change status, priority, assignment
  - Add public response or internal note
  - Add/remove tags
  - Upload additional attachments
  - Link to other tickets or Jira issues
  - Add CC recipients
  - Log time entries
  - Re-trigger AI analysis
  - View AI suggested replies
  - Print ticket

---

## Engineer Setup (`/admin/engineers`)

### Create/Edit Engineer
- Name, email, location
- Active/inactive toggle
- Max workload capacity
- Shift hours (start, end, timezone)

### Skills & Expertise
For each engineer, set:
- **Skills** (e.g., SIP, VoIP, SS7, TLS) — proficiency 1-5
- **Product Expertise** (per product + category) — expertise 1-5

These ratings are used by the AI and the fallback algorithm to match tickets to the best engineer.

---

## Product Configuration

### Products (`/admin/products`)
- Add/edit/delete telecom products
- Set required fields per product (serial number, logs, etc.)

### Categories (`/admin/categories`)
- Define categories per product (Configuration, Troubleshooting, Performance, etc.)
- Set display order

### Question Templates (`/admin/questions`)
- Create dynamic questionnaires per product/category
- 8 question types: text, textarea, select, multiselect, radio, checkbox, number, date
- Set required/optional
- Add conditional logic (show question B only if answer to A = X)

### Skills (`/admin/skills`)
- Define available skill types (SIP, TLS, VoIP, SS7, etc.)
- These skills are then assignable to engineers

---

## SLA Configuration (`/admin/sla`)

Define response and resolution time targets per priority:

| Priority | Response Time | Resolution Time |
|----------|--------------|-----------------|
| Critical | 1 hour | 4 hours |
| High | 4 hours | 24 hours |
| Medium | 8 hours | 72 hours |
| Low | 24 hours | 168 hours |

The SLA dashboard shows breached and at-risk tickets.

---

## Escalation Rules (`/admin/escalation`)

Configure automatic escalation triggers:
- **Trigger**: priority level + hours without response
- **Action**: notify admin, reassign, change priority, etc.

---

## Jira Integration (`/admin/setup` → Jira tab)

1. Set Jira Base URL (e.g., `https://telcobridges.atlassian.net`)
2. Set API Email and API Token
3. Set Project Key and Issue Type
4. Once configured, you can:
   - Click "Create Jira Issue" on any ticket
   - See live Jira issue status on ticket detail
   - AI will suggest Jira escalation when appropriate

---

## Setup Page (`/admin/setup`)

Central configuration for all system settings:

| Tab | Settings |
|-----|----------|
| **General** | App name, URL, timezone |
| **Claude AI** | Server URL, auth type, model, auto-assign threshold, analysis mode |
| **SSH/SFTP** | Host, port, user, password, remote path |
| **Email** | SMTP host, port, user, password, from address |
| **Notifications** | Slack webhook URL, Teams webhook URL |
| **Jira** | Base URL, API email, API token, project key, issue type |
| **Automation** | Auto-close days, auto-state transitions, idle alert hours, customer reminder hours |
| **License** | License validation API settings |

---

## User Management (`/admin/users`)

- Create admin or customer accounts
- Reset passwords
- Enable/disable accounts
- View customer list with company info

---

## Reports

### Time Reports (`/admin/time-reports`)
- Time spent per customer
- Engineer breakdown
- Chargeable vs non-chargeable hours
- Professional service hours remaining

### Recurring Tickets (`/admin/recurring`)
- Patterns: same customer + product + category
- Helps identify systemic issues
