import express from 'express';
import multer from 'multer';
import { JOB_STATUSES, CV_LANGUAGES } from '../constants.js';
import { mapJobRow } from '../db.js';
import { importJobs, getSetting, setSetting } from '../services/importService.js';
import {
  getResumePathStatus,
  pickResumeFile,
  validateResumeFile,
} from '../services/fileDialogService.js';
import { generateCvForJob } from '../services/cvService.js';
import { recordAiUsage, getAiUsageReport } from '../services/aiUsageService.js';

const upload = multer({ storage: multer.memoryStorage() });

export function createRouter(db) {
  const router = express.Router();

  router.get('/jobs', (req, res) => {
    const { status } = req.query;
    let rows;
    if (status) {
      rows = db
        .prepare('SELECT * FROM jobs WHERE status = ? ORDER BY score_overall DESC, id DESC')
        .all(status);
    } else {
      rows = db.prepare('SELECT * FROM jobs ORDER BY score_overall DESC, id DESC').all();
    }
    res.json(rows.map(mapJobRow));
  });

  router.get('/jobs/:id', (req, res) => {
    const job = mapJobRow(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id));
    if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });

    const comments = db
      .prepare('SELECT * FROM job_comments WHERE job_id = ? ORDER BY created_at DESC')
      .all(job.id)
      .map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.created_at,
      }));

    const cvs = db
      .prepare('SELECT id, language, created_at FROM generated_cvs WHERE job_id = ? ORDER BY created_at DESC')
      .all(job.id)
      .map((c) => ({
        id: c.id,
        language: c.language,
        createdAt: c.created_at,
      }));

    res.json({ ...job, comments, cvs });
  });

  router.patch('/jobs/:id/status', (req, res) => {
    const { status } = req.body;
    if (!JOB_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status inválido', validStatuses: JOB_STATUSES });
    }

    const result = db
      .prepare("UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }

    const job = mapJobRow(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id));
    res.json(job);
  });

  router.delete('/jobs/:id', (req, res) => {
    const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }
    res.status(204).end();
  });

  router.post('/jobs/:id/comments', (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Comentário não pode ser vazio' });
    }

    const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });

    const result = db
      .prepare('INSERT INTO job_comments (job_id, content) VALUES (?, ?)')
      .run(req.params.id, content.trim());

    const comment = db
      .prepare('SELECT * FROM job_comments WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
    });
  });

  router.post('/jobs/:id/generate-cv', async (req, res) => {
    try {
      const job = mapJobRow(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id));
      if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });

      const language =
        req.body?.language || getSetting(db, 'default_cv_language', 'pt-BR');

      if (!CV_LANGUAGES.includes(language)) {
        return res.status(400).json({ error: 'Idioma inválido', validLanguages: CV_LANGUAGES });
      }

      const { content, usage } = await generateCvForJob(db, job, language);

      recordAiUsage(db, {
        operation: 'cv_generation',
        model: usage.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        jobId: job.id,
      });

      const insertResult = db
        .prepare('INSERT INTO generated_cvs (job_id, language, content) VALUES (?, ?, ?)')
        .run(job.id, language, content);

      if (job.status === 'found') {
        db.prepare("UPDATE jobs SET status = 'cv_generated', updated_at = datetime('now') WHERE id = ?").run(
          job.id
        );
      }

      res.status(201).json({
        id: insertResult.lastInsertRowid,
        jobId: job.id,
        language,
        content,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Erro ao gerar CV' });
    }
  });

  router.get('/jobs/:id/cvs', (req, res) => {
    const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });

    const cvs = db
      .prepare('SELECT id, language, content, created_at FROM generated_cvs WHERE job_id = ? ORDER BY created_at DESC')
      .all(req.params.id)
      .map((c) => ({
        id: c.id,
        language: c.language,
        content: c.content,
        createdAt: c.created_at,
      }));

    res.json(cvs);
  });

  router.get('/jobs/:id/cvs/:cvId', (req, res) => {
    const cv = db
      .prepare('SELECT * FROM generated_cvs WHERE id = ? AND job_id = ?')
      .get(req.params.cvId, req.params.id);

    if (!cv) return res.status(404).json({ error: 'CV não encontrado' });

    res.json({
      id: cv.id,
      jobId: cv.job_id,
      language: cv.language,
      content: cv.content,
      createdAt: cv.created_at,
    });
  });

  router.post('/imports', upload.single('file'), (req, res) => {
    try {
      let payload;
      let filename = null;

      if (req.file) {
        payload = JSON.parse(req.file.buffer.toString('utf-8'));
        filename = req.file.originalname;
      } else if (req.body && Object.keys(req.body).length > 0) {
        payload = req.body;
        filename = req.body.filename || 'body.json';
      } else {
        return res.status(400).json({ error: 'Envie um arquivo JSON ou body JSON' });
      }

      const result = importJobs(db, payload, filename);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message || 'Erro ao importar JSON' });
    }
  });

  router.get('/imports', (_req, res) => {
    const imports = db
      .prepare('SELECT * FROM imports ORDER BY imported_at DESC LIMIT 50')
      .all()
      .map((row) => ({
        id: row.id,
        filename: row.filename,
        jobsAdded: row.jobs_added,
        jobsSkipped: row.jobs_skipped,
        jobsFiltered: row.jobs_filtered,
        totalInFile: row.total_in_file,
        importedAt: row.imported_at,
      }));
    res.json(imports);
  });

  function buildSettingsResponse() {
    const resumePath = getSetting(db, 'resume_path', './resume.md');
    const { exists: resumeExists, absolutePath: resumeAbsolutePath } =
      getResumePathStatus(resumePath);

    return {
      resumePath,
      resumeExists,
      resumeAbsolutePath,
      defaultCvLanguage: getSetting(db, 'default_cv_language', 'pt-BR'),
    };
  }

  router.get('/settings', (_req, res) => {
    res.json(buildSettingsResponse());
  });

  router.post('/settings/pick-resume-file', (req, res) => {
    try {
      const currentPath = getSetting(db, 'resume_path', './resume.md');
      const absolutePath = pickResumeFile(currentPath);

      if (!absolutePath) {
        return res.status(204).end();
      }

      setSetting(db, 'resume_path', absolutePath);
      res.json(buildSettingsResponse());
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Erro ao selecionar arquivo' });
    }
  });

  router.patch('/settings', (req, res) => {
    const { resumePath, defaultCvLanguage } = req.body;

    if (resumePath != null) {
      try {
        validateResumeFile(resumePath);
        setSetting(db, 'resume_path', resumePath.trim());
      } catch (error) {
        const status = error.status || 400;
        return res.status(status).json({ error: error.message || 'Caminho inválido' });
      }
    }
    if (defaultCvLanguage != null) {
      if (!CV_LANGUAGES.includes(defaultCvLanguage)) {
        return res.status(400).json({ error: 'Idioma inválido', validLanguages: CV_LANGUAGES });
      }
      setSetting(db, 'default_cv_language', defaultCvLanguage);
    }

    res.json(buildSettingsResponse());
  });

  router.get('/meta/statuses', (_req, res) => {
    res.json(JOB_STATUSES);
  });

  router.get('/ai/usage', (_req, res) => {
    res.json(getAiUsageReport(db));
  });

  router.post('/database/reset', (_req, res) => {
    const jobsRemoved = db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count;
    const importsRemoved = db.prepare('SELECT COUNT(*) AS count FROM imports').get().count;
    const aiUsageRemoved = db.prepare('SELECT COUNT(*) AS count FROM ai_usage').get().count;

    const reset = db.transaction(() => {
      db.prepare('DELETE FROM jobs').run();
      db.prepare('DELETE FROM imports').run();
      db.prepare('DELETE FROM ai_usage').run();
    });
    reset();

    res.json({ jobsRemoved, importsRemoved, aiUsageRemoved });
  });

  return router;
}
