const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// ── Supabase admin client ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CORS_ALLOWED = (process.env.CORS_ORIGIN || '')
  .split(',').map((o) => o.trim()).filter(Boolean);

const ACCESS_TOKEN_SECRET  = process.env.ACCESS_TOKEN_SECRET  || 'dev-access-secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret';

// ── Middleware ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: CORS_ALLOWED.length ? CORS_ALLOWED : true, credentials: true }));
app.use(express.json());

// ── Helpers ──
function makeAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
}
function makeRefreshToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, REFRESH_TOKEN_SECRET);
}
function currentUserId(req) {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.split(' ')[1], ACCESS_TOKEN_SECRET).id; }
  catch { return null; }
}
function toUser(row) {
  return {
    id: row.id, username: row.username,
    firstName: row.first_name, lastName: row.last_name,
    email: row.email, phone: row.phone,
    role: row.role, enabled: row.enabled,
  };
}
function toNotification(row) {
  return {
    id: row.id, title: row.title, message: row.message,
    type: row.type, read: !!row.is_read, createdAt: row.created_at,
  };
}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, firstName, lastName, email, phone, role } = req.body;
    if (!username || !password || !role)
      return res.status(400).json({ message: 'Missing required fields' });

    const { data: existing } = await supabase
      .from('users').select('id').eq('username', username).maybeSingle();
    if (existing) return res.status(409).json({ message: 'Username already exists' });

    const hashed  = await bcrypt.hash(password, 10);
    const enabled = role !== 'CUSTOMER';
    const now     = new Date().toISOString();

    const { data: user, error } = await supabase
      .from('users')
      .insert({ username, password: hashed, first_name: firstName || '',
                last_name: lastName || '', email: email || '', phone: phone || '',
                role, enabled, created_at: now, updated_at: now })
      .select().single();
    if (error) throw error;

    const refreshToken = makeRefreshToken(user);
    await supabase.from('refresh_tokens').insert({
      token: refreshToken, user_id: user.id, created_at: now,
    });

    await supabase.from('notifications').insert({
      user_id: user.id, title: 'Welcome',
      message: 'Welcome to Keystone Field Service',
      type: 'INFO', is_read: false, created_at: now,
    });

    res.json({ accessToken: makeAccessToken(user), refreshToken, user: toUser(user) });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Missing username or password' });

    const { data: user, error } = await supabase
      .from('users').select('*').eq('username', username).maybeSingle();
    if (error || !user) return res.status(401).json({ message: 'Invalid username or password' });
    if (!user.enabled)  return res.status(401).json({ message: 'Account disabled' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid username or password' });

    const refreshToken = makeRefreshToken(user);
    await supabase.from('refresh_tokens').insert({
      token: refreshToken, user_id: user.id, created_at: new Date().toISOString(),
    });

    res.json({ accessToken: makeAccessToken(user), refreshToken, user: toUser(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(403).json({ message: 'Invalid refresh token' });

    const { data: stored } = await supabase
      .from('refresh_tokens').select('user_id').eq('token', token).maybeSingle();
    if (!stored) return res.status(403).json({ message: 'Invalid refresh token' });

    jwt.verify(token, REFRESH_TOKEN_SECRET, async (err, user) => {
      if (err) return res.status(403).json({ message: 'Invalid refresh token' });

      await supabase.from('refresh_tokens').delete().eq('token', token);

      const { data: freshUser } = await supabase
        .from('users').select('*').eq('id', user.id).maybeSingle();
      if (!freshUser) return res.status(403).json({ message: 'User not found' });

      const newRefresh = makeRefreshToken(freshUser);
      await supabase.from('refresh_tokens').insert({
        token: newRefresh, user_id: freshUser.id, created_at: new Date().toISOString(),
      });

      res.json({ accessToken: makeAccessToken(freshUser), refreshToken: newRefresh });
    });
  } catch (err) {
    console.error('Refresh error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const { token } = req.body;
  if (token) await supabase.from('refresh_tokens').delete().eq('token', token);
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ message: 'Authentication required' });
  jwt.verify(auth.split(' ')[1], ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    res.json({ user: decoded });
  });
});

// ══════════════════════════════════════════
//  WORK ORDERS
// ══════════════════════════════════════════

app.get('/api/work-orders', async (req, res) => {
  try {
    const { search, status, priority, customerId, siteId,
            technicianId, slaBreached, page = 1, size = 20 } = req.query;

    let q = supabase.from('work_orders')
      .select('*, customers(name), sites(name)', { count: 'exact' });

    if (search)       q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%,work_order_number.ilike.%${search}%`);
    if (status)       q = q.eq('status', status);
    if (priority)     q = q.eq('priority', priority);
    if (customerId)   q = q.eq('customer_id', customerId);
    if (siteId)       q = q.eq('site_id', siteId);
    if (technicianId) q = q.eq('assigned_technician_id', technicianId);
    if (slaBreached !== undefined) q = q.eq('sla_breached', slaBreached === 'true');
    q = q.order('created_at', { ascending: false });

    const p = Math.max(parseInt(page) || 1, 1);
    const s = Math.max(parseInt(size) || 20, 1);
    const { data, error, count } = await q.range((p - 1) * s, p * s - 1);
    if (error) throw error;

    const total = count || 0;
    res.json({
      content: data.map(r => ({ ...r, customerName: r.customers?.name, siteName: r.sites?.name })),
      page: p, size: s, totalElements: total,
      totalPages: Math.ceil(total / s), first: p === 1, last: p * s >= total,
    });
  } catch (err) {
    console.error('Get work orders error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/work-orders/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*, customers(name), sites(name), users!assigned_technician_id(first_name, last_name)')
      .eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data)  return res.status(404).json({ message: 'Work order not found' });
    res.json({
      ...data,
      customerName: data.customers?.name, siteName: data.sites?.name,
      technicianFirstName: data.users?.first_name, technicianLastName: data.users?.last_name,
    });
  } catch (err) {
    console.error('Get work order error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/work-orders', async (req, res) => {
  try {
    const { customerId, siteId, title, description, priority } = req.body;
    if (!customerId || !siteId || !title)
      return res.status(400).json({ message: 'Missing required fields: customerId, siteId, title' });

    const num = `WO-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    const now = new Date().toISOString();
    const userId = currentUserId(req) || 1;

    const { data, error } = await supabase.from('work_orders')
      .insert({ work_order_number: num, customer_id: customerId, site_id: siteId,
                title, description: description || '', priority: priority || 'MEDIUM',
                status: 'NEW', created_by_id: userId, created_at: now, updated_at: now })
      .select().single();
    if (error) throw error;

    await supabase.from('notifications').insert({
      user_id: userId, title: 'New work order',
      message: `${num} has been created`, type: 'INFO', is_read: false, created_at: now,
    });

    res.status(201).json(data);
  } catch (err) {
    console.error('Create work order error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/work-orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { toStatus, note } = req.body;
    if (!toStatus) return res.status(400).json({ message: 'Missing toStatus' });

    const { data: wo } = await supabase
      .from('work_orders').select('status, assigned_technician_id').eq('id', id).maybeSingle();
    if (!wo) return res.status(404).json({ message: 'Work order not found' });

    const userId = currentUserId(req) || 1;
    const now    = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('work_orders').update({ status: toStatus, updated_at: now })
      .eq('id', id).select().single();
    if (error) throw error;

    await supabase.from('work_order_status_history').insert({
      work_order_id: id, from_status: wo.status, to_status: toStatus,
      changed_by_id: userId, changed_at: now, note: note || '',
    });

    await supabase.from('notifications').insert({
      user_id: wo.assigned_technician_id || userId,
      title: 'Work order status changed',
      message: `Status changed to ${toStatus}`, type: 'INFO', is_read: false, created_at: now,
    });

    res.json(updated);
  } catch (err) {
    console.error('Update status error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ══════════════════════════════════════════
//  CUSTOMERS
// ══════════════════════════════════════════

app.get('/api/customers', async (req, res) => {
  try {
    const { search, page = 1, size = 20 } = req.query;
    let q = supabase.from('customers').select('*', { count: 'exact' });
    if (search) q = q.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
    q = q.order('name');
    const p = Math.max(parseInt(page) || 1, 1);
    const s = Math.max(parseInt(size) || 20, 1);
    const { data, error, count } = await q.range((p - 1) * s, p * s - 1);
    if (error) throw error;
    const total = count || 0;
    res.json({ content: data, page: p, size: s, totalElements: total,
      totalPages: Math.ceil(total / s), first: p === 1, last: p * s >= total });
  } catch (err) {
    console.error('Get customers error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, contactName, email, phone, address } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('customers')
      .insert({ name, contact_name: contactName || '', email: email || '',
                phone: phone || '', address: address || '', created_at: now, updated_at: now })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create customer error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ══════════════════════════════════════════
//  SITES
// ══════════════════════════════════════════

app.get('/api/sites', async (req, res) => {
  try {
    const { customerId, search, page = 1, size = 20 } = req.query;
    let q = supabase.from('sites').select('*, customers(name)', { count: 'exact' });
    if (customerId) q = q.eq('customer_id', customerId);
    if (search)     q = q.or(`name.ilike.%${search}%,street_address.ilike.%${search}%`);
    q = q.order('name');
    const p = Math.max(parseInt(page) || 1, 1);
    const s = Math.max(parseInt(size) || 20, 1);
    const { data, error, count } = await q.range((p - 1) * s, p * s - 1);
    if (error) throw error;
    const total = count || 0;
    res.json({ content: data.map(r => ({ ...r, customerName: r.customers?.name })),
      page: p, size: s, totalElements: total,
      totalPages: Math.ceil(total / s), first: p === 1, last: p * s >= total });
  } catch (err) {
    console.error('Get sites error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/sites', async (req, res) => {
  try {
    const { customerId, name, streetAddress, city, state, zip, country,
            contactName, contactPhone, notes } = req.body;
    if (!customerId || !name)
      return res.status(400).json({ message: 'customerId and name are required' });
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('sites')
      .insert({ customer_id: customerId, name, street_address: streetAddress || '',
                city: city || '', state: state || '', zip: zip || '', country: country || '',
                contact_name: contactName || '', contact_phone: contactPhone || '',
                notes: notes || '', created_at: now, updated_at: now })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create site error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ══════════════════════════════════════════
//  PARTS
// ══════════════════════════════════════════

app.get('/api/parts', async (req, res) => {
  try {
    const { search, page = 1, size = 20 } = req.query;
    let q = supabase.from('parts').select('*', { count: 'exact' });
    if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
    q = q.order('name');
    const p = Math.max(parseInt(page) || 1, 1);
    const s = Math.max(parseInt(size) || 20, 1);
    const { data, error, count } = await q.range((p - 1) * s, p * s - 1);
    if (error) throw error;
    const total = count || 0;
    res.json({ content: data, page: p, size: s, totalElements: total,
      totalPages: Math.ceil(total / s), first: p === 1, last: p * s >= total });
  } catch (err) {
    console.error('Get parts error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ══════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════

app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    const [{ data: allWo }, { data: techs }, { data: lowParts }] = await Promise.all([
      supabase.from('work_orders').select('status, priority'),
      supabase.from('users').select('id').eq('role', 'TECHNICIAN'),
      supabase.from('parts').select('id').lte('quantity_on_hand', 0),
    ]);

    const byStatus = {};
    let openWorkOrders = 0;
    const openBy = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    (allWo || []).forEach(wo => {
      byStatus[wo.status] = (byStatus[wo.status] || 0) + 1;
      if (!['COMPLETED', 'CLOSED'].includes(wo.status)) {
        openWorkOrders++;
        if (openBy[wo.priority] !== undefined) openBy[wo.priority]++;
      }
    });

    res.json({
      totalWorkOrders: allWo?.length || 0, byStatus, openWorkOrders,
      overdueWorkOrders: 0, slaBreached: 0, slaComplianceRate: 100,
      openUrgent: openBy.URGENT, openHigh: openBy.HIGH,
      openMedium: openBy.MEDIUM, openLow: openBy.LOW,
      totalTechnicians: techs?.length || 0, busyTechnicians: 0,
      idleTechnicians: techs?.length || 0, lowStockParts: lowParts?.length || 0,
      lowStockAlerts: lowParts?.length || 0, unreadDispatcherNotifications: 0,
      averageCompletionHours: 0, completedLast30Days: byStatus['COMPLETED'] || 0,
      recentActivity: [],
      priorityOrder: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      statusOrder: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED'],
      technicians: [],
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ══════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════

app.get('/api/notifications', async (req, res) => {
  try {
    const { page = 0, size = 20, unreadOnly } = req.query;
    const userId = currentUserId(req);
    let q = supabase.from('notifications').select('*', { count: 'exact' });
    if (userId)              q = q.eq('user_id', userId);
    if (unreadOnly === 'true') q = q.eq('is_read', false);
    q = q.order('created_at', { ascending: false });
    const p = Math.max(parseInt(page) || 0, 0);
    const s = Math.max(parseInt(size) || 20, 1);
    const { data, error, count } = await q.range(p * s, (p + 1) * s - 1);
    if (error) throw error;
    const total = count || 0;
    res.json({ content: (data || []).map(toNotification),
      page: p, size: s, totalElements: total,
      totalPages: Math.ceil(total / s), first: p === 0, last: (p + 1) * s >= total });
  } catch (err) {
    console.error('Get notifications error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const userId = currentUserId(req);
    let q = supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_read', false);
    if (userId) q = q.eq('user_id', userId);
    const { count, error } = await q;
    if (error) throw error;
    res.json(count || 0);
  } catch (err) {
    console.error('Unread count error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    const userId = currentUserId(req);
    let q = supabase.from('notifications').update({ is_read: true }).eq('id', req.params.id);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q.select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Notification not found' });
    res.json(toNotification(data));
  } catch (err) {
    console.error('Mark read error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  try {
    const userId = currentUserId(req);
    let q = supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ══════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════

app.get('/api/users', async (req, res) => {
  try {
    const { role, page = 1, size = 20 } = req.query;
    let q = supabase.from('users')
      .select('id, username, first_name, last_name, email, phone, role, enabled, created_at',
              { count: 'exact' });
    if (role) q = q.eq('role', role);
    q = q.order('username');
    const p = Math.max(parseInt(page) || 1, 1);
    const s = Math.max(parseInt(size) || 20, 1);
    const { data, error, count } = await q.range((p - 1) * s, p * s - 1);
    if (error) throw error;
    const total = count || 0;
    res.json({ content: data, page: p, size: s, totalElements: total,
      totalPages: Math.ceil(total / s), first: p === 1, last: p * s >= total });
  } catch (err) {
    console.error('Get users error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ══════════════════════════════════════════
//  HEALTH
// ══════════════════════════════════════════

app.get('/api/health', (_req, res) => res.json({ status: 'OK' }));
app.get('/health',     (_req, res) => res.json({ status: 'OK' }));

// ── Export for Vercel serverless ──
module.exports = app;

// ── Also run as standalone server locally ──
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Keystone API running on port ${PORT}`);
    console.log(`Supabase: ${process.env.SUPABASE_URL}`);
  });
}
