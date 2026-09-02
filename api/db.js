'use strict';
/**
 * Database adapter
 * - Local / no DATABASE_URL  → SQLite via better-sqlite3
 * - Vercel / DATABASE_URL set → Vercel Postgres (@vercel/postgres)
 *
 * Both adapters expose the same surface:
 *   db.get(sql, ...params)        → single row or undefined
 *   db.all(sql, ...params)        → array of rows
 *   db.run(sql, ...params)        → { changes, lastInsertRowid }
 *   db.exec(sql)                  → void  (DDL / multi-statement)
 *   db.transaction(fn)()          → calls fn() inside a transaction
 */

const IS_POSTGRES = !!process.env.DATABASE_URL;

if (IS_POSTGRES) {
  // ── Vercel Postgres (production) ─────────────────────────────────────────
  const { sql: vsql } = require('@vercel/postgres');

  // Convert SQLite-style ? placeholders to Postgres $1 $2 …
  function toPg(query, params = []) {
    let i = 0;
    const q = query.replace(/\?/g, () => `$${++i}`);
    return { q, params };
  }

  // Vercel postgres `sql` tag doesn't support dynamic queries well, so we use
  // the lower-level query function exposed via sql.query
  async function pgQuery(query, params = []) {
    const { q, p } = (() => { const { q, params: p } = toPg(query, params); return { q, p }; })();
    const client = await vsql.connect?.() ?? null;
    if (client) {
      try { return await client.query(q, p); } finally { client.release(); }
    }
    // Fallback: use tagged template (works for zero-param queries)
    return vsql`${q}`;
  }

  // We expose a synchronous-looking API backed by a connection pool
  // Note: on Vercel all handlers are already async, so callers just await db.*
  module.exports = {
    isPostgres: true,
    async get(query, ...params) {
      const res = await pgQuery(query, params);
      return res.rows[0] ?? undefined;
    },
    async all(query, ...params) {
      const res = await pgQuery(query, params);
      return res.rows;
    },
    async run(query, ...params) {
      const res = await pgQuery(query, params);
      return { changes: res.rowCount, lastInsertRowid: res.rows[0]?.id ?? null };
    },
    async exec(query) {
      // Split on semicolons for multi-statement DDL
      const stmts = query.split(';').map(s => s.trim()).filter(Boolean);
      for (const s of stmts) await pgQuery(s);
    },
    transaction(fn) {
      return async () => {
        await pgQuery('BEGIN');
        try { await fn(); await pgQuery('COMMIT'); }
        catch (e) { await pgQuery('ROLLBACK'); throw e; }
      };
    },
  };

} else {
  // ── SQLite (local development) ────────────────────────────────────────────
  const Database = require('better-sqlite3');
  const path = require('path');
  const raw = new Database(path.join(__dirname, 'keystone.db'));
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  module.exports = {
    isPostgres: false,
    get(query, ...params)  { return raw.prepare(query).get(...params); },
    all(query, ...params)  { return raw.prepare(query).all(...params); },
    run(query, ...params)  { const r = raw.prepare(query).run(...params); return { changes: r.changes, lastInsertRowid: r.lastInsertRowid }; },
    exec(query)            { raw.exec(query); },
    transaction(fn)        { return raw.transaction(fn); },
  };
}
