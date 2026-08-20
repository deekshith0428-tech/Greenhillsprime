const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, '../data/leadsData.json');

class LeadStore {
  constructor() {
    this.leads = [];
    this.appointments = [];
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(LEADS_FILE)) {
        const raw = fs.readFileSync(LEADS_FILE, 'utf8');
        const data = JSON.parse(raw);
        this.leads = data.leads || [];
        this.appointments = data.appointments || [];
      } else {
        this.saveData();
      }
    } catch (err) {
      console.error('Failed to load leadsData.json:', err.message);
      this.leads = [];
      this.appointments = [];
    }
  }

  saveData() {
    try {
      const data = {
        leads: this.leads,
        appointments: this.appointments
      };
      fs.writeFileSync(LEADS_FILE, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      // Vercel serverless environment has a read-only filesystem. State is safely kept in memory/database.
      console.warn('[LeadStore] Local file write skipped (Read-only filesystem):', err.message);
      return false;
    }
  }

  getLeads() {
    return this.leads;
  }

  getLeadByPhone(whatsappNumber) {
    if (!whatsappNumber) return null;
    const clean = this.normalizePhone(whatsappNumber);
    return this.leads.find((l) => this.normalizePhone(l.whatsapp_number) === clean);
  }

  upsertLead(updates) {
    if (!updates || !updates.whatsapp_number) return null;
    const cleanPhone = this.normalizePhone(updates.whatsapp_number);
    let index = this.leads.findIndex((l) => this.normalizePhone(l.whatsapp_number) === cleanPhone);

    const now = new Date().toISOString();

    if (index !== -1) {
      // Update existing lead row (DO NOT CREATE DUPLICATE ROWS)
      const existing = this.leads[index];
      const updated = {
        ...existing,
        ...updates,
        whatsapp_number: updates.whatsapp_number || existing.whatsapp_number,
        updated_at: now,
        last_contacted: now
      };
      // Merge arrays if present
      if (updates.media_sent && existing.media_sent) {
        updated.media_sent = Array.from(new Set([...existing.media_sent, ...updates.media_sent]));
      }
      this.leads[index] = updated;
      this.saveData();
      return updated;
    } else {
      // Create new lead row
      const newLead = {
        lead_id: 'lead_' + cleanPhone,
        date: now.split('T')[0],
        customer_name: updates.customer_name || 'Interested Customer',
        whatsapp_number: updates.whatsapp_number,
        interested: updates.interested || 'Yes',
        budget: updates.budget || 'Not Specified',
        preferred_plot_size: updates.preferred_plot_size || 'Not Specified',
        purpose: updates.purpose || 'Not Specified',
        facing_preference: updates.facing_preference || 'Flexible',
        corner_preference: updates.corner_preference || 'Flexible',
        project: 'Green Hills Prime',
        last_customer_message: updates.last_customer_message || '',
        lead_status: updates.lead_status || 'NEW_LEAD',
        interest_level: updates.interest_level || 'MEDIUM',
        site_visit_interested: updates.site_visit_interested || false,
        site_visit_date: updates.site_visit_date || '',
        site_visit_time: updates.site_visit_time || '',
        google_calendar_event_id: updates.google_calendar_event_id || '',
        vehicle_required: updates.vehicle_required !== undefined ? updates.vehicle_required : true,
        pickup_location: updates.pickup_location || '',
        media_sent: updates.media_sent || [],
        conversation_summary: updates.conversation_summary || '',
        human_handoff: updates.human_handoff || false,
        last_contacted: now,
        updated_at: now
      };
      this.leads.unshift(newLead);
      this.saveData();
      return newLead;
    }
  }

  getAppointments() {
    return this.appointments;
  }

  getAppointmentByPhone(whatsappNumber) {
    if (!whatsappNumber) return null;
    const clean = this.normalizePhone(whatsappNumber);
    return this.appointments.find(
      (a) => this.normalizePhone(a.whatsapp_number) === clean && a.status !== 'CANCELLED'
    );
  }

  saveAppointment(aptData) {
    const cleanPhone = this.normalizePhone(aptData.whatsapp_number);
    let index = this.appointments.findIndex((a) => this.normalizePhone(a.whatsapp_number) === cleanPhone);

    const now = new Date().toISOString();

    if (index !== -1) {
      // Update existing appointment (RESCHEDULE / UPDATE)
      const existing = this.appointments[index];
      const updated = {
        ...existing,
        ...aptData,
        updated_at: now
      };
      this.appointments[index] = updated;
      this.saveData();
      return updated;
    } else {
      // Create new appointment
      const newApt = {
        id: 'apt_' + Date.now(),
        whatsapp_number: aptData.whatsapp_number,
        customer_name: aptData.customer_name || 'Customer',
        date: aptData.date,
        time: aptData.time,
        pickup_location: aptData.pickup_location || 'Customer Location',
        vehicle_required: aptData.vehicle_required !== undefined ? aptData.vehicle_required : true,
        status: aptData.status || 'CONFIRMED',
        google_calendar_event_id: aptData.google_calendar_event_id || '',
        created_at: now,
        updated_at: now
      };
      this.appointments.unshift(newApt);
      this.saveData();
      return newApt;
    }
  }

  updateAppointmentStatus(id, status, extraData = {}) {
    const index = this.appointments.findIndex((a) => a.id === id || a.google_calendar_event_id === id);
    if (index === -1) return false;

    this.appointments[index].status = status;
    this.appointments[index].updated_at = new Date().toISOString();
    Object.assign(this.appointments[index], extraData);

    this.saveData();
    return this.appointments[index];
  }

  normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  }
}

module.exports = new LeadStore();
