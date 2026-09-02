-- Seed demo users. Passwords (BCrypt hashed, bcryptjs cost 10):
--   manager1    / Manager@123
--   dispatcher1 / Dispatcher@123
--   tech1       / Tech@123
--   tech2       / Tech@123
--   customer1   / Customer@123
INSERT INTO users (username, password, first_name, last_name, email, phone, role, enabled, created_at, updated_at)
VALUES
    ('manager1',    '$2b$10$J68eQX7mPnZj/kXzTiEK8.yPfGjt1XUJpPZrEJv38MI.2pWPqqwAy', 'Alex',   'Morgan', 'alex.morgan@keystone.test',  '555-1001', 'MANAGER',    TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('dispatcher1', '$2b$10$AjDvH1qGnIvFehzxp9Zv7.vqYpq1JgGwjMMo5rvSxqz4.Z0/kVROq', 'Sam',    'Carter', 'sam.carter@keystone.test',   '555-1002', 'DISPATCHER', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('tech1',       '$2b$10$/hm4g2B.3EkBu8qLX/jZKeFOG3xN3pUFCeHTZsz1HfjxESlWmZzCO', 'Jordan', 'Lee',    'jordan.lee@keystone.test',   '555-1003', 'TECHNICIAN', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('tech2',       '$2b$10$/hm4g2B.3EkBu8qLX/jZKeFOG3xN3pUFCeHTZsz1HfjxESlWmZzCO', 'Casey',  'Kim',    'casey.kim@keystone.test',    '555-1004', 'TECHNICIAN', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('customer1',   '$2b$10$cIKAgdwp1hxHBBHD5k4W8uPW7EYXSKbGY9I3x5wQI8uzN/bR7PE5m', 'Riley',  'Smith',  'riley.smith@acme.test',      '555-2001', 'CUSTOMER',   TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
