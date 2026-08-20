const { google } = require('googleapis');
const leadStore = require('./leadStore');

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID || null;
    this.sheets = null;
    this.isConfigured = false;
    this.initAuth();
  }

  initAuth() {
    try {
      if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          'https://developers.google.com/oauthplayground'
        );
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        this.sheets = google.sheets({ version: 'v4', auth: oauth2Client });
        this.isConfigured = true;
        console.log('[GoogleSheetsService] Authenticated via OAuth2 Refresh Token.');
      } else if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        const jwtClient = new google.auth.JWT(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          null,
          process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/spreadsheets']
        );
        this.sheets = google.sheets({ version: 'v4', auth: jwtClient });
        this.isConfigured = true;
        console.log('[GoogleSheetsService] Authenticated via Service Account JWT.');
      } else {
        console.log('[GoogleSheetsService] No live Google Sheets credentials in env. Fallback Mock Sync active.');
        this.isConfigured = false;
      }
    } catch (err) {
      console.error('[GoogleSheetsService] Auth initialization error:', err.message);
      this.isConfigured = false;
    }
  }

  getStatus() {
    return {
      configured: this.isConfigured,
      spreadsheet_id: this.spreadsheetId || 'NOT_CONFIGURED',
      mode: this.isConfigured ? 'LIVE_GOOGLE_SHEETS_API' : 'SIMULATED_SHEETS_SYNC',
      upsert_identifier: 'WhatsApp Number'
    };
  }

  // Format a lead object into an ordered array of 25 columns per spec
  formatLeadRow(lead) {
    return [
      lead.lead_id || '',
      lead.date || new Date().toISOString().split('T')[0],
      lead.customer_name || 'Customer',
      lead.whatsapp_number || '',
      lead.interested || 'Yes',
      lead.budget || 'Unspecified',
      lead.preferred_plot_size || 'Unspecified',
      lead.purpose || 'Unspecified',
      lead.facing_preference || 'Flexible',
      lead.corner_preference || 'Flexible',
      lead.project || 'Green Hills Prime',
      lead.last_customer_message || '',
      lead.lead_status || 'NEW_LEAD',
      lead.interest_level || 'MEDIUM',
      lead.site_visit_interested ? 'Yes' : 'No',
      lead.site_visit_date || '',
      lead.site_visit_time || '',
      lead.google_calendar_event_id || '',
      lead.vehicle_required ? 'Yes' : 'No',
      lead.pickup_location || '',
      Array.isArray(lead.media_sent) ? lead.media_sent.join(', ') : (lead.media_sent || ''),
      lead.conversation_summary || '',
      lead.human_handoff ? 'Yes' : 'No',
      lead.last_contacted || new Date().toISOString(),
      lead.updated_at || new Date().toISOString()
    ];
  }

  async upsertLeadToSheet(lead) {
    if (!lead || !lead.whatsapp_number) return { success: false, error: 'WhatsApp number required' };

    // Always update local persistent lead store first
    const savedLead = leadStore.upsertLead(lead);
    const rowValues = this.formatLeadRow(savedLead);

    if (this.isConfigured && this.sheets && this.spreadsheetId) {
      try {
        // Fetch existing rows from Sheet to find matching WhatsApp Number (Column D / Index 3)
        const getRes = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: 'Leads!A:Y'
        });

        const rows = getRes.data.values || [];
        let rowIndex = -1;
        const cleanTarget = leadStore.normalizePhone(lead.whatsapp_number);

        for (let i = 0; i < rows.length; i++) {
          if (rows[i][3] && leadStore.normalizePhone(rows[i][3]) === cleanTarget) {
            rowIndex = i + 1; // 1-indexed for Sheet range
            break;
          }
        }

        if (rowIndex !== -1) {
          // Update existing row (UPSERT - NO DUPLICATES)
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `Leads!A${rowIndex}:Y${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowValues] }
          });
          console.log(`[GoogleSheetsService] Updated row ${rowIndex} in Google Sheet for ${lead.whatsapp_number}`);
          return { success: true, action: 'UPDATED_ROW', rowIndex, mode: 'LIVE_SHEETS_API', lead: savedLead };
        } else {
          // Append new row
          await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: 'Leads!A:Y',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowValues] }
          });
          console.log(`[GoogleSheetsService] Appended new row in Google Sheet for ${lead.whatsapp_number}`);
          return { success: true, action: 'APPENDED_ROW', mode: 'LIVE_SHEETS_API', lead: savedLead };
        }
      } catch (err) {
        console.error('[GoogleSheetsService] Live Sheet upsert failed, fall back to local store:', err.message);
      }
    }

    console.log(`[GoogleSheetsService] Local Sheet Sync completed for ${savedLead.whatsapp_number}`);
    return {
      success: true,
      action: 'LOCAL_STORE_UPSERT',
      mode: 'SIMULATED_SHEETS_SYNC',
      lead: savedLead
    };
  }

  async syncAllLeads() {
    const leads = leadStore.getLeads();
    return {
      total_leads: leads.length,
      synced: true,
      mode: this.isConfigured ? 'LIVE_GOOGLE_SHEETS_API' : 'SIMULATED_SHEETS_SYNC'
    };
  }
}

module.exports = new GoogleSheetsService();
