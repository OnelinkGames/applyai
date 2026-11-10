import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function perMillion(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  }).format(value * 1_000_000);
}

const MODEL_PAGE_SIZE = 10;

function matchesQuery(item, query) {
  return [item.name, item.id, item.provider, item.providerLabel]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query));
}

function formatTokenPrice(value) {
  const formatted = perMillion(value);
  return formatted ? `${formatted} / 1M` : '—';
}

function ModelPrices({ item }) {
  return (
    <span className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-slate-400">
      <span>Entrada {formatTokenPrice(item.pricing?.prompt)}</span>
      <span>Saída {formatTokenPrice(item.pricing?.completion)}</span>
    </span>
  );
}

function ModelPicker({ models, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const selected = models.find((item) => item.id === value);

  const visibleModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query ? models.filter((item) => matchesQuery(item, query)) : models;
    return filtered.slice(0, MODEL_PAGE_SIZE);
  }, [models, search]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function toggle() {
    setOpen((current) => {
      if (!current) setSearch('');
      return !current;
    });
  }

  function choose(id) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id="ai-model"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-white disabled:opacity-50"
      >
        <span className={selected || value ? 'truncate' : 'truncate text-slate-400'}>
          {selected?.name || value || 'Selecione um modelo'}
        </span>
        <span aria-hidden="true" className="text-slate-400">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar por nome ou provedor"
            aria-label="Pesquisar modelo"
            className="mb-2 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
          />
          <ul role="listbox" aria-label="Modelos" className="space-y-1">
            {visibleModels.length === 0 ? (
              <li className="px-2 py-2 text-sm text-slate-400">Nenhum modelo encontrado.</li>
            ) : (
              visibleModels.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.id === value}
                    onClick={() => choose(item.id)}
                    className={`w-full rounded-md px-2 py-2 text-left hover:bg-slate-800 ${
                      item.id === value ? 'bg-slate-800' : ''
                    }`}
                  >
                    <span className="block text-sm text-white">{item.name}</span>
                    <ModelPrices item={item} />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AiProviderSection({ settings, onMessage }) {
  const queryClient = useQueryClient();
  const ai = settings?.ai;
  const [model, setModel] = useState(ai?.model || '');
  const [apiKey, setApiKey] = useState('');
  const [testFeedback, setTestFeedback] = useState(null);

  useEffect(() => {
    setModel(ai?.model || '');
  }, [ai?.model]);

  const modelsQuery = useQuery({
    queryKey: ['ai-models'],
    queryFn: api.getAiModels,
    staleTime: 60 * 60 * 1000,
  });

  const models = modelsQuery.data?.models || [];
  const selected = models.find((item) => item.id === model);

  const saveMutation = useMutation({
    mutationFn: api.updateAiSettings,
    onSuccess: (data) => {
      setApiKey('');
      onMessage('Configuração de IA salva.');
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['job-search-defaults'] });
    },
    onError: (err) => onMessage(`Erro: ${err.message}`),
  });

  const testMutation = useMutation({
    mutationFn: api.testAiConnection,
    onSuccess: (data) => setTestFeedback({ ok: true, message: data.message }),
    onError: (err) => setTestFeedback({ ok: false, message: err.message }),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.updateAiSettings({ clearApiKey: true }),
    onSuccess: (data) => {
      setApiKey('');
      onMessage('Chave de IA removida deste computador.');
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['job-search-defaults'] });
    },
    onError: (err) => onMessage(`Erro: ${err.message}`),
  });

  function handleTest() {
    setTestFeedback(null);
    const payload = { model };
    if (apiKey.trim()) payload.apiKey = apiKey.trim();
    testMutation.mutate(payload);
  }

  function handleSave(event) {
    event.preventDefault();
    onMessage(null);
    const payload = { model };
    if (apiKey.trim()) payload.apiKey = apiKey.trim();
    saveMutation.mutate(payload);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div>
        <h2 className="text-base font-semibold text-white">Inteligência artificial</h2>
        <p className="mt-1 text-sm text-slate-400">
          As gerações de currículo e o refinamento da busca usam o{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:text-sky-300"
          >
            OpenRouter
          </a>
          . Uma chave acessa vários modelos. Ela é salva criptografada no banco local.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Provedor</label>
          <input
            type="text"
            value="OpenRouter"
            readOnly
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
          />
        </div>

        <div>
          <label htmlFor="ai-model" className="mb-1 block text-sm text-slate-300">
            Modelo
          </label>
          <ModelPicker
            models={models}
            value={model}
            onChange={(nextModel) => {
              setModel(nextModel);
              setTestFeedback(null);
            }}
            disabled={modelsQuery.isLoading}
          />
          <p className="mt-1 text-xs text-slate-500">
            {modelsQuery.isLoading
              ? 'Carregando catálogo do OpenRouter...'
              : modelsQuery.isError
                ? modelsQuery.error.message
                : `${models.length} modelos disponíveis${
                    modelsQuery.data?.source === 'fallback' ? ' na lista local' : ''
                  }. O menu mostra 10 por vez.`}
          </p>
          {modelsQuery.data?.warning && (
            <p className="mt-1 text-xs text-amber-300">{modelsQuery.data.warning}</p>
          )}
          {selected && (
            <dl className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-slate-950/80 p-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Modelo</dt>
                <dd className="mt-1 text-sm font-medium text-white">{selected.name}</dd>
                <dd className="mt-0.5 break-all text-xs text-slate-400">{selected.id}</dd>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Contexto</dt>
                  <dd className="mt-1 text-sm text-slate-100">
                    {selected.contextLength
                      ? `${selected.contextLength.toLocaleString('pt-BR')} tokens`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Entrada</dt>
                  <dd className="mt-1 text-sm text-slate-100">
                    {formatTokenPrice(selected.pricing?.prompt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Saída</dt>
                  <dd className="mt-1 text-sm text-slate-100">
                    {formatTokenPrice(selected.pricing?.completion)}
                  </dd>
                </div>
              </div>
            </dl>
          )}
        </div>

        <div>
          <label htmlFor="ai-api-key" className="mb-1 block text-sm text-slate-300">
            Chave do OpenRouter
          </label>
          <p className="mb-2 text-xs text-slate-400">
            Crie a credencial em{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="break-all text-sky-400 hover:text-sky-300"
            >
              https://openrouter.ai/keys
            </a>
          </p>
          <input
            id="ai-api-key"
            type="password"
            value={apiKey}
            autoComplete="off"
            onChange={(event) => {
              setApiKey(event.target.value);
              setTestFeedback(null);
            }}
            placeholder={
              ai?.keyHint
                ? `Chave salva (${ai.keyHint}). Deixe em branco para mantê-la.`
                : 'Cole a chave criada no OpenRouter'
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
          />
          <p className={`mt-1 text-xs ${ai?.configured ? 'text-emerald-400' : 'text-amber-300'}`}>
            {ai?.keyUnreadable
              ? 'A chave salva não pôde ser lida. Informe a chave novamente.'
              : ai?.keyFormat === 'openai'
                ? 'A chave salva é da OpenAI. O teste lê essa chave, mas o OpenRouter só aceita uma chave criada em openrouter.ai/keys.'
                : ai?.keyFormat === 'unknown'
                  ? 'A chave salva não parece ser do OpenRouter. Cole uma chave criada em openrouter.ai/keys.'
                  : ai?.configured
                    ? `Pronta para uso com ${ai.model}.`
                    : 'Informe a chave e um modelo para gerar currículos e refinar buscas.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending || !model}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Salvando...' : 'Salvar IA'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testMutation.isPending || !model || (!apiKey.trim() && !ai?.keyHint)}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {testMutation.isPending ? 'Testando...' : 'Testar conexão'}
          </button>
          {ai?.keyHint && (
            <button
              type="button"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {clearMutation.isPending ? 'Removendo...' : 'Remover chave'}
            </button>
          )}
        </div>

        {testFeedback && (
          <p
            role="status"
            className={`rounded-lg border px-3 py-2 text-sm ${
              testFeedback.ok
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            {testFeedback.message}
          </p>
        )}
      </form>
    </section>
  );
}
