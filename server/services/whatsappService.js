const https = require('https');

class WhatsappService {
  constructor() {
    this.mode = process.env.WHATSAPP_MODE || 'mock';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || null;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || null;
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null;
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'green_hills_prime_secure_verify_token_2026';
    this.appSecret = process.env.WHATSAPP_APP_SECRET || null;
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
  }

  getStatus() {
    return {
      mode: this.mode.toUpperCase(),
      is_production_ready: Boolean(this.accessToken && this.phoneNumberId),
      webhook_configured: Boolean(this.verifyToken),
      phone_number_id_configured: Boolean(this.phoneNumberId),
      access_token_configured: Boolean(this.accessToken),
      app_secret_configured: Boolean(this.appSecret),
      verify_token_configured: Boolean(this.verifyToken),
      api_version: this.apiVersion
    };
  }

  formatPhoneForMeta(phone) {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  }

  async sendTextMessage(toPhone, text) {
    return this.sendMessage(toPhone, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneForMeta(toPhone),
      type: 'text',
      text: { preview_url: true, body: text }
    });
  }

  async sendImageMessage(toPhone, imageUrl, caption = '') {
    return this.sendMessage(toPhone, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneForMeta(toPhone),
      type: 'image',
      image: { link: imageUrl, caption: caption }
    });
  }

  async sendVideoMessage(toPhone, videoUrl, caption = '') {
    return this.sendMessage(toPhone, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneForMeta(toPhone),
      type: 'video',
      video: { link: videoUrl, caption: caption }
    });
  }

  async sendDocumentMessage(toPhone, documentUrl, filename = 'Brochure.pdf', caption = '') {
    return this.sendMessage(toPhone, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneForMeta(toPhone),
      type: 'document',
      document: { link: documentUrl, filename: filename, caption: caption }
    });
  }

  async sendLocationMessage(toPhone, latitude, longitude, name = 'Green Hills Prime', address = 'Gondagaon, Telangana') {
    return this.sendMessage(toPhone, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneForMeta(toPhone),
      type: 'location',
      location: { latitude: String(latitude), longitude: String(longitude), name: name, address: address }
    });
  }

  async sendMessage(toPhone, payload) {
    const formattedPhone = this.formatPhoneForMeta(toPhone);
    payload.to = formattedPhone;

    // Check if in MOCK mode or missing live production credentials
    if (this.mode !== 'production' || !this.accessToken || !this.phoneNumberId) {
      const mockMsgId = `wamid.mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      console.log(`[WhatsappService - MOCK MODE] Simulated outgoing ${payload.type} message to ${formattedPhone}:`);
      console.log(JSON.stringify(payload, null, 2));

      return {
        success: true,
        messaging_product: 'whatsapp',
        contacts: [{ input: formattedPhone, wa_id: formattedPhone }],
        messages: [{ id: mockMsgId }],
        mode: 'MOCK'
      };
    }

    // LIVE META GRAPH API HTTP REQUEST
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const options = {
        hostname: 'graph.facebook.com',
        path: `/${this.apiVersion}/${this.phoneNumberId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log('[WhatsappService - LIVE META GRAPH API] Message sent successfully:', parsed);
              resolve({ success: true, mode: 'PRODUCTION', ...parsed });
            } else {
              console.error('[WhatsappService - LIVE META GRAPH API ERROR]:', parsed);
              resolve({ success: false, mode: 'PRODUCTION', error: parsed });
            }
          } catch (err) {
            reject(new Error(`Failed to parse Meta Graph API response: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => {
        console.error('[WhatsappService - Network Error]:', err.message);
        reject(err);
      });

      req.write(data);
      req.end();
    });
  }
}

module.exports = new WhatsappService();
