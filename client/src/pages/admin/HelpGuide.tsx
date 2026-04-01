import React, { useState } from 'react';
import {
  BookOpen, LogIn, LayoutDashboard, Ticket, Users, AlertTriangle, Clock, ShieldAlert,
  ExternalLink, Timer, MessageSquare, Tag, Search, Keyboard, Lightbulb, ChevronDown, ChevronRight
} from 'lucide-react';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

function Collapse({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="tb-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue">{icon}</span>
        <h3 className="font-semibold text-gray-900 dark:text-white flex-1">{title}</h3>
        {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">{children}</div>}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {headers.map((h, i) => <th key={i} className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
              {row.map((cell, j) => <td key={j} className="py-2 px-3 text-gray-600 dark:text-gray-400">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HelpGuide() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-accent-blue" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support Specialist Guide</h1>
      </div>

      <div className="space-y-3">
        {/* Getting Started */}
        <Collapse title="Getting Started" icon={<LogIn className="w-4 h-4" />} defaultOpen={true}>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Receiving Your Credentials</h4>
              <p>When your account is created by an administrator, you will receive an email containing your <strong>Login URL</strong>, <strong>Email</strong> (username), and <strong>Password</strong>.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Logging In</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Navigate to the login page</li>
                <li>Enter your email and password</li>
                <li>Click <strong>Log In</strong></li>
                <li>You will be redirected directly to the Support Panel</li>
              </ol>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300">
              It is recommended to change your password after your first login.
            </div>
          </div>
        </Collapse>

        {/* Support Panel Overview */}
        <Collapse title="Support Panel Overview" icon={<LayoutDashboard className="w-4 h-4" />}>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>After logging in, you will see the Support Panel sidebar with the following sections:</p>
            <Table
              headers={['Menu', 'Description']}
              rows={[
                ['Dashboard', 'Overview of ticket statistics, recent activity, and system metrics'],
                ['Tickets', 'View, manage, and respond to all support tickets'],
                ['Customers', 'Browse customer profiles and their ticket history'],
                ['Escalations', 'Monitor escalation rules and alerts for overdue tickets'],
                ['Time Reports', 'Track time entries and view your time logs'],
                ['SLA Dashboard', 'Monitor SLA compliance, response times, and breached tickets'],
              ]}
            />
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-800 dark:text-blue-300">
              Administrative functions (Products, Categories, Skills, Setup, user management) are only accessible to administrators.
            </div>
          </div>
        </Collapse>

        {/* Managing Tickets */}
        <Collapse title="Managing Tickets" icon={<Ticket className="w-4 h-4" />}>
          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Viewing Tickets</h4>
              <p className="mb-2">Click <strong>Tickets</strong> in the sidebar. Use filters to narrow down:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Status</strong> — New, Analyzing, Assigned, In Progress, Pending Info, Escalated to Jira, Resolved, Closed</li>
                <li><strong>Priority</strong> — Critical, High, Medium, Low</li>
                <li><strong>Product</strong> — Filter by product</li>
                <li><strong>Engineer</strong> — Filter by assigned specialist</li>
                <li><strong>Search</strong> — Search by ticket number, subject, or description</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Ticket Actions</h4>
              <Table
                headers={['Action', 'Description']}
                rows={[
                  ['Update Status', 'Change ticket status (In Progress, Pending Info, Resolved, etc.)'],
                  ['Assign Specialist', 'Assign or reassign the ticket'],
                  ['Change Priority', 'Adjust the ticket priority level'],
                  ['Re-analyze with AI', 'Trigger a new AI analysis with optional custom prompt'],
                  ['Escalate to Jira', 'Create a Jira incident linked to the ticket'],
                  ['Merge Ticket', 'Merge another ticket into the current one'],
                ]}
              />
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Responding to Tickets</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Type your response in the message box at the bottom of the ticket detail</li>
                <li>Toggle <strong>Internal Note</strong> to add notes visible only to staff</li>
                <li>Use <strong>Canned Responses</strong> for frequently used reply templates</li>
                <li>Use <strong>AI Suggest Reply</strong> to generate an AI-powered response</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">AI Analysis</h4>
              <p>Each ticket includes an AI-generated analysis with:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Classification</strong> — Issue type identification</li>
                <li><strong>Severity</strong> — Recommended priority level</li>
                <li><strong>Recommended Specialist</strong> — Best engineer based on skills</li>
                <li><strong>Complexity</strong> — Estimated difficulty</li>
                <li><strong>Full Technical Report</strong> — Detailed technical assessment</li>
              </ul>
            </div>
          </div>
        </Collapse>

        {/* Time Tracking */}
        <Collapse title="Time Tracking" icon={<Timer className="w-4 h-4" />}>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>Track time spent on each ticket using the timer or manual entries.</p>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Using the Timer</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open a ticket detail page</li>
                <li>Click <strong>Start Timer</strong> to begin tracking</li>
                <li>Work on the ticket</li>
                <li>Click <strong>Stop Timer</strong> — add a description and mark as chargeable/non-chargeable</li>
              </ol>
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300">
                Only one timer can be active at a time. Stop the current timer before starting a new one.
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Manual Time Entry</h4>
              <p>Add entries manually with hours, description, and activity type:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['General', 'Investigation', 'Configuration', 'Testing', 'Documentation', 'Meeting', 'Travel'].map(t => (
                  <span key={t} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </Collapse>

        {/* Jira Escalation */}
        <Collapse title="Jira Escalation" icon={<ExternalLink className="w-4 h-4" />}>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>When a ticket requires engineering attention, escalate it to Jira:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Open the ticket detail page</li>
              <li>Click <strong>Escalate to Jira</strong></li>
              <li>A form will appear with pre-filled and editable fields</li>
              <li>Click <strong>Create Jira Incident</strong></li>
            </ol>

            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Pre-filled Fields (automatic)</h4>
              <Table
                headers={['Field', 'Value']}
                rows={[
                  ['Work Type', 'Incident (always)'],
                  ['Summary', '[Ticket Number] Subject'],
                  ['Components', 'SBC or TMG (auto-detected from product)'],
                  ['Priority', 'Mapped from ticket priority'],
                ]}
              />
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Editable Fields</h4>
              <Table
                headers={['Field', 'Description']}
                rows={[
                  ['Labels', 'Type to search, select from dropdown (multi-select)'],
                  ['Account', 'Type to search, select customer account'],
                  ['Affected Version', 'Type to search, select the SBC/TMG version'],
                  ['Escalation Notes', 'Notes for the engineering team (becomes Jira description)'],
                ]}
              />
            </div>

            <p>After escalation, the ticket status changes to <strong>Escalated to Jira</strong> and the Jira issue key is displayed with a link.</p>
          </div>
        </Collapse>

        {/* Customer Management */}
        <Collapse title="Customer Management" icon={<Users className="w-4 h-4" />}>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>Click <strong>Customers</strong> in the sidebar to browse customer profiles.</p>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Customer Profile Includes</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Contact Information</strong> — Email, company, account creation date</li>
                <li><strong>Ticket History</strong> — All tickets submitted by the customer</li>
                <li><strong>Environment Notes</strong> — Technical environment details</li>
                <li><strong>External Links</strong> — Related resources and documentation</li>
              </ul>
            </div>
          </div>
        </Collapse>

        {/* Escalation Monitoring */}
        <Collapse title="Escalation Monitoring" icon={<AlertTriangle className="w-4 h-4" />}>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>The Escalations page shows configured rules that automatically trigger actions for overdue tickets:</p>
            <Table
              headers={['Action', 'Description']}
              rows={[
                ['Notify Admin', 'Sends alerts when tickets are overdue'],
                ['Increase Priority', 'Automatically raises priority for stale tickets'],
                ['Reassign', 'Reassigns tickets that have been idle too long'],
              ]}
            />
            <p>Monitor <strong>Escalation Alerts</strong> to identify tickets that need immediate attention.</p>
          </div>
        </Collapse>

        {/* SLA Dashboard */}
        <Collapse title="SLA Dashboard" icon={<ShieldAlert className="w-4 h-4" />}>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>The SLA Dashboard provides real-time monitoring of service level agreements:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Compliance Rate</strong> — Percentage of tickets meeting SLA targets by priority</li>
              <li><strong>Response Time Metrics</strong> — Average first response times vs. SLA targets</li>
              <li><strong>Resolution Time Metrics</strong> — Average resolution times vs. SLA targets</li>
              <li><strong>Trend Data</strong> — SLA compliance over the last 30 days</li>
              <li><strong>Breached Tickets</strong> — Tickets that exceeded SLA targets with overdue hours</li>
            </ul>
          </div>
        </Collapse>

        {/* Keyboard Shortcuts */}
        <Collapse title="Keyboard Shortcuts" icon={<Keyboard className="w-4 h-4" />}>
          <div className="text-sm">
            <Table
              headers={['Shortcut', 'Action']}
              rows={[
                ['Alt + D', 'Go to Dashboard'],
                ['Alt + T', 'Go to Tickets'],
                ['Escape', 'Close modal / overlay'],
                ['?', 'Toggle keyboard shortcuts help'],
              ]}
            />
          </div>
        </Collapse>

        {/* Tips & Best Practices */}
        <Collapse title="Tips & Best Practices" icon={<Lightbulb className="w-4 h-4" />}>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-accent-blue font-bold">1.</span>
              <p><strong>Check the Dashboard regularly</strong> — Stay on top of new and unassigned tickets</p>
            </div>
            <div className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-accent-blue font-bold">2.</span>
              <p><strong>Use Internal Notes</strong> — Communicate with other specialists without notifying the customer</p>
            </div>
            <div className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-accent-blue font-bold">3.</span>
              <p><strong>Track your time</strong> — Use the timer feature for accurate time logging</p>
            </div>
            <div className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-accent-blue font-bold">4.</span>
              <p><strong>Leverage AI Analysis</strong> — Review the AI-generated analysis before investigating; it often identifies the root cause</p>
            </div>
            <div className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-accent-blue font-bold">5.</span>
              <p><strong>Use Canned Responses</strong> — Save time on common replies</p>
            </div>
            <div className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-accent-blue font-bold">6.</span>
              <p><strong>Monitor SLA</strong> — Keep an eye on the SLA Dashboard to prevent breaches</p>
            </div>
            <div className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-accent-blue font-bold">7.</span>
              <p><strong>Escalate when needed</strong> — Don't hesitate to escalate complex issues to Jira with detailed notes</p>
            </div>
            <div className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-accent-blue font-bold">8.</span>
              <p><strong>Tag tickets</strong> — Use tags to organize and find related tickets quickly</p>
            </div>
          </div>
        </Collapse>

        {/* Troubleshooting */}
        <Collapse title="Troubleshooting" icon={<Search className="w-4 h-4" />}>
          <div className="text-sm">
            <Table
              headers={['Issue', 'Solution']}
              rows={[
                ['Cannot log in', 'Verify your email and password. Contact admin if you forgot your password.'],
                ['Cannot see tickets', 'Ensure you are logged in. Try refreshing the page.'],
                ['Jira escalation fails', 'Check if Jira credentials are configured (contact admin). Review the error message.'],
                ['Timer not working', 'Only one timer can be active at a time. Stop the current timer first.'],
                ['Missing menu items', 'Some menus are admin-only. Contact your administrator if you need access.'],
              ]}
            />
          </div>
        </Collapse>
      </div>
    </div>
  );
}
