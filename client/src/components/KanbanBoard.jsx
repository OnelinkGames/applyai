import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { JOB_STATUSES } from '../constants';
import KanbanColumn from './KanbanColumn';
import JobCard from './JobCard';
import JobModal from './JobModal';

export default function KanbanBoard() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [importMessage, setImportMessage] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.getJobs,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.updateJobStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      const previous = queryClient.getQueryData(['jobs']);
      queryClient.setQueryData(['jobs'], (old = []) =>
        old.map((j) => (j.id === id ? { ...j, status } : j))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['jobs'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      if (selectedJobId) queryClient.invalidateQueries({ queryKey: ['job', selectedJobId] });
    },
  });

  const importMutation = useMutation({
    mutationFn: api.importJson,
    onSuccess: (result) => {
      setImportMessage(
        `Importação concluída: ${result.added} adicionadas, ${result.skipped} duplicadas, ${result.filtered} abaixo de 70%.`
      );
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['imports'] });
    },
    onError: (err) => setImportMessage(`Erro: ${err.message}`),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const jobsByStatus = useMemo(() => {
    const map = Object.fromEntries(JOB_STATUSES.map((s) => [s, []]));
    for (const job of jobs) {
      if (map[job.status]) map[job.status].push(job);
    }
    return map;
  }, [jobs]);

  function handleDragStart(event) {
    const job = jobs.find((j) => String(j.id) === event.active.id);
    setActiveJob(job ?? null);
  }

  function handleDragEnd(event) {
    setActiveJob(null);
    const { active, over } = event;
    if (!over) return;

    const jobId = Number(active.id);
    const newStatus = over.id;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === newStatus || !JOB_STATUSES.includes(newStatus)) return;

    statusMutation.mutate({ id: jobId, status: newStatus });
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage(null);
    importMutation.mutate(file);
    e.target.value = '';
  }

  if (isLoading) {
    return <p className="text-slate-400">Carregando vagas...</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Pipeline de vagas</h1>
          <p className="text-sm text-slate-400">{jobs.length} vagas no total</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {importMutation.isPending ? 'Importando...' : 'Importar JSON'}
          </button>
        </div>
      </div>

      {importMessage && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300">
          {importMessage}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {JOB_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              jobs={jobsByStatus[status]}
              onJobClick={(job) => setSelectedJobId(job.id)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeJob ? (
            <div className="w-[260px] rotate-2 opacity-90">
              <JobCard job={activeJob} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedJobId && (
        <JobModal jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </>
  );
}
