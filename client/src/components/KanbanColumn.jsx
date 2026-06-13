import { useDroppable } from '@dnd-kit/core';
import { STATUS_LABELS } from '../constants';
import JobCard from './JobCard';

export default function KanbanColumn({ status, jobs, onJobClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[260px] max-w-[280px] flex-1 flex-col rounded-2xl border bg-slate-900/50 ${
        isOver ? 'border-sky-500 bg-sky-950/20' : 'border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
        <h2 className="text-sm font-semibold text-slate-200">{STATUS_LABELS[status]}</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
          {jobs.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onClick={onJobClick} />
        ))}
        {jobs.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-600">Nenhuma vaga</p>
        )}
      </div>
    </div>
  );
}
