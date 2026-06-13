export const JOB_STATUSES = [
  'found',
  'cv_generated',
  'applied',
  'interview',
  'technical_interview',
  'approved',
  'cancelled',
];

export const STATUS_LABELS = {
  found: 'Vagas encontradas',
  cv_generated: 'CV gerado',
  applied: 'Aplicadas',
  interview: 'Entrevista',
  technical_interview: 'Entrevista técnica',
  approved: 'Aprovação',
  cancelled: 'Cancelada',
};

export const CV_LANGUAGES = [
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Español' },
];

export function scoreColor(score) {
  if (score >= 90) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (score >= 80) return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  if (score >= 70) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
}
