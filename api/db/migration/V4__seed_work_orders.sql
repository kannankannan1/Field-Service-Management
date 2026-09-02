-- Seed work orders, status history (audit), time logs, stock movements and notifications.

-- ---------- Work orders ----------
INSERT INTO work_orders (work_order_number, customer_id, site_id, title, description, priority, status,
                         assigned_technician_id, created_by_id, scheduled_start, scheduled_end,
                         actual_start, actual_end, sla_due_at, sla_breached, created_at, updated_at, closed_at)
VALUES
    ('WO-000001',
     (SELECT id FROM customers WHERE name = 'Acme Manufacturing'),
     (SELECT id FROM sites WHERE name = 'Plant A'),
     'Rooftop unit not cooling', 'RTU-3 on production line losing cooling capacity, indoor temp rising.', 'URGENT', 'NEW',
     NULL,
     (SELECT id FROM users WHERE username = 'dispatcher1'),
     '2026-08-16 09:00:00', '2026-08-16 13:00:00',
     NULL, NULL, '2026-08-16 13:00:00', FALSE,
     '2026-08-15 09:00:00', '2026-08-15 09:00:00', NULL),
    ('WO-000002',
     (SELECT id FROM customers WHERE name = 'Acme Manufacturing'),
     (SELECT id FROM sites WHERE name = 'Plant B'),
     'Fan motor noise on air handler', 'AHU-2 emitting grinding noise during operation, possible bearing wear.', 'HIGH', 'ASSIGNED',
     (SELECT id FROM users WHERE username = 'tech1'),
     (SELECT id FROM users WHERE username = 'dispatcher1'),
     '2026-08-17 10:00:00', '2026-08-17 14:00:00',
     NULL, NULL, '2026-08-16 10:00:00', FALSE,
     '2026-08-15 09:30:00', '2026-08-15 09:35:00', NULL),
    ('WO-000003',
     (SELECT id FROM customers WHERE name = 'Acme Manufacturing'),
     (SELECT id FROM sites WHERE name = 'Plant A'),
     'Water valve replacement', 'Leaking electric water valve on chilled water loop, replacing with new valve.', 'MEDIUM', 'IN_PROGRESS',
     (SELECT id FROM users WHERE username = 'tech1'),
     (SELECT id FROM users WHERE username = 'dispatcher1'),
     '2026-08-14 08:00:00', '2026-08-14 16:00:00',
     '2026-08-14 08:15:00', NULL, '2026-08-18 08:00:00', FALSE,
     '2026-08-13 10:00:00', '2026-08-14 08:15:00', NULL),
    ('WO-000004',
     (SELECT id FROM customers WHERE name = 'Initech Facilities'),
     (SELECT id FROM sites WHERE name = 'HQ Building'),
     'Ignition board faulty', 'Gas furnace ignition board showing fault code, heating intermittent. Waiting on part delivery.', 'HIGH', 'ON_HOLD',
     (SELECT id FROM users WHERE username = 'tech2'),
     (SELECT id FROM users WHERE username = 'dispatcher1'),
     '2026-08-13 09:00:00', '2026-08-13 17:00:00',
     '2026-08-13 09:20:00', NULL, '2026-08-14 09:00:00', FALSE,
     '2026-08-12 14:00:00', '2026-08-13 11:00:00', NULL),
    ('WO-000005',
     (SELECT id FROM customers WHERE name = 'Globex Logistics'),
     (SELECT id FROM sites WHERE name = 'Warehouse 7'),
     'Smoke detector testing', 'Annual functional test of addressable smoke detectors on dock level.', 'LOW', 'IN_PROGRESS',
     (SELECT id FROM users WHERE username = 'tech2'),
     (SELECT id FROM users WHERE username = 'dispatcher1'),
     '2026-08-14 13:00:00', '2026-08-14 18:00:00',
     '2026-08-14 13:30:00', NULL, '2026-08-21 13:00:00', FALSE,
     '2026-08-11 08:00:00', '2026-08-14 13:30:00', NULL),
    ('WO-000006',
     (SELECT id FROM customers WHERE name = 'Acme Manufacturing'),
     (SELECT id FROM sites WHERE name = 'Plant A'),
     'Filter replacement routine', 'Quarterly MERV 8 filter replacement across office air handlers.', 'LOW', 'COMPLETED',
     (SELECT id FROM users WHERE username = 'tech1'),
     (SELECT id FROM users WHERE username = 'dispatcher1'),
     '2026-08-05 08:00:00', '2026-08-05 12:00:00',
     '2026-08-05 08:10:00', '2026-08-05 11:40:00', '2026-08-12 08:00:00', FALSE,
     '2026-08-04 09:00:00', '2026-08-05 11:40:00', NULL),
    ('WO-000007',
     (SELECT id FROM customers WHERE name = 'Globex Logistics'),
     (SELECT id FROM sites WHERE name = 'Warehouse 7'),
     'Emergency refrigerant top-up', 'Walk-in freezer low on refrigerant, emergency top-up performed.', 'URGENT', 'CLOSED',
     (SELECT id FROM users WHERE username = 'tech2'),
     (SELECT id FROM users WHERE username = 'dispatcher1'),
     '2026-08-02 14:00:00', '2026-08-02 18:00:00',
     '2026-08-02 14:15:00', '2026-08-02 16:50:00', '2026-08-02 18:00:00', FALSE,
     '2026-08-02 13:30:00', '2026-08-03 09:00:00', '2026-08-03 09:00:00'),
    ('WO-000008',
     (SELECT id FROM customers WHERE name = 'Initech Facilities'),
     (SELECT id FROM sites WHERE name = 'HQ Building'),
     'Thermostat not responding', 'Second floor thermostat display blank, zone stuck heating.', 'MEDIUM', 'NEW',
     NULL,
     (SELECT id FROM users WHERE username = 'dispatcher1'),
     '2026-08-18 09:00:00', '2026-08-18 13:00:00',
     NULL, NULL, '2026-08-19 09:00:00', FALSE,
     '2026-08-15 11:00:00', '2026-08-15 11:00:00', NULL);

-- ---------- Status history (immutable audit trail) ----------
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, NULL, 'NEW', NULL, '2026-08-15 09:00:00', 'Work order created' FROM work_orders w WHERE w.work_order_number = 'WO-000001';

INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, NULL, 'NEW', NULL, '2026-08-15 09:30:00', 'Work order created' FROM work_orders w WHERE w.work_order_number = 'WO-000002';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'NEW', 'ASSIGNED', (SELECT id FROM users WHERE username = 'dispatcher1'), '2026-08-15 09:35:00', 'Assigned to Jordan Lee' FROM work_orders w WHERE w.work_order_number = 'WO-000002';

INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, NULL, 'NEW', NULL, '2026-08-13 10:00:00', 'Work order created' FROM work_orders w WHERE w.work_order_number = 'WO-000003';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'NEW', 'ASSIGNED', (SELECT id FROM users WHERE username = 'dispatcher1'), '2026-08-13 10:05:00', 'Assigned to Jordan Lee' FROM work_orders w WHERE w.work_order_number = 'WO-000003';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'ASSIGNED', 'IN_PROGRESS', (SELECT id FROM users WHERE username = 'tech1'), '2026-08-14 08:15:00', 'Technician started work' FROM work_orders w WHERE w.work_order_number = 'WO-000003';

INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, NULL, 'NEW', NULL, '2026-08-12 14:00:00', 'Work order created' FROM work_orders w WHERE w.work_order_number = 'WO-000004';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'NEW', 'ASSIGNED', (SELECT id FROM users WHERE username = 'dispatcher1'), '2026-08-12 14:10:00', 'Assigned to Casey Kim' FROM work_orders w WHERE w.work_order_number = 'WO-000004';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'ASSIGNED', 'IN_PROGRESS', (SELECT id FROM users WHERE username = 'tech2'), '2026-08-13 09:20:00', 'Technician started work' FROM work_orders w WHERE w.work_order_number = 'WO-000004';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'IN_PROGRESS', 'ON_HOLD', (SELECT id FROM users WHERE username = 'tech2'), '2026-08-13 11:00:00', 'Waiting for part delivery' FROM work_orders w WHERE w.work_order_number = 'WO-000004';

INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, NULL, 'NEW', NULL, '2026-08-11 08:00:00', 'Work order created' FROM work_orders w WHERE w.work_order_number = 'WO-000005';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'NEW', 'ASSIGNED', (SELECT id FROM users WHERE username = 'dispatcher1'), '2026-08-11 08:10:00', 'Assigned to Casey Kim' FROM work_orders w WHERE w.work_order_number = 'WO-000005';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'ASSIGNED', 'IN_PROGRESS', (SELECT id FROM users WHERE username = 'tech2'), '2026-08-14 13:30:00', 'Technician started work' FROM work_orders w WHERE w.work_order_number = 'WO-000005';

INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, NULL, 'NEW', NULL, '2026-08-04 09:00:00', 'Work order created' FROM work_orders w WHERE w.work_order_number = 'WO-000006';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'NEW', 'ASSIGNED', (SELECT id FROM users WHERE username = 'dispatcher1'), '2026-08-04 09:05:00', 'Assigned to Jordan Lee' FROM work_orders w WHERE w.work_order_number = 'WO-000006';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'ASSIGNED', 'IN_PROGRESS', (SELECT id FROM users WHERE username = 'tech1'), '2026-08-05 08:10:00', 'Technician started work' FROM work_orders w WHERE w.work_order_number = 'WO-000006';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'IN_PROGRESS', 'COMPLETED', (SELECT id FROM users WHERE username = 'tech1'), '2026-08-05 11:40:00', 'Job completed by technician' FROM work_orders w WHERE w.work_order_number = 'WO-000006';

INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, NULL, 'NEW', NULL, '2026-08-02 13:30:00', 'Work order created' FROM work_orders w WHERE w.work_order_number = 'WO-000007';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'NEW', 'ASSIGNED', (SELECT id FROM users WHERE username = 'dispatcher1'), '2026-08-02 13:40:00', 'Assigned to Casey Kim' FROM work_orders w WHERE w.work_order_number = 'WO-000007';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'ASSIGNED', 'IN_PROGRESS', (SELECT id FROM users WHERE username = 'tech2'), '2026-08-02 14:15:00', 'Technician started work' FROM work_orders w WHERE w.work_order_number = 'WO-000007';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'IN_PROGRESS', 'COMPLETED', (SELECT id FROM users WHERE username = 'tech2'), '2026-08-02 16:50:00', 'Job completed by technician' FROM work_orders w WHERE w.work_order_number = 'WO-000007';
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, 'COMPLETED', 'CLOSED', (SELECT id FROM users WHERE username = 'manager1'), '2026-08-03 09:00:00', 'Work order closed by manager' FROM work_orders w WHERE w.work_order_number = 'WO-000007';

INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
SELECT w.id, NULL, 'NEW', NULL, '2026-08-15 11:00:00', 'Work order created' FROM work_orders w WHERE w.work_order_number = 'WO-000008';

-- ---------- Time logs ----------
INSERT INTO time_logs (work_order_id, technician_id, start_time, end_time, hours_worked, notes, created_at)
SELECT w.id, (SELECT id FROM users WHERE username = 'tech1'), '2026-08-05 08:10:00', '2026-08-05 11:40:00', 3.50, 'Replaced filters in 7 air handlers', '2026-08-05 11:40:00'
FROM work_orders w WHERE w.work_order_number = 'WO-000006';

INSERT INTO time_logs (work_order_id, technician_id, start_time, end_time, hours_worked, notes, created_at)
SELECT w.id, (SELECT id FROM users WHERE username = 'tech2'), '2026-08-02 14:15:00', '2026-08-02 16:50:00', 2.58, 'Topped up R-404A, leak test passed', '2026-08-02 16:50:00'
FROM work_orders w WHERE w.work_order_number = 'WO-000007';

INSERT INTO time_logs (work_order_id, technician_id, start_time, end_time, hours_worked, notes, created_at)
SELECT w.id, (SELECT id FROM users WHERE username = 'tech1'), '2026-08-14 08:15:00', NULL, NULL, 'Valve replacement in progress', '2026-08-14 08:15:00'
FROM work_orders w WHERE w.work_order_number = 'WO-000003';

-- ---------- Stock movements ----------
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, NULL, 'INBOUND', 25, 'Initial stock load', CURRENT_TIMESTAMP FROM parts p WHERE p.sku = 'ELEC-CONT-100';
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, NULL, 'INBOUND', 12, 'Initial stock load', CURRENT_TIMESTAMP FROM parts p WHERE p.sku = 'ELEC-MOT-250';
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, NULL, 'INBOUND', 80, 'Initial stock load', CURRENT_TIMESTAMP FROM parts p WHERE p.sku = 'MECH-BLT-005';
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, NULL, 'INBOUND', 6, 'Initial stock load', CURRENT_TIMESTAMP FROM parts p WHERE p.sku = 'PLMB-VLV-120';
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, NULL, 'INBOUND', 40, 'Initial stock load', CURRENT_TIMESTAMP FROM parts p WHERE p.sku = 'SEC-SNS-001';
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, NULL, 'INBOUND', 3, 'Initial stock load', CURRENT_TIMESTAMP FROM parts p WHERE p.sku = 'ELEC-BRD-900';
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, NULL, 'INBOUND', 150, 'Initial stock load', CURRENT_TIMESTAMP FROM parts p WHERE p.sku = 'MISC-FLT-010';
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, NULL, 'INBOUND', 8, 'Initial stock load', CURRENT_TIMESTAMP FROM parts p WHERE p.sku = 'HVAC-RFR-404';
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, w.id, 'OUTBOUND', -4, 'Filters used on WO-000006', '2026-08-05 11:40:00'
FROM parts p, work_orders w WHERE p.sku = 'MISC-FLT-010' AND w.work_order_number = 'WO-000006';
INSERT INTO stock_movements (part_id, work_order_id, type, quantity_change, note, created_at)
SELECT p.id, w.id, 'OUTBOUND', -2, 'Valves used on WO-000003', '2026-08-14 09:00:00'
FROM parts p, work_orders w WHERE p.sku = 'PLMB-VLV-120' AND w.work_order_number = 'WO-000003';

-- ---------- Notifications ----------
INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
SELECT u.id, 'New assignment', 'WO-000002 (Fan motor noise) has been assigned to you.', 'ASSIGNMENT', FALSE, '2026-08-15 09:35:00'
FROM users u WHERE u.username = 'tech1';
INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
SELECT u.id, 'Work started', 'You started WO-000003 (Water valve replacement).', 'STATUS_CHANGE', FALSE, '2026-08-14 08:15:00'
FROM users u WHERE u.username = 'tech1';
INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
SELECT u.id, 'SLA at risk', 'WO-000001 (Rooftop unit not cooling) is due within 4 hours.', 'SLA_REMINDER', FALSE, '2026-08-16 09:00:00'
FROM users u WHERE u.username = 'dispatcher1';
INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
SELECT u.id, 'Low stock alert', 'Part ELEC-BRD-900 (Furnace Ignition Board) is below reorder level.', 'STOCK_LOW', FALSE, '2026-08-15 08:00:00'
FROM users u WHERE u.username = 'manager1';
