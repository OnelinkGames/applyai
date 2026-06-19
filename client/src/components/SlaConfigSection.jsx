import { SLA_COLUMNS } from '../constants';

function SlaStageFields({ label, stageKey, values, onChange, errors }) {
  const normal = values?.normalLimitDays ?? '';
  const warning = values?.warningLimitDays ?? '';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{label}</h3>

      <div className="space-y-3">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <span aria-hidden="true">🟢</span>
            <span>Normal</span>
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span>Até</span>
            <input
              type="number"
              min={1}
              step={1}
              value={normal}
              onChange={(e) =>
                onChange(stageKey, 'normalLimitDays', e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-center text-white"
            />
            <span>dias</span>
            <span className="text-emerald-400">→ Verde</span>
          </label>
          {errors?.[`${stageKey}.normal`] && (
            <p className="mt-1 text-xs text-red-400">{errors[`${stageKey}.normal`]}</p>
          )}
        </div>

        <div>
          <p className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <span aria-hidden="true">🟡</span>
            <span>Atenção</span>
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span>Até</span>
            <input
              type="number"
              min={1}
              step={1}
              value={warning}
              onChange={(e) =>
                onChange(stageKey, 'warningLimitDays', e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-center text-white"
            />
            <span>dias</span>
            <span className="text-amber-400">→ Atenção</span>
          </label>
          {errors?.[`${stageKey}.warning`] && (
            <p className="mt-1 text-xs text-red-400">{errors[`${stageKey}.warning`]}</p>
          )}
        </div>

        <p className="flex items-center gap-2 text-xs text-slate-500">
          <span aria-hidden="true">🔴</span>
          <span>
            Crítico — acima de {warning || '…'} dias (automático)
          </span>
        </p>
      </div>
    </div>
  );
}

export default function SlaConfigSection({ value, onChange, errors }) {
  function handleChange(stageKey, field, fieldValue) {
    onChange({
      ...value,
      [stageKey]: {
        ...value[stageKey],
        [field]: fieldValue,
      },
    });
  }

  return (
    <div className="space-y-3">
      {SLA_COLUMNS.map(({ key, label }) => (
        <SlaStageFields
          key={key}
          label={label}
          stageKey={key}
          values={value[key]}
          onChange={handleChange}
          errors={errors}
        />
      ))}
    </div>
  );
}
