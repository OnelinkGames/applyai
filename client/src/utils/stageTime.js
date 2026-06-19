import { DEFAULT_KANBAN_SLA, MONITORED_STATUSES, STATUS_TO_SLA_KEY } from '../constants';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function getDaysInStage(enteredAt) {
  if (!enteredAt) return 0;
  const entered = new Date(enteredAt);
  const now = new Date();
  return Math.max(0, Math.floor((now - entered) / MS_PER_DAY));
}

export function getSlaLimitsForStatus(status, kanbanSla) {
  const key = STATUS_TO_SLA_KEY[status];
  if (!key) return null;
  const config = kanbanSla ?? DEFAULT_KANBAN_SLA;
  return config[key] ?? DEFAULT_KANBAN_SLA[key];
}

export function getStageTimeState(days, limits) {
  if (days <= limits.normalLimitDays) return 'normal';
  if (days <= limits.warningLimitDays) return 'attention';
  return 'critical';
}

function formatDaysLabel(days, state, limits) {
  const unit = days === 1 ? 'dia' : 'dias';
  if (state === 'critical') return `${days} ${unit} sem retorno`;
  if (state === 'attention' && days > limits.normalLimitDays) {
    return `${days} ${unit} sem atualização`;
  }
  return `${days} ${unit}`;
}

const STAGE_TIME_STYLES = {
  normal: {
    icon: '⏱',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    border: 'border-l-emerald-500',
    card: 'border-emerald-900/40 bg-emerald-950/20',
  },
  attention: {
    icon: '⚠',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    border: 'border-l-amber-500',
    card: 'border-amber-900/40 bg-amber-950/20',
  },
  critical: {
    icon: '🚨',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30 animate-pulse',
    border: 'border-l-red-500',
    card: 'border-red-900/50 bg-red-950/25',
  },
};

export function getStageTimeIndicator(job, kanbanSla) {
  if (!MONITORED_STATUSES.includes(job.status) || !job.enteredAt) return null;

  const limits = getSlaLimitsForStatus(job.status, kanbanSla);
  if (!limits) return null;

  const days = getDaysInStage(job.enteredAt);
  const state = getStageTimeState(days, limits);
  const styles = STAGE_TIME_STYLES[state];

  return {
    state,
    days,
    icon: styles.icon,
    label: formatDaysLabel(days, state, limits),
    badgeClass: styles.badge,
    borderClass: styles.border,
    cardClass: styles.card,
  };
}

export function validateKanbanSlaForm(config) {
  const errors = {};

  for (const { key, label } of [
    { key: 'applied', label: 'Aplicadas' },
    { key: 'interview', label: 'Entrevista' },
    { key: 'technicalInterview', label: 'Entrevista técnica' },
  ]) {
    const stage = config?.[key];
    const normal = Number(stage?.normalLimitDays);
    const warning = Number(stage?.warningLimitDays);

    if (stage?.normalLimitDays === '' || !Number.isFinite(normal) || !Number.isInteger(normal) || normal <= 0) {
      errors[`${key}.normal`] = `${label}: informe um limite normal maior que zero`;
    }
    if (stage?.warningLimitDays === '' || !Number.isFinite(warning) || !Number.isInteger(warning)) {
      errors[`${key}.warning`] = `${label}: informe um limite de atenção válido`;
    } else if (Number.isFinite(normal) && warning <= normal) {
      errors[`${key}.warning`] = `${label}: atenção deve ser maior que o limite normal`;
    }
  }

  return errors;
}
