-- Seed catalog data: customers (linked to user accounts), sites and parts.

INSERT INTO customers (name, contact_name, email, phone, address, user_id, created_at, updated_at)
SELECT 'Acme Manufacturing', 'Riley Smith', 'riley.smith@acme.test', '555-2001', '123 Industrial Way, Detroit, MI',
       u.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users u WHERE u.username = 'customer1';

INSERT INTO customers (name, contact_name, email, phone, address, created_at, updated_at)
VALUES ('Globex Logistics', 'Dana White', 'dana.white@globex.test', '555-3001', '88 Harbor Blvd, Chicago, IL',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO customers (name, contact_name, email, phone, address, created_at, updated_at)
VALUES ('Initech Facilities', 'Peter Gibbons', 'peter.g@initech.test', '555-4001', '12 Corporate Plaza, Austin, TX',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO sites (customer_id, name, street_address, city, state, zip, country, contact_name, contact_phone, notes, created_at, updated_at)
SELECT c.id, 'Plant A', '123 Industrial Way', 'Detroit', 'MI', '48201', 'USA', 'Riley Smith', '555-2001', 'Main production facility',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM customers c WHERE c.name = 'Acme Manufacturing';

INSERT INTO sites (customer_id, name, street_address, city, state, zip, country, contact_name, contact_phone, notes, created_at, updated_at)
SELECT c.id, 'Plant B', '456 Foundry Rd', 'Toledo', 'OH', '43604', 'USA', 'Riley Smith', '555-2002', 'Secondary facility',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM customers c WHERE c.name = 'Acme Manufacturing';

INSERT INTO sites (customer_id, name, street_address, city, state, zip, country, contact_name, contact_phone, notes, created_at, updated_at)
SELECT c.id, 'Warehouse 7', '88 Harbor Blvd', 'Chicago', 'IL', '60601', 'USA', 'Dana White', '555-3001', 'East coast distribution',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM customers c WHERE c.name = 'Globex Logistics';

INSERT INTO sites (customer_id, name, street_address, city, state, zip, country, contact_name, contact_phone, notes, created_at, updated_at)
SELECT c.id, 'HQ Building', '12 Corporate Plaza', 'Austin', 'TX', '73301', 'USA', 'Peter Gibbons', '555-4001', 'Office campus',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM customers c WHERE c.name = 'Initech Facilities';

INSERT INTO parts (sku, name, description, unit_price, quantity_on_hand, reorder_level, created_at, updated_at)
VALUES
    ('ELEC-CONT-100', 'HVAC Control Board',      'Main control board for rooftop HVAC units',      349.99, 25,  5,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('ELEC-MOT-250',  'Blower Motor 1HP',         'Single phase 1HP blower motor',                  189.50, 12,  4,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('MECH-BLT-005',  'Drive Belt A-53',          'V-belt for air handler units',                     12.75, 80,  20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('PLMB-VLV-120',  'Water Valve 1.2"',         'Electric actuated water control valve',            96.00, 6,   3,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('SEC-SNS-001',   'Smoke Detector',           'Addressable photoelectric smoke detector',         45.25, 40,  10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('ELEC-BRD-900',  'Furnace Ignition Board',   'Ignition control module for gas furnaces',        120.00, 3,   5,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('MISC-FLT-010',  'Air Filter 20x20x1',       'MERV 8 pleated air filter',                        8.99, 150, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('HVAC-RFR-404',  'Refrigerant R-404A (30lb)','Refrigerant cylinder for commercial units',       315.00, 8,   2,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
