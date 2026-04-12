import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] text-[var(--text-primary)] px-4">
      <section
        aria-labelledby="notfound-title"
        className="max-w-md w-full bg-white border border-neutral-200 rounded-xl p-8 shadow-2xl text-center"
      >
        <div aria-hidden="true" className="text-5xl mb-3 text-neutral-300 font-bold">
          404
        </div>
        <h1 id="notfound-title" className="text-2xl font-bold text-neutral-900 mb-2">
          Página não encontrada
        </h1>
        <p className="text-neutral-500 text-sm mb-6">
          A rota que você tentou acessar não existe ou foi movida.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          Voltar ao Centro de Comando
        </Link>
      </section>
    </main>
  );
}
