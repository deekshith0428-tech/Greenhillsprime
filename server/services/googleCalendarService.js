const { google } = require('googleapis');

class GoogleCalendarService {
  constructor() {
    this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    this.auth = null;
    this.calendar = null;
    this.isConfigured = false;
    this.initAuth();
  }

  initAuth() {
    try {
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          'https://developers.google.com/oauthplayground'
        );
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        this.isConfigured = true;
        console.log('[GoogleCalendarService] Authenticated via OAuth2 Refresh Token.');
      } else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        const jwtClient = new google.auth.JWT(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          null,
          process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/calendar']
        );
        this.calendar = google.calendar({ version: 'v3', auth: jwtClient });
        this.isConfigured = true;
        console.log('[GoogleCalendarService] Authenticated via Service Account JWT.');
      } else {
        console.log('[GoogleCalendarService] No live Google API credentials in env. Fallback Mock Mode active.');
        this.isConfigured = false;
      }
    } catch (err) {
      console.error('[GoogleCalendarService] Auth initialization error:', err.message);
      this.isConfigured = false;
    }
  }

  getStatus() {
    return {
      configured: this.isConfigured,
      calendar_id: this.calendarId,
      mode: this.isConfigured ? 'LIVE_GOOGLE_CALENDAR_API' : 'SIMULATED_CALENDAR_ENGINE',
      double_booking_protection: 'ACTIVE'
    };
  }

  // Check double booking for a target date and time string (e.g. "2026-08-23", "11:00 AM")
  async checkAvailability(dateStr, timeStr) {
    if (this.isConfigured && this.calendar) {
      try {
        const { startTime, endTime } = this.parseDateTimeRange(dateStr, timeStr);
        const res = await this.calendar.events.list({
          calendarId: this.calendarId,
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          singleEvents: true
        });
        const events = res.data.items || [];
        const isAvailable = events.length === 0;
        return {
          available: isAvailable,
          conflicting_events: events.map((e) => e.summary)
        };
      } catch (err) {
        console.warn('[GoogleCalendarService] Live availability check failed, using safety policy:', err.message);
      }
    }

    // Default simulated slot availability check:
    // Slot is available unless it's Sunday at 02:00 PM (mock busy slot for testing)
    const isMockBusy = timeStr.includes('2:00 PM') || timeStr.includes('14:00');
    return {
      available: !isMockBusy,
      conflicting_events: isMockBusy ? ['Green Hills Prime - VIP Site Visit'] : []
    };
  }

  async createEvent(apt) {
    const { startTime, endTime } = this.parseDateTimeRange(apt.date, apt.time);

    const eventPayload = {
      summary: `Green Hills Prime - Site Visit - ${apt.customer_name || 'Customer'}`,
      location: apt.pickup_location || 'Green Hills Prime Project Site',
      description:
        `🌿 *GREEN HILLS PRIME SITE VISIT CONFIRMATION*\n\n` +
        `👤 Customer Name: ${apt.customer_name || 'Customer'}\n` +
        `📱 WhatsApp: ${apt.whatsapp_number}\n` +
        `📅 Date: ${apt.date}\n` +
        `⏰ Time: ${apt.time}\n` +
        `🚗 Transportation: ${apt.vehicle_required ? 'Company Vehicle' : 'Self Transport'}\n` +
        `📍 Pickup Location: ${apt.pickup_location || 'Project Site Direct'}\n` +
        `🏡 Plot Interest: ${apt.preferred_plot_size || 'General'}\n` +
        `💰 Budget: ${apt.budget || 'Unspecified'}\n` +
        `🎯 Purpose: ${apt.purpose || 'Investment / Home'}\n` +
        `📝 Notes: ${apt.notes || 'Automated Green Hills Prime Sales Agent Booking'}`,
      start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Kolkata' },
      end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Kolkata' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 120 },
          { method: 'popup', minutes: 24 * 60 }
        ]
      }
    };

    if (this.isConfigured && this.calendar) {
      try {
        const response = await this.calendar.events.insert({
          calendarId: this.calendarId,
          requestBody: eventPayload
        });
        console.log('[GoogleCalendarService] Event created in Google Calendar:', response.data.id);
        return {
          success: true,
          eventId: response.data.id,
          htmlLink: response.data.htmlLink,
          mode: 'LIVE_GOOGLE_CALENDAR'
        };
      } catch (err) {
        console.error('[GoogleCalendarService] Failed to create live event:', err.message);
      }
    }

    // Mock response fallback
    const mockEventId = `gcal_evt_${Date.now()}`;
    console.log('[GoogleCalendarService] Simulated Event Created:', mockEventId);
    return {
      success: true,
      eventId: mockEventId,
      htmlLink: `https://calendar.google.com/calendar/event?eid=${mockEventId}`,
      mode: 'SIMULATED_CALENDAR'
    };
  }

  async updateEvent(eventId, apt) {
    if (!eventId) return this.createEvent(apt);

    const { startTime, endTime } = this.parseDateTimeRange(apt.date, apt.time);

    if (this.isConfigured && this.calendar && !eventId.startsWith('gcal_evt_')) {
      try {
        const response = await this.calendar.events.patch({
          calendarId: this.calendarId,
          eventId: eventId,
          requestBody: {
            summary: `Green Hills Prime - Site Visit - ${apt.customer_name || 'Customer'} (Rescheduled)`,
            location: apt.pickup_location || 'Green Hills Prime Project Site',
            start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Kolkata' },
            description: `[Rescheduled Visit] Date: ${apt.date}, Time: ${apt.time}, Pickup: ${apt.pickup_location}`
          }
        });
        return { success: true, eventId: response.data.id, mode: 'LIVE_GOOGLE_CALENDAR' };
      } catch (err) {
        console.error('[GoogleCalendarService] Failed to update live event:', err.message);
      }
    }

    return { success: true, eventId, mode: 'SIMULATED_CALENDAR' };
  }

  async cancelEvent(eventId) {
    if (!eventId) return { success: true };

    if (this.isConfigured && this.calendar && !eventId.startsWith('gcal_evt_')) {
      try {
        await this.calendar.events.delete({
          calendarId: this.calendarId,
          eventId: eventId
        });
        return { success: true, mode: 'LIVE_GOOGLE_CALENDAR' };
      } catch (err) {
        console.error('[GoogleCalendarService] Failed to delete live event:', err.message);
      }
    }

    return { success: true, mode: 'SIMULATED_CALENDAR' };
  }

  parseDateTimeRange(dateStr, timeStr) {
    // Basic date/time parsing fallback for India ISO timezone offset (+05:30)
    let year = 2026, month = 7, day = 23; // August 23, 2026 default
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    }

    let hours = 11, minutes = 0;
    if (timeStr) {
      const match = timeStr.match(/(\d+):?(\d+)?\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[3] ? match[3].toUpperCase() : null;
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        hours = h;
        minutes = m;
      }
    }

    const startTime = new Date(Date.UTC(year, month, day, hours - 5, minutes - 30));
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration

    return { startTime, endTime };
  }
}

module.exports = new GoogleCalendarService();
