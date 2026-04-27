# Feature Guide

## Supported Products

| # | Product | Model | Domain |
|---|---------|-------|--------|
| 1 | ProSBC | Session Border Controller | VoIP security, SIP routing, transcoding |
| 2 | Tmedia Gateway | TMG800 | Small-scale media gateway |
| 3 | Tmedia Gateway | TMG3200 | Mid-scale media gateway |
| 4 | Tmedia Gateway | TMG7800 | Large-scale media gateway |
| 5 | Tsig Gateway | TSG800 | Signaling gateway (small) |
| 6 | Tsig Gateway | TSG3200 | Signaling gateway (large) |
| 7 | (Additional) | Configurable | Dynamic product management |

---

## Customer Features

### Ticket Creation (Wizard)
- Step-by-step wizard: Product → Category → Questionnaire → Details → Attachments → Review
- Dynamic questionnaires with conditional logic (8 question types)
- Required field enforcement (serial number, logs) per product/category
- Help text explaining how to get serial numbers and logs
- Up to 10 file attachments (100MB each)
- Anonymous ticket creation supported

### My Tickets
- View all personal tickets
- Company-wide ticket visibility (configurable)
- Filter by status ("show all except closed" default)
- Search by ticket ID, keywords, tags

### Ticket Detail (Customer View)
- Full conversation thread (public messages)
- Add responses and attachments after creation
- Satisfaction survey after resolution
- Time since last response display
- SLA status display

### Public Ticket Tracking
- Track any ticket by ticket number without login
- URL: `/track/TKT-xxxxx`

### Knowledge Base
- Browse articles from resolved tickets
- Search by product and keywords

### Release Notes
- View product version history and updates

### Profile Management
- Update name, company info
- Change password

---

## Admin Features

### Dashboard
- KPIs: open tickets, avg resolution time, SLA compliance, satisfaction score
- Charts: ticket volume over time, by product, by priority
- Engineer performance stats

### Ticket Management
- Full ticket list with advanced filters (status, product, engineer, customer, keywords, tags)
- Bulk operations: status update, assign, delete
- CSV export
- Ticket detail with full audit trail
- Internal notes (private comments)
- Re-trigger AI analysis
- Print-friendly ticket view

### Engineer Management
- CRUD engineers with contact info and location
- Set skill proficiencies (1-5) per skill
- Set product expertise (1-5) per product/category
- Shift-based assignment (start/end times, timezone)
- Workload capacity management

### Product Configuration
- Manage products, categories, question templates
- Manage skill definitions
- Configure required fields per product

### SLA Management
- Define SLA policies per priority (response time, resolution time)
- SLA breach dashboard
- SLA compliance reports

### Escalation Rules
- Configure auto-escalation triggers (priority + hours threshold)
- Active escalation alerts view

### Jira Integration
- Configure Jira connection (URL, API token, project key)
- Create Jira issue from ticket
- "Escalated to Jira" ticket status
- Live Jira issue status display

### Time Tracking
- Manual time entry per ticket (hours, description, date)
- Chargeable vs non-chargeable categorization
- Time reports per customer with engineer breakdown
- Professional service hours tracking per customer

### Notifications
- In-app notifications (bell icon + unread count)
- Email notifications via SMTP
- Slack/Teams webhook notifications
- SLA breach alerts
- Customer response reminders
- Version update notifications

### Canned Responses
- Pre-made reply templates
- Categorized by type

### Lifecycle Automation
- Auto-close after X days of inactivity
- Auto-reminders to customers
- Rule-based auto-state transitions
- Idle ticket alerts
- Customer inactivity alerts

### User Management
- CRUD admin and customer users
- Password management
- Role-based access control

### Health Dashboard
- Server health monitoring
- System status checks

---

## Ticket Workflow

```
New → Analyzing (AI) → Assigned → In Progress → Pending Info → Escalated to Jira → Resolved → Closed
                                       ↑                              |
                                       └──────────────────────────────┘
                                         (customer replies / re-open)
```

## Ticket Relationships

- **Related** — loosely connected tickets
- **Parent/Child** — hierarchical relationship
- **Duplicate** — same issue reported twice
- **References** — ticket references a comment in another ticket
