export default function AppIcon({ className = 'h-8 w-8' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="app-icon-bg" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f172a" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#app-icon-bg)" />
      <rect x="4" y="6" width="24" height="20" rx="2.5" fill="#334155" fillOpacity="0.45" />
      <rect x="6" y="8" width="5.5" height="16" rx="1.25" fill="#0f172a" />
      <rect x="13.25" y="8" width="5.5" height="16" rx="1.25" fill="#0f172a" />
      <rect x="20.5" y="8" width="5.5" height="16" rx="1.25" fill="#0f172a" />
      <rect x="7" y="10" width="3.5" height="2.75" rx="0.6" fill="#38bdf8" />
      <rect x="7" y="14" width="3.5" height="2.75" rx="0.6" fill="#34d399" />
      <rect x="14.25" y="10" width="3.5" height="4.5" rx="0.6" fill="#38bdf8" />
      <rect x="21.5" y="12" width="3.5" height="2.75" rx="0.6" fill="#818cf8" />
      <path
        d="M25.5 5.25l.55 1.1 1.1.55-1.1.55-.55 1.1-.55-1.1-1.1-.55 1.1-.55.55-1.1z"
        fill="#fbbf24"
      />
    </svg>
  );
}
