import { calculateCostUsd } from './aiPricing.js';

export function recordAiUsage(db, {
  operation,
  model,
  promptTokens = 0,
  completionTokens = 0,
  jobId = null,
  costUsd: reportedCost = null,
}) {
  const totalTokens = promptTokens + completionTokens;
  const costUsd =
    typeof reportedCost === 'number' && Number.isFinite(reportedCost)
      ? reportedCost
      : calculateCostUsd(model, promptTokens, completionTokens);

  const result = db
    .prepare(
      `INSERT INTO ai_usage (operation, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, job_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(operation, model, promptTokens, completionTokens, totalTokens, costUsd, jobId);

  return {
    id: result.lastInsertRowid,
    operation,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
    jobId,
  };
}

export function getAiUsageReport(db) {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS requests,
         COALESCE(SUM(cost_usd), 0) AS cost_usd,
         COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
         COALESCE(SUM(total_tokens), 0) AS total_tokens
       FROM ai_usage`
    )
    .get();

  const thisMonth = db
    .prepare(
      `SELECT
         COUNT(*) AS requests,
         COALESCE(SUM(cost_usd), 0) AS cost_usd
       FROM ai_usage
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    )
    .get();

  const monthly = db
    .prepare(
      `SELECT
         strftime('%Y-%m', created_at) AS month,
         COUNT(*) AS requests,
         COALESCE(SUM(cost_usd), 0) AS cost_usd,
         COALESCE(SUM(total_tokens), 0) AS total_tokens
       FROM ai_usage
       GROUP BY strftime('%Y-%m', created_at)
       ORDER BY month DESC
       LIMIT 12`
    )
    .all()
    .reverse()
    .map((row) => ({
      month: row.month,
      label: formatMonthLabel(row.month),
      requests: row.requests,
      costUsd: row.cost_usd,
      totalTokens: row.total_tokens,
    }));

  const daily = db
    .prepare(
      `SELECT
         date(created_at) AS date,
         COUNT(*) AS requests,
         COALESCE(SUM(cost_usd), 0) AS cost_usd,
         COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
         COALESCE(SUM(total_tokens), 0) AS total_tokens
       FROM ai_usage
       GROUP BY date(created_at)
       ORDER BY date DESC
       LIMIT 90`
    )
    .all()
    .map((row) => ({
      date: row.date,
      requests: row.requests,
      costUsd: row.cost_usd,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      totalTokens: row.total_tokens,
    }));

  const byOperation = db
    .prepare(
      `SELECT
         operation,
         COUNT(*) AS requests,
         COALESCE(SUM(cost_usd), 0) AS cost_usd
       FROM ai_usage
       GROUP BY operation
       ORDER BY cost_usd DESC`
    )
    .all()
    .map((row) => ({
      operation: row.operation,
      label: OPERATION_LABELS[row.operation] || row.operation,
      requests: row.requests,
      costUsd: row.cost_usd,
    }));

  return {
    summary: {
      totalCostUsd: totals.cost_usd,
      totalRequests: totals.requests,
      totalTokens: totals.total_tokens,
      thisMonthCostUsd: thisMonth.cost_usd,
      thisMonthRequests: thisMonth.requests,
    },
    monthly,
    daily,
    byOperation,
  };
}

const OPERATION_LABELS = {
  cv_generation: 'Geração de CV',
  job_search_profile: 'Análise de perfil para busca',
  connection_test: 'Teste de conexão',
};

function formatMonthLabel(ym) {
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}
