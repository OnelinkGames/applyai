import { Routes, Route, Link, useLocation } from 'react-router-dom';
import KanbanPage from './pages/KanbanPage';
import SettingsPage from './pages/SettingsPage';
import AiCostsPage from './pages/AiCostsPage';

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white">
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
      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <Routes>
          <Route path="/" element={<KanbanPage />} />
          <Route path="/ai-costs" element={<AiCostsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
