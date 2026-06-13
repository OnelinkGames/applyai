import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { formatDate, formatNumber, formatUsd, formatUsdShort } from '../utils/format';

export default function AiCostsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: api.getAiUsage,
  });

  if (isLoading) {
    return <p className="text-slate-400">Carregando gastos com IA...</p>;
  }

  if (error) {
    return <p className="text-red-400">Erro ao carregar gastos: {error.message}</p>;
  }

  const { summary, monthly, daily, byOperation } = data;
  const maxMonthlyCost = Math.max(...monthly.map((m) => m.costUsd), 0.0001);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Gastos com IA</h1>
        <p className="text-sm text-slate-400">
          Acompanhamento de custos estimados com base no uso de tokens da OpenAI.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Este mês" value={formatUsdShort(summary.thisMonthCostUsd)} />
        <SummaryCard label="Requisições este mês" value={formatNumber(summary.thisMonthRequests)} />
        <SummaryCard label="Total acumulado" value={formatUsdShort(summary.totalCostUsd)} />
        <SummaryCard label="Total de requisições" value={formatNumber(summary.totalRequests)} />
      </div>

      {byOperation.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-400">
            Por operação
          </h2>
          <div className="flex flex-wrap gap-3">
            {byOperation.map((item) => (
              <div
                key={item.operation}
                className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3"
              >
                <p className="text-sm text-slate-300">{item.label}</p>
                <p className="text-lg font-semibold text-white">{formatUsdShort(item.costUsd)}</p>
                <p className="text-xs text-slate-500">{formatNumber(item.requests)} requisições</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-400">
          Gastos mensais
        </h2>
        <p className="mb-6 text-xs text-slate-500">Últimos 12 meses com registro de uso</p>

        {monthly.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum gasto registrado ainda.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex h-48 items-end gap-2 border-b border-slate-700 pb-2">
              {monthly.map((item) => {
                const heightPct = Math.max((item.costUsd / maxMonthlyCost) * 100, item.costUsd > 0 ? 4 : 0);
                return (
                  <div key={item.month} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="relative flex h-40 w-full items-end justify-center">
                      <div
                        className="w-full max-w-10 rounded-t-md bg-sky-500/80 transition group-hover:bg-sky-400"
                        style={{ height: `${heightPct}%` }}
                        title={`${item.label}: ${formatUsd(item.costUsd)}`}
                      />
                      <div className="pointer-events-none absolute -top-8 hidden rounded bg-slate-800 px-2 py-1 text-xs text-white group-hover:block">
                        {formatUsdShort(item.costUsd)}
                      </div>
                    </div>
                    <span className="max-w-full truncate text-center text-[10px] text-slate-500">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {monthly.map((item) => (
                <div
                  key={`${item.month}-detail`}
                  className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-medium text-white">{formatUsdShort(item.costUsd)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-400">
          Gastos por dia
        </h2>
        <p className="mb-4 text-xs text-slate-500">Últimos 90 dias</p>

        {daily.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum registro diário ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium text-right">Requisições</th>
                  <th className="px-3 py-2 font-medium text-right">Tokens entrada</th>
                  <th className="px-3 py-2 font-medium text-right">Tokens saída</th>
                  <th className="px-3 py-2 font-medium text-right">Total tokens</th>
                  <th className="px-3 py-2 font-medium text-right">Custo</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((row) => (
                  <tr key={row.date} className="border-b border-slate-800/80 hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 text-slate-200">{formatDate(row.date)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{formatNumber(row.requests)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">
                      {formatNumber(row.promptTokens)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400">
                      {formatNumber(row.completionTokens)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-300">
                      {formatNumber(row.totalTokens)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-300">
                      {formatUsd(row.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-600">
        Valores estimados com base na tabela de preços da OpenAI por modelo. Podem divergir levemente
        da fatura real.
      </p>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
