const dbService = require('./dbService');

class RetentionService {
  /**
   * 14-Day Conversation Retention Cleanup Policy.
   * Purges raw message logs older than 14 days while keeping active leads, site visits, and human handoffs.
   */
  async purgeOldMessages(retentionDays = 14) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[RetentionService] Executing 14-Day Message Purge for messages older than ${cutoffDate}...`);

    try {
      // Find conversations with active exceptions (active site visits, human handoffs, or high lead status)
      const exceptionSql = `
        SELECT DISTINCT c.id
        FROM conversations c
        LEFT JOIN leads l ON l.customer_id = c.customer_id
        LEFT JOIN site_visits sv ON sv.customer_id = c.customer_id
        WHERE c.state IN ('HUMAN_ACTIVE', 'AI_PAUSED')
           OR l.human_handoff = TRUE
           OR l.lead_status IN ('SITE_VISIT_CONFIRMED', 'SITE_VISIT_SCHEDULED', 'HIGH_INTEREST')
           OR sv.status IN ('CONFIRMED', 'RESCHEDULED', 'PENDING_CONFIRMATION');
      `;

      const exceptionRows = await dbService.query(exceptionSql);
      const exceptionIds = exceptionRows.map((r) => r.id || r.conversation_id);

      let deleteSql = '';
      let params = [cutoffDate];

      if (exceptionIds.length > 0) {
        if (dbService.usePostgres) {
          deleteSql = `DELETE FROM messages WHERE timestamp < $1 AND conversation_id NOT IN (${exceptionIds.map((_, i) => `$${i + 2}`).join(',')});`;
          params = [cutoffDate, ...exceptionIds];
        } else {
          deleteSql = `DELETE FROM messages WHERE timestamp < ? AND conversation_id NOT IN (${exceptionIds.map(() => '?').join(',')});`;
          params = [cutoffDate, ...exceptionIds];
        }
      } else {
        deleteSql = dbService.usePostgres
          ? 'DELETE FROM messages WHERE timestamp < $1;'
          : 'DELETE FROM messages WHERE timestamp < ?;';
        params = [cutoffDate];
      }

      const res = await dbService.query(deleteSql, params);
      const deletedCount = res && res[0] && res[0].changes !== undefined ? res[0].changes : 0;

      console.log(`[RetentionService] Successfully purged ${deletedCount} messages older than ${retentionDays} days (Exceptions preserved: ${exceptionIds.length}).`);

      return {
        success: true,
        purged_count: deletedCount,
        exceptions_preserved: exceptionIds.length,
        cutoff_date: cutoffDate,
        retention_days: retentionDays
      };
    } catch (err) {
      console.error('[RetentionService Purge Error]:', err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new RetentionService();
