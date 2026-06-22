import { Routes, Route, Link, useLocation } from 'react-router-dom';
import KanbanPage from './pages/KanbanPage';
import SettingsPage from './pages/SettingsPage';
import AiCostsPage from './pages/AiCostsPage';
import ImportsPage from './pages/ImportsPage';
import AppIcon from './components/AppIcon';

export default function App() {
  const location = useLocation();
  const isKanban = location.pathname === '/';

  return (
    <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
      <header className="z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white">
            <AppIcon className="h-8 w-8 shrink-0" />
            Vagas Kanban
          </Link>
          <nav className="flex gap-2">
            <Link
              to="/"
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                location.pathname === '/'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Kanban
            </Link>
            <Link
              to="/ai-costs"
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                location.pathname === '/ai-costs'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gastos IA
            </Link>
            <Link
              to="/imports"
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                location.pathname === '/imports'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Importações
            </Link>
            <Link
              to="/settings"
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                location.pathname === '/settings'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Configurações
            </Link>
          </nav>
        </div>
      </header>
      <main
        className={`app-scrollbar mx-auto min-h-0 w-full max-w-[1600px] px-4 ${
          isKanban
            ? 'flex flex-col overflow-hidden py-4'
            : 'overflow-y-auto py-6'
        }`}
      >
        <div className={isKanban ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : undefined}>
          <Routes>
            <Route path="/" element={<KanbanPage />} />
            <Route path="/ai-costs" element={<AiCostsPage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
