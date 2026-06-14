import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { CV_LANGUAGES } from '../constants';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [resumePath, setResumePath] = useState('');
  const [resumeExists, setResumeExists] = useState(false);
  const [searchQueryPath, setSearchQueryPath] = useState('');
  const [searchQueryExists, setSearchQueryExists] = useState(false);
  const [defaultCvLanguage, setDefaultCvLanguage] = useState('pt-BR');
  const [message, setMessage] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  useEffect(() => {
    if (settings) {
      setResumePath(settings.resumePath || './resume.md');
      setResumeExists(Boolean(settings.resumeExists));
      setSearchQueryPath(settings.searchQueryPath || './search-query.txt');
      setSearchQueryExists(Boolean(settings.searchQueryExists));
      setDefaultCvLanguage(settings.defaultCvLanguage || 'pt-BR');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateSettings({ resumePath, searchQueryPath, defaultCvLanguage }),
    onSuccess: (data) => {
      setResumePath(data.resumePath || resumePath);
      setResumeExists(Boolean(data.resumeExists));
      setSearchQueryPath(data.searchQueryPath || searchQueryPath);
      setSearchQueryExists(Boolean(data.searchQueryExists));
      setMessage('Configurações salvas.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['job-search-defaults'] });
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
      queryClient.invalidateQueries({ queryKey: ['job-search-defaults'] });
    },
    onError: (err) => setMessage(`Erro: ${err.message}`),
  });

  const pickSearchQueryMutation = useMutation({
    mutationFn: api.pickSearchQueryFile,
    onSuccess: (data) => {
      if (!data) return;
      setSearchQueryPath(data.searchQueryPath || '');
      setSearchQueryExists(Boolean(data.searchQueryExists));
      setMessage('Critérios de busca selecionados e salvos.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['job-search-defaults'] });
    },
    onError: (err) => setMessage(`Erro: ${err.message}`),
  });

  const resetMutation = useMutation({
    mutationFn: api.resetDatabase,
    onSuccess: (result) => {
      setShowResetModal(false);
      setMessage(
        `Banco zerado: ${result.jobsRemoved} vagas, ${result.importsRemoved} importações e ${result.aiUsageRemoved} registros de uso de IA removidos.`
      );
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['imports'] });
      queryClient.invalidateQueries({ queryKey: ['ai-usage'] });
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
          Currículo base, critérios de busca e preferências para geração de CV.
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
          <label className="mb-1 block text-sm text-slate-300">
            Caminho dos critérios de busca (search-query.txt)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQueryPath}
              onChange={(e) => {
                setSearchQueryPath(e.target.value);
                setSearchQueryExists(false);
              }}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              placeholder="/caminho/para/search-query.txt"
            />
            <button
              type="button"
              onClick={() => pickSearchQueryMutation.mutate()}
              disabled={pickSearchQueryMutation.isPending}
              className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pickSearchQueryMutation.isPending ? 'Abrindo...' : 'Selecionar arquivo'}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Define cargo, tecnologias, modalidade e localização usados na busca de vagas.
          </p>
          {searchQueryPath && (
            <p
              className={`mt-1 text-xs ${searchQueryExists ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {searchQueryExists
                ? 'Arquivo encontrado e pronto para buscar vagas.'
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

      <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <h2 className="mb-1 font-medium text-white">Zerar banco de dados</h2>
        <p className="mb-4 text-sm text-slate-400">
          Remove todos os registros de vagas para permitir uma nova importação do zero.
        </p>
        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-300"
        >
          Limpar todos os registros
        </button>
      </section>

      {showResetModal && (
        <ResetDatabaseModal
          onClose={() => setShowResetModal(false)}
          onConfirm={() => resetMutation.mutate()}
          isPending={resetMutation.isPending}
          error={resetMutation.isError ? resetMutation.error.message : null}
        />
      )}
    </div>
  );
}

function ResetDatabaseModal({ onClose, onConfirm, isPending, error }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
          aria-label="Fechar"
        >
          ✕
        </button>

        <h2 className="mb-3 pr-8 text-lg font-semibold text-white">Limpar banco de dados</h2>
        <p className="mb-4 text-sm text-slate-300">
          Esta ação irá remover permanentemente todos os dados abaixo. Use quando quiser
          reimportar um arquivo de vagas do zero.
        </p>

        <ul className="mb-4 list-inside list-disc space-y-1 text-sm text-slate-400">
          <li>Todas as vagas do kanban</li>
          <li>Comentários e CVs gerados</li>
          <li>Histórico de importações</li>
          <li>Registros de uso de IA</li>
        </ul>

        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          As configurações (currículo base, critérios de busca e idioma padrão) serão mantidas. Esta ação{' '}
          <strong className="font-semibold">não pode ser desfeita</strong> — não há rollback.
        </p>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {isPending ? 'Limpando...' : 'Confirmar limpeza'}
          </button>
        </div>
      </div>
    </div>
  );
}
