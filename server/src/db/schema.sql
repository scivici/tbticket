-- Smart Ticket System Schema

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT 'Anonymous',
    company TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin')),
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    company_ticket_visibility INTEGER NOT NULL DEFAULT 0,
    environment_notes TEXT,
    external_links TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    model TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS question_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES product_categories(id),
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK(question_type IN ('text', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'number', 'date', 'file')),
    options TEXT, -- JSON array for select/radio/multiselect
    is_required INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    conditional_on INTEGER REFERENCES question_templates(id),
    conditional_value TEXT,
    placeholder TEXT,
    validation_rules TEXT, -- JSON object
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engineers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    location TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    current_workload INTEGER NOT NULL DEFAULT 0,
    max_workload INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS engineer_skills (
    engineer_id INTEGER NOT NULL REFERENCES engineers(id),
    skill_id INTEGER NOT NULL REFERENCES skills(id),
    proficiency INTEGER NOT NULL CHECK(proficiency BETWEEN 1 AND 5),
    PRIMARY KEY (engineer_id, skill_id)
);

CREATE TABLE IF NOT EXISTS engineer_product_expertise (
    engineer_id INTEGER NOT NULL REFERENCES engineers(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    category_id INTEGER REFERENCES product_categories(id),
    expertise_level INTEGER NOT NULL CHECK(expertise_level BETWEEN 1 AND 5),
    UNIQUE (engineer_id, product_id, category_id)
);

CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    category_id INTEGER NOT NULL REFERENCES product_categories(id),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    product_key TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'escalated_to_jira', 'resolved', 'closed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    assigned_engineer_id INTEGER REFERENCES engineers(id),
    jira_issue_key TEXT,
    ai_analysis TEXT, -- JSON object
    ai_confidence REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS ticket_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    question_template_id INTEGER NOT NULL REFERENCES question_templates(id),
    answer TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    author_id INTEGER NOT NULL REFERENCES customers(id),
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL CHECK(author_role IN ('admin', 'customer', 'engineer')),
    message TEXT NOT NULL,
    is_internal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket ON ticket_responses(ticket_id);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    type TEXT NOT NULL CHECK(type IN ('status_change', 'assigned', 'response', 'resolved', 'sla_breach', 'idle_ticket', 'reminder', 'version_update')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(customer_id, is_read);

CREATE TABLE IF NOT EXISTS sla_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    priority TEXT NOT NULL UNIQUE CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    response_time_hours INTEGER NOT NULL,
    resolution_time_hours INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS canned_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    created_by INTEGER REFERENCES customers(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    actor_id INTEGER REFERENCES customers(id),
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket ON ticket_activity_log(ticket_id);

CREATE TABLE IF NOT EXISTS ticket_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    tag TEXT NOT NULL,
    UNIQUE(ticket_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket ON ticket_tags(ticket_id);

CREATE TABLE IF NOT EXISTS ticket_satisfaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL UNIQUE REFERENCES tickets(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escalation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    hours_without_response INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('notify_admin', 'increase_priority', 'reassign')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    engineer_id INTEGER REFERENCES engineers(id),
    author_id INTEGER REFERENCES customers(id),
    author_name TEXT NOT NULL,
    hours REAL NOT NULL,
    description TEXT NOT NULL,
    is_chargeable INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_ticket ON time_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_engineer ON time_entries(engineer_id);

CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER REFERENCES tickets(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id),
    category_id INTEGER REFERENCES product_categories(id),
    tags TEXT,
    created_by INTEGER REFERENCES customers(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kb_product ON knowledge_base(product_id);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category_id);

CREATE TABLE IF NOT EXISTS ticket_cc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    email TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(ticket_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ticket_cc_ticket ON ticket_cc(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_cc_email ON ticket_cc(email);

CREATE TABLE IF NOT EXISTS ticket_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    linked_ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    link_type TEXT NOT NULL DEFAULT 'related' CHECK(link_type IN ('related', 'parent', 'child', 'duplicate')),
    created_by INTEGER REFERENCES customers(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(ticket_id, linked_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_links_ticket ON ticket_links(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_linked ON ticket_links(linked_ticket_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_answers_ticket ON ticket_answers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_question_templates_category ON question_templates(category_id);
