import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export default function JobSearchModal({ onClose, onSearch, isSearching }) {
  const [position, setPosition] = useState('');
  const [technologies, setTechnologies] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [location, setLocation] = useState('');

  const { data: searchDefaults = {}, isLoading, error } = useQuery({
    queryKey: ['job-search-defaults'],
    queryFn: api.getJobSearchDefaults,
  });

  useEffect(() => {
    if (!searchDefaults.filters) return;
    setPosition(searchDefaults.filters.position ?? '');
    setTechnologies((searchDefaults.filters.technologies ?? []).join(', '));
    setRemoteOnly(Boolean(searchDefaults.filters.remoteOnly));
    setLocation(searchDefaults.filters.location ?? '');
  }, [searchDefaults]);

  function handleSubmit(e) {
    e.preventDefault();
    onSearch({
      position: position.trim() || undefined,
      technologies: technologies
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      remoteOnly,
      location: location.trim() || undefined,
    });
  }

  const profile = searchDefaults.candidateProfile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Buscar vagas</h2>
            <p className="mt-1 text-sm text-slate-400">
              Critérios carregados do currículo e dos critérios de busca configurados.
              {searchDefaults.aiAvailable
                ? ` A busca refina o perfil com ${searchDefaults.ai?.model}.`
                : ' Configure o OpenRouter em Configurações para refinar a busca com IA.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSearching}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {isLoading && (
          <p className="mb-4 text-sm text-slate-400">Carregando perfil e critérios...</p>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
            {error.message}. Configure o currículo em Configurações.
          </div>
        )}

        {profile && (
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
            <p className="font-medium text-white">{profile.name || 'Perfil do currículo'}</p>
            <p className="mt-1 text-slate-400">
              {profile.seniority}
              {profile.yearsOfExperience != null ? ` · ${profile.yearsOfExperience} anos` : ''}
              {profile.mainTechnologies?.length
                ? ` · ${profile.mainTechnologies.slice(0, 6).join(', ')}`
                : ''}
            </p>
            {!searchDefaults.searchQueryExists && (
              <p className="mt-2 text-xs text-amber-300">
                search-query.txt não encontrado — configure em Configurações ou a busca usará
                apenas o currículo.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Cargo</span>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              disabled={isLoading || Boolean(error)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">
              Tecnologias (separadas por vírgula)
            </span>
            <input
              type="text"
              value={technologies}
              onChange={(e) => setTechnologies(e.target.value)}
              disabled={isLoading || Boolean(error)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Localização</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isLoading || Boolean(error)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 disabled:opacity-50"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              disabled={isLoading || Boolean(error)}
              className="rounded border-slate-600 bg-slate-950 disabled:opacity-50"
            />
            Somente remoto
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSearching}
              className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSearching || isLoading || Boolean(error)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isSearching ? 'Buscando...' : 'Buscar vagas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
