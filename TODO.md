# Development TODO - TelcoBridges Ticketing System

> Created: 2026-03-25 | Last updated: 2026-03-25

---

## COMPLETED

### Phase 1: Quick Wins & Core UX Fixes (6/6)

- [x] **1.1** URL access by ticket number (`/tickets/TKT-xxx` route support)
- [x] **1.2** "Show all except closed" as default filter in ticket list
- [x] **1.3** Add search filters: by customer/company, assigned engineer, tags, keywords
- [x] **1.4** Add attachments after ticket creation (on ticket detail page)
- [x] **1.5** Time since last response / last access display on ticket detail
- [x] **1.6** Help text in wizard: how to get SN/product key, how to get logs (tbreport, pcap)

### Phase 2: Required Field Enforcement & Validation (4/4)

- [x] **2.1** Required field enforcement: serial number / product key mandatory
- [x] **2.2** Required field enforcement: log files (tbreport, pcap) mandatory or prompted
- [x] **2.3** Auto-detect missing required info and auto-reply requesting it
- [x] **2.4** Configurable required fields per product/category in admin

### Phase 3: Company & Account Improvements (4/4)

- [x] **3.1** Company-wide ticket visibility (configurable per company)
- [x] **3.2** Add users to customer account (company visibility toggle)
- [x] **3.3** CC user support on tickets
- [x] **3.4** Customer profile: environment notes, external links (Odoo, dashboards)

### Phase 4: Ticket Linking & Relationships (4/4)

- [x] **4.1** Link ticket to another ticket (parent/child/related/duplicate/references)
- [x] **4.2** Link ticket to a specific comment (anchor IDs + copy link)
- [x] **4.3** Display linked tickets on ticket detail page
- [x] **4.4** Linked Jira issue field (manual entry — prep for Phase 6)

### Phase 5: Lifecycle Automation (5/5)

- [x] **5.1** Auto-close tickets after X days of inactivity (configurable)
- [x] **5.2** Auto-reminders to customers for pending updates
- [x] **5.3** Rule-based auto-state transitions (e.g., customer replies -> status changes)
- [x] **5.4** Customer inactivity alerts for engineers
- [x] **5.5** Idle ticket alerts (no activity for X time)

### Phase 6: Jira Integration (6/6)

- [x] **6.1** Jira connection settings in Setup page (URL, API token, project key)
- [x] **6.2** Create Jira issue from ticket (with ticket data pre-filled)
- [x] **6.3** "Escalated to Jira" ticket status in workflow
- [x] **6.4** Fetch Jira issue status via REST API
- [x] **6.5** Display linked Jira issue live status on ticket detail
- [x] **6.6** AI suggestion: recommend Jira escalation based on analysis

### Phase 7: AI Enhancements (4/4)

- [x] **7.1** AI suggested replies for engineers (draft response based on analysis + similar tickets)
- [x] **7.2** AI suggest working session / RMA when appropriate
- [x] **7.3** Knowledge base: convert resolved tickets to KB articles
- [x] **7.4** Reuse past answers: suggest solutions from similar resolved tickets

### Phase 8: Time Tracking (5/5)

- [x] **8.1** Manual time entry on ticket (hours + description + date)
- [x] **8.2** Chargeable vs non-chargeable time categorization
- [x] **8.3** Time spent per customer report (with engineer breakdown)
- [x] **8.4** SLA compliance detailed reports (by priority, response/resolution)
- [x] **8.5** Remaining professional service hours display per customer

### Phase 9: Notifications & Alerts Expansion (4/4)

- [x] **9.1** SLA breach alerts sent to customers and admins (scheduler-based)
- [x] **9.2** Customer response reminder emails (auto, configurable hours)
- [x] **9.3** Version update notifications to customers (admin-triggered per product)
- [x] **9.4** Release notes / latest version section on portal

### Phase 10: Advanced Integrations (1/5)

- [x] **10.5** Professional service hours tracking per customer

### Phase 11: File Handling & Low Priority (5/6)

- [x] **11.1** Large file upload support (up to 100MB, 10 files)
- [x] **11.2** Centralized log repository for reuse (browse/search all attachments)
- [x] **11.3** AI-powered structured data extraction from attachments
- [x] **11.4** Shift-based engineer assignment (time-of-day routing)
- [x] **11.5** User @mentions in comments (notify mentioned admins)
- [x] **11.6** Customer profile diagrams and snapshots (image upload per customer)

---

## REMAINING

### Requires External Service Setup

| # | Feature | Phase | Notes |
|---|---------|-------|-------|
| 10.1 | Microsoft Teams integration | 10 | Requires Teams webhook/bot registration |
| 10.2 | Live chat support within ticket | 10 | Requires WebSocket/real-time infrastructure |
| 10.3 | Convert chat conversation to ticket | 10 | Depends on 10.2 |
| 10.4 | Kimai integration for PS hours | 10 | Requires Kimai API endpoint |

---

## Progress Summary

| Phase | Items | Done | Status |
|-------|-------|------|--------|
| Phase 1: Quick Wins & Core UX | 6 | 6 | **DONE** |
| Phase 2: Field Enforcement | 4 | 4 | **DONE** |
| Phase 3: Company & Accounts | 4 | 4 | **DONE** |
| Phase 4: Ticket Linking | 4 | 4 | **DONE** |
| Phase 5: Lifecycle Automation | 5 | 5 | **DONE** |
| Phase 6: Jira Integration | 6 | 6 | **DONE** |
| Phase 7: AI Enhancements | 4 | 4 | **DONE** |
| Phase 8: Time Tracking | 5 | 5 | **DONE** |
| Phase 9: Notifications | 4 | 4 | **DONE** |
| Phase 10: Advanced Integrations | 5 | 1 | 20% (external services) |
| Phase 11: File & Low Priority | 6 | 6 | **DONE** |
| **TOTAL** | **53** | **49** | **92%** |

> 10 of 11 phases fully completed. 49 of 53 features implemented. Remaining 4 items require external service configuration (Microsoft Teams, WebSocket chat, Kimai).

---

## Implementation Notes

### Architecture Additions
- **Scheduler Service** (`scheduler.service.ts`) - Background task runner, 5-min interval
- **Jira Service** (`jira.service.ts`) - Jira REST API v3 integration
- **Knowledge Base** table + admin API for resolved ticket -> article conversion
- **Time Entries** table + per-ticket time logging with chargeable flag
- **Ticket Links** table + bidirectional linking (related/parent/child/duplicate/references)
- **Ticket CC** table + email notification to CC recipients
- **Release Notes** table + public portal page + admin CRUD
- **Customer Diagrams** table + image upload for network diagrams
- **Log Repository** - Browse/search all uploaded files across tickets
- **AI Data Extraction** - Parse log files for errors, IPs, SIP methods, timestamps

### New Database Tables
- `time_entries` - Time tracking per ticket
- `knowledge_base` - Articles from resolved tickets
- `ticket_cc` - CC recipients per ticket
- `ticket_links` - Ticket-to-ticket relationships
- `release_notes` - Product version history
- `customer_diagrams` - Customer environment diagrams/snapshots

### New Columns
- `customers`: `company_ticket_visibility`, `environment_notes`, `external_links`, `professional_service_hours`
- `tickets`: `jira_issue_key`
- `products`: `required_fields` (JSON)
- `engineers`: `shift_start`, `shift_end`, `timezone`

### New Settings (Setup Page)
- **Automation Tab**: `auto_close_days`, `auto_state_transitions`, `idle_ticket_alert_hours`, `customer_reminder_hours`
- **Jira Tab**: `jira_base_url`, `jira_api_email`, `jira_api_token`, `jira_project_key`, `jira_issue_type`

### New Ticket Status
- `escalated_to_jira` - Added to workflow between `pending_info` and `resolved`

### New Pages
- `/release-notes` - Public customer-facing release notes portal
