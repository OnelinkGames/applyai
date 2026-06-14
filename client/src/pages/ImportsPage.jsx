import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

const PAGE_SIZE = 20;

export default function ImportsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['imports', page],
    queryFn: () => api.getImports(page, PAGE_SIZE),
    placeholderData: (previousData) => previousData,
  });

  if (isLoading && !data) {
    return <p className="text-slate-400">Carregando histórico de importações...</p>;
  }

  if (error) {
    return <p className="text-red-400">Erro ao carregar importações: {error.message}</p>;
  }

  const { items = [], total = 0, totalPages = 1 } = data ?? {};
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Histórico de importações</h1>
        <p className="text-sm text-slate-400">
          Registro de cada importação de JSON realizada no kanban.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma importação realizada ainda.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Arquivo</th>
                    <th className="px-3 py-2 font-medium text-right">No arquivo</th>
                    <th className="px-3 py-2 font-medium text-right">Adicionadas</th>
                    <th className="px-3 py-2 font-medium text-right">Duplicadas</th>
                    <th className="px-3 py-2 font-medium text-right">Filtradas (&lt;70%)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-800/80 hover:bg-slate-800/30"
                    >
                      <td className="px-3 py-2.5 text-slate-200">
                        {new Date(item.importedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{item.filename || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400">
                        {item.totalInFile ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-emerald-300">{item.jobsAdded}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{item.jobsSkipped}</td>
                      <td className="px-3 py-2.5 text-right text-amber-300">{item.jobsFiltered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <p className="text-sm text-slate-500">
                {isFetching ? 'Atualizando...' : `Mostrando ${from}–${to} de ${total}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isFetching}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="min-w-[5rem] text-center text-sm text-slate-400">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isFetching}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
