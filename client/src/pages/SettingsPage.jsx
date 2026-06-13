import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { CV_LANGUAGES } from '../constants';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [resumePath, setResumePath] = useState('');
  const [resumeExists, setResumeExists] = useState(false);
  const [defaultCvLanguage, setDefaultCvLanguage] = useState('pt-BR');
  const [message, setMessage] = useState(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const { data: imports = [] } = useQuery({
    queryKey: ['imports'],
    queryFn: api.getImports,
  });

  useEffect(() => {
    if (settings) {
      setResumePath(settings.resumePath || './resume.md');
      setResumeExists(Boolean(settings.resumeExists));
      setDefaultCvLanguage(settings.defaultCvLanguage || 'pt-BR');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateSettings({ resumePath, defaultCvLanguage }),
    onSuccess: (data) => {
      setResumePath(data.resumePath || resumePath);
      setResumeExists(Boolean(data.resumeExists));
      setMessage('Configurações salvas.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => setMessage(`Erro: ${err.message}`),
  });

  const pickResumeMutation = useMutation({
    mutationFn: api.pickResumeFile,
    onSuccess: (data) => {
      if (!data) return;
      setResumePath(data.resumePath || '');
      setResumeExists(Boolean(data.resumeExists));
      setMessage('Currículo base selecionado e salvo.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => setMessage(`Erro: ${err.message}`),
  });

  if (isLoading) {
    return <p className="text-slate-400">Carregando configurações...</p>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Configurações</h1>
        <p className="text-sm text-slate-400">
          Currículo base e preferências para geração de CV.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300">
          {message}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div>
          <label className="mb-1 block text-sm text-slate-300">
            Caminho do currículo base (resume.md)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={resumePath}
              onChange={(e) => {
                setResumePath(e.target.value);
                setResumeExists(false);
              }}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              placeholder="/caminho/para/resume.md"
            />
            <button
              type="button"
              onClick={() => pickResumeMutation.mutate()}
              disabled={pickResumeMutation.isPending}
              className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pickResumeMutation.isPending ? 'Abrindo...' : 'Selecionar arquivo'}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Caminho absoluto ou relativo à raiz do projeto. O caminho é salvo no banco para uso
            futuro.
          </p>
          {resumePath && (
            <p
              className={`mt-1 text-xs ${resumeExists ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {resumeExists
                ? 'Arquivo encontrado e pronto para gerar CVs.'
                : 'Arquivo não encontrado no caminho informado.'}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300">Idioma padrão do CV</label>
          <select
            value={defaultCvLanguage}
            onChange={(e) => setDefaultCvLanguage(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            {CV_LANGUAGES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-4 font-medium text-white">Histórico de importações</h2>
        {imports.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma importação realizada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2 pr-4">Data</th>
                  <th className="pb-2 pr-4">Arquivo</th>
                  <th className="pb-2 pr-4">Adicionadas</th>
                  <th className="pb-2 pr-4">Duplicadas</th>
                  <th className="pb-2">Filtradas (&lt;70%)</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800/50 text-slate-300">
                    <td className="py-2 pr-4">
                      {new Date(item.importedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 pr-4">{item.filename || '—'}</td>
                    <td className="py-2 pr-4">{item.jobsAdded}</td>
                    <td className="py-2 pr-4">{item.jobsSkipped}</td>
                    <td className="py-2">{item.jobsFiltered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
