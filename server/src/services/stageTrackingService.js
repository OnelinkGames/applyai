import { isMonitoredStatus } from '../constants.js';
import { mapJobRow } from '../db.js';

export function updateJobStatusWithTracking(db, jobId, newStatus) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) return null;

  const fromStatus = job.status;
  if (fromStatus === newStatus) return mapJobRow(job);

  const now = new Date().toISOString();

  const applyStatusChange = db.transaction(() => {
    if (isMonitoredStatus(newStatus)) {
      db.prepare(
        "UPDATE jobs SET status = ?, entered_at = ?, updated_at = ? WHERE id = ?"
      ).run(newStatus, now, now, jobId);

      db.prepare(
        'INSERT INTO job_stage_history (job_id, from_column, to_column, moved_at) VALUES (?, ?, ?, ?)'
      ).run(jobId, fromStatus, newStatus, now);
    } else {
      db.prepare("UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?").run(
        newStatus,
        now,
        jobId
      );
    }
  });

  applyStatusChange();

  return mapJobRow(db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId));
}
