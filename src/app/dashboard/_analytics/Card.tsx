export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
      <h3 className="text-sm font-bold text-zinc-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function WidgetState({ loading, error, empty }: { loading?: boolean; error?: unknown; empty?: boolean }) {
  if (loading) return <div className="h-24 animate-pulse bg-zinc-800/40 rounded-xl" />;
  if (error) return <div className="text-sm text-red-400">Erreur de chargement</div>;
  if (empty) return <div className="text-sm text-zinc-600">Pas encore de données</div>;
  return null;
}
