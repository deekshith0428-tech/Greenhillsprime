const dbService = require('./dbService');

class MediaService {
  constructor() {
    this.storageProvider = process.env.MEDIA_STORAGE_PROVIDER || 'PERSISTENT_CDN';
    this.mediaCatalog = {
      brochure_pdf: {
        type: 'document',
        name: 'Green Hills Prime Official Brochure.pdf',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/Green_Hills_Prime_Brochure.pdf',
        caption: '🌿 Royal Kingdom – Green Hills Prime Official Brochure & Layout Details'
      },
      project_video: {
        type: 'video',
        name: 'Green Hills Prime Walkthrough.mp4',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/Green_Hills_Prime_Video.mp4',
        caption: '🎥 Green Hills Prime Site Walkthrough & Road Network Overview'
      },
      site_plan_image: {
        type: 'image',
        name: 'Site Layout Plan.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/Site_Layout_Plan.jpg',
        caption: '📐 Master Layout Plan & Plot Sizes (2 Guntas, Residential & Commercial)'
      },
      location_map: {
        type: 'location',
        name: 'Green Hills Prime Site Coordinates',
        latitude: 18.022750,
        longitude: 77.654268,
        url: 'https://maps.app.goo.gl/tjvaVs8RNn8WFLtV8',
        address: 'Gondagaon / Zaheerabad NIMZ Corridor, Sangareddy District, Telangana 502286'
      }
    };
  }

  getMediaAsset(key) {
    return this.mediaCatalog[key] || null;
  }

  async recordMediaSent(customerId, conversationId, mediaType, fileReference, whatsappMessageId = null) {
    const mediaId = 'med_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const now = new Date().toISOString();

    const sql = dbService.usePostgres
      ? 'INSERT INTO media (id, customer_id, media_type, media_url, sent_at) VALUES ($1, $2, $3, $4, $5)'
      : 'INSERT INTO media (id, customer_id, media_type, media_url, sent_at) VALUES (?, ?, ?, ?, ?)';

    try {
      await dbService.query(sql, [mediaId, customerId, mediaType, fileReference || '', now]);
    } catch (err) {
      console.warn('[MediaService] Failed to log media to DB table:', err.message);
    }
    return mediaId;
  }

  async hasMediaBeenSent(customerId, mediaType) {
    const sql = dbService.usePostgres
      ? 'SELECT * FROM media WHERE customer_id = $1 AND media_type = $2'
      : 'SELECT * FROM media WHERE customer_id = ? AND media_type = ?';

    try {
      const rows = await dbService.query(sql, [customerId, mediaType]);
      return rows && rows.length > 0;
    } catch (err) {
      return false;
    }
  }
}

module.exports = new MediaService();
