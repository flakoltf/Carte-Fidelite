export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-onyx mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function WidgetState({ loading, error, empty }: { loading?: boolean; error?: unknown; empty?: boolean }) {
  if (loading) return <div className="h-24 animate-pulse bg-[#ECE7DB] rounded-xl" />;
  if (error) return <div className="text-sm text-red-600">Erreur de chargement</div>;
  if (empty) return <div className="text-sm text-galet">Pas encore de données</div>;
  return null;
}
