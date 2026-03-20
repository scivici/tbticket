-- ============ Admin User (password: admin123) ============
INSERT OR IGNORE INTO customers (email, name, password_hash, role)
VALUES ('admin@company.com', 'System Admin', '$2a$10$8KzaN2KBSxWc0CWfGHFqHOGGMPCV9R4v3MpV.lL5nJXDmFMz8sHHi', 'admin');

-- ============ Products ============
INSERT OR IGNORE INTO products (id, name, model, description, image_url) VALUES
(1, 'SmartHome Hub', 'SH-2000', 'Central smart home controller with voice assistant, automation engine, and multi-protocol support (Zigbee, Z-Wave, WiFi, Thread).', '/images/smarthome-hub.png'),
(2, 'IndustrialSense IoT Gateway', 'IS-500', 'Industrial IoT gateway for factory floor monitoring with edge computing, predictive maintenance, and real-time sensor data aggregation.', '/images/industrial-gateway.png');

-- ============ Product Categories ============
-- SmartHome Hub categories
INSERT OR IGNORE INTO product_categories (id, product_id, name, description, icon, display_order) VALUES
(1, 1, 'Connectivity Issues', 'WiFi, Zigbee, Z-Wave, or Thread connection problems', 'wifi', 1),
(2, 1, 'Voice Assistant', 'Voice recognition, command processing, or response issues', 'microphone', 2),
(3, 1, 'Automation Rules', 'Scene, routine, or automation rule failures', 'cpu', 3),
(4, 1, 'Device Pairing', 'Problems pairing new smart devices', 'link', 4),
(5, 1, 'Firmware & Updates', 'Update failures, firmware corruption, or rollback issues', 'download', 5);

-- IndustrialSense categories
INSERT OR IGNORE INTO product_categories (id, product_id, name, description, icon, display_order) VALUES
(6, 2, 'Sensor Data', 'Missing, incorrect, or delayed sensor readings', 'activity', 1),
(7, 2, 'Edge Computing', 'Edge processing failures, model deployment, or resource issues', 'server', 2),
(8, 2, 'Network & Protocols', 'Modbus, OPC-UA, MQTT, or Ethernet/IP connectivity', 'network', 3),
(9, 2, 'Alerts & Monitoring', 'False alarms, missed alerts, or dashboard issues', 'bell', 4),
(10, 2, 'Predictive Maintenance', 'ML model accuracy, prediction failures, or calibration', 'trending-up', 5);

-- ============ Question Templates ============
-- Category 1: Connectivity Issues
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(1, 1, 'Which protocol is affected?', 'select', '["WiFi", "Zigbee", "Z-Wave", "Thread", "Multiple", "Not sure"]', 1, 1, NULL),
(2, 1, 'How many devices are affected?', 'radio', '["Single device", "Multiple devices", "All devices"]', 1, 2, NULL),
(3, 1, 'When did the issue start?', 'select', '["Today", "This week", "After a recent update", "After adding a new device", "Intermittent/recurring"]', 1, 3, NULL),
(4, 1, 'Describe the connection behavior', 'textarea', NULL, 1, 4, 'e.g., Devices disconnect randomly, fail to respond, or show offline status...'),
(5, 1, 'Have you tried restarting the hub?', 'radio', '["Yes - issue persists", "Yes - temporarily fixed", "No"]', 1, 5, NULL),
(6, 1, 'Hub firmware version (Settings > About)', 'text', NULL, 0, 6, 'e.g., v3.2.1');

-- Category 2: Voice Assistant
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order) VALUES
(7, 2, 'What type of voice issue?', 'select', '["Not responding to wake word", "Misunderstanding commands", "Wrong device controlled", "Slow response", "Error messages", "Other"]', 1, 1),
(8, 2, 'Which language is configured?', 'select', '["English (US)", "English (UK)", "German", "French", "Spanish", "Other"]', 1, 2),
(9, 2, 'Does the issue occur with specific commands?', 'radio', '["Yes - specific commands only", "No - all commands", "Random/intermittent"]', 1, 3),
(10, 2, 'If specific commands, which ones?', 'textarea', NULL, 0, 4);
-- Conditional: only show if answer to Q9 is "Yes - specific commands only"
UPDATE question_templates SET conditional_on = 9, conditional_value = 'Yes - specific commands only' WHERE id = 10;

INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(11, 2, 'Environment noise level', 'radio', '["Quiet", "Moderate (TV/music)", "Noisy (kitchen/workshop)"]', 0, 5, NULL);

-- Category 3: Automation Rules
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(12, 3, 'Type of automation affected', 'select', '["Time-based schedule", "Trigger-based rule", "Scene/routine", "Geofencing", "Sunrise/Sunset", "Multiple types"]', 1, 1, NULL),
(13, 3, 'What happens when the automation should trigger?', 'select', '["Nothing happens", "Wrong action executed", "Delayed execution", "Partial execution", "Error notification"]', 1, 2, NULL),
(14, 3, 'How many automations are affected?', 'radio', '["One specific automation", "Multiple automations", "All automations"]', 1, 3, NULL),
(15, 3, 'Please describe the automation rule and expected behavior', 'textarea', NULL, 1, 4, 'e.g., At 7am, turn on kitchen lights and start coffee maker. Currently only lights turn on...');

-- Category 4: Device Pairing
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(16, 4, 'Device brand and model you are trying to pair', 'text', NULL, 1, 1, 'e.g., Philips Hue Bulb A19'),
(17, 4, 'Device protocol', 'select', '["Zigbee", "Z-Wave", "WiFi", "Thread", "Bluetooth", "Not sure"]', 1, 2, NULL),
(18, 4, 'What happens during pairing?', 'select', '["Device not found", "Pairing starts but fails", "Pairs but goes offline", "Pairs but no control", "Error message shown"]', 1, 3, NULL),
(19, 4, 'Error message if any', 'text', NULL, 0, 4, 'Copy the exact error message here'),
(20, 4, 'Is this a new device or was it previously paired?', 'radio', '["Brand new device", "Previously paired to this hub", "Previously paired to another hub"]', 1, 5, NULL);

-- Category 5: Firmware & Updates
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(21, 5, 'Current firmware version', 'text', NULL, 1, 1, 'Settings > About > Firmware Version'),
(22, 5, 'What update issue occurred?', 'select', '["Update fails to download", "Update fails to install", "Hub stuck in update mode", "Hub not booting after update", "Features broken after update", "Rollback failed"]', 1, 2, NULL),
(23, 5, 'Hub status LEDs', 'select', '["Normal (solid green)", "Blinking green", "Solid red", "Blinking red", "Orange/amber", "No lights", "Other"]', 1, 3, NULL),
(24, 5, 'Describe what happened', 'textarea', NULL, 1, 4, 'Step by step what occurred...');

-- Category 6: Sensor Data (Industrial)
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(25, 6, 'Sensor type affected', 'multiselect', '["Temperature", "Pressure", "Vibration", "Flow", "Level", "Humidity", "Power/Current", "Custom"]', 1, 1, NULL),
(26, 6, 'Number of sensors affected', 'number', NULL, 1, 2, 'Enter the number of affected sensors'),
(27, 6, 'Data issue type', 'select', '["No data received", "Incorrect/out-of-range values", "Delayed data (>30s)", "Intermittent gaps", "Duplicate readings", "Timestamp errors"]', 1, 3, NULL),
(28, 6, 'When did the issue start?', 'select', '["Today", "This week", "After configuration change", "After firmware update", "Gradual degradation"]', 1, 4, NULL),
(29, 6, 'Affected production line or zone', 'text', NULL, 1, 5, 'e.g., Line 3, Zone B'),
(30, 6, 'Impact on production', 'radio', '["Production stopped", "Production degraded", "No immediate impact but data needed", "Safety concern"]', 1, 6, NULL);

-- Category 7: Edge Computing
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(31, 7, 'Edge computing issue type', 'select', '["Model deployment failure", "Processing timeout", "Memory/CPU exhaustion", "Data pipeline error", "Results incorrect", "Service crash"]', 1, 1, NULL),
(32, 7, 'Which ML model or pipeline is affected?', 'text', NULL, 1, 2, 'Model name or pipeline ID'),
(33, 7, 'Gateway resource usage (if known)', 'textarea', NULL, 0, 3, 'CPU%, Memory%, Disk% - check via gateway dashboard'),
(34, 7, 'Error logs', 'textarea', NULL, 0, 4, 'Paste relevant error logs here');

-- Category 8: Network & Protocols (Industrial)
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(35, 8, 'Protocol affected', 'select', '["Modbus RTU", "Modbus TCP", "OPC-UA", "MQTT", "Ethernet/IP", "PROFINET", "BACnet", "Custom"]', 1, 1, NULL),
(36, 8, 'Connection status', 'select', '["Never connected", "Was working, now disconnected", "Intermittent connection", "Connected but no data", "Authentication errors"]', 1, 2, NULL),
(37, 8, 'Network topology change recently?', 'radio', '["Yes", "No", "Not sure"]', 1, 3, NULL),
(38, 8, 'Endpoint details', 'textarea', NULL, 1, 4, 'IP address, port, node ID, or device address of the affected endpoint');

-- Category 9: Alerts & Monitoring
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(39, 9, 'Alert issue type', 'select', '["False positive alerts", "Missed alerts (should have fired)", "Alert delay", "Notification delivery failure", "Dashboard not loading", "Incorrect alert thresholds"]', 1, 1, NULL),
(40, 9, 'Alert severity level', 'select', '["Critical", "Warning", "Info", "All levels"]', 1, 2, NULL),
(41, 9, 'Notification channels configured', 'multiselect', '["Email", "SMS", "Webhook", "SCADA integration", "Mobile push", "On-screen"]', 1, 3, NULL),
(42, 9, 'Describe the expected vs actual behavior', 'textarea', NULL, 1, 4, 'What should happen vs what actually happens');

-- Category 10: Predictive Maintenance
INSERT OR IGNORE INTO question_templates (id, category_id, question_text, question_type, options, is_required, display_order, placeholder) VALUES
(43, 10, 'Prediction issue type', 'select', '["False positive prediction", "Missed failure prediction", "Incorrect remaining useful life", "Model not updating", "Calibration request", "Accuracy degradation"]', 1, 1, NULL),
(44, 10, 'Equipment type', 'text', NULL, 1, 2, 'e.g., CNC Machine, Conveyor Belt, Pump'),
(45, 10, 'Equipment ID or asset tag', 'text', NULL, 1, 3, 'Enter the asset identifier'),
(46, 10, 'Current model accuracy (if known)', 'text', NULL, 0, 4, 'e.g., 85% or check Model Dashboard'),
(47, 10, 'How long has the model been deployed?', 'select', '["Less than 1 month", "1-3 months", "3-6 months", "6-12 months", "Over 1 year"]', 1, 5, NULL);

-- ============ Skills ============
INSERT OR IGNORE INTO skills (id, name, description) VALUES
(1, 'Embedded Systems', 'Firmware development, hardware debugging, JTAG, low-level protocols'),
(2, 'Networking & Protocols', 'TCP/IP, Modbus, OPC-UA, MQTT, Zigbee, Z-Wave, Thread'),
(3, 'Machine Learning', 'Model training, deployment, MLOps, predictive analytics'),
(4, 'Cloud & Integration', 'API development, cloud services, webhooks, data pipelines'),
(5, 'Voice & NLP', 'Speech recognition, natural language processing, wake word detection');

-- ============ Engineers ============
INSERT OR IGNORE INTO engineers (id, name, email, location, is_active, current_workload, max_workload) VALUES
(1, 'Alice Chen', 'alice@company.com', 'San Francisco', 1, 2, 5),
(2, 'Bob Mueller', 'bob@company.com', 'Berlin', 1, 1, 5),
(3, 'Carlos Rivera', 'carlos@company.com', 'Madrid', 1, 3, 5),
(4, 'Diana Kowalski', 'diana@company.com', 'Warsaw', 1, 0, 5),
(5, 'Ethan Park', 'ethan@company.com', 'Seoul', 1, 2, 4);

-- ============ Engineer Skills ============
INSERT OR IGNORE INTO engineer_skills (engineer_id, skill_id, proficiency) VALUES
-- Alice: Strong in ML and Cloud
(1, 3, 5), (1, 4, 4), (1, 2, 3),
-- Bob: Embedded systems expert, good networking
(2, 1, 5), (2, 2, 4), (2, 4, 2),
-- Carlos: Networking specialist, good at voice
(3, 2, 5), (3, 5, 4), (3, 1, 3),
-- Diana: Well-rounded, strong cloud and ML
(4, 4, 5), (4, 3, 4), (4, 2, 3), (4, 1, 2),
-- Ethan: Voice/NLP expert, embedded systems
(5, 5, 5), (5, 1, 4), (5, 3, 3);

-- ============ Engineer Product Expertise ============
INSERT OR IGNORE INTO engineer_product_expertise (engineer_id, product_id, category_id, expertise_level) VALUES
-- Alice: Industrial IoT expert (sensor data, edge computing, predictive)
(1, 2, 6, 5), (1, 2, 7, 5), (1, 2, 10, 5), (1, 1, 3, 3),
-- Bob: SmartHome firmware & connectivity expert
(2, 1, 1, 5), (2, 1, 5, 5), (2, 1, 4, 4), (2, 2, 8, 3),
-- Carlos: Connectivity across both products, voice specialist
(3, 1, 1, 4), (3, 1, 2, 5), (3, 2, 8, 5), (3, 2, 9, 4),
-- Diana: Broad knowledge, cloud/integration focus
(4, 1, 3, 4), (4, 2, 7, 4), (4, 2, 9, 5), (4, 1, 4, 3),
-- Ethan: Voice expert, SmartHome specialist
(5, 1, 2, 5), (5, 1, 5, 4), (5, 2, 10, 3), (5, 1, 1, 3);
