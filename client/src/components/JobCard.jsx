import { useDraggable } from '@dnd-kit/core';
import { scoreColor } from '../constants';

export default function JobCard({ job, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(job.id),
    data: { job, status: job.status },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(job)}
      className={`cursor-grab rounded-xl border border-slate-700 bg-slate-800/80 p-3 shadow-sm transition hover:border-slate-500 active:cursor-grabbing ${
        isDragging ? 'opacity-50 ring-2 ring-sky-500' : ''
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-white">{job.title}</h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreColor(job.score.overall)}`}
        >
          {job.score.overall}%
        </span>
      </div>
      <p className="text-xs text-slate-400">{job.company}</p>
      {job.location && (
        <p className="mt-1 truncate text-xs text-slate-500">{job.location}</p>
      )}
    </div>
  );
}
