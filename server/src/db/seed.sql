-- ============ Admin User (password: admin123) ============
INSERT INTO customers (email, name, password_hash, role)
VALUES ('admin@telcobridges.com', 'TB Admin', '$2a$10$UIqE7rpJ9B.WUvHyzdtC2elkZFfwX3nZOWc2/eFmmnJ0Z2Zw3jnj2', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ============ Products ============
INSERT INTO products (id, name, model, description, image_url) VALUES
(1, 'ProSBC', 'SBC-SW', 'Carrier-grade Session Border Controller software. SIP trunking, peering, STIR/SHAKEN, DDoS protection, Microsoft Teams Direct Routing. 500 to 60,000 concurrent sessions.', '/images/prosbc.png'),
(3, 'TMG800', 'TMG800', 'Entry-level 1U VoIP/SS7 media gateway. 1-16 T1/E1, 32-512 VoIP channels. Software upgradeable capacity.', '/images/tmg800-3200.png'),
(4, 'TMG3200', 'TMG3200', 'Mid-density 1U carrier-grade VoIP media gateway. Up to 64 T1/E1, 3 DS3, or 1 OC3/STM-1.', '/images/tmg800-3200.png'),
(5, 'TMG7800', 'TMG7800', 'High-density scalable cluster-based VoIP media gateway. Up to 1,024 T1/E1 per cluster, 131,072 channels max.', '/images/tmg7800.png'),
(6, 'TSG800', 'TSG800', 'Cost-effective 1U SS7/SIGTRAN signaling gateway. 1-16 T1/E1 with software upgradeable capacity.', '/images/tmg800-3200.png'),
(7, 'TSG3200', 'TSG3200', 'High-density signaling gateway. 16-64 T1/E1, 1-3 DS3, or 1 OC3/STM-1. SS7-to-SIGTRAN translation.', '/images/tmg800-3200.png')
ON CONFLICT DO NOTHING;

-- Reset product sequence
SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM products));

-- ============ Product Categories ============

-- ProSBC categories
INSERT INTO product_categories (id, product_id, name, description, icon, display_order) VALUES
(1, 1, 'SIP Trunking & Peering', 'SIP trunk configuration, peering issues, call routing problems', 'network', 1),
(2, 1, 'STIR/SHAKEN', 'Caller ID authentication, certificate management, attestation issues', 'shield', 2),
(3, 1, 'Security & DDoS', 'DDoS/DoS protection, blacklisting, fraud detection, TLS/sRTP', 'shield', 3),
(4, 1, 'Call Quality', 'Audio quality issues, codec problems, transcoding, MOS scores', 'activity', 4),
(5, 1, 'Microsoft Teams', 'Teams Direct Routing setup, connectivity, and call flow issues', 'link', 5),
(6, 1, 'High Availability', 'Failover configuration, ProSBC+ HA, geo-redundancy issues', 'server', 6),
(7, 1, 'Installation & Licensing', 'Deployment, activation, upgrades, cloud setup (AWS/Azure/KVM)', 'download', 7),
(8, 1, 'API & Integration', 'RESTful API, CDR, RADIUS, SNMP, OSS/BSS connector issues', 'cpu', 8)
ON CONFLICT DO NOTHING;

-- TMG800 categories
INSERT INTO product_categories (id, product_id, name, description, icon, display_order) VALUES
(13, 3, 'Hardware & Installation', 'Rack mounting, power, physical interface issues', 'server', 1),
(14, 3, 'T1/E1 Configuration', 'T1/E1 interface setup, signaling, and connectivity', 'network', 2),
(15, 3, 'Call Quality & Codecs', 'Audio quality, echo, jitter, codec negotiation', 'activity', 3),
(16, 3, 'SS7 Signaling', 'SS7 link setup, ISDN PRI configuration, signaling issues', 'cpu', 4),
(17, 3, 'Firmware & Upgrades', 'Firmware updates, capacity upgrades, software issues', 'download', 5)
ON CONFLICT DO NOTHING;

-- TMG3200 categories
INSERT INTO product_categories (id, product_id, name, description, icon, display_order) VALUES
(18, 4, 'Hardware & Installation', 'Rack mounting, power, physical interface issues', 'server', 1),
(19, 4, 'Interface Configuration', 'T1/E1, DS3, OC3/STM-1 interface setup and connectivity', 'network', 2),
(20, 4, 'Call Quality & Codecs', 'Audio quality, echo, jitter, codec negotiation', 'activity', 3),
(21, 4, 'SS7 & ISDN', 'SS7 signaling, ISDN PRI, SIGTRAN configuration', 'cpu', 4),
(22, 4, 'Firmware & Upgrades', 'Firmware updates, capacity expansion', 'download', 5)
ON CONFLICT DO NOTHING;

-- TMG7800 categories
INSERT INTO product_categories (id, product_id, name, description, icon, display_order) VALUES
(23, 5, 'Hardware & Cluster Setup', 'Cluster configuration, rack mounting, hardware issues', 'server', 1),
(24, 5, 'Interface Configuration', 'T1/E1, DS3, OC3/STM-1 interface setup across clusters', 'network', 2),
(25, 5, 'Scalability & Performance', 'Cluster scaling, capacity issues, performance tuning', 'trending-up', 3),
(26, 5, 'SS7 & Signaling', 'SS7 link management, SIGTRAN, signaling across clusters', 'cpu', 4),
(27, 5, 'Redundancy & Failover', 'HA configuration, failover between cluster nodes', 'shield', 5)
ON CONFLICT DO NOTHING;

-- TSG800 categories
INSERT INTO product_categories (id, product_id, name, description, icon, display_order) VALUES
(28, 6, 'SS7 Link Configuration', 'SS7 link setup, alignment, point code configuration', 'network', 1),
(29, 6, 'SIGTRAN Setup', 'M2UA/M3UA configuration, SS7-to-SIGTRAN translation', 'cpu', 2),
(30, 6, 'Hardware & Firmware', 'Hardware issues, firmware updates, interface problems', 'server', 3),
(31, 6, 'Redundancy', '1+1 redundancy setup and failover issues', 'shield', 4)
ON CONFLICT DO NOTHING;

-- TSG3200 categories
INSERT INTO product_categories (id, product_id, name, description, icon, display_order) VALUES
(32, 7, 'SS7 Link Configuration', 'SS7 link setup, alignment, point code configuration', 'network', 1),
(33, 7, 'SIGTRAN Setup', 'M2UA/M3UA configuration, SS7-to-SIGTRAN translation', 'cpu', 2),
(34, 7, 'Interface Configuration', 'T1/E1, DS3, OC3/STM-1 interface configuration', 'network', 3),
(35, 7, 'Hardware & Firmware', 'Hardware issues, firmware updates, RMA requests', 'server', 4)
ON CONFLICT DO NOTHING;

-- Reset category sequence
SELECT setval('product_categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM product_categories));

-- ============ Question Templates ============

-- Category 1: ProSBC - SIP Trunking & Peering
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(1, 1, 'What type of SIP issue are you experiencing?', 'select', '["Trunk registration failure", "Calls not completing", "One-way audio", "Wrong call routing", "SIP 4xx/5xx errors", "Codec mismatch", "NAT traversal issue", "Other"]', TRUE, 1, NULL),
(2, 1, 'How many concurrent sessions is your ProSBC configured for?', 'select', '["500-1000", "1000-5000", "5000-10000", "10000-30000", "30000-60000"]', TRUE, 2, NULL),
(3, 1, 'Deployment environment', 'select', '["Bare-metal COTS", "KVM", "AWS", "Azure", "Other cloud"]', TRUE, 3, NULL),
(4, 1, 'ProSBC version', 'text', NULL, TRUE, 4, 'e.g., v4.2.1'),
(5, 1, 'Number of affected trunk groups', 'radio', '["Single trunk", "Multiple trunks", "All trunks"]', TRUE, 5, NULL),
(6, 1, 'SIP error codes observed (if any)', 'text', NULL, FALSE, 6, 'e.g., 403 Forbidden, 503 Service Unavailable'),
(7, 1, 'Please describe the issue in detail', 'textarea', NULL, TRUE, 7, 'Include SIP trace excerpts if available...'),
(8, 1, 'When did the issue start?', 'select', '["Today", "This week", "After a configuration change", "After an upgrade", "Intermittent/recurring"]', TRUE, 8, NULL)
ON CONFLICT DO NOTHING;

-- Category 2: ProSBC - STIR/SHAKEN
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(9, 2, 'STIR/SHAKEN issue type', 'select', '["Certificate installation", "Attestation level incorrect", "Verification failures", "STI-AS connection issue", "STI-VS connection issue", "Performance degradation", "Other"]', TRUE, 1, NULL),
(10, 2, 'Certificate authority used', 'text', NULL, TRUE, 2, 'e.g., TransNexus, Neustar, Comcast'),
(11, 2, 'Attestation level expected', 'radio', '["Full (A)", "Partial (B)", "Gateway (C)"]', TRUE, 3, NULL),
(12, 2, 'Number of affected calls (approximate)', 'select', '["All calls", "Specific routes only", "Intermittent", "Less than 10%", "More than 50%"]', TRUE, 4, NULL),
(13, 2, 'Error messages or SIP header details', 'textarea', NULL, FALSE, 5, 'Paste relevant Identity header or error messages...')
ON CONFLICT DO NOTHING;

-- Category 3: ProSBC - Security & DDoS
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(14, 3, 'Security issue type', 'select', '["DDoS attack in progress", "DoS attack suspected", "SIP scanner/brute force", "Toll fraud detected", "TLS/sRTP configuration issue", "Blacklist management", "Firewall rule issue", "Other"]', TRUE, 1, NULL),
(15, 3, 'Is this issue currently impacting service?', 'radio', '["Yes - service down", "Yes - degraded service", "No - preventive/configuration"]', TRUE, 2, NULL),
(16, 3, 'Approximate attack volume (if DDoS/DoS)', 'text', NULL, FALSE, 3, 'e.g., 10,000 packets/sec, 500 SIP INVITE/sec'),
(17, 3, 'Source IP addresses (if known)', 'textarea', NULL, FALSE, 4, 'List known malicious IPs...'),
(18, 3, 'Current DDoS protection settings enabled?', 'multiselect', '["Rate limiting", "Dynamic blacklisting", "SIP message validation", "Registration throttling", "Geo-IP blocking", "None/default"]', TRUE, 5, NULL)
ON CONFLICT DO NOTHING;

-- Category 4: ProSBC - Call Quality
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(19, 4, 'Call quality issue type', 'select', '["One-way audio", "No audio", "Echo", "Choppy/broken audio", "High latency/delay", "DTMF not working", "Fax failure (T.38)", "Low MOS score", "Other"]', TRUE, 1, NULL),
(20, 4, 'Codecs in use', 'multiselect', '["G.711 (PCMU/PCMA)", "G.729", "G.722", "OPUS", "AMR", "T.38", "Other"]', TRUE, 2, NULL),
(21, 4, 'Is transcoding enabled?', 'radio', '["Yes", "No", "Not sure"]', TRUE, 3, NULL),
(22, 4, 'Percentage of calls affected', 'select', '["All calls", "More than 50%", "10-50%", "Less than 10%", "Specific route only"]', TRUE, 4, NULL),
(23, 4, 'Network details', 'textarea', NULL, FALSE, 5, 'Describe network topology, WAN links, QoS settings if known...')
ON CONFLICT DO NOTHING;

-- Category 5: ProSBC - Microsoft Teams
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(24, 5, 'Teams integration issue', 'select', '["Direct Routing setup", "TLS certificate issue", "Calls not reaching Teams", "Calls not reaching PSTN", "Teams user registration", "E911 routing", "Media bypass issue", "Other"]', TRUE, 1, NULL),
(25, 5, 'Microsoft 365 tenant domain', 'text', NULL, TRUE, 2, 'e.g., company.onmicrosoft.com'),
(26, 5, 'SBC FQDN configured for Teams', 'text', NULL, TRUE, 3, 'e.g., sbc.company.com'),
(27, 5, 'TLS certificate provider', 'text', NULL, FALSE, 4, 'e.g., DigiCert, Let''s Encrypt, Baltimore CyberTrust'),
(28, 5, 'Describe the issue', 'textarea', NULL, TRUE, 5, 'Include Teams admin center errors if available...')
ON CONFLICT DO NOTHING;

-- Category 6: ProSBC - High Availability
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(29, 6, 'HA issue type', 'select', '["Failover not triggering", "Split-brain scenario", "Synchronization failure", "Active/standby state stuck", "Geo-redundancy issue", "License HA activation", "Other"]', TRUE, 1, NULL),
(30, 6, 'ProSBC edition', 'radio', '["ProSBC (manual HA)", "ProSBC+ (1+1 HA included)"]', TRUE, 2, NULL),
(31, 6, 'Number of nodes in cluster', 'number', NULL, TRUE, 3, 'e.g., 2'),
(32, 6, 'Heartbeat mechanism', 'select', '["Dedicated interface", "Shared network", "Cloud health check", "Not configured"]', TRUE, 4, NULL),
(33, 6, 'Describe the failover behavior observed', 'textarea', NULL, TRUE, 5, 'What happened vs what was expected...')
ON CONFLICT DO NOTHING;

-- Category 7: ProSBC - Installation & Licensing
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(34, 7, 'Issue type', 'select', '["Fresh installation", "Upgrade/migration", "License activation", "License renewal", "Cloud deployment issue", "Performance after install", "Other"]', TRUE, 1, NULL),
(35, 7, 'Target platform', 'select', '["Bare-metal server", "KVM virtual machine", "AWS EC2", "Azure VM", "Other cloud/VM"]', TRUE, 2, NULL),
(36, 7, 'Current version (if upgrading)', 'text', NULL, FALSE, 3, 'e.g., v3.8.0'),
(37, 7, 'Target version', 'text', NULL, FALSE, 4, 'e.g., v4.2.1'),
(38, 7, 'License key or order number', 'text', NULL, FALSE, 5, 'For license-related issues'),
(39, 7, 'Describe the issue', 'textarea', NULL, TRUE, 6, 'Include error messages or screenshots...')
ON CONFLICT DO NOTHING;

-- Category 8: ProSBC - API & Integration
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(40, 8, 'Integration type', 'select', '["REST API", "CDR/billing", "RADIUS", "SNMP monitoring", "Webhook/notifications", "OSS/BSS connector", "Other"]', TRUE, 1, NULL),
(41, 8, 'API endpoint or method affected', 'text', NULL, FALSE, 2, 'e.g., POST /api/v1/trunks, GET /api/v1/stats'),
(42, 8, 'HTTP status code or error', 'text', NULL, FALSE, 3, 'e.g., 401 Unauthorized, timeout'),
(43, 8, 'Describe the expected vs actual behavior', 'textarea', NULL, TRUE, 4, 'Include request/response samples if possible...')
ON CONFLICT DO NOTHING;

-- Category 13: TMG800 - Hardware & Installation
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(52, 13, 'Hardware issue type', 'select', '["Unit not powering on", "Interface card failure", "LED error indicators", "Fan/thermal alarm", "Rack mounting issue", "Cabling/connector issue", "Other"]', TRUE, 1, NULL),
(53, 13, 'TMG800 serial number', 'text', NULL, TRUE, 2, 'Found on rear label'),
(54, 13, 'Number of T1/E1 ports installed', 'select', '["1", "2", "4", "8", "16"]', TRUE, 3, NULL),
(55, 13, 'Current firmware version', 'text', NULL, FALSE, 4, 'Check via web interface or CLI'),
(56, 13, 'Describe the issue', 'textarea', NULL, TRUE, 5, 'Include LED status and any error messages...')
ON CONFLICT DO NOTHING;

-- Category 14: TMG800 - T1/E1 Configuration
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(57, 14, 'Interface issue type', 'select', '["T1/E1 link down", "Alarm condition (red/yellow/blue)", "CRC errors", "Slip/frame errors", "Clock synchronization issue", "Loopback test failure", "Other"]', TRUE, 1, NULL),
(58, 14, 'Interface type', 'radio', '["T1", "E1"]', TRUE, 2, NULL),
(59, 14, 'Number of affected ports', 'number', NULL, TRUE, 3, NULL),
(60, 14, 'Framing type', 'select', '["ESF", "SF/D4", "CRC4", "No CRC4", "Not sure"]', TRUE, 4, NULL),
(61, 14, 'Line coding', 'select', '["B8ZS", "AMI", "HDB3", "Not sure"]', TRUE, 5, NULL),
(62, 14, 'Connected equipment on the other end', 'text', NULL, FALSE, 6, 'e.g., Cisco router, Telco DMARC, PBX model')
ON CONFLICT DO NOTHING;

-- Category 15: TMG800 - Call Quality
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(63, 15, 'Audio issue type', 'select', '["Echo", "One-way audio", "No audio", "Choppy audio", "Background noise", "DTMF issues", "Fax/modem failure", "Other"]', TRUE, 1, NULL),
(64, 15, 'Call direction affected', 'radio', '["TDM to VoIP", "VoIP to TDM", "Both directions"]', TRUE, 2, NULL),
(65, 15, 'Codecs configured', 'multiselect', '["G.711 ulaw", "G.711 alaw", "G.729", "G.722", "T.38", "Other"]', TRUE, 3, NULL),
(66, 15, 'Percentage of calls affected', 'select', '["All calls", "More than 50%", "Less than 50%", "Specific route only", "Random/intermittent"]', TRUE, 4, NULL)
ON CONFLICT DO NOTHING;

-- Category 28: TSG800 - SS7 Link Configuration
INSERT INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(67, 28, 'SS7 issue type', 'select', '["Link not aligning", "Link flapping", "Point code conflict", "Route set issue", "MTP level failure", "ISUP message issue", "Other"]', TRUE, 1, NULL),
(68, 28, 'SS7 variant', 'select', '["ANSI", "ITU", "China", "Japan"]', TRUE, 2, NULL),
(69, 28, 'Local point code', 'text', NULL, TRUE, 3, 'e.g., 1-1-1 or 16384'),
(70, 28, 'Remote point code', 'text', NULL, TRUE, 4, NULL),
(71, 28, 'Number of signaling links configured', 'number', NULL, TRUE, 5, NULL),
(72, 28, 'Describe the issue', 'textarea', NULL, TRUE, 6, 'Include link status and any MTP3 alarms...')
ON CONFLICT DO NOTHING;

-- Reset question template sequence
SELECT setval('question_templates_id_seq', (SELECT COALESCE(MAX(id), 1) FROM question_templates));

-- ============ Skills ============
INSERT INTO skills (id, name, description) VALUES
(1, 'SIP & VoIP', 'SIP protocol, VoIP troubleshooting, SIP trunking, codec management, call flow analysis'),
(2, 'SS7 & TDM', 'SS7 signaling (MTP/ISUP/SCCP), ISDN PRI, T1/E1/DS3/OC3 interfaces, TDM networks'),
(3, 'Network Security', 'DDoS mitigation, TLS/sRTP, firewall rules, fraud detection, STIR/SHAKEN'),
(4, 'Cloud & DevOps', 'AWS/Azure deployment, KVM virtualization, REST API, CI/CD, containerization'),
(5, 'Hardware & Firmware', 'Tmedia/Tsig hardware diagnostics, firmware upgrades, RMA, rack and stack')
ON CONFLICT DO NOTHING;

-- Reset skills sequence
SELECT setval('skills_id_seq', (SELECT COALESCE(MAX(id), 1) FROM skills));

-- ============ Engineers ============
INSERT INTO engineers (id, name, email, location, is_active, current_workload, max_workload) VALUES
(1, 'Marc Bhierre', 'marc@telcobridges.com', 'Montreal', TRUE, 2, 6),
(2, 'Ahmed Hassan', 'ahmed@telcobridges.com', 'Montreal', TRUE, 1, 6),
(3, 'Sophie Tremblay', 'sophie@telcobridges.com', 'Montreal', TRUE, 3, 6),
(4, 'David Kim', 'david@telcobridges.com', 'Montreal', TRUE, 0, 5),
(5, 'Priya Nair', 'priya@telcobridges.com', 'Montreal', TRUE, 2, 5)
ON CONFLICT DO NOTHING;

-- Reset engineers sequence
SELECT setval('engineers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM engineers));

-- ============ Engineer Skills ============
INSERT INTO engineer_skills (engineer_id, skill_id, proficiency) VALUES
-- Marc: SIP/VoIP expert, strong security
(1, 1, 5), (1, 3, 4), (1, 4, 3),
-- Ahmed: SS7/TDM expert, hardware
(2, 2, 5), (2, 5, 5), (2, 1, 3),
-- Sophie: SIP + Cloud/DevOps
(3, 1, 4), (3, 4, 5), (3, 3, 3),
-- David: All-rounder, security focused
(4, 3, 5), (4, 1, 4), (4, 2, 3), (4, 4, 3),
-- Priya: SS7 + SIP, hardware
(5, 2, 4), (5, 1, 4), (5, 5, 4)
ON CONFLICT DO NOTHING;

-- ============ Engineer Product Expertise ============
INSERT INTO engineer_product_expertise (engineer_id, product_id, category_id, expertise_level) VALUES
-- Marc: ProSBC SIP/Security/Teams expert
(1, 1, 1, 5), (1, 1, 3, 5), (1, 1, 5, 5), (1, 1, 4, 4),
-- Ahmed: Tmedia/Tsig hardware expert
(2, 3, 13, 5), (2, 3, 14, 5), (2, 3, 16, 5), (2, 4, 18, 5), (2, 4, 21, 5),
(2, 5, 23, 5), (2, 6, 28, 5), (2, 7, 32, 5),
-- Sophie: ProSBC cloud, API, installation
(3, 1, 7, 5), (3, 1, 8, 5), (3, 1, 6, 4),
-- David: ProSBC security, STIR/SHAKEN, HA
(4, 1, 2, 5), (4, 1, 3, 5), (4, 1, 6, 4), (4, 1, 1, 4),
-- Priya: Tmedia call quality, SS7, signaling gateways
(5, 3, 15, 5), (5, 3, 16, 4), (5, 4, 20, 5), (5, 4, 21, 5),
(5, 5, 26, 5), (5, 6, 28, 4), (5, 6, 29, 4)
ON CONFLICT DO NOTHING;

-- ============ SLA Policies ============
INSERT INTO sla_policies (priority, response_time_hours, resolution_time_hours) VALUES
('critical', 4, 24),
('high', 8, 48),
('medium', 24, 72),
('low', 48, 168)
ON CONFLICT DO NOTHING;

-- ============ Default Settings ============
INSERT INTO settings (key, value, description) VALUES
('claude_analysis_mode', 'wrapper', 'Claude integration mode: wrapper, ssh, http, disabled'),
('claude_server_url', 'http://claude-support-2.telcobridges.lan', 'Claude server URL'),
('claude_auth_type', 'basic', 'Auth type: basic, bearer, api-key'),
('claude_auth_value', 'support:support', 'Auth credentials'),
('claude_model', 'claude-sonnet-4-20250514', 'Claude model to use'),
('claude_auto_assign_threshold', '0.7', 'Minimum confidence for auto-assignment'),
('claude_wrapper_url', 'http://host.docker.internal:4002', 'Claude wrapper service URL'),
('claude_wrapper_auth_token', 'tb-claude-wrapper-secret', 'Wrapper auth token'),
('claude_wrapper_timeout', '0', 'Wrapper timeout (0=unlimited)'),
('claude_ssh_host', 'claude-support-2.telcobridges.lan', 'SSH host'),
('claude_ssh_port', '22', 'SSH port'),
('claude_ssh_user', 'support', 'SSH user'),
('claude_ssh_pass', 'support', 'SSH password'),
('claude_ssh_remote_path', '/home/support/tickets', 'SSH remote path'),
('email_to_ticket_enabled', 'false', 'Enable email-to-ticket IMAP polling'),
('email_to_ticket_poll_interval', '5', 'Email polling interval in minutes'),
('email_to_ticket_default_product_id', '1', 'Default product ID for email-created tickets'),
('email_to_ticket_default_category_id', '1', 'Default category ID for email-created tickets'),
('imap_host', '', 'IMAP server hostname'),
('imap_port', '993', 'IMAP server port'),
('imap_user', '', 'IMAP username'),
('imap_pass', '', 'IMAP password'),
('imap_tls', 'true', 'Use TLS for IMAP connection'),
('satisfaction_survey_url', '', 'Satisfaction survey URL sent to customers when ticket is resolved (leave empty to disable)')
ON CONFLICT DO NOTHING;
