import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { CV_LANGUAGES, scoreColor } from '../constants';
import { downloadCvAsPdf } from '../utils/cvPdf';

const cvActionBtn =
  'rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-sky-300 shadow-sm transition hover:border-sky-500/60 hover:bg-slate-700 hover:text-sky-200 hover:shadow-md active:scale-[0.97] active:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-600 disabled:hover:bg-slate-800/80 disabled:hover:text-sky-300 disabled:hover:shadow-sm';

const cvActionBtnSuccess =
  'rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 shadow-sm';

export default function JobModal({ jobId, onClose }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [language, setLanguage] = useState('pt-BR');
  const [cvPreview, setCvPreview] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const commentMutation = useMutation({
    mutationFn: (content) => api.addComment(jobId, content),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  const cvMutation = useMutation({
    mutationFn: (lang) => api.generateCv(jobId, lang),
    onSuccess: (data) => {
      setCvPreview(data);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['ai-usage'] });
    },
    onError: (err) => setError(err.message),
  });

  async function loadLatestCv() {
    try {
      const cvs = await api.getCvs(jobId);
      if (cvs[0]) setCvPreview(cvs[0]);
    } catch (err) {
      setError(err.message);
    }
  }

  function cvFilename(ext) {
    return `cv-${job.company}-${job.id}.${ext}`.replace(/\s+/g, '-').toLowerCase();
  }

  async function copyCv() {
    if (!cvPreview?.content) return;
    await navigator.clipboard.writeText(cvPreview.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCv() {
    if (!cvPreview?.content) return;
    const blob = new Blob([cvPreview.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cvFilename('md');
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCvPdf() {
    if (!cvPreview?.content || pdfDownloading) return;
    setPdfDownloading(true);
    setError(null);
    try {
      await downloadCvAsPdf(cvPreview.content, cvFilename('pdf'));
    } catch (err) {
      setError(err.message || 'Erro ao gerar PDF');
    } finally {
      setPdfDownloading(false);
    }
  }

  if (isLoading || !job) {
    return (
      <ModalShell onClose={onClose}>
        <p className="text-slate-400">Carregando...</p>
      </ModalShell>
    );
  }

  const defaultLang = settings?.defaultCvLanguage || 'pt-BR';

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-4 pr-10">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-white">{job.title}</h2>
          <p className="text-slate-400">
            {job.company} · {job.location || 'Local não informado'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-bold shadow-lg shadow-black/40 ring-2 ring-white/10 backdrop-blur-sm ${scoreColor(job.score.overall)}`}
        >
          Match {job.score.overall}%
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          {job.salary && (
            <InfoBlock label="Salário" value={job.salary} />
          )}
          {job.url && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Link</p>
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-sky-400 hover:underline break-all"
              >
                {job.url}
              </a>
            </div>
          )}
          {job.description && (
            <InfoBlock label="Descrição" value={job.description} />
          )}
          {job.requirements?.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Requisitos</p>
              <div className="flex flex-wrap gap-1.5">
                {job.requirements.map((req) => (
                  <span
                    key={req}
                    className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300"
                  >
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}
          {job.matchReasons?.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Motivos do match</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                {job.matchReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Scores</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <ScoreItem label="Tecnologias" value={job.score.technologies} />
              <ScoreItem label="Experiência" value={job.score.experience} />
              <ScoreItem label="Salário" value={job.score.salary} />
              <ScoreItem label="Localização" value={job.score.location} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <h3 className="mb-3 font-medium text-white">Gerar CV adaptado</h3>
            <div className="mb-3 flex flex-wrap gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                {CV_LANGUAGES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => cvMutation.mutate(language || defaultLang)}
                disabled={cvMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {cvMutation.isPending ? 'Gerando...' : 'Gerar CV'}
              </button>
              {job.cvs?.length > 0 && (
                <button
                  type="button"
                  onClick={loadLatestCv}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Ver último CV
                </button>
              )}
            </div>
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            {cvPreview && (
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyCv}
                    className={copied ? cvActionBtnSuccess : cvActionBtn}
                  >
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                  <button type="button" onClick={downloadCv} className={cvActionBtn}>
                    Baixar .md
                  </button>
                  <button
                    type="button"
                    onClick={downloadCvPdf}
                    disabled={pdfDownloading}
                    className={cvActionBtn}
                  >
                    {pdfDownloading ? 'Gerando PDF...' : 'Baixar PDF'}
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs whitespace-pre-wrap text-slate-300">
                  {cvPreview.content}
                </pre>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <h3 className="mb-3 font-medium text-white">Comentários</h3>
            <div className="mb-3 max-h-40 space-y-2 overflow-y-auto">
              {job.comments?.length === 0 && (
                <p className="text-sm text-slate-500">Nenhum comentário ainda.</p>
              )}
              {job.comments?.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-800/80 p-2 text-sm">
                  <p className="text-slate-200">{c.content}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(c.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Adicionar nota sobre esta vaga..."
              rows={3}
              className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => comment.trim() && commentMutation.mutate(comment.trim())}
              disabled={!comment.trim() || commentMutation.isPending}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
            >
              Salvar comentário
            </button>
          </div>
        </section>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
          aria-label="Fechar"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-300 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ScoreItem({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-800/60 px-3 py-2">
      <span className="text-slate-400">{label}: </span>
      <span className="font-medium text-white">{value ?? '—'}%</span>
    </div>
  );
}
