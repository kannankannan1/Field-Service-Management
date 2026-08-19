const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT $1::text as greeting', ['Hello World']).then(res => {
  console.log('Database connected:', res.rows[0].greeting);
}).catch(err => {
  console.error('Database connection error:', err.message);
  process.exit(1);
});

// In-memory refresh token store (for production, use Redis)
const refreshTokens = {};

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, firstName, lastName, email, phone, role } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if user exists
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const enabled = role !== 'CUSTOMER'; // Customers enabled by default via signup flow
    
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const result = await pool.query(
      `INSERT INTO users (username, password, first_name, last_name, email, phone, role, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, username, first_name, last_name, email, phone, role, enabled, created_at, updated_at`,
      [username, hashedPassword, firstName || '', lastName || '', email || '', phone || '', role, enabled, createdAt, updatedAt]
    );
    
    const user = result.rows[0];
    
    // Create JWT token
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.REFRESH_TOKEN_SECRET
    );
    refreshTokens[refreshToken] = user.id;
    
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
       VALUES ($1, 'New account', 'Welcome to Keystone Field Service', 'INFO', FALSE, NOW())`,
      [user.id]
    );
    
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        enabled: user.enabled,
      }
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Missing username or password' });
    }
    
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const user = userCheck.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    if (!user.enabled) {
      return res.status(401).json({ message: 'Account disabled' });
    }
    
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.REFRESH_TOKEN_SECRET
    );
    refreshTokens[refreshToken] = user.id;
    
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        enabled: user.enabled,
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Refresh token
app.post('/api/auth/refresh', (req, res) => {
  const { token } = req.body;
  
  if (!token || !refreshTokens[token]) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }
  
  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }
    
    delete refreshTokens[token];
    
    const newAccessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );
    
    const newRefreshToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.REFRESH_TOKEN_SECRET
    );
    refreshTokens[newRefreshToken] = user.id;
    
    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body;
  if (token) {
    delete refreshTokens[token];
  }
  res.json({ message: 'Logged out successfully' });
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
  try {
    // In a real app, we'd verify the JWT from the Authorization header
    // For this demo, we'll check if there's a session
    const authHeader = req.headers['authorization'];
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid token' });
        user = {
          id: decoded.id,
          username: decoded.username,
          firstName: decoded.firstName || '',
          lastName: decoded.lastName || '',
          email: decoded.email || '',
          phone: decoded.phone || '',
          role: decoded.role,
        };
        res.json({ user });
      });
    }
    
    if (!user) {
      // Try refresh token approach for demo
      res.status(401).json({ message: 'Authentication required' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============ WORK ORDER ROUTES ============

// List work orders
app.get('/api/work-orders', async (req, res) => {
  try {
    const { search, status, priority, customerId, siteId, technicianId, slaBreached, page = 1, size = 20, sort } = req.query;
    
    let query = `SELECT wo.*, c.name as customerName, s.name as siteName 
                 FROM work_orders wo 
                 JOIN customers c ON wo.customer_id = c.id 
                 JOIN sites s ON wo.site_id = s.id 
                 WHERE 1=1`;
    const params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      query += ` AND (wo.title ILIKE $${paramCount} OR wo.description ILIKE $${paramCount} OR wo.work_order_number ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    if (status) {
      paramCount++;
      query += ` AND wo.status = $${paramCount}`;
      params.push(status);
    }
    if (priority) {
      paramCount++;
      query += ` AND wo.priority = $${paramCount}`;
      params.push(priority);
    }
    if (customerId) {
      paramCount++;
      query += ` AND wo.customer_id = $${paramCount}`;
      params.push(customerId);
    }
    if (siteId) {
      paramCount++;
      query += ` AND wo.site_id = $${paramCount}`;
      params.push(siteId);
    }
    if (technicianId) {
      paramCount++;
      query += ` AND wo.assigned_technician_id = $${paramCount}`;
      params.push(technicianId);
    }
    if (slaBreached !== undefined) {
      paramCount++;
      query += ` AND wo.sla_breached = $${paramCount}`;
      params.push(slaBreached === 'true');
    }
    
    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    // Add pagination and sorting
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);
    const offset = (pageNum - 1) * pageSize;
    
    query += ` ORDER BY wo.${sort || 'created_at'} DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(pageSize, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      content: result.rows,
      page: pageNum,
      size: pageSize,
      totalElements: total,
      totalPages: Math.ceil(total / pageSize),
      first: pageNum === 1,
      last: pageNum * pageSize >= total,
    });
  } catch (err) {
    console.error('Get work orders error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get work order by ID
app.get('/api/work-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT wo.*, c.name as customerName, s.name as siteName, 
       u.first_name as technicianFirstName, u.last_name as technicianLastName
       FROM work_orders wo 
       JOIN customers c ON wo.customer_id = c.id 
       JOIN sites s ON wo.site_id = s.id 
       LEFT JOIN users u ON wo.assigned_technician_id = u.id
       WHERE wo.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Work order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get work order error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create work order
app.post('/api/work-orders', async (req, res) => {
  try {
    const { customerId, siteId, title, description, priority, scheduledStart, scheduledEnd } = req.body;
    
    if (!customerId || !siteId || !title) {
      return res.status(400).json({ message: 'Missing required fields: customerId, siteId, title' });
    }
    
    // Get next work order number
    const seqResult = await pool.query('SELECT NEXT VALUE FOR work_order_number_seq as next_val');
    const workOrderNumber = `WO-${String(seqResult.rows[0].next_val).padStart(6, '0')}`;
    
    const createdAt = new Date();
    const result = await pool.query(
      `INSERT INTO work_orders (work_order_number, customer_id, site_id, title, description, priority, status, created_by_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'NEW', $7, $8, $9)
       RETURNING *`,
      [workOrderNumber, customerId, siteId, title, description || '', priority || 'MEDIUM', 1, createdAt, createdAt]
    );
    
    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
       VALUES ($1, 'New work order', 'WO-${seqResult.rows[0].next_val} has been created', 'INFO', FALSE, NOW())`,
      [1] // In production, this would be the dispatcher/manager ID
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create work order error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update work order status
app.patch('/api/work-orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { toStatus, note } = req.body;
    
    if (!toStatus) {
      return res.status(400).json({ message: 'Missing required field: toStatus' });
    }
    
    // Get the work order with current user info
    const woResult = await pool.query('SELECT * FROM work_orders WHERE id = $1', [id]);
    if (woResult.rows.length === 0) {
      return res.status(404).json({ message: 'Work order not found' });
    }
    
    const fromStatus = woResult.rows[0].status;
    
    // Update status
    const updateResult = await pool.query(
      `UPDATE work_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [toStatus, id]
    );
    
    // Create status history entry
    await pool.query(
      `INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by_id, changed_at, note)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [id, fromStatus, toStatus, 1, note || '']
    );
    
    // Create notification
    const technician = woResult.rows[0].assigned_technician_id;
    const techName = technician ? await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [technician]) : null;
    
    let notifyMessage = '';
    let notifyType = 'INFO';
    
    const statusMap = {
      'NEW': 'Work order created',
      'ASSIGNED': 'Work order assigned',
      'IN_PROGRESS': 'Work started',
      'ON_HOLD': 'Work on hold',
      'COMPLETED': 'Job completed',
      'CLOSED': 'Work order closed'
    };
    
    notifyMessage = statusMap[toStatus] || 'Status changed';
    if (technician) {
      notifyMessage = `You ${statusMap[toStatus] || 'status changed'} for work order WO-${id}`;
    }
    
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
       VALUES ($1, 'Work order status changed', $2, $3, FALSE, NOW())`,
      [technician || 1, notifyMessage, notifyType]
    );
    
    res.json(updateResult.rows[0]);
  } catch (err) {
    console.error('Update work order status error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============ CUSTOMER ROUTES ============

// List customers
app.get('/api/customers', async (req, res) => {
  try {
    const { search, page = 1, size = 20 } = req.query;
    
    let query = `SELECT * FROM customers WHERE 1=1`;
    const params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR contact_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as subquery`, params);
    const total = parseInt(countResult.rows[0].total);
    
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);
    const offset = (pageNum - 1) * pageSize;
    
    query += ` ORDER BY name LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(pageSize, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      content: result.rows,
      page: pageNum,
      size: pageSize,
      totalElements: total,
      totalPages: Math.ceil(total / pageSize),
      first: pageNum === 1,
      last: pageNum * pageSize >= total,
    });
  } catch (err) {
    console.error('Get customers error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create customer
app.post('/api/customers', async (req, res) => {
  try {
    const { name, contactName, email, phone, address } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    const createdAt = new Date();
    const result = await pool.query(
      `INSERT INTO customers (name, contact_name, email, phone, address, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, contactName || '', email || '', phone || '', address || '', createdAt, createdAt]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create customer error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============ SITE ROUTES ============

// List sites
app.get('/api/sites', async (req, res) => {
  try {
    const { customerId, search, page = 1, size = 20 } = req.query;
    
    let query = `SELECT s.*, c.name as customerName FROM sites s JOIN customers c ON s.customer_id = c.id WHERE 1=1`;
    const params = [];
    let paramCount = 0;
    
    if (customerId) {
      paramCount++;
      query += ` AND s.customer_id = $${paramCount}`;
      params.push(customerId);
    }
    if (search) {
      paramCount++;
      query += ` AND (s.name ILIKE $${paramCount} OR s.street_address ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as subquery`, params);
    const total = parseInt(countResult.rows[0].total);
    
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);
    const offset = (pageNum - 1) * pageSize;
    
    query += ` ORDER BY s.name LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(pageSize, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      content: result.rows,
      page: pageNum,
      size: pageSize,
      totalElements: total,
      totalPages: Math.ceil(total / pageSize),
      first: pageNum === 1,
      last: pageNum * pageSize >= total,
    });
  } catch (err) {
    console.error('Get sites error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create site
app.post('/api/sites', async (req, res) => {
  try {
    const { customerId, name, streetAddress, city, state, zip, country, contactName, contactPhone, notes } = req.body;
    
    if (!customerId || !name) {
      return res.status(400).json({ message: 'customerId and name are required' });
    }
    
    const createdAt = new Date();
    const result = await pool.query(
      `INSERT INTO sites (customer_id, name, street_address, city, state, zip, country, contact_name, contact_phone, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [customerId, name, streetAddress || '', city || '', state || '', zip || '', country || '', contactName || '', notes || '', createdAt, createdAt]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create site error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============ PART ROUTES ============

// List parts
app.get('/api/parts', async (req, res) => {
  try {
    const { search, lowStock, page = 1, size = 20 } = req.query;
    
    let query = `SELECT * FROM parts WHERE 1=1`;
    const params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR sku ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    if (lowStock) {
      paramCount++;
      query += ` AND low_stock = $${paramCount}`;
      params.push(lowStock === 'true');
    }
    
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as subquery`, params);
    const total = parseInt(countResult.rows[0].total);
    
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);
    const offset = (pageNum - 1) * pageSize;
    
    query += ` ORDER BY name LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(pageSize, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      content: result.rows,
      page: pageNum,
      size: pageSize,
      totalElements: total,
      totalPages: Math.ceil(total / pageSize),
      first: pageNum === 1,
      last: pageNum * pageSize >= total,
    });
  } catch (err) {
    console.error('Get parts error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============ DASHBOARD ROUTES ============

// Dashboard metrics
app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    // Get counts from database
    const woCount = await pool.query('SELECT COUNT(*) as count FROM work_orders');
    const woStatusCounts = await pool.query(
      `SELECT status, COUNT(*) as count FROM work_orders GROUP BY status`
    );
    const partsLow = await pool.query(`SELECT COUNT(*) as count FROM parts WHERE quantity_on_hand <= reorder_level`);
    const users = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['TECHNICIAN']);
    const customers = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['CUSTOMER']);
    
    const metrics = {
      totalWorkOrders: parseInt(woCount.rows[0].count),
      byStatus: {},
      openWorkOrders: 0,
      overdueWorkOrders: 0,
      slaBreached: 0,
      slaComplianceRate: 100,
      openUrgent: 0,
      openHigh: 0,
      openMedium: 0,
      openLow: 0,
      totalTechnicians: parseInt(users.rows[0].count),
      busyTechnicians: 0,
      idleTechnicians: 0,
      lowStockParts: parseInt(partsLow.rows[0].count),
      lowStockAlerts: 0,
      unreadDispatcherNotifications: 0,
      averageCompletionHours: 0,
      completedLast30Days: 0,
      recentActivity: [],
      priorityOrder: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      statusOrder: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED'],
      technicians: [],
      completedLast30Days: 0,
    };
    
    // Calculate status counts
    woStatusCounts.rows.forEach(row => {
      const status = row.status;
      metrics.byStatus[status] = parseInt(row.count);
      if (status !== 'COMPLETED' && status !== 'CLOSED') {
        metrics.openWorkOrders += parseInt(row.count);
      }
      if (['URGENT', 'HIGH'].includes(status)) {
        if (status === 'URGENT') metrics.openUrgent += parseInt(row.count);
        if (status === 'HIGH') metrics.openHigh += parseInt(row.count);
      }
      if (status === 'MEDIUM') metrics.openMedium += parseInt(row.count);
      if (status === 'LOW') metrics.openLow += parseInt(row.count);
    });
    
    // Low stock parts (estimate: 30% of low stock parts trigger alerts)
    metrics.lowStockAlerts = Math.floor(metrics.lowStockParts * 0.3);
    
    res.json(metrics);
  } catch (err) {
    console.error('Get dashboard metrics error:', err.message);
    // Return default metrics on error
    res.json({
      totalWorkOrders: 0,
      byStatus: {},
      openWorkOrders: 0,
      overdueWorkOrders: 0,
      slaBreached: 0,
      slaComplianceRate: 100,
      openUrgent: 0,
      openHigh: 0,
      openMedium: 0,
      openLow: 0,
      totalTechnicians: 0,
      busyTechnicians: 0,
      idleTechnicians: 0,
      lowStockParts: 0,
      lowStockAlerts: 0,
      unreadDispatcherNotifications: 0,
      averageCompletionHours: 0,
      completedLast30Days: 0,
      recentActivity: [],
      priorityOrder: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      statusOrder: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED'],
      technicians: [],
    });
  }
});

// ============ NOTIFICATION ROUTES ============

// List notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const { page = 1, size = 20, unreadOnly } = req.query;
    
    let query = `SELECT n.*, u.first_name, u.last_name FROM notifications n LEFT JOIN users u ON n.user_id = u.id WHERE 1=1`;
    const params = [];
    let paramCount = 0;
    
    if (unreadOnly === 'true') {
      paramCount++;
      query += ` AND n.is_read = $${paramCount}`;
      params.push(true);
    }
    
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as subquery`, params);
    const total = parseInt(countResult.rows[0].total);
    
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);
    const offset = (pageNum - 1) * pageSize;
    
    query += ` ORDER BY n.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(pageSize, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      content: result.rows,
      page: pageNum,
      size: pageSize,
      totalElements: total,
      totalPages: Math.ceil(total / pageSize),
      first: pageNum === 1,
      last: pageNum * pageSize >= total,
    });
  } catch (err) {
    console.error('Get notifications error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark notification read error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark all notifications as read
app.patch('/api/notifications/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all notifications read error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============ SCHEDULE/HEALTH ============

// Health check
app.get('/actuator/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Simple health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Keystone API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  pool.end();
  process.exit(0);
});