const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

class DbService {
  constructor() {
    this.usePostgres = Boolean(process.env.DATABASE_URL);
    this.pgPool = null;
    this.sqliteDb = null;
    this.sqliteFile = path.join(__dirname, '../data/green_hills_production.sqlite');

    this.initConnection();
  }

  initConnection() {
    if (this.usePostgres) {
      console.log('[DbService] Connecting to Live PostgreSQL Database via DATABASE_URL...');
      this.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
    } else {
      console.log('[DbService] No DATABASE_URL specified. Initializing Local Persistent SQLite Database...');
      const dataDir = path.dirname(this.sqliteFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.sqliteDb = new sqlite3.Database(this.sqliteFile);
    }
    this.initPromise = this.initTables();
  }

  normalizePhone(phone) {
    if (!phone) return '+910000000000';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '91' + cleaned.substring(1);
    }
    return '+' + cleaned;
  }

  async query(sql, params = []) {
    if (this.initPromise) {
      await this.initPromise;
    }
    return this._rawQuery(sql, params);
  }

  async _rawQuery(sql, params = []) {
    if (this.usePostgres) {
      try {
        const res = await this.pgPool.query(sql, params);
        return res.rows;
      } catch (err) {
        console.error('[DbService PostgreSQL Query Error]:', err.message);
        throw err;
      }
    } else {
      return new Promise((resolve, reject) => {
        const sqlUpper = sql.trim().toUpperCase();
        if (sqlUpper.startsWith('SELECT')) {
          this.sqliteDb.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        } else {
          this.sqliteDb.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve([{ lastID: this.lastID, changes: this.changes }]);
          });
        }
      });
    }
  }

  async initTables() {
    console.log('[DbService] Running SQL migrations for production core tables...');

    const createCustomersTable = `
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(64) PRIMARY KEY,
        whatsapp_number VARCHAR(32) UNIQUE NOT NULL,
        customer_name VARCHAR(128),
        created_at TEXT,
        updated_at TEXT
      );
    `;

    const createConversationsTable = `
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(64) PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        state VARCHAR(32) DEFAULT 'AI_ACTIVE',
        created_at TEXT,
        updated_at TEXT
      );
    `;

    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(64) PRIMARY KEY,
        conversation_id VARCHAR(64) NOT NULL,
        sender_type VARCHAR(32) NOT NULL,
        message_type VARCHAR(32) DEFAULT 'TEXT',
        content TEXT NOT NULL,
        whatsapp_message_id VARCHAR(128),
        delivery_status VARCHAR(32) DEFAULT 'SENT',
        media_reference TEXT,
        metadata TEXT,
        timestamp TEXT NOT NULL
      );
    `;

    const createMediaTable = `
      CREATE TABLE IF NOT EXISTS media (
        id VARCHAR(64) PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        media_type VARCHAR(64) NOT NULL,
        media_url TEXT NOT NULL,
        sent_at TEXT NOT NULL
      );
    `;

    const createLeadsTable = `
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(64) PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        whatsapp_number VARCHAR(32) UNIQUE NOT NULL,
        budget VARCHAR(64),
        purpose VARCHAR(64),
        preferred_plot_size VARCHAR(64),
        facing_preference VARCHAR(32),
        corner_preference VARCHAR(32),
        interest_level VARCHAR(32) DEFAULT 'MEDIUM',
        lead_status VARCHAR(32) DEFAULT 'NEW_LEAD',
        site_visit_interest BOOLEAN DEFAULT FALSE,
        site_visit_date TEXT,
        site_visit_time TEXT,
        pickup_location TEXT,
        human_handoff BOOLEAN DEFAULT FALSE,
        conversation_summary TEXT,
        last_customer_message_at TEXT,
        last_ai_message_at TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `;

    const createSiteVisitsTable = `
      CREATE TABLE IF NOT EXISTS site_visits (
        id VARCHAR(64) PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        whatsapp_number VARCHAR(32) NOT NULL,
        customer_name VARCHAR(128),
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        pickup_location TEXT,
        vehicle_required BOOLEAN DEFAULT TRUE,
        status VARCHAR(32) DEFAULT 'CONFIRMED',
        google_calendar_event_id VARCHAR(128),
        created_at TEXT,
        updated_at TEXT
      );
    `;

    const createAiActionsTable = `
      CREATE TABLE IF NOT EXISTS ai_actions (
        id VARCHAR(64) PRIMARY KEY,
        conversation_id VARCHAR(64) NOT NULL,
        action_type VARCHAR(64) NOT NULL,
        matched_intent VARCHAR(64),
        facts_used TEXT,
        guardrails_triggered TEXT,
        details TEXT,
        timestamp TEXT NOT NULL
      );
    `;

    try {
      await this._rawQuery(createCustomersTable);
      await this._rawQuery(createConversationsTable);
      await this._rawQuery(createMessagesTable);
      await this._rawQuery(createMediaTable);
      await this._rawQuery(createLeadsTable);
      await this._rawQuery(createSiteVisitsTable);
      await this._rawQuery(createAiActionsTable);

      // Migration column patches for existing databases
      try { await this._rawQuery('ALTER TABLE messages ADD COLUMN whatsapp_message_id VARCHAR(128);'); } catch (e) {}
      try { await this._rawQuery('ALTER TABLE messages ADD COLUMN delivery_status VARCHAR(32) DEFAULT "SENT";'); } catch (e) {}

      console.log('[DbService] All 7 production core SQL tables verified & migrated!');
    } catch (err) {
      console.error('[DbService Migration Error]:', err.message);
    }
  }

  // --- CUSTOMER & CONVERSATION ORM METHODS ---

  async findOrCreateCustomer(rawPhone, name = 'Interested Customer') {
    const cleanPhone = this.normalizePhone(rawPhone);
    const sqlSelect = this.usePostgres
      ? 'SELECT * FROM customers WHERE whatsapp_number = $1'
      : 'SELECT * FROM customers WHERE whatsapp_number = ?';
    let rows = await this.query(sqlSelect, [cleanPhone]);

    const now = new Date().toISOString();
    let customer = rows && rows.length > 0 ? rows[0] : null;

    if (!customer) {
      const custId = 'cust_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      if (this.usePostgres) {
        await this.query(
          'INSERT INTO customers (id, whatsapp_number, customer_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
          [custId, cleanPhone, name, now, now]
        );
      } else {
        await this.query(
          'INSERT INTO customers (id, whatsapp_number, customer_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [custId, cleanPhone, name, now, now]
        );
      }
      customer = { id: custId, whatsapp_number: cleanPhone, customer_name: name, created_at: now, updated_at: now };
    } else if (name && name !== 'Interested Customer' && customer.customer_name !== name) {
      if (this.usePostgres) {
        await this.query('UPDATE customers SET customer_name = $1, updated_at = $2 WHERE id = $3', [name, now, customer.id]);
      } else {
        await this.query('UPDATE customers SET customer_name = ?, updated_at = ? WHERE id = ?', [name, now, customer.id]);
      }
      customer.customer_name = name;
    }

    return customer;
  }

  async getConversation(customerId) {
    let rows = await this.query(
      this.usePostgres
        ? 'SELECT * FROM conversations WHERE customer_id = $1'
        : 'SELECT * FROM conversations WHERE customer_id = ?',
      [customerId]
    );

    const now = new Date().toISOString();
    if (rows && rows.length > 0) {
      return rows[0];
    } else {
      const convId = 'conv_' + customerId;
      const sql = this.usePostgres
        ? 'INSERT INTO conversations (id, customer_id, state, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)'
        : 'INSERT INTO conversations (id, customer_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)';
      await this.query(sql, [convId, customerId, 'AI_ACTIVE', now, now]);
      return { id: convId, customer_id: customerId, state: 'AI_ACTIVE', created_at: now, updated_at: now };
    }
  }

  async updateConversationState(convId, state) {
    const now = new Date().toISOString();
    const sql = this.usePostgres
      ? 'UPDATE conversations SET state = $1, updated_at = $2 WHERE id = $3'
      : 'UPDATE conversations SET state = ?, updated_at = ? WHERE id = ?';
    await this.query(sql, [state, now, convId]);

    // Also sync lead human_handoff flag
    const handoffBool = state === 'HUMAN_ACTIVE' || state === 'AI_PAUSED';
    const sqlLead = this.usePostgres
      ? 'UPDATE leads SET human_handoff = $1, updated_at = $2 WHERE customer_id = (SELECT customer_id FROM conversations WHERE id = $3)'
      : 'UPDATE leads SET human_handoff = ?, updated_at = ? WHERE customer_id = (SELECT customer_id FROM conversations WHERE id = ?)';
    await this.query(sqlLead, [handoffBool, now, convId]);

    return { success: true, conversation_id: convId, state };
  }

  async isMessageIdProcessed(whatsappMessageId) {
    if (!whatsappMessageId) return false;
    const sql = this.usePostgres
      ? 'SELECT id FROM messages WHERE whatsapp_message_id = $1'
      : 'SELECT id FROM messages WHERE whatsapp_message_id = ?';
    const rows = await this.query(sql, [whatsappMessageId]);
    return Boolean(rows && rows.length > 0);
  }

  async updateDeliveryStatus(whatsappMessageId, status) {
    if (!whatsappMessageId) return false;
    const sql = this.usePostgres
      ? 'UPDATE messages SET delivery_status = $1 WHERE whatsapp_message_id = $2'
      : 'UPDATE messages SET delivery_status = ? WHERE whatsapp_message_id = ?';
    await this.query(sql, [status, whatsappMessageId]);
    return true;
  }

  async saveMessage(msg) {
    const msgId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const now = new Date().toISOString();

    const sql = this.usePostgres
      ? 'INSERT INTO messages (id, conversation_id, sender_type, message_type, content, whatsapp_message_id, delivery_status, media_reference, metadata, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)'
      : 'INSERT INTO messages (id, conversation_id, sender_type, message_type, content, whatsapp_message_id, delivery_status, media_reference, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    const params = [
      msgId,
      msg.conversation_id,
      msg.sender_type || 'CUSTOMER',
      msg.message_type || 'TEXT',
      msg.content || '',
      msg.whatsapp_message_id || null,
      msg.delivery_status || 'SENT',
      msg.media_reference || null,
      msg.metadata ? JSON.stringify(msg.metadata) : null,
      now
    ];

    await this.query(sql, params);
    return { id: msgId, ...msg, timestamp: now };
  }

  async getMessages(convId, limit = 50) {
    const sql = this.usePostgres
      ? 'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT $2'
      : 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC LIMIT ?';
    return await this.query(sql, [convId, limit]);
  }

  async getLeadByCustomer(customerId) {
    const sql = this.usePostgres
      ? 'SELECT * FROM leads WHERE customer_id = $1'
      : 'SELECT * FROM leads WHERE customer_id = ?';
    const rows = await this.query(sql, [customerId]);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  async upsertLeadRecord(customer, leadData) {
    const now = new Date().toISOString();
    const existing = await this.getLeadByCustomer(customer.id);

    if (existing) {
      const sql = this.usePostgres
        ? `UPDATE leads SET budget = COALESCE($1, budget), purpose = COALESCE($2, purpose), preferred_plot_size = COALESCE($3, preferred_plot_size),
           interest_level = COALESCE($4, interest_level), lead_status = COALESCE($5, lead_status), site_visit_interest = COALESCE($6, site_visit_interest),
           site_visit_date = COALESCE($7, site_visit_date), site_visit_time = COALESCE($8, site_visit_time), pickup_location = COALESCE($9, pickup_location),
           conversation_summary = COALESCE($10, conversation_summary), updated_at = $11 WHERE id = $12`
        : `UPDATE leads SET budget = COALESCE(?, budget), purpose = COALESCE(?, purpose), preferred_plot_size = COALESCE(?, preferred_plot_size),
           interest_level = COALESCE(?, interest_level), lead_status = COALESCE(?, lead_status), site_visit_interest = COALESCE(?, site_visit_interest),
           site_visit_date = COALESCE(?, site_visit_date), site_visit_time = COALESCE(?, site_visit_time), pickup_location = COALESCE(?, pickup_location),
           conversation_summary = COALESCE(?, conversation_summary), updated_at = ? WHERE id = ?`;

      const params = [
        leadData.budget || null,
        leadData.purpose || null,
        leadData.preferred_plot_size || null,
        leadData.interest_level || null,
        leadData.lead_status || null,
        leadData.site_visit_interest !== undefined ? leadData.site_visit_interest : null,
        leadData.site_visit_date || null,
        leadData.site_visit_time || null,
        leadData.pickup_location || null,
        leadData.conversation_summary || null,
        now,
        existing.id
      ];

      await this.query(sql, params);
      return { ...existing, ...leadData, updated_at: now };
    } else {
      const leadId = 'lead_' + customer.whatsapp_number.replace(/[^0-9]/g, '');
      const sql = this.usePostgres
        ? `INSERT INTO leads (id, customer_id, whatsapp_number, budget, purpose, preferred_plot_size, interest_level, lead_status, site_visit_interest, site_visit_date, site_visit_time, pickup_location, conversation_summary, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`
        : `INSERT INTO leads (id, customer_id, whatsapp_number, budget, purpose, preferred_plot_size, interest_level, lead_status, site_visit_interest, site_visit_date, site_visit_time, pickup_location, conversation_summary, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const params = [
        leadId,
        customer.id,
        customer.whatsapp_number,
        leadData.budget || 'Unspecified',
        leadData.purpose || 'Unspecified',
        leadData.preferred_plot_size || 'General',
        leadData.interest_level || 'MEDIUM',
        leadData.lead_status || 'NEW_LEAD',
        leadData.site_visit_interest || false,
        leadData.site_visit_date || '',
        leadData.site_visit_time || '',
        leadData.pickup_location || '',
        leadData.conversation_summary || '',
        now,
        now
      ];

      await this.query(sql, params);
      return { id: leadId, customer_id: customer.id, whatsapp_number: customer.whatsapp_number, ...leadData, created_at: now, updated_at: now };
    }
  }

  async getAllConversationsWithDetails() {
    const sql = `
      SELECT c.id AS conversation_id, c.state, c.updated_at AS conversation_updated_at,
             cust.id AS customer_id, cust.whatsapp_number, cust.customer_name,
             l.budget, l.purpose, l.interest_level, l.lead_status, l.site_visit_date, l.site_visit_time, l.pickup_location, l.human_handoff
      FROM conversations c
      JOIN customers cust ON c.customer_id = cust.id
      LEFT JOIN leads l ON l.customer_id = cust.id
      ORDER BY c.updated_at DESC;
    `;
    return await this.query(sql);
  }

  async logAiAction(convId, actionType, intent, facts, guardrails, details) {
    const actionId = 'act_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const now = new Date().toISOString();

    const sql = this.usePostgres
      ? 'INSERT INTO ai_actions (id, conversation_id, action_type, matched_intent, facts_used, guardrails_triggered, details, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)'
      : 'INSERT INTO ai_actions (id, conversation_id, action_type, matched_intent, facts_used, guardrails_triggered, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

    const params = [
      actionId,
      convId,
      actionType,
      intent || 'GENERAL',
      Array.isArray(facts) ? JSON.stringify(facts) : facts || '[]',
      Array.isArray(guardrails) ? JSON.stringify(guardrails) : guardrails || '[]',
      details || '',
      now
    ];

    await this.query(sql, params);
    return actionId;
  }
}

module.exports = new DbService();
