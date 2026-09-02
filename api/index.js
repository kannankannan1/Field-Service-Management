'use strict';
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const path     = require('path');
require('dotenv').config();

const app = express();

// ── DB: SQLite locally, Supabase on Vercel ───────────────────────────────────
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
let db, supabase;

if (USE_SUPABASE) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
} else {
  const Database = require('better-sqlite3');
  const raw = new Database(path.join(__dirname, 'keystone.db'));
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  db = {
    get:  (q, ...p) => raw.prepare(q).get(...p),
    all:  (q, ...p) => raw.prepare(q).all(...p),
    run:  (q, ...p) => { const r = raw.prepare(q).run(...p); return { changes: r.changes, lastInsertRowid: r.lastInsertRowid }; },
    exec: (q)       => raw.exec(q),
    tx:   (fn)      => raw.transaction(fn)(),
  };
}

// ── Config ───────────────────────────────────────────────────────────────────
const CORS_ALLOWED = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',').map(o => o.trim()).filter(Boolean);
const ACCESS_TOKEN_SECRET  = process.env.ACCESS_TOKEN_SECRET  || 'dev-access-secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: CORS_ALLOWED.length ? CORS_ALLOWED : true, credentials: true }));
app.use(express.json());

// ── SQLite schema + seed (local only) ────────────────────────────────────────
if (!USE_SUPABASE) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT DEFAULT '', role TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, contact_name TEXT DEFAULT '', email TEXT DEFAULT '', phone TEXT DEFAULT '', address TEXT DEFAULT '', user_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, name TEXT NOT NULL, street_address TEXT DEFAULT '', city TEXT DEFAULT '', state TEXT DEFAULT '', zip TEXT DEFAULT '', country TEXT DEFAULT '', contact_name TEXT DEFAULT '', contact_phone TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS work_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, work_order_number TEXT NOT NULL UNIQUE, customer_id INTEGER NOT NULL, site_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', priority TEXT NOT NULL DEFAULT 'MEDIUM', status TEXT NOT NULL DEFAULT 'NEW', assigned_technician_id INTEGER, created_by_id INTEGER, scheduled_start TEXT, scheduled_end TEXT, actual_start TEXT, actual_end TEXT, sla_due_at TEXT, sla_breached INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT);
    CREATE TABLE IF NOT EXISTS work_order_status_history (id INTEGER PRIMARY KEY AUTOINCREMENT, work_order_id INTEGER NOT NULL, from_status TEXT, to_status TEXT NOT NULL, changed_by_id INTEGER, changed_at TEXT NOT NULL, note TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS parts (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT DEFAULT '', unit_price REAL NOT NULL DEFAULT 0, quantity_on_hand INTEGER NOT NULL DEFAULT 0, reorder_level INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, part_id INTEGER NOT NULL, work_order_id INTEGER, type TEXT NOT NULL, quantity_change INTEGER NOT NULL, note TEXT DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS time_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, work_order_id INTEGER NOT NULL, technician_id INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT, hours_worked REAL, notes TEXT DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, message TEXT DEFAULT '', type TEXT NOT NULL DEFAULT 'INFO', is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  `);

  if (db.get('SELECT COUNT(*) as n FROM users').n === 0) {
    const now = new Date().toISOString();
    db.tx(() => {
      const iu = (un,pw,fn,ln,em,ph,role) => db.run('INSERT INTO users(username,password,first_name,last_name,email,phone,role,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)',un,pw,fn,ln,em,ph,role,now,now);
      iu('manager1',   '$2b$10$J68eQX7mPnZj/kXzTiEK8.yPfGjt1XUJpPZrEJv38MI.2pWPqqwAy','Alex',  'Morgan','alex@keystone.test','555-1001','MANAGER');
      iu('dispatcher1','$2b$10$AjDvH1qGnIvFehzxp9Zv7.vqYpq1JgGwjMMo5rvSxqz4.Z0/kVROq','Sam',   'Carter','sam@keystone.test', '555-1002','DISPATCHER');
      iu('tech1',      '$2b$10$/hm4g2B.3EkBu8qLX/jZKeFOG3xN3pUFCeHTZsz1HfjxESlWmZzCO','Jordan','Lee',   'jordan@keystone.test','555-1003','TECHNICIAN');
      iu('tech2',      '$2b$10$/hm4g2B.3EkBu8qLX/jZKeFOG3xN3pUFCeHTZsz1HfjxESlWmZzCO','Casey', 'Kim',   'casey@keystone.test','555-1004','TECHNICIAN');
      iu('customer1',  '$2b$10$cIKAgdwp1hxHBBHD5k4W8uPW7EYXSKbGY9I3x5wQI8uzN/bR7PE5m','Riley', 'Smith', 'riley@acme.test',   '555-2001','CUSTOMER');
    });
    const custId = db.run('INSERT INTO customers(name,contact_name,email,phone,address,user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)','Acme Corp','Riley Smith','riley@acme.test','555-2001','123 Main St',db.get("SELECT id FROM users WHERE username='customer1'").id,now,now).lastInsertRowid;
    const cust2Id = db.run('INSERT INTO customers(name,contact_name,email,created_at,updated_at) VALUES(?,?,?,?,?)','Globex Inc','Homer Simpson','homer@globex.test',now,now).lastInsertRowid;
    const site1Id = db.run('INSERT INTO sites(customer_id,name,street_address,city,state,zip,contact_name,contact_phone,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',custId,'Acme HQ','123 Main St','Springfield','IL','62701','Riley','555-2001',now,now).lastInsertRowid;
    const site2Id = db.run('INSERT INTO sites(customer_id,name,city,state,created_at,updated_at) VALUES(?,?,?,?,?,?)',custId,'Acme Warehouse','Springfield','IL',now,now).lastInsertRowid;
    const site3Id = db.run('INSERT INTO sites(customer_id,name,city,state,created_at,updated_at) VALUES(?,?,?,?,?,?)',cust2Id,'Globex Plant A','Shelbyville','IL',now,now).lastInsertRowid;
    const mgrId  = db.get("SELECT id FROM users WHERE username='manager1'").id;
    const tech1Id= db.get("SELECT id FROM users WHERE username='tech1'").id;
    const wo1Id  = db.run('INSERT INTO work_orders(work_order_number,customer_id,site_id,title,description,priority,status,assigned_technician_id,created_by_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)','WO-000001',custId,site1Id,'AC Unit Not Cooling','Unit blowing warm air.','HIGH','IN_PROGRESS',tech1Id,mgrId,now,now).lastInsertRowid;
    db.run('INSERT INTO work_orders(work_order_number,customer_id,site_id,title,priority,status,created_by_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)','WO-000002',custId,site2Id,'Annual HVAC Maintenance','MEDIUM','NEW',mgrId,now,now);
    db.run('INSERT INTO work_orders(work_order_number,customer_id,site_id,title,priority,status,created_by_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)','WO-000003',cust2Id,site3Id,'Emergency Boiler Repair','URGENT','ASSIGNED',mgrId,now,now);
    db.run('INSERT INTO work_order_status_history(work_order_id,from_status,to_status,changed_by_id,changed_at,note) VALUES(?,?,?,?,?,?)',wo1Id,null,'NEW',mgrId,now,'Created');
    db.run('INSERT INTO work_order_status_history(work_order_id,from_status,to_status,changed_by_id,changed_at,note) VALUES(?,?,?,?,?,?)',wo1Id,'NEW','IN_PROGRESS',tech1Id,now,'Started');
    db.tx(() => {
      const ip = (sku,n,d,p,q,r) => db.run('INSERT INTO parts(sku,name,description,unit_price,quantity_on_hand,reorder_level,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',sku,n,d,p,q,r,now,now);
      ip('FILT-001','HVAC Filter 16x20','Standard filter',12.99,45,10);
      ip('BELT-002','Drive Belt 3/8"','Replacement belt',8.50,23,5);
      ip('PUMP-003','Condensate Pump','115V pump',89.00,4,5);
      ip('CNTRL-004','Digital Thermostat','Programmable',54.00,18,8);
      ip('REFR-005','Refrigerant R-410A','2lb canister',65.00,2,3);
    });
    for (const u of db.all('SELECT id FROM users')) db.run('INSERT INTO notifications(user_id,title,message,type,is_read,created_at) VALUES(?,?,?,?,0,?)',u.id,'Welcome','Welcome to Keystone Field Service','INFO',now);
    console.log('✓ Demo data seeded');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeAccess  = u => jwt.sign({ id:u.id, username:u.username, role:u.role }, ACCESS_TOKEN_SECRET, { expiresIn:'15m' });
const makeRefresh = u => jwt.sign({ id:u.id, username:u.username }, REFRESH_TOKEN_SECRET);
function currentUserId(req) {
  const a = req.headers['authorization'];
  if (!a?.startsWith('Bearer ')) return null;
  try { return jwt.verify(a.split(' ')[1], ACCESS_TOKEN_SECRET).id; } catch { return null; }
}
function toUser(r) {
  return { id:r.id, username:r.username, firstName:r.first_name||r.firstName, lastName:r.last_name||r.lastName,
    fullName:[r.first_name||r.firstName,r.last_name||r.lastName].filter(Boolean).join(' ')||r.username,
    email:r.email, phone:r.phone, role:r.role, enabled:r.enabled===undefined?true:!!r.enabled, createdAt:r.created_at||r.createdAt };
}
function pg(total,p,s) { return { page:p, size:s, totalElements:total, totalPages:Math.ceil(total/s), first:p===1, last:p*s>=total }; }
function pg0(total,p,s) { return { page:p, size:s, totalElements:total, totalPages:Math.ceil(total/s), first:p===0, last:(p+1)*s>=total }; }

// ── Supabase helpers (used only when USE_SUPABASE=true) ───────────────────────
function sbErr(error, res, msg) { if (error) { console.error(msg, error.message); res.status(500).json({ message: 'Database error. Please try again.' }); return true; } return false; }

// ── SQLite query helpers ──────────────────────────────────────────────────────
const WO_SQL = `SELECT wo.*, c.name AS customer_name, s.name AS site_name, s.street_address, s.city, s.state, (t.first_name||' '||t.last_name) AS technician_name, (cb.first_name||' '||cb.last_name) AS created_by_name FROM work_orders wo LEFT JOIN customers c ON c.id=wo.customer_id LEFT JOIN sites s ON s.id=wo.site_id LEFT JOIN users t ON t.id=wo.assigned_technician_id LEFT JOIN users cb ON cb.id=wo.created_by_id`;
const SM_SQL = `SELECT sm.*, p.sku AS part_sku, p.name AS part_name, wo.work_order_number FROM stock_movements sm LEFT JOIN parts p ON p.id=sm.part_id LEFT JOIN work_orders wo ON wo.id=sm.work_order_id`;
const TL_SQL = `SELECT tl.*, (u.first_name||' '||u.last_name) AS technician_name, wo.work_order_number FROM time_logs tl LEFT JOIN users u ON u.id=tl.technician_id LEFT JOIN work_orders wo ON wo.id=tl.work_order_id`;

function serializeWO(r) {
  return { id:r.id, workOrderNumber:r.work_order_number||r.workOrderNumber,
    customerId:r.customer_id||r.customerId, customerName:r.customer_name||r.customerName||undefined,
    siteId:r.site_id||r.siteId, siteName:r.site_name||r.siteName||undefined,
    title:r.title, description:r.description, priority:r.priority, status:r.status,
    assignedTechnicianId:r.assigned_technician_id||r.assignedTechnicianId||undefined,
    assignedTechnicianName:r.technician_name?.trim()||r.assignedTechnicianName||undefined,
    createdById:r.created_by_id||r.createdById,
    createdByName:r.created_by_name?.trim()||r.createdByName||undefined,
    siteAddress:[r.street_address,r.city,r.state].filter(Boolean).join(', ')||undefined,
    scheduledStart:r.scheduled_start||r.scheduledStart||undefined, scheduledEnd:r.scheduled_end||r.scheduledEnd||undefined,
    slaDueAt:r.sla_due_at||r.slaDueAt||undefined, slaBreached:!!r.sla_breached,
    createdAt:r.created_at||r.createdAt, updatedAt:r.updated_at||r.updatedAt, closedAt:r.closed_at||r.closedAt||undefined };
}
function serializeSM(r) {
  return { id:r.id, partId:r.part_id||r.partId, partSku:r.part_sku||r.sku, partName:r.part_name||r.name,
    workOrderId:r.work_order_id||r.workOrderId, workOrderNumber:r.work_order_number||r.workOrderNumber,
    type:r.type, quantityChange:r.quantity_change||r.quantityChange, note:r.note, createdAt:r.created_at||r.createdAt };
}
function serializeTL(r) {
  return { id:r.id, workOrderId:r.work_order_id||r.workOrderId, workOrderNumber:r.work_order_number||r.workOrderNumber,
    technicianId:r.technician_id||r.technicianId, technicianName:r.technician_name?.trim()||r.technicianName||undefined,
    startTime:r.start_time||r.startTime, endTime:r.end_time||r.endTime||undefined, hoursWorked:r.hours_worked||r.hoursWorked,
    notes:r.notes, createdAt:r.created_at||r.createdAt };
}
function toNotif(r) { return { id:r.id, title:r.title, message:r.message, type:r.type, read:r.read!==undefined?!!r.read:!!r.is_read, createdAt:r.created_at||r.createdAt }; }

// ═══════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, firstName, lastName, email, phone, role } = req.body;
    if (!username||!password||!role) return res.status(400).json({ message:'Missing required fields' });
    const now = new Date().toISOString();
    const hashed = await bcrypt.hash(password, 10);
    const enabled = 1;

    if (USE_SUPABASE) {
      const { data:existing } = await supabase.from('users').select('id').eq('username',username).maybeSingle();
      if (existing) return res.status(409).json({ message:'Username already exists' });
      const { data:user, error } = await supabase.from('users').insert({ username, password:hashed, first_name:firstName||'', last_name:lastName||'', email:email||'', phone:phone||'', role, enabled:true, created_at:now, updated_at:now }).select().single();
      if (sbErr(error, res, 'Register:')) return;
      const refreshToken = makeRefresh(user);
      try { await supabase.from('refresh_tokens').insert({ token:refreshToken, user_id:user.id, created_at:now }); } catch(e){}
      try { await supabase.from('notifications').insert({ user_id:user.id, title:'Welcome', message:'Welcome to Keystone Field Service', type:'INFO', is_read:false, created_at:now }); } catch(e){}
      return res.json({ accessToken:makeAccess(user), refreshToken, user:toUser(user) });
    }

    if (db.get('SELECT id FROM users WHERE username=?',username)) return res.status(409).json({ message:'Username already exists' });
    const uid = db.run('INSERT INTO users(username,password,first_name,last_name,email,phone,role,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)',username,hashed,firstName||'',lastName||'',email||'',phone||'',role,now,now).lastInsertRowid;
    const user = db.get('SELECT * FROM users WHERE id=?',uid);
    const refreshToken = makeRefresh(user);
    try { db.run('INSERT INTO refresh_tokens(token,user_id,created_at) VALUES(?,?,?)',refreshToken,uid,now); } catch(e){}
    try { db.run('INSERT INTO notifications(user_id,title,message,type,is_read,created_at) VALUES(?,?,?,?,0,?)',uid,'Welcome','Welcome to Keystone Field Service','INFO',now); } catch(e){}
    res.json({ accessToken:makeAccess(user), refreshToken, user:toUser(user) });
  } catch(err) { console.error('Register:',err.message); res.status(500).json({ message:'Registration failed. Please try again.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username||!password) return res.status(400).json({ message:'Missing username or password' });

    if (USE_SUPABASE) {
      const { data:user, error:dbErr } = await supabase.from('users').select('*').eq('username',username).maybeSingle();
      if (dbErr) { console.error('Login DB:',dbErr.message); return res.status(500).json({ message:'Database error. Please try again.' }); }
      if (!user) return res.status(401).json({ message:'Invalid username or password' });
      if (!user.enabled) return res.status(401).json({ message:'Account disabled. Contact your administrator.' });
      if (!user.password) return res.status(500).json({ message:'Account configuration error.' });
      let valid=false; try { valid=await bcrypt.compare(password,user.password); } catch(e){ return res.status(500).json({ message:'Authentication error.' }); }
      if (!valid) return res.status(401).json({ message:'Invalid username or password' });
      const accessToken=makeAccess(user), refreshToken=makeRefresh(user);
      try { await supabase.from('refresh_tokens').insert({ token:refreshToken, user_id:user.id, created_at:new Date().toISOString() }); } catch(e){}
      return res.json({ accessToken, refreshToken, user:toUser(user) });
    }

    const user = db.get('SELECT * FROM users WHERE username=?',username);
    if (!user) return res.status(401).json({ message:'Invalid username or password' });
    if (!user.enabled) return res.status(401).json({ message:'Account disabled. Contact your administrator.' });
    let valid=false; try { valid=await bcrypt.compare(password,user.password); } catch(e){ return res.status(500).json({ message:'Authentication error.' }); }
    if (!valid) return res.status(401).json({ message:'Invalid username or password' });
    const accessToken=makeAccess(user), refreshToken=makeRefresh(user);
    try { db.run('INSERT INTO refresh_tokens(token,user_id,created_at) VALUES(?,?,?)',refreshToken,user.id,new Date().toISOString()); } catch(e){}
    res.json({ accessToken, refreshToken, user:toUser(user) });
  } catch(err) { console.error('Login:',err.message); res.status(500).json({ message:'Login failed. Please try again.' }); }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(403).json({ message:'Refresh token required' });
    let decoded; try { decoded=jwt.verify(token,REFRESH_TOKEN_SECRET); } catch { return res.status(403).json({ message:'Invalid or expired refresh token' }); }

    if (USE_SUPABASE) {
      const { data:stored } = await supabase.from('refresh_tokens').select('user_id').eq('token',token).maybeSingle();
      if (!stored) return res.status(403).json({ message:'Session expired. Please log in again.' });
      const { data:user } = await supabase.from('users').select('*').eq('id',decoded.id).maybeSingle();
      if (!user||!user.enabled) return res.status(403).json({ message:'Account not available' });
      await supabase.from('refresh_tokens').delete().eq('token',token);
      const newRefresh=makeRefresh(user);
      try { await supabase.from('refresh_tokens').insert({ token:newRefresh, user_id:user.id, created_at:new Date().toISOString() }); } catch(e){}
      return res.json({ accessToken:makeAccess(user), refreshToken:newRefresh });
    }

    const stored=db.get('SELECT user_id FROM refresh_tokens WHERE token=?',token);
    if (!stored) return res.status(403).json({ message:'Session expired. Please log in again.' });
    const user=db.get('SELECT * FROM users WHERE id=?',decoded.id);
    if (!user||!user.enabled) return res.status(403).json({ message:'Account not available' });
    db.run('DELETE FROM refresh_tokens WHERE token=?',token);
    const newRefresh=makeRefresh(user);
    try { db.run('INSERT INTO refresh_tokens(token,user_id,created_at) VALUES(?,?,?)',newRefresh,user.id,new Date().toISOString()); } catch(e){}
    res.json({ accessToken:makeAccess(user), refreshToken:newRefresh });
  } catch(err) { console.error('Refresh:',err.message); res.status(500).json({ message:'Token refresh failed.' }); }
});

app.post('/api/auth/logout', async (req, res) => {
  try { const { token }=req.body; if (token) { if (USE_SUPABASE) await supabase.from('refresh_tokens').delete().eq('token',token); else db.run('DELETE FROM refresh_tokens WHERE token=?',token); } } catch(e){}
  res.json({ message:'Logged out successfully' });
});

app.get('/api/auth/me', async (req, res) => {
  const a=req.headers['authorization'];
  if (!a?.startsWith('Bearer ')) return res.status(401).json({ message:'Authentication required' });
  try {
    const decoded=jwt.verify(a.split(' ')[1],ACCESS_TOKEN_SECRET);
    if (USE_SUPABASE) {
      const { data:user,error }=await supabase.from('users').select('*').eq('id',decoded.id).maybeSingle();
      if (error) return res.status(500).json({ message:'Database error' });
      if (!user) return res.status(401).json({ message:'User not found' });
      return res.json(toUser(user));
    }
    const user=db.get('SELECT * FROM users WHERE id=?',decoded.id);
    if (!user) return res.status(401).json({ message:'User not found' });
    res.json(toUser(user));
  } catch { res.status(401).json({ message:'Invalid or expired token' }); }
});

// ═══════════════════════════════════════════════════════════════════════
//  WORK ORDERS
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/work-orders', async (req, res) => {
  try {
    const { search,status,priority,customerId,siteId,technicianId,slaBreached,page=1,size=20 }=req.query;
    const p=Math.max(parseInt(page)||1,1), s=Math.max(parseInt(size)||20,1);

    if (USE_SUPABASE) {
      let q=supabase.from('work_orders').select('*,customers(name),sites(name),technician:users!assigned_technician_id(first_name,last_name),created_by:users!created_by_id(first_name,last_name)',{count:'exact'});
      if (search) q=q.or(`title.ilike.%${search}%,description.ilike.%${search}%,work_order_number.ilike.%${search}%`);
      if (status) q=q.eq('status',status); if (priority) q=q.eq('priority',priority);
      if (customerId) q=q.eq('customer_id',customerId); if (siteId) q=q.eq('site_id',siteId);
      if (technicianId) q=q.eq('assigned_technician_id',technicianId);
      if (slaBreached!==undefined) q=q.eq('sla_breached',slaBreached==='true');
      q=q.order('created_at',{ascending:false});
      const { data,error,count }=await q.range((p-1)*s,p*s-1);
      if (sbErr(error,res,'WOs:')) return;
      const total=count||0;
      return res.json({ content:(data||[]).map(r=>serializeWO({...r,customer_name:r.customers?.name,site_name:r.sites?.name,technician_name:r.technician?[r.technician.first_name,r.technician.last_name].filter(Boolean).join(' '):undefined,created_by_name:r.created_by?[r.created_by.first_name,r.created_by.last_name].filter(Boolean).join(' '):undefined})), ...pg(total,p,s) });
    }

    const conds=[],params=[];
    if (search){conds.push('(wo.title LIKE ? OR wo.description LIKE ? OR wo.work_order_number LIKE ?)');const v=`%${search}%`;params.push(v,v,v);}
    if (status){conds.push('wo.status=?');params.push(status);}
    if (priority){conds.push('wo.priority=?');params.push(priority);}
    if (customerId){conds.push('wo.customer_id=?');params.push(customerId);}
    if (siteId){conds.push('wo.site_id=?');params.push(siteId);}
    if (technicianId){conds.push('wo.assigned_technician_id=?');params.push(technicianId);}
    if (slaBreached!==undefined){conds.push('wo.sla_breached=?');params.push(slaBreached==='true'?1:0);}
    const w=conds.length?`WHERE ${conds.join(' AND ')}`:'';
    const total=db.get(`SELECT COUNT(*) as n FROM work_orders wo ${w}`,...params).n;
    const rows=db.all(`${WO_SQL} ${w} ORDER BY wo.created_at DESC LIMIT ? OFFSET ?`,...params,s,(p-1)*s);
    res.json({ content:rows.map(serializeWO), ...pg(total,p,s) });
  } catch(err){ console.error(err.message); res.status(500).json({ message:'Internal server error' }); }
});

app.get('/api/work-orders/kanban', async (req,res) => {
  try {
    const { search,priority,technicianId,customerId,siteId,slaBreached }=req.query;
    const board={NEW:[],ASSIGNED:[],IN_PROGRESS:[],ON_HOLD:[],COMPLETED:[],CLOSED:[]};

    if (USE_SUPABASE) {
      let q=supabase.from('work_orders').select('*,customers(name),sites(name)');
      if (search) q=q.or(`title.ilike.%${search}%,work_order_number.ilike.%${search}%`);
      if (priority) q=q.eq('priority',priority); if (technicianId) q=q.eq('assigned_technician_id',technicianId);
      if (customerId) q=q.eq('customer_id',customerId); if (siteId) q=q.eq('site_id',siteId);
      if (slaBreached!==undefined) q=q.eq('sla_breached',slaBreached==='true');
      const { data,error }=await q.order('created_at',{ascending:false});
      if (sbErr(error,res,'Kanban:')) return;
      for (const r of (data||[])) { const st=board[r.status]?r.status:'NEW'; board[st].push({ id:r.id,workOrderNumber:r.work_order_number,title:r.title,priority:r.priority,status:r.status,customerId:r.customer_id,customerName:r.customers?.name,siteName:r.sites?.name,assignedTechnicianId:r.assigned_technician_id||undefined,scheduledStart:r.scheduled_start||undefined,scheduledEnd:r.scheduled_end||undefined,slaDueAt:r.sla_due_at||undefined,slaBreached:!!r.sla_breached }); }
      return res.json(board);
    }

    const conds=[],params=[];
    if (search){conds.push('(wo.title LIKE ? OR wo.work_order_number LIKE ?)');const v=`%${search}%`;params.push(v,v);}
    if (priority){conds.push('wo.priority=?');params.push(priority);}
    if (technicianId){conds.push('wo.assigned_technician_id=?');params.push(technicianId);}
    if (customerId){conds.push('wo.customer_id=?');params.push(customerId);}
    if (siteId){conds.push('wo.site_id=?');params.push(siteId);}
    if (slaBreached!==undefined){conds.push('wo.sla_breached=?');params.push(slaBreached==='true'?1:0);}
    const w=conds.length?`WHERE ${conds.join(' AND ')}`:'';
    for (const r of db.all(`${WO_SQL} ${w} ORDER BY wo.created_at DESC`,...params)) { const st=board[r.status]?r.status:'NEW'; board[st].push({ id:r.id,workOrderNumber:r.work_order_number,title:r.title,priority:r.priority,status:r.status,customerId:r.customer_id,customerName:r.customer_name,siteName:r.site_name,assignedTechnicianId:r.assigned_technician_id||undefined,assignedTechnicianName:r.technician_name?.trim()||undefined,scheduledStart:r.scheduled_start||undefined,scheduledEnd:r.scheduled_end||undefined,slaDueAt:r.sla_due_at||undefined,slaBreached:!!r.sla_breached }); }
    res.json(board);
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});

app.get('/api/work-orders/:id', async (req,res) => {
  try {
    if (USE_SUPABASE) {
      const { data,error }=await supabase.from('work_orders').select('*,customers(name),sites(name),technician:users!assigned_technician_id(first_name,last_name),created_by:users!created_by_id(first_name,last_name)').eq('id',req.params.id).maybeSingle();
      if (sbErr(error,res,'WO:')) return; if (!data) return res.status(404).json({ message:'Work order not found' });
      return res.json(serializeWO({...data,customer_name:data.customers?.name,site_name:data.sites?.name,technician_name:data.technician?[data.technician.first_name,data.technician.last_name].filter(Boolean).join(' '):undefined,created_by_name:data.created_by?[data.created_by.first_name,data.created_by.last_name].filter(Boolean).join(' '):undefined}));
    }
    const row=db.get(`${WO_SQL} WHERE wo.id=?`,req.params.id);
    if (!row) return res.status(404).json({ message:'Work order not found' });
    res.json(serializeWO(row));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});

app.post('/api/work-orders', async (req,res) => {
  try {
    const { customerId,siteId,title,description,priority,scheduledStart,scheduledEnd }=req.body;
    if (!customerId||!siteId||!title) return res.status(400).json({ message:'Missing required fields' });
    const num=`WO-${Date.now().toString().slice(-6)}${Math.floor(Math.random()*100).toString().padStart(2,'0')}`;
    const now=new Date().toISOString(); const uid=currentUserId(req)||1;
    if (USE_SUPABASE) {
      const { data,error }=await supabase.from('work_orders').insert({ work_order_number:num,customer_id:customerId,site_id:siteId,title,description:description||'',priority:priority||'MEDIUM',status:'NEW',created_by_id:uid,scheduled_start:scheduledStart||null,scheduled_end:scheduledEnd||null,created_at:now,updated_at:now }).select().single();
      if (sbErr(error,res,'Create WO:')) return;
      try { await supabase.from('notifications').insert({ user_id:uid,title:'New work order',message:`${num} has been created`,type:'INFO',is_read:false,created_at:now }); } catch(e){}
      return res.status(201).json(serializeWO(data));
    }
    const id=db.run('INSERT INTO work_orders(work_order_number,customer_id,site_id,title,description,priority,status,created_by_id,scheduled_start,scheduled_end,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',num,customerId,siteId,title,description||'',priority||'MEDIUM','NEW',uid,scheduledStart||null,scheduledEnd||null,now,now).lastInsertRowid;
    try { db.run('INSERT INTO notifications(user_id,title,message,type,is_read,created_at) VALUES(?,?,?,?,0,?)',uid,'New work order',`${num} has been created`,'INFO',now); } catch(e){}
    res.status(201).json(serializeWO(db.get(`${WO_SQL} WHERE wo.id=?`,id)));
  } catch(err){ console.error(err.message); res.status(500).json({ message:'Internal server error' }); }
});

app.patch('/api/work-orders/:id/status', async (req,res) => {
  try {
    const { id }=req.params; const { toStatus,note }=req.body;
    if (!toStatus) return res.status(400).json({ message:'Missing toStatus' });
    const uid=currentUserId(req)||1; const now=new Date().toISOString();
    if (USE_SUPABASE) {
      const { data:wo }=await supabase.from('work_orders').select('status,assigned_technician_id').eq('id',id).maybeSingle();
      if (!wo) return res.status(404).json({ message:'Work order not found' });
      const { data,error }=await supabase.from('work_orders').update({ status:toStatus,updated_at:now }).eq('id',id).select().single();
      if (sbErr(error,res,'Status:')) return;
      try { await supabase.from('work_order_status_history').insert({ work_order_id:id,from_status:wo.status,to_status:toStatus,changed_by_id:uid,changed_at:now,note:note||'' }); } catch(e){}
      try { await supabase.from('notifications').insert({ user_id:wo.assigned_technician_id||uid,title:'Status changed',message:`Status changed to ${toStatus}`,type:'INFO',is_read:false,created_at:now }); } catch(e){}
      return res.json(serializeWO(data));
    }
    const wo=db.get('SELECT status,assigned_technician_id FROM work_orders WHERE id=?',id);
    if (!wo) return res.status(404).json({ message:'Work order not found' });
    db.run('UPDATE work_orders SET status=?,updated_at=? WHERE id=?',toStatus,now,id);
    db.run('INSERT INTO work_order_status_history(work_order_id,from_status,to_status,changed_by_id,changed_at,note) VALUES(?,?,?,?,?,?)',id,wo.status,toStatus,uid,now,note||'');
    try { db.run('INSERT INTO notifications(user_id,title,message,type,is_read,created_at) VALUES(?,?,?,?,0,?)',wo.assigned_technician_id||uid,'Status changed',`Status changed to ${toStatus}`,'INFO',now); } catch(e){}
    res.json(serializeWO(db.get(`${WO_SQL} WHERE wo.id=?`,id)));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});

app.post('/api/work-orders/:id/assign', async (req,res) => {
  try {
    const { id }=req.params; const { technicianId }=req.body;
    if (!technicianId) return res.status(400).json({ message:'technicianId is required' });
    const uid=currentUserId(req)||1; const now=new Date().toISOString();
    if (USE_SUPABASE) {
      const { data:wo }=await supabase.from('work_orders').select('status').eq('id',id).maybeSingle();
      if (!wo) return res.status(404).json({ message:'Work order not found' });
      const next=wo.status==='NEW'?'ASSIGNED':wo.status;
      const { data,error }=await supabase.from('work_orders').update({ assigned_technician_id:technicianId,status:next,updated_at:now }).eq('id',id).select().single();
      if (sbErr(error,res,'Assign:')) return;
      try { await supabase.from('notifications').insert({ user_id:technicianId,title:'Assigned',message:`Assigned to ${data.work_order_number}`,type:'WORK_ORDER_ASSIGNED',is_read:false,created_at:now }); } catch(e){}
      return res.json(serializeWO(data));
    }
    const wo=db.get('SELECT status FROM work_orders WHERE id=?',id);
    if (!wo) return res.status(404).json({ message:'Work order not found' });
    const next=wo.status==='NEW'?'ASSIGNED':wo.status;
    db.run('UPDATE work_orders SET assigned_technician_id=?,status=?,updated_at=? WHERE id=?',technicianId,next,now,id);
    if (wo.status==='NEW') db.run('INSERT INTO work_order_status_history(work_order_id,from_status,to_status,changed_by_id,changed_at,note) VALUES(?,?,?,?,?,?)',id,wo.status,'ASSIGNED',uid,now,'Assigned');
    try { const n=db.get('SELECT work_order_number FROM work_orders WHERE id=?',id); db.run('INSERT INTO notifications(user_id,title,message,type,is_read,created_at) VALUES(?,?,?,?,0,?)',technicianId,'Assigned',`Assigned to ${n?.work_order_number}`,'WORK_ORDER_ASSIGNED',now); } catch(e){}
    res.json(serializeWO(db.get(`${WO_SQL} WHERE wo.id=?`,id)));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});

app.get('/api/work-orders/:id/history', async (req,res) => {
  try {
    if (USE_SUPABASE) {
      const { data,error }=await supabase.from('work_order_status_history').select('*,users(first_name,last_name)').eq('work_order_id',req.params.id).order('changed_at',{ascending:false});
      if (sbErr(error,res,'History:')) return;
      return res.json((data||[]).map(h=>({ id:h.id,workOrderId:h.work_order_id,fromStatus:h.from_status,toStatus:h.to_status,changedById:h.changed_by_id,changedByName:h.users?[h.users.first_name,h.users.last_name].filter(Boolean).join(' ')||'System':'System',changedAt:h.changed_at,note:h.note||undefined })));
    }
    const rows=db.all(`SELECT h.*,(u.first_name||' '||u.last_name) AS by_name FROM work_order_status_history h LEFT JOIN users u ON u.id=h.changed_by_id WHERE h.work_order_id=? ORDER BY h.changed_at DESC`,req.params.id);
    res.json(rows.map(h=>({ id:h.id,workOrderId:h.work_order_id,fromStatus:h.from_status,toStatus:h.to_status,changedById:h.changed_by_id,changedByName:h.by_name?.trim()||'System',changedAt:h.changed_at,note:h.note||undefined })));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════
//  TIME LOGS
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/work-orders/:id/time-logs', async (req,res) => {
  try {
    if (USE_SUPABASE) { const { data,error }=await supabase.from('time_logs').select('*,users(first_name,last_name),work_orders(work_order_number)').eq('work_order_id',req.params.id).order('start_time',{ascending:false}); if (sbErr(error,res,'TL:')) return; return res.json((data||[]).map(r=>serializeTL({...r,technician_name:r.users?[r.users.first_name,r.users.last_name].filter(Boolean).join(' '):undefined,work_order_number:r.work_orders?.work_order_number}))); }
    res.json(db.all(`${TL_SQL} WHERE tl.work_order_id=? ORDER BY tl.start_time DESC`,req.params.id).map(serializeTL));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.get('/api/time-logs/my', async (req,res) => {
  try {
    const uid=currentUserId(req);
    if (USE_SUPABASE) { let q=supabase.from('time_logs').select('*,users(first_name,last_name),work_orders(work_order_number)').order('start_time',{ascending:false}); if (uid) q=q.eq('technician_id',uid); const { data,error }=await q; if (sbErr(error,res,'TL my:')) return; return res.json((data||[]).map(r=>serializeTL({...r,technician_name:r.users?[r.users.first_name,r.users.last_name].filter(Boolean).join(' '):undefined,work_order_number:r.work_orders?.work_order_number}))); }
    res.json((uid?db.all(`${TL_SQL} WHERE tl.technician_id=? ORDER BY tl.start_time DESC`,uid):db.all(`${TL_SQL} ORDER BY tl.start_time DESC`)).map(serializeTL));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.post('/api/work-orders/:id/time-logs/start', async (req,res) => {
  try {
    const uid=currentUserId(req); if (!uid) return res.status(401).json({ message:'Authentication required' });
    const now=new Date().toISOString();
    if (USE_SUPABASE) { const { data:ex }=await supabase.from('time_logs').select('id').eq('work_order_id',req.params.id).eq('technician_id',uid).is('end_time',null).maybeSingle(); if (ex) return res.status(409).json({ message:'Timer already running' }); const { data,error }=await supabase.from('time_logs').insert({ work_order_id:req.params.id,technician_id:uid,start_time:now,created_at:now }).select('*,users(first_name,last_name),work_orders(work_order_number)').single(); if (sbErr(error,res,'TL start:')) return; return res.status(201).json(serializeTL({...data,technician_name:data.users?[data.users.first_name,data.users.last_name].filter(Boolean).join(' '):undefined,work_order_number:data.work_orders?.work_order_number})); }
    if (db.get('SELECT id FROM time_logs WHERE work_order_id=? AND technician_id=? AND end_time IS NULL',req.params.id,uid)) return res.status(409).json({ message:'Timer already running' });
    const id=db.run('INSERT INTO time_logs(work_order_id,technician_id,start_time,created_at) VALUES(?,?,?,?)',req.params.id,uid,now,now).lastInsertRowid;
    res.status(201).json(serializeTL(db.get(`${TL_SQL} WHERE tl.id=?`,id)));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.post('/api/time-logs/:id/stop', async (req,res) => {
  try {
    const end=new Date();
    if (USE_SUPABASE) { const { data:log }=await supabase.from('time_logs').select('*').eq('id',req.params.id).maybeSingle(); if (!log) return res.status(404).json({ message:'Not found' }); if (log.end_time) return res.status(409).json({ message:'Already stopped' }); const h=Math.round(((end-new Date(log.start_time))/3600000)*100)/100; const { data,error }=await supabase.from('time_logs').update({ end_time:end.toISOString(),hours_worked:h }).eq('id',req.params.id).select('*,users(first_name,last_name),work_orders(work_order_number)').single(); if (sbErr(error,res,'TL stop:')) return; return res.json(serializeTL({...data,technician_name:data.users?[data.users.first_name,data.users.last_name].filter(Boolean).join(' '):undefined,work_order_number:data.work_orders?.work_order_number})); }
    const log=db.get('SELECT * FROM time_logs WHERE id=?',req.params.id); if (!log) return res.status(404).json({ message:'Not found' }); if (log.end_time) return res.status(409).json({ message:'Already stopped' });
    const h=Math.round(((end-new Date(log.start_time))/3600000)*100)/100;
    db.run('UPDATE time_logs SET end_time=?,hours_worked=? WHERE id=?',end.toISOString(),h,req.params.id);
    res.json(serializeTL(db.get(`${TL_SQL} WHERE tl.id=?`,req.params.id)));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════
//  CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/customers', async (req,res) => {
  try {
    const { search,page=1,size=20 }=req.query;
    const p=Math.max(parseInt(page)||1,1),s=Math.max(parseInt(size)||20,1);
    if (USE_SUPABASE) {
      let q=supabase.from('customers').select('*,users(username)',{count:'exact'}); if (search) q=q.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`); q=q.order('name');
      const { data,error,count }=await q.range((p-1)*s,p*s-1); if (sbErr(error,res,'Customers:')) return;
      return res.json({ content:(data||[]).map(c=>({...c,portalUsername:c.users?.username})), ...pg(count||0,p,s) });
    }
    const w=search?`WHERE c.name LIKE ? OR c.contact_name LIKE ? OR c.email LIKE ?`:'';
    const params=search?[`%${search}%`,`%${search}%`,`%${search}%`]:[];
    const total=db.get(`SELECT COUNT(*) as n FROM customers c ${w}`,...params).n;
    const rows=db.all(`SELECT c.*,u.username AS portal_username FROM customers c LEFT JOIN users u ON u.id=c.user_id ${w} ORDER BY c.name LIMIT ? OFFSET ?`,...params,s,(p-1)*s);
    res.json({ content:rows.map(r=>({...r,portalUsername:r.portal_username||undefined})), ...pg(total,p,s) });
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.post('/api/customers', async (req,res) => {
  try {
    const { name,contactName,email,phone,address,createPortalUser,portalUsername,portalPassword }=req.body;
    if (!name) return res.status(400).json({ message:'Name is required' });
    const now=new Date().toISOString(); let portalUserId=null;
    if (createPortalUser) {
      if (!portalUsername||!portalPassword) return res.status(400).json({ message:'Portal credentials required' });
      const h=await bcrypt.hash(portalPassword,10);
      if (USE_SUPABASE) { const { data:dup }=await supabase.from('users').select('id').eq('username',portalUsername).maybeSingle(); if (dup) return res.status(409).json({ message:'Portal username exists' }); const { data:pu,error }=await supabase.from('users').insert({ username:portalUsername,password:h,first_name:contactName||'',last_name:name,email:email||'',role:'CUSTOMER',enabled:true,created_at:now,updated_at:now }).select().single(); if (sbErr(error,res,'Portal user:')) return; portalUserId=pu.id; }
      else { if (db.get('SELECT id FROM users WHERE username=?',portalUsername)) return res.status(409).json({ message:'Portal username exists' }); portalUserId=db.run('INSERT INTO users(username,password,first_name,last_name,email,phone,role,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)',portalUsername,h,contactName||'',name,email||'','','CUSTOMER',now,now).lastInsertRowid; }
    }
    if (USE_SUPABASE) { const { data,error }=await supabase.from('customers').insert({ name,contact_name:contactName||'',email:email||'',phone:phone||'',address:address||'',user_id:portalUserId,created_at:now,updated_at:now }).select('*,users(username)').single(); if (sbErr(error,res,'Cust:')) return; return res.status(201).json({...data,portalUsername:data.users?.username}); }
    const id=db.run('INSERT INTO customers(name,contact_name,email,phone,address,user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',name,contactName||'',email||'',phone||'',address||'',portalUserId,now,now).lastInsertRowid;
    const row=db.get('SELECT c.*,u.username AS portal_username FROM customers c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=?',id);
    res.status(201).json({...row,portalUsername:row.portal_username||undefined});
  } catch(err){ console.error(err.message); res.status(500).json({ message:'Internal server error' }); }
});
app.put('/api/customers/:id', async (req,res) => {
  try {
    const { name,contactName,email,phone,address }=req.body; if (!name) return res.status(400).json({ message:'Name is required' });
    if (USE_SUPABASE) { const { data,error }=await supabase.from('customers').update({ name,contact_name:contactName||'',email:email||'',phone:phone||'',address:address||'',updated_at:new Date().toISOString() }).eq('id',req.params.id).select().single(); if (sbErr(error,res,'UpdCust:')) return; if (!data) return res.status(404).json({ message:'Not found' }); return res.json(data); }
    const r=db.run('UPDATE customers SET name=?,contact_name=?,email=?,phone=?,address=?,updated_at=? WHERE id=?',name,contactName||'',email||'',phone||'',address||'',new Date().toISOString(),req.params.id); if (!r.changes) return res.status(404).json({ message:'Not found' }); res.json(db.get('SELECT * FROM customers WHERE id=?',req.params.id));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.delete('/api/customers/:id', async (req,res) => {
  try { if (USE_SUPABASE) { await supabase.from('customers').delete().eq('id',req.params.id); } else db.run('DELETE FROM customers WHERE id=?',req.params.id); res.json({ message:'Customer deleted' }); }
  catch(err){ res.status(500).json({ message:'Cannot delete customer with associated records' }); }
});

// ═══════════════════════════════════════════════════════════════════════
//  SITES
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/sites', async (req,res) => {
  try {
    const { customerId,search,page=1,size=20 }=req.query;
    const p=Math.max(parseInt(page)||1,1),s=Math.max(parseInt(size)||20,1);
    if (USE_SUPABASE) {
      let q=supabase.from('sites').select('*,customers(name)',{count:'exact'}); if (customerId) q=q.eq('customer_id',customerId); if (search) q=q.or(`name.ilike.%${search}%,street_address.ilike.%${search}%`); q=q.order('name');
      const { data,error,count }=await q.range((p-1)*s,p*s-1); if (sbErr(error,res,'Sites:')) return;
      return res.json({ content:(data||[]).map(r=>({...r,customerName:r.customers?.name})), ...pg(count||0,p,s) });
    }
    const conds=[],params=[]; if (customerId){conds.push('s.customer_id=?');params.push(customerId);} if (search){conds.push('(s.name LIKE ? OR s.street_address LIKE ?)');params.push(`%${search}%`,`%${search}%`);}
    const w=conds.length?`WHERE ${conds.join(' AND ')}`:'';
    const total=db.get(`SELECT COUNT(*) as n FROM sites s ${w}`,...params).n;
    const rows=db.all(`SELECT s.*,c.name AS customer_name FROM sites s LEFT JOIN customers c ON c.id=s.customer_id ${w} ORDER BY s.name LIMIT ? OFFSET ?`,...params,s,(p-1)*s);
    res.json({ content:rows.map(r=>({...r,customerName:r.customer_name,fullAddress:[r.street_address,r.city,r.state].filter(Boolean).join(', ')})), ...pg(total,p,s) });
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.post('/api/sites', async (req,res) => {
  try {
    const { customerId,name,streetAddress,city,state,zip,country,contactName,contactPhone,notes }=req.body; if (!customerId||!name) return res.status(400).json({ message:'customerId and name are required' }); const now=new Date().toISOString();
    if (USE_SUPABASE) { const { data,error }=await supabase.from('sites').insert({ customer_id:customerId,name,street_address:streetAddress||'',city:city||'',state:state||'',zip:zip||'',country:country||'',contact_name:contactName||'',contact_phone:contactPhone||'',notes:notes||'',created_at:now,updated_at:now }).select().single(); if (sbErr(error,res,'Site:')) return; return res.status(201).json(data); }
    const id=db.run('INSERT INTO sites(customer_id,name,street_address,city,state,zip,country,contact_name,contact_phone,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',customerId,name,streetAddress||'',city||'',state||'',zip||'',country||'',contactName||'',contactPhone||'',notes||'',now,now).lastInsertRowid;
    res.status(201).json(db.get('SELECT * FROM sites WHERE id=?',id));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.put('/api/sites/:id', async (req,res) => {
  try {
    const { customerId,name,streetAddress,city,state,zip,country,contactName,contactPhone,notes }=req.body; if (!customerId||!name) return res.status(400).json({ message:'customerId and name are required' });
    if (USE_SUPABASE) { const { data,error }=await supabase.from('sites').update({ customer_id:customerId,name,street_address:streetAddress||'',city:city||'',state:state||'',zip:zip||'',country:country||'',contact_name:contactName||'',contact_phone:contactPhone||'',notes:notes||'',updated_at:new Date().toISOString() }).eq('id',req.params.id).select().single(); if (sbErr(error,res,'UpdSite:')) return; if (!data) return res.status(404).json({ message:'Not found' }); return res.json(data); }
    const r=db.run('UPDATE sites SET customer_id=?,name=?,street_address=?,city=?,state=?,zip=?,country=?,contact_name=?,contact_phone=?,notes=?,updated_at=? WHERE id=?',customerId,name,streetAddress||'',city||'',state||'',zip||'',country||'',contactName||'',contactPhone||'',notes||'',new Date().toISOString(),req.params.id); if (!r.changes) return res.status(404).json({ message:'Not found' }); res.json(db.get('SELECT * FROM sites WHERE id=?',req.params.id));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.delete('/api/sites/:id', async (req,res) => {
  try { if (USE_SUPABASE) await supabase.from('sites').delete().eq('id',req.params.id); else db.run('DELETE FROM sites WHERE id=?',req.params.id); res.json({ message:'Site deleted' }); }
  catch(err){ res.status(500).json({ message:'Cannot delete site with associated work orders' }); }
});

// ═══════════════════════════════════════════════════════════════════════
//  PARTS
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/parts', async (req,res) => {
  try {
    const { search,page=1,size=20 }=req.query; const p=Math.max(parseInt(page)||1,1),s=Math.max(parseInt(size)||20,1);
    if (USE_SUPABASE) { let q=supabase.from('parts').select('*',{count:'exact'}); if (search) q=q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`); q=q.order('name'); const { data,error,count }=await q.range((p-1)*s,p*s-1); if (sbErr(error,res,'Parts:')) return; return res.json({ content:(data||[]).map(r=>({...r,lowStock:r.quantity_on_hand<=r.reorder_level})), ...pg(count||0,p,s) }); }
    const w=search?`WHERE name LIKE ? OR sku LIKE ? OR description LIKE ?`:''; const params=search?[`%${search}%`,`%${search}%`,`%${search}%`]:[];
    const total=db.get(`SELECT COUNT(*) as n FROM parts ${w}`,...params).n;
    res.json({ content:db.all(`SELECT * FROM parts ${w} ORDER BY name LIMIT ? OFFSET ?`,...params,s,(p-1)*s).map(r=>({...r,lowStock:r.quantity_on_hand<=r.reorder_level})), ...pg(total,p,s) });
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.get('/api/parts/low', async (req,res) => {
  try {
    if (USE_SUPABASE) { const { data,error }=await supabase.from('parts').select('*').lt('quantity_on_hand','reorder_level').order('name'); if (sbErr(error,res,'Low:')) return; return res.json((data||[]).map(r=>({...r,lowStock:true}))); }
    res.json(db.all('SELECT * FROM parts WHERE quantity_on_hand<=reorder_level ORDER BY name').map(r=>({...r,lowStock:true})));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.get('/api/parts/:id/movements', async (req,res) => {
  try {
    if (USE_SUPABASE) { const { data,error }=await supabase.from('stock_movements').select('*,parts(sku,name),work_orders(work_order_number)').eq('part_id',req.params.id).order('created_at',{ascending:false}); if (sbErr(error,res,'Moves:')) return; return res.json((data||[]).map(r=>serializeSM({...r,part_sku:r.parts?.sku,part_name:r.parts?.name,work_order_number:r.work_orders?.work_order_number}))); }
    res.json(db.all(`${SM_SQL} WHERE sm.part_id=? ORDER BY sm.created_at DESC`,req.params.id).map(serializeSM));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.post('/api/parts/:id/stock', async (req,res) => {
  try {
    const { type,quantity,note }=req.body; if (!type||!quantity||Number(quantity)<=0) return res.status(400).json({ message:'type and positive quantity required' });
    const change=type==='PURCHASE'?Math.abs(Number(quantity)):-Math.abs(Number(quantity)); const now=new Date().toISOString();
    if (USE_SUPABASE) {
      const { data:part }=await supabase.from('parts').select('quantity_on_hand').eq('id',req.params.id).maybeSingle(); if (!part) return res.status(404).json({ message:'Part not found' });
      const newQty=Math.max(0,part.quantity_on_hand+change);
      const [{ data:up,error:ue },{ data:mv,error:me }]=await Promise.all([supabase.from('parts').update({ quantity_on_hand:newQty,updated_at:now }).eq('id',req.params.id).select().single(),supabase.from('stock_movements').insert({ part_id:req.params.id,type,quantity_change:change,note:note||'',created_at:now }).select('*,parts(sku,name),work_orders(work_order_number)').single()]);
      if (sbErr(ue||me,res,'Stock:')) return; return res.status(201).json({ movement:serializeSM({...mv,part_sku:mv.parts?.sku,part_name:mv.parts?.name}),part:up });
    }
    const part=db.get('SELECT * FROM parts WHERE id=?',req.params.id); if (!part) return res.status(404).json({ message:'Part not found' });
    db.run('UPDATE parts SET quantity_on_hand=?,updated_at=? WHERE id=?',Math.max(0,part.quantity_on_hand+change),now,req.params.id);
    const mvId=db.run('INSERT INTO stock_movements(part_id,type,quantity_change,note,created_at) VALUES(?,?,?,?,?)',req.params.id,type,change,note||'',now).lastInsertRowid;
    res.status(201).json({ movement:serializeSM(db.get(`${SM_SQL} WHERE sm.id=?`,mvId)),part:db.get('SELECT * FROM parts WHERE id=?',req.params.id) });
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.get('/api/parts/work-orders/:wid', async (req,res) => {
  try {
    if (USE_SUPABASE) { const { data,error }=await supabase.from('stock_movements').select('*,parts(sku,name),work_orders(work_order_number)').eq('work_order_id',req.params.wid).eq('type','CONSUMED').order('created_at',{ascending:false}); if (sbErr(error,res,'WOParts:')) return; return res.json((data||[]).map(r=>serializeSM({...r,part_sku:r.parts?.sku,part_name:r.parts?.name,work_order_number:r.work_orders?.work_order_number}))); }
    res.json(db.all(`${SM_SQL} WHERE sm.work_order_id=? AND sm.type='CONSUMED' ORDER BY sm.created_at DESC`,req.params.wid).map(serializeSM));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.post('/api/parts/work-orders/:wid/consume', async (req,res) => {
  try {
    const { partId,quantity,note }=req.body; if (!partId||!quantity||Number(quantity)<=0) return res.status(400).json({ message:'partId and positive quantity required' });
    const change=-Math.abs(Number(quantity)); const now=new Date().toISOString();
    if (USE_SUPABASE) {
      const { data:part }=await supabase.from('parts').select('quantity_on_hand').eq('id',partId).maybeSingle(); if (!part) return res.status(404).json({ message:'Part not found' }); if (part.quantity_on_hand<Number(quantity)) return res.status(400).json({ message:'Insufficient stock' });
      const [{ error:ue },{ data:mv,error:me }]=await Promise.all([supabase.from('parts').update({ quantity_on_hand:part.quantity_on_hand+change,updated_at:now }).eq('id',partId),supabase.from('stock_movements').insert({ part_id:partId,work_order_id:req.params.wid,type:'CONSUMED',quantity_change:change,note:note||'',created_at:now }).select('*,parts(sku,name),work_orders(work_order_number)').single()]);
      if (sbErr(ue||me,res,'Consume:')) return; return res.status(201).json(serializeSM({...mv,part_sku:mv.parts?.sku,part_name:mv.parts?.name,work_order_number:mv.work_orders?.work_order_number}));
    }
    const part=db.get('SELECT * FROM parts WHERE id=?',partId); if (!part) return res.status(404).json({ message:'Part not found' }); if (part.quantity_on_hand<Number(quantity)) return res.status(400).json({ message:'Insufficient stock' });
    db.run('UPDATE parts SET quantity_on_hand=?,updated_at=? WHERE id=?',part.quantity_on_hand+change,now,partId);
    const mvId=db.run('INSERT INTO stock_movements(part_id,work_order_id,type,quantity_change,note,created_at) VALUES(?,?,?,?,?,?)',partId,req.params.wid,'CONSUMED',change,note||'',now).lastInsertRowid;
    res.status(201).json(serializeSM(db.get(`${SM_SQL} WHERE sm.id=?`,mvId)));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/dashboard/metrics', async (req,res) => {
  try {
    let allWo,techs,lowParts,recent;
    if (USE_SUPABASE) {
      const [a,t,l,r]=await Promise.all([supabase.from('work_orders').select('status,priority'),supabase.from('users').select('id,username,first_name,last_name,email,phone,role,enabled,created_at').eq('role','TECHNICIAN'),supabase.from('parts').select('id').lt('quantity_on_hand','reorder_level'),supabase.from('work_order_status_history').select('id,work_order_id,to_status,changed_at,note,work_orders(work_order_number,title),users(first_name,last_name)').order('changed_at',{ascending:false}).limit(10)]);
      allWo=a.data||[]; techs=(t.data||[]).map(u=>({...u,fullName:[u.first_name,u.last_name].filter(Boolean).join(' ')||u.username})); lowParts=l.data||[];
      recent=(r.data||[]).map(x=>({ workOrderId:x.work_order_id,workOrderNumber:x.work_orders?.work_order_number,title:x.work_orders?.title,toStatus:x.to_status,actorName:x.users?[x.users.first_name,x.users.last_name].filter(Boolean).join(' ')||'System':'System',changedAt:x.changed_at,note:x.note||undefined }));
    } else {
      allWo=db.all('SELECT status,priority FROM work_orders');
      techs=db.all("SELECT id,username,first_name,last_name,email,phone,role,enabled,created_at FROM users WHERE role='TECHNICIAN'").map(u=>({...u,enabled:!!u.enabled,fullName:[u.first_name,u.last_name].filter(Boolean).join(' ')||u.username}));
      lowParts=db.all('SELECT id FROM parts WHERE quantity_on_hand<=reorder_level');
      recent=db.all(`SELECT h.*,wo.work_order_number,wo.title,(u.first_name||' '||u.last_name) AS actor FROM work_order_status_history h LEFT JOIN work_orders wo ON wo.id=h.work_order_id LEFT JOIN users u ON u.id=h.changed_by_id ORDER BY h.changed_at DESC LIMIT 10`).map(r=>({ workOrderId:r.work_order_id,workOrderNumber:r.work_order_number,title:r.title,toStatus:r.to_status,actorName:r.actor?.trim()||'System',changedAt:r.changed_at,note:r.note||undefined }));
    }
    const byStatus={}; let open=0; const ob={URGENT:0,HIGH:0,MEDIUM:0,LOW:0};
    for (const w of allWo) { byStatus[w.status]=(byStatus[w.status]||0)+1; if (!['COMPLETED','CLOSED'].includes(w.status)){open++;if(ob[w.priority]!==undefined)ob[w.priority]++;} }
    res.json({ totalWorkOrders:allWo.length,byStatus,openWorkOrders:open,overdueWorkOrders:0,slaBreached:0,slaComplianceRate:100,openUrgent:ob.URGENT,openHigh:ob.HIGH,openMedium:ob.MEDIUM,openLow:ob.LOW,totalTechnicians:techs.length,busyTechnicians:0,idleTechnicians:techs.length,lowStockParts:lowParts.length,lowStockAlerts:lowParts.length,unreadDispatcherNotifications:0,averageCompletionHours:0,completedLast30Days:byStatus['COMPLETED']||0,recentActivity:recent,priorityOrder:['LOW','MEDIUM','HIGH','URGENT'],statusOrder:['NEW','ASSIGNED','IN_PROGRESS','ON_HOLD','COMPLETED','CLOSED'],technicians:techs });
  } catch(err){ console.error(err.message); res.status(500).json({ message:'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/notifications', async (req,res) => {
  try {
    const { page=0,size=20,unreadOnly }=req.query; const p=Math.max(parseInt(page)||0,0),s=Math.max(parseInt(size)||20,1); const uid=currentUserId(req);
    if (USE_SUPABASE) { let q=supabase.from('notifications').select('*',{count:'exact'}); if (uid) q=q.eq('user_id',uid); if (unreadOnly==='true') q=q.eq('is_read',false); q=q.order('created_at',{ascending:false}); const { data,error,count }=await q.range(p*s,(p+1)*s-1); if (sbErr(error,res,'Notif:')) return; const total=count||0; return res.json({ content:(data||[]).map(toNotif),page:p,size:s,totalElements:total,totalPages:Math.ceil(total/s),first:p===0,last:(p+1)*s>=total }); }
    const conds=[],params=[]; if (uid){conds.push('user_id=?');params.push(uid);} if (unreadOnly==='true') conds.push('is_read=0');
    const w=conds.length?`WHERE ${conds.join(' AND ')}`:'';
    const total=db.get(`SELECT COUNT(*) as n FROM notifications ${w}`,...params).n;
    res.json({ content:db.all(`SELECT * FROM notifications ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`,...params,s,p*s).map(toNotif),page:p,size:s,totalElements:total,totalPages:Math.ceil(total/s),first:p===0,last:(p+1)*s>=total });
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.get('/api/notifications/unread-count', async (req,res) => {
  try {
    const uid=currentUserId(req);
    if (USE_SUPABASE) { let q=supabase.from('notifications').select('*',{count:'exact',head:true}).eq('is_read',false); if (uid) q=q.eq('user_id',uid); const { count }=await q; return res.json(count||0); }
    res.json(uid?db.get('SELECT COUNT(*) as n FROM notifications WHERE user_id=? AND is_read=0',uid).n:db.get('SELECT COUNT(*) as n FROM notifications WHERE is_read=0').n);
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.post('/api/notifications/:id/read', async (req,res) => {
  try {
    const uid=currentUserId(req);
    if (USE_SUPABASE) { let q=supabase.from('notifications').update({ is_read:true }).eq('id',req.params.id); if (uid) q=q.eq('user_id',uid); const { data,error }=await q.select().single(); if (sbErr(error,res,'Read:')) return; if (!data) return res.status(404).json({ message:'Not found' }); return res.json(toNotif(data)); }
    const r=uid?db.run('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?',req.params.id,uid):db.run('UPDATE notifications SET is_read=1 WHERE id=?',req.params.id); if (!r.changes) return res.status(404).json({ message:'Not found' }); res.json(toNotif(db.get('SELECT * FROM notifications WHERE id=?',req.params.id)));
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});
app.post('/api/notifications/read-all', async (req,res) => {
  try {
    const uid=currentUserId(req);
    if (USE_SUPABASE) { let q=supabase.from('notifications').update({ is_read:true }).eq('is_read',false); if (uid) q=q.eq('user_id',uid); await q; return res.json({ message:'All marked read' }); }
    if (uid) db.run('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0',uid); else db.run('UPDATE notifications SET is_read=1 WHERE is_read=0');
    res.json({ message:'All marked read' });
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/users', async (req,res) => {
  try {
    const { role,search,page=1,size=20 }=req.query; const p=Math.max(parseInt(page)||1,1),s=Math.max(parseInt(size)||20,1);
    if (USE_SUPABASE) { let q=supabase.from('users').select('id,username,first_name,last_name,email,phone,role,enabled,created_at',{count:'exact'}); if (role) q=q.eq('role',role); q=q.order('username'); const { data,error,count }=await q.range((p-1)*s,p*s-1); if (sbErr(error,res,'Users:')) return; return res.json({ content:(data||[]).map(u=>({...u,fullName:[u.first_name,u.last_name].filter(Boolean).join(' ')||u.username})), ...pg(count||0,p,s) }); }
    const conds=[],params=[]; if (role){conds.push('role=?');params.push(role);} if (search){conds.push('(username LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');params.push(`%${search}%`,`%${search}%`,`%${search}%`);}
    const w=conds.length?`WHERE ${conds.join(' AND ')}`:'';
    const total=db.get(`SELECT COUNT(*) as n FROM users ${w}`,...params).n;
    res.json({ content:db.all(`SELECT id,username,first_name,last_name,email,phone,role,enabled,created_at FROM users ${w} ORDER BY username LIMIT ? OFFSET ?`,...params,s,(p-1)*s).map(u=>({...u,enabled:!!u.enabled,fullName:[u.first_name,u.last_name].filter(Boolean).join(' ')||u.username})), ...pg(total,p,s) });
  } catch(err){ res.status(500).json({ message:'Internal server error' }); }
});

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health',(_,res)=>res.json({ status:'OK',db:USE_SUPABASE?'supabase':'sqlite',uptime:process.uptime(),timestamp:new Date().toISOString() }));
app.get('/health',(_,res)=>res.json({ status:'OK' }));

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n✓ Keystone API → http://localhost:${PORT}  [${USE_SUPABASE?'Supabase':'SQLite'}]`);
    if (!USE_SUPABASE) {
      console.log('\n  Demo logins:');
      console.log('    manager1    / Manager@123');
      console.log('    dispatcher1 / Dispatcher@123');
      console.log('    tech1       / Tech@123');
      console.log('    customer1   / Customer@123\n');
    }
  });
}
