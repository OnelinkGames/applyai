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

export const CV_LANGUAGES = ['pt-BR', 'en-US', 'es-ES'];

export const SCORE_THRESHOLD = 70;

/** Colunas com acompanhamento de tempo de permanência */
export const MONITORED_STATUSES = ['applied', 'interview', 'technical_interview'];

export function isMonitoredStatus(status) {
  return MONITORED_STATUSES.includes(status);
}
