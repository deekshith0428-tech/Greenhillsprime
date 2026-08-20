const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

class DbService {
  constructor() {
    this.usePostgres = Boolean(process.env.DATABASE_URL);
    this.pgPool = null;
    this.jsonFile = path.join(__dirname, '../data/green_hills_production_db.json');
    this.dbData = {
      customers: [],
      conversations: [],
      messages: [],
      leads: [],
      site_visits: [],
      ai_actions: [],
      media: []
    };

    this.initConnection();
  }

  initConnection() {
    if (this.usePostgres) {
      console.log('[DbService] Connecting to Live PostgreSQL Database via DATABASE_URL (Pure JS Driver)...');
      try {
        this.pgPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : false
        });
      } catch (err) {
        console.error('[DbService] PostgreSQL Pool initialization error:', err.message);
      }
    } else {
      console.log('[DbService] No DATABASE_URL specified. Initializing Pure-JavaScript Persistent JSON File Store...');
      this.loadJsonDb();
    }
    this.initPromise = this.initTables();
  }

  loadJsonDb() {
    try {
      const dataDir = path.dirname(this.jsonFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(this.jsonFile)) {
        const raw = fs.readFileSync(this.jsonFile, 'utf8');
        const parsed = JSON.parse(raw);
        this.dbData = {
          customers: parsed.customers || [],
          conversations: parsed.conversations || [],
          messages: parsed.messages || [],
          leads: parsed.leads || [],
          site_visits: parsed.site_visits || [],
          ai_actions: parsed.ai_actions || [],
          media: parsed.media || []
        };
      } else {
        this.saveJsonDb();
      }
    } catch (err) {
      console.error('[DbService] Pure JS JSON DB Load Error:', err.message);
    }
  }

  saveJsonDb() {
    if (this.usePostgres) return;
    try {
      fs.writeFileSync(this.jsonFile, JSON.stringify(this.dbData, null, 2), 'utf8');
    } catch (err) {
      console.warn('[DbService] Local JSON file write skipped (Read-only filesystem on Vercel):', err.message);
    }
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
    if (this.usePostgres && this.pgPool) {
      try {
        const res = await this.pgPool.query(sql, params);
        return res.rows;
      } catch (err) {
        console.error('[DbService PostgreSQL Query Error]:', err.message);
        throw err;
      }
    } else {
      const sqlUpper = sql.toUpperCase();
      if (sqlUpper.includes('FROM MESSAGES')) {
        if (params[0]) {
          return this.dbData.messages.filter((m) => m.whatsapp_message_id === params[0] || m.conversation_id === params[0]);
        }
        return this.dbData.messages;
      }
      if (sqlUpper.includes('FROM LEADS')) return this.dbData.leads;
      if (sqlUpper.includes('FROM SITE_VISITS')) return this.dbData.site_visits;
      if (sqlUpper.includes('FROM CUSTOMERS')) return this.dbData.customers;
      if (sqlUpper.includes('FROM CONVERSATIONS')) return this.dbData.conversations;
      return [];
    }
  }

  async initTables() {
    if (!this.usePostgres) {
      console.log('[DbService] Pure-JS Store tables verified & ready (0 native dependencies).');
      return;
    }

    console.log('[DbService] Running PostgreSQL SQL migrations...');

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
        whatsapp_message_id VARCHAR(128) UNIQUE,
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
      console.log('[DbService] All 7 production core PostgreSQL tables verified & ready!');
    } catch (err) {
      console.error('[DbService PostgreSQL Migration Error]:', err.message);
    }
  }

  // --- CUSTOMER ORM ---

  async findOrCreateCustomer(rawPhone, name = 'Interested Customer') {
    const cleanPhone = this.normalizePhone(rawPhone);
    const now = new Date().toISOString();

    if (this.usePostgres && this.pgPool) {
      let rows = await this.query('SELECT * FROM customers WHERE whatsapp_number = $1', [cleanPhone]);
      let customer = rows && rows.length > 0 ? rows[0] : null;

      if (!customer) {
        const custId = 'cust_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        await this.query(
          'INSERT INTO customers (id, whatsapp_number, customer_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
          [custId, cleanPhone, name, now, now]
        );
        customer = { id: custId, whatsapp_number: cleanPhone, customer_name: name, created_at: now, updated_at: now };
      } else if (name && name !== 'Interested Customer' && customer.customer_name !== name) {
        await this.query('UPDATE customers SET customer_name = $1, updated_at = $2 WHERE id = $3', [name, now, customer.id]);
        customer.customer_name = name;
      }
      return customer;
    } else {
      let customer = this.dbData.customers.find((c) => c.whatsapp_number === cleanPhone);

      if (!customer) {
        const custId = 'cust_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        customer = { id: custId, whatsapp_number: cleanPhone, customer_name: name, created_at: now, updated_at: now };
        this.dbData.customers.push(customer);
        this.saveJsonDb();
      } else if (name && name !== 'Interested Customer' && customer.customer_name !== name) {
        customer.customer_name = name;
        customer.updated_at = now;
        this.saveJsonDb();
      }
      return customer;
    }
  }

  // --- CONVERSATION ORM ---

  async getConversation(customerId) {
    const now = new Date().toISOString();

    if (this.usePostgres && this.pgPool) {
      let rows = await this.query('SELECT * FROM conversations WHERE customer_id = $1', [customerId]);
      if (rows && rows.length > 0) return rows[0];

      const convId = 'conv_' + customerId;
      await this.query('INSERT INTO conversations (id, customer_id, state, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)', [
        convId,
        customerId,
        'AI_ACTIVE',
        now,
        now
      ]);
      return { id: convId, customer_id: customerId, state: 'AI_ACTIVE', created_at: now, updated_at: now };
    } else {
      let conv = this.dbData.conversations.find((c) => c.customer_id === customerId);
      if (!conv) {
        const convId = 'conv_' + customerId;
        conv = { id: convId, customer_id: customerId, state: 'AI_ACTIVE', created_at: now, updated_at: now };
        this.dbData.conversations.push(conv);
        this.saveJsonDb();
      }
      return conv;
    }
  }

  async updateConversationState(convId, state) {
    const now = new Date().toISOString();

    if (this.usePostgres && this.pgPool) {
      await this.query('UPDATE conversations SET state = $1, updated_at = $2 WHERE id = $3', [state, now, convId]);
      const handoffBool = state === 'HUMAN_ACTIVE' || state === 'AI_PAUSED';
      await this.query(
        'UPDATE leads SET human_handoff = $1, updated_at = $2 WHERE customer_id = (SELECT customer_id FROM conversations WHERE id = $3)',
        [handoffBool, now, convId]
      );
    } else {
      let conv = this.dbData.conversations.find((c) => c.id === convId);
      if (conv) {
        conv.state = state;
        conv.updated_at = now;
        let lead = this.dbData.leads.find((l) => l.customer_id === conv.customer_id);
        if (lead) {
          lead.human_handoff = state === 'HUMAN_ACTIVE' || state === 'AI_PAUSED';
          lead.updated_at = now;
        }
        this.saveJsonDb();
      }
    }

    return { success: true, conversation_id: convId, state };
  }

  // --- MESSAGE ORM & IDEMPOTENCY ---

  async isMessageIdProcessed(whatsappMessageId) {
    if (!whatsappMessageId) return false;

    if (this.usePostgres && this.pgPool) {
      const rows = await this.query('SELECT id FROM messages WHERE whatsapp_message_id = $1', [whatsappMessageId]);
      return Boolean(rows && rows.length > 0);
    } else {
      return this.dbData.messages.some((m) => m.whatsapp_message_id === whatsappMessageId);
    }
  }

  async updateDeliveryStatus(whatsappMessageId, status) {
    if (!whatsappMessageId) return false;

    if (this.usePostgres && this.pgPool) {
      await this.query('UPDATE messages SET delivery_status = $1 WHERE whatsapp_message_id = $2', [status, whatsappMessageId]);
    } else {
      let msg = this.dbData.messages.find((m) => m.whatsapp_message_id === whatsappMessageId);
      if (msg) {
        msg.delivery_status = status;
        this.saveJsonDb();
      }
    }
    return true;
  }

  async saveMessage(msg) {
    const msgId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const now = new Date().toISOString();

    const record = {
      id: msgId,
      conversation_id: msg.conversation_id,
      sender_type: msg.sender_type || 'CUSTOMER',
      message_type: msg.message_type || 'TEXT',
      content: msg.content || '',
      whatsapp_message_id: msg.whatsapp_message_id || null,
      delivery_status: msg.delivery_status || 'SENT',
      media_reference: msg.media_reference || null,
      metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
      timestamp: now
    };

    if (this.usePostgres && this.pgPool) {
      const sql = `INSERT INTO messages (id, conversation_id, sender_type, message_type, content, whatsapp_message_id, delivery_status, media_reference, metadata, timestamp)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
      const params = [
        record.id,
        record.conversation_id,
        record.sender_type,
        record.message_type,
        record.content,
        record.whatsapp_message_id,
        record.delivery_status,
        record.media_reference,
        record.metadata,
        record.timestamp
      ];
      await this.query(sql, params);
    } else {
      this.dbData.messages.push(record);
      this.saveJsonDb();
    }

    return record;
  }

  async getMessages(convId, limit = 50) {
    if (this.usePostgres && this.pgPool) {
      return await this.query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT $2', [convId, limit]);
    } else {
      return this.dbData.messages
        .filter((m) => m.conversation_id === convId)
        .slice(-limit);
    }
  }

  // --- LEADS ORM ---

  async getLeadByCustomer(customerId) {
    if (this.usePostgres && this.pgPool) {
      const rows = await this.query('SELECT * FROM leads WHERE customer_id = $1', [customerId]);
      return rows && rows.length > 0 ? rows[0] : null;
    } else {
      return this.dbData.leads.find((l) => l.customer_id === customerId) || null;
    }
  }

  async upsertLeadRecord(customer, leadData) {
    const now = new Date().toISOString();
    const existing = await this.getLeadByCustomer(customer.id);

    if (this.usePostgres && this.pgPool) {
      if (existing) {
        const sql = `UPDATE leads SET budget = COALESCE($1, budget), purpose = COALESCE($2, purpose), preferred_plot_size = COALESCE($3, preferred_plot_size),
                     interest_level = COALESCE($4, interest_level), lead_status = COALESCE($5, lead_status), site_visit_interest = COALESCE($6, site_visit_interest),
                     site_visit_date = COALESCE($7, site_visit_date), site_visit_time = COALESCE($8, site_visit_time), pickup_location = COALESCE($9, pickup_location),
                     conversation_summary = COALESCE($10, conversation_summary), updated_at = $11 WHERE id = $12`;
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
        const sql = `INSERT INTO leads (id, customer_id, whatsapp_number, budget, purpose, preferred_plot_size, interest_level, lead_status, site_visit_interest, site_visit_date, site_visit_time, pickup_location, conversation_summary, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`;
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
    } else {
      if (existing) {
        Object.assign(existing, leadData, { updated_at: now });
        this.saveJsonDb();
        return existing;
      } else {
        const leadId = 'lead_' + customer.whatsapp_number.replace(/[^0-9]/g, '');
        const record = {
          id: leadId,
          customer_id: customer.id,
          whatsapp_number: customer.whatsapp_number,
          budget: leadData.budget || 'Unspecified',
          purpose: leadData.purpose || 'Unspecified',
          preferred_plot_size: leadData.preferred_plot_size || 'General',
          interest_level: leadData.interest_level || 'MEDIUM',
          lead_status: leadData.lead_status || 'NEW_LEAD',
          site_visit_interest: leadData.site_visit_interest || false,
          site_visit_date: leadData.site_visit_date || '',
          site_visit_time: leadData.site_visit_time || '',
          pickup_location: leadData.pickup_location || '',
          conversation_summary: leadData.conversation_summary || '',
          created_at: now,
          updated_at: now
        };
        this.dbData.leads.push(record);
        this.saveJsonDb();
        return record;
      }
    }
  }

  async getAllConversationsWithDetails() {
    if (this.usePostgres && this.pgPool) {
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
    } else {
      return this.dbData.conversations.map((c) => {
        const cust = this.dbData.customers.find((cu) => cu.id === c.customer_id) || {};
        const lead = this.dbData.leads.find((l) => l.customer_id === c.customer_id) || {};
        return {
          conversation_id: c.id,
          state: c.state,
          conversation_updated_at: c.updated_at,
          customer_id: cust.id,
          whatsapp_number: cust.whatsapp_number,
          customer_name: cust.customer_name,
          budget: lead.budget,
          purpose: lead.purpose,
          interest_level: lead.interest_level,
          lead_status: lead.lead_status,
          site_visit_date: lead.site_visit_date,
          site_visit_time: lead.site_visit_time,
          pickup_location: lead.pickup_location,
          human_handoff: lead.human_handoff
        };
      });
    }
  }

  async logAiAction(convId, actionType, intent, facts, guardrails, details) {
    const actionId = 'act_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const now = new Date().toISOString();

    const record = {
      id: actionId,
      conversation_id: convId,
      action_type: actionType,
      matched_intent: intent || 'GENERAL',
      facts_used: Array.isArray(facts) ? JSON.stringify(facts) : facts || '[]',
      guardrails_triggered: Array.isArray(guardrails) ? JSON.stringify(guardrails) : guardrails || '[]',
      details: details || '',
      timestamp: now
    };

    if (this.usePostgres && this.pgPool) {
      const sql = `INSERT INTO ai_actions (id, conversation_id, action_type, matched_intent, facts_used, guardrails_triggered, details, timestamp)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
      await this.query(sql, Object.values(record));
    } else {
      this.dbData.ai_actions.push(record);
      this.saveJsonDb();
    }

    return actionId;
  }
}

module.exports = new DbService();
