# TelcoBridges Ticketing System - Feature Status

> Last updated: 2026-03-25

---

## CURRENTLY SUPPORTED FEATURES

### 1. Ticket Management

| Feature | Status | Notes |
|---------|--------|-------|
| Ticket creation via customer portal | Done | Step-by-step wizard |
| Ticket creation by internal users | Done | Via admin panel |
| Anonymous ticket creation | Done | With email/name |
| Unique Ticket ID | Done | TKT-{timestamp}-{uuid} format |
| Product / Unit (SN or key) | Done | product_key field |
| Priority | Done | low/medium/high/critical |
| Severity / Classification | Done | Automatic via AI analysis |
| SLA status | Done | Defined per priority level |
| Ticket status / stage | Done | new, analyzing, assigned, in_progress, pending_info, resolved, closed |
| Assigned engineer | Done | Manual or AI-driven assignment |
| Tags | Done | Free-form tag add/remove |
| File attachments | Done | Up to 5 files during ticket creation |
| Assign / reassign ticket | Done | From admin panel |
| Put ticket on hold | Done | pending_info status |
| Public / private comments | Done | is_internal flag |
| Direct URL access to ticket (by number) | Done | /my-tickets/{id} works |
| Assignment by engineer | Done | Based on skills + expertise + workload |
| Bulk operations | Done | Bulk status, assign, delete |
| CSV export | Done | From ticket list |
| Activity audit trail | Done | All changes are logged |

### 2. Ticket States / Workflow

| State | Supported? |
|-------|------------|
| New | Yes |
| Analyzing (AI) | Yes |
| Assigned | Yes |
| In Progress | Yes |
| Waiting for Customer (pending_info) | Yes |
| Resolved | Yes |
| Closed | Yes |
| Escalated to Jira | No - Not yet implemented |

### 3. Customer & Account Management

| Feature | Status | Notes |
|---------|--------|-------|
| Customer ticket creation | Done | Via portal |
| View own tickets | Done | MyTickets page |
| File upload | Done | During ticket creation |
| Role-based permissions (Admin/Customer) | Done | JWT + middleware |
| Customer registration (with company info) | Done | |
| Profile management | Done | Name, company, password change |
| Admin user management | Done | CRUD + password management |

### 4. SLA & Time Management

| Feature | Status | Notes |
|---------|--------|-------|
| Define SLA per priority level | Done | sla_policies table |
| Display SLA in ticket | Done | On dashboard |
| First response time tracking | Done | response_time_hours |
| Resolution time tracking | Done | resolution_time_hours |
| SLA breach warnings | Done | On dashboard and escalation |
| Agent inactivity alerts | Done | Via escalation rules |

### 5. Search & Reporting

| Feature | Status | Notes |
|---------|--------|-------|
| Search by Ticket ID | Done | TicketTracker (public) |
| Search by status | Done | Filters available |
| Ticket volume reports | Done | Dashboard charts |
| Open vs closed tickets | Done | Dashboard KPIs |
| Engineer performance | Done | Resolved count + avg resolution time |
| Satisfaction rating | Done | Average score on dashboard |

### 6. Automation & AI Features

| Feature | Status | Notes |
|---------|--------|-------|
| Claude AI log analysis | Done | 3 modes: HTTP API, SSH/SFTP, Wrapper |
| AI classification and severity assessment | Done | Automatic JSON output |
| AI engineer recommendation | Done | Skill/expertise matching |
| Auto-assignment (confidence >= 0.7) | Done | Configurable threshold |
| Re-analyze trigger | Done | Button in admin panel |
| Fallback scoring algorithm | Done | When Claude is unavailable |
| Canned response templates | Done | CannedResponseManager |
| Escalation rules | Done | Priority + time + action |
| Recurring ticket detection | Done | By customer + product + category |

### 7. Notifications

| Feature | Status | Notes |
|---------|--------|-------|
| New ticket notifications | Done | In-app + email + webhook |
| In-app notifications | Done | Bell icon + unread count |
| Email notifications | Done | Via SMTP |
| Slack / Teams webhooks | Done | From settings page |

### 8. Product & Category Management

| Feature | Status | Notes |
|---------|--------|-------|
| Dynamic product CRUD | Done | ProductManager |
| Dynamic category CRUD | Done | With display order |
| Dynamic question templates | Done | 8 question types, conditional logic |
| Skill definitions management | Done | SkillManager |

### 9. License Validation

| Feature | Status | Notes |
|---------|--------|-------|
| Product key validation via external API | Done | From settings page |
| Support agreement check | Done | Redirect for unsupported customers |

### 10. Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Docker container | Done | Node 22 Alpine, port 4001 |
| SQLite database (WAL mode) | Done | Persistent volume |
| JWT authentication | Done | 24-hour expiry |
| Dark / Light theme | Done | Stored in localStorage |
| Responsive design | Done | Mobile menu |

---

## FUTURE IMPROVEMENTS (Not Yet Implemented)

### 1. Ticket Management - Missing

| Feature | Priority | Description |
|---------|----------|-------------|
| Ticket linking | High | Link a ticket to another ticket or to a specific comment |
| Jira integration | High | Create Jira issue from ticket, sync status, link ticket to Jira |
| "Escalated to Jira" status | High | Jira escalation state in workflow |
| URL access by ticket number | Medium | /my-tickets/TKT-xxx format not working, only ID works |
| Add attachments after creation | Medium | Upload additional files after ticket is created |
| Large file upload (up to 1GB) | Medium | Currently limited to 5 files, size limit unclear |
| CC user support | Medium | Add CC recipients to a ticket |
| Shift-based assignment | Low | Assign engineers based on time of day / shift |
| User mentions (@mention) | Low | Mention users in comments |

### 2. Customer & Account Management - Missing

| Feature | Priority | Description |
|---------|----------|-------------|
| Company-wide ticket visibility | High | View tickets from other users in the same company (configurable) |
| Add users to customer account | Medium | Invite new users under a company |
| Dashboard user access integration | Medium | SLA, phone numbers, installed units from central database |
| Diagrams and snapshots | Low | Environmental notes in customer profile |
| Environment notes | Low | Customer's technical environment information |
| External links (Odoo, dashboards, etc.) | Low | External system links on customer profile |

### 3. SLA & Time Management - Missing

| Feature | Priority | Description |
|---------|----------|-------------|
| Time since last response | Medium | Explicit display in ticket detail |
| Time since last access | Medium | Explicit display in ticket detail |
| Customer inactivity alert | Medium | Customer hasn't responded for X time |
| Manual time entry | Medium | Time spent logged by engineers |
| Automatic time tracking | Low | Automatically measure time spent on work |
| Chargeable vs non-chargeable time | Low | Separate time types |
| Kimai integration | Low | Professional service hours tracking |
| Remaining hours display | Low | Remaining hours for customer + support |

### 4. Search & Reporting - Missing

| Feature | Priority | Description |
|---------|----------|-------------|
| Search by customer / company | High | Customer filter in ticket list |
| Search by assigned engineer | High | Engineer filter in ticket list |
| Search by keywords | Medium | Content-based search (description, comments) |
| Search by tags | Medium | Tag-based filtering |
| "Show all except closed" filter | Medium | Default view |
| SLA compliance reports | Medium | Detailed SLA reports |
| Time spent per customer report | Low | After time tracking is implemented |

### 5. Integrations - Missing

| Feature | Priority | Description |
|---------|----------|-------------|
| Jira integration | High | Issue creation, status sync, ticket-Jira linking |
| Microsoft Teams integration | Medium | Calls, meeting scheduling |
| Live chat support | Medium | Chat directly from ticket |
| Convert chat to ticket | Medium | Chat to ticket conversion |
| Phone system / call center | Low | 24/7 phone integration |

### 6. Automation & AI - Missing

| Feature | Priority | Description |
|---------|----------|-------------|
| Auto-detect and request missing info | High | Auto-reply if SN or logs are missing |
| Required field enforcement (SN, logs, etc.) | High | Force mandatory files/info during ticket creation |
| How to get SN / product key guidance | Medium | Help text in wizard |
| How to get logs (tbreport, pcap) guidance | Medium | Help text in wizard |
| AI suggested replies | Medium | AI-based reply suggestions for engineers |
| AI Jira escalation suggestion | Medium | Claude suggests escalation |
| AI working session suggestion | Low | Claude suggests a working session |
| AI RMA suggestion | Low | Claude suggests RMA |
| Knowledge base automation | Low | Resolved ticket to KB article conversion |
| Reuse past answers | Low | Suggest answers from similar tickets |

### 7. Notifications - Missing

| Feature | Priority | Description |
|---------|----------|-------------|
| SLA breach alerts (to users) | Medium | Dedicated alerts for customers and engineers |
| Idle ticket alerts | Medium | Tickets with no activity for a long time |
| Customer response reminders | Medium | Send reminders to customers |
| Version update notifications | Low | Notify customers of new releases |

### 8. Lifecycle Automation - Missing

| Feature | Priority | Description |
|---------|----------|-------------|
| Auto-close after inactivity | Medium | Automatically close ticket after X days |
| Auto-reminders for customer updates | Medium | Periodic reminders |
| Rule-based auto-state transitions | Medium | e.g., auto-change status when response arrives |
| Release notes / latest version section | Low | Update information shown to customers |

### 9. File & Data Handling - Missing

| Feature | Priority | Description |
|---------|----------|-------------|
| Large file support (up to 1GB) | Medium | Increase current limit |
| Store logs for reuse | Low | Centralized log repository |
| Extract structured data from attachments | Low | AI-powered log parsing |

---

## SUMMARY STATISTICS

| Category | Completed | Missing |
|----------|-----------|---------|
| Ticket Management | 20 | 9 |
| Customer/Account Management | 7 | 6 |
| SLA/Time Management | 6 | 8 |
| Search/Reporting | 6 | 7 |
| Integrations | 4 | 5 |
| Automation/AI | 9 | 10 |
| Notifications | 4 | 4 |
| Lifecycle Automation | 0 | 4 |
| File Handling | 1 | 3 |
| Infrastructure | 5 | 0 |
| **TOTAL** | **62** | **56** |

> The system is strong in core ticketing functionality and AI integration. The biggest gaps are: Jira integration, time tracking, live chat, automatic lifecycle management, and advanced search/filtering.
