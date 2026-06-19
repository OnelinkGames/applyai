import { parseJsonField } from '../db.js';
import { getSetting, setSetting } from './importService.js';

export const SLA_SETTING_KEY = 'kanban_sla';

export const DEFAULT_KANBAN_SLA = {
  applied: { normalLimitDays: 15, warningLimitDays: 30 },
  interview: { normalLimitDays: 15, warningLimitDays: 30 },
  technicalInterview: { normalLimitDays: 15, warningLimitDays: 30 },
};

const SLA_KEYS = ['applied', 'interview', 'technicalInterview'];

const SLA_LABELS = {
  applied: 'Aplicadas',
  interview: 'Entrevista',
  technicalInterview: 'Entrevista técnica',
};

export function validateKanbanSla(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuração de SLA inválida');
  }

  const normalized = {};

  for (const key of SLA_KEYS) {
    const stage = config[key];
    if (!stage || typeof stage !== 'object') {
      throw new Error(`Configuração SLA ausente para ${SLA_LABELS[key]}`);
    }

    const normalLimitDays = Number(stage.normalLimitDays);
    const warningLimitDays = Number(stage.warningLimitDays);

    if (!Number.isFinite(normalLimitDays) || !Number.isInteger(normalLimitDays) || normalLimitDays <= 0) {
      throw new Error(`${SLA_LABELS[key]}: limite normal deve ser um número inteiro maior que zero`);
    }

    if (
      !Number.isFinite(warningLimitDays) ||
      !Number.isInteger(warningLimitDays) ||
      warningLimitDays <= normalLimitDays
    ) {
      throw new Error(
        `${SLA_LABELS[key]}: limite de atenção deve ser maior que o limite normal`
      );
    }

    normalized[key] = { normalLimitDays, warningLimitDays };
  }

  return normalized;
}

export function getKanbanSla(db) {
  const stored = parseJsonField(getSetting(db, SLA_SETTING_KEY), null);
  if (!stored) return { ...DEFAULT_KANBAN_SLA };

  try {
    return validateKanbanSla(stored);
  } catch {
    return { ...DEFAULT_KANBAN_SLA };
  }
}

export function setKanbanSla(db, config) {
  const normalized = validateKanbanSla(config);
  setSetting(db, SLA_SETTING_KEY, JSON.stringify(normalized));
  return normalized;
}
