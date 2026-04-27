# Support Specialist User Guide

## TelcoBridges Support Ticket System

---

## 1. Getting Started

### Receiving Your Credentials
When your account is created by an administrator, you will receive an email containing:
- **Login URL** — Direct link to the login page
- **Email** — Your email address (used as username)
- **Password** — Your initial password

### Logging In
1. Navigate to the login page
2. Enter your **email** and **password**
3. Click **Log In**
4. You will be redirected directly to the **Support Panel**

> **Note:** It is recommended to change your password after your first login.

---

## 2. Support Panel Overview

After logging in, you will see the Support Panel with a sidebar containing the following sections:

| Menu Item | Description |
|-----------|-------------|
| **Dashboard** | Overview of ticket statistics, recent activity, and system metrics |
| **Tickets** | View, manage, and respond to all support tickets |
| **Customers** | Browse customer profiles and their ticket history |
| **Escalations** | Monitor escalation rules and alerts for overdue tickets |
| **Time Reports** | Track time entries and view your time logs |
| **SLA Dashboard** | Monitor SLA compliance, response times, and breached tickets |

> **Note:** Administrative functions such as Products, Categories, Skills, Setup, and user management are only accessible to administrators.

---

## 3. Dashboard

The Dashboard provides a quick overview of:
- **Open Tickets** — Total number of active tickets
- **Unassigned Tickets** — Tickets awaiting assignment
- **SLA Breaches** — Tickets that have exceeded SLA targets
- **Recent Activity** — Latest ticket updates and assignments

---

## 4. Managing Tickets

### Viewing Tickets
1. Click **Tickets** in the sidebar
2. Use filters to narrow down tickets:
   - **Status** — New, Analyzing, Assigned, In Progress, Pending Info, Escalated to Jira, Resolved, Closed
   - **Priority** — Critical, High, Medium, Low
   - **Product** — Filter by product
   - **Engineer** — Filter by assigned specialist
   - **Search** — Search by ticket number, subject, or description

### Ticket Detail View
Click on any ticket to open its detail view. Here you can:

#### View Information
- **Customer details** — Name, email, company
- **Product & Category** — The product and issue category
- **AI Analysis** — Automated analysis including classification, severity, recommended specialist, and complexity
- **Full Technical Report** — Detailed AI-generated technical assessment

#### Take Actions
- **Update Status** — Change ticket status (e.g., In Progress, Pending Info, Resolved)
- **Assign Specialist** — Assign or reassign the ticket to a specialist
- **Change Priority** — Adjust the ticket priority level
- **Re-analyze with AI** — Trigger a new AI analysis with optional custom prompt
- **Escalate to Jira** — Create a Jira issue linked to the ticket (see Section 6)
- **Merge Ticket** — Merge another ticket into the current one

#### Respond to Tickets
- Type your response in the message box at the bottom
- Toggle **Internal Note** to add notes visible only to staff (not sent to customer)
- Use **Canned Responses** for frequently used reply templates
- Use **AI Suggest Reply** to generate an AI-powered response suggestion

#### Manage Attachments
- View customer-uploaded files and images
- Add additional attachments
- Extract data from attachments using AI

#### Time Tracking
- **Start Timer** — Begin tracking time spent on the ticket
- **Stop Timer** — Stop the timer and log the time entry
- **Add Manual Entry** — Add a time entry with hours, description, and activity type
- Activity types: General, Investigation, Configuration, Testing, Documentation, Meeting, Travel

#### Tags
- Add tags to categorize and organize tickets
- Remove tags as needed

#### Linked Tickets
- Link related tickets together
- View linked ticket details

---

## 5. Customer Management

### Viewing Customers
1. Click **Customers** in the sidebar
2. Browse the customer list or search by name/email/company
3. Click on a customer to view their profile

### Customer Profile
- **Contact Information** — Email, company, account creation date
- **Ticket History** — All tickets submitted by the customer
- **Environment Notes** — Technical environment details
- **External Links** — Related resources and documentation

---

## 6. Jira Escalation

When a ticket requires engineering attention, you can escalate it to Jira:

1. Open the ticket detail page
2. Click **Escalate to Jira**
3. A modal will appear with:
   - **Pre-filled fields** (read-only):
     - Work Type: Incident
     - Summary: [Ticket Number] Subject
     - Components: SBC or TMG (auto-detected from product)
     - Priority: Mapped from ticket priority
   - **Fields you can fill**:
     - **Labels** — Type to search, select from dropdown (multi-select)
     - **Account** — Type to search, select customer account
     - **Affected Version** — Type to search, select the version
     - **Escalation Notes** — Add notes for the engineering team (becomes the Jira description)
4. Click **Create Jira Incident**
5. The ticket status will change to **Escalated to Jira** and the Jira issue key will be displayed

### Viewing Jira Status
Once escalated, the ticket detail page shows:
- **Jira Issue Key** — Clickable link to the Jira issue
- **Jira Status** — Current status of the Jira issue (e.g., To Do, In Progress, Done)

---

## 7. Escalation Monitoring

### Escalation Rules
View the configured escalation rules that automatically trigger actions when tickets remain unresolved:
- **Notify Admin** — Sends alerts when tickets are overdue
- **Increase Priority** — Automatically raises priority for stale tickets
- **Reassign** — Reassigns tickets that have been idle too long

### Escalation Alerts
Monitor active escalation alerts to identify tickets that need immediate attention.

---

## 8. Time Reports

### Viewing Time Reports
1. Click **Time Reports** in the sidebar
2. Filter by:
   - **Date Range** — Select start and end dates
   - **Engineer** — Filter by specialist (your entries are shown by default)
   - **Customer** — Filter by customer
   - **Activity Type** — Filter by type of work
3. View detailed time entries with:
   - Ticket reference
   - Description of work performed
   - Hours logged
   - Chargeable/non-chargeable status

---

## 9. SLA Dashboard

### Monitoring SLA Compliance
The SLA Dashboard shows:
- **Compliance Rate** — Percentage of tickets meeting SLA targets, broken down by priority
- **Response Time Metrics** — Average first response times vs. SLA targets
- **Resolution Time Metrics** — Average resolution times vs. SLA targets
- **Trend Data** — SLA compliance trend over the last 30 days
- **Breached Tickets** — List of tickets that have exceeded SLA targets with overdue hours

### SLA Targets (Reference)
| Priority | Response Time | Resolution Time |
|----------|--------------|-----------------|
| Critical | Defined by admin | Defined by admin |
| High | Defined by admin | Defined by admin |
| Medium | Defined by admin | Defined by admin |
| Low | Defined by admin | Defined by admin |

> Contact your administrator for specific SLA target values.

---

## 10. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + D` | Go to Dashboard |
| `Alt + T` | Go to Tickets |
| `Escape` | Close modal / overlay |
| `?` | Toggle keyboard shortcuts help |

---

## 11. Tips & Best Practices

1. **Check the Dashboard regularly** — Stay on top of new and unassigned tickets
2. **Use Internal Notes** — Communicate with other specialists without notifying the customer
3. **Track your time** — Use the timer feature for accurate time logging
4. **Leverage AI Analysis** — Review the AI-generated analysis before investigating; it often identifies the root cause
5. **Use Canned Responses** — Save time on common replies
6. **Monitor SLA** — Keep an eye on the SLA Dashboard to prevent breaches
7. **Escalate when needed** — Don't hesitate to escalate complex issues to Jira with detailed notes
8. **Tag tickets** — Use tags to organize and find related tickets quickly

---

## 12. Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot log in | Verify your email and password. Contact admin if you forgot your password. |
| Cannot see tickets | Ensure you are logged in with the correct account. Try refreshing the page. |
| Jira escalation fails | Check if Jira credentials are configured (contact admin). Review the error message for details. |
| Timer not working | Only one timer can be active at a time. Stop the current timer before starting a new one. |
| Missing menu items | Some menus are admin-only. Contact your administrator if you need access. |

---

*For additional help or to report issues, contact your system administrator.*
