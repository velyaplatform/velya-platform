export default function RootLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando"
      className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] text-[var(--text-primary)]"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-blue-400 animate-spin"
        />
        <p className="text-sm text-slate-600">Carregando...</p>
      </div>
    </div>
  );
}
