'use client';

// Panneau de validation — la « pièce maîtresse » du studio. Consomme le moteur
// validateTemplate (Issue[]) : erreurs (bloquent la publication), avertissements,
// et rappels système (info). Chaque Issue liée à un champ propose un lien vers
// lui. Publication bloquée tant qu'il reste une erreur.

import { AlertCircle, AlertTriangle, Info, CheckCircle2, ArrowRight } from 'lucide-react';
import type { Issue, IssueSeverity } from '@/lib/cardDesign/validateTemplate';

const STYLE: Record<IssueSeverity, { box: string; Icon: typeof AlertCircle; title: string }> = {
  error: { box: 'bg-red-500/10 border-red-500/30 text-red-700', Icon: AlertCircle, title: 'À corriger avant publication' },
  warning: { box: 'bg-amber-500/10 border-amber-500/30 text-amber-700', Icon: AlertTriangle, title: 'Avertissements' },
  info: { box: 'bg-slate-500/10 border-slate-400/30 text-slate-600', Icon: Info, title: 'Bon à savoir' },
};

function Group({
  severity,
  issues,
  onFocusField,
}: {
  severity: IssueSeverity;
  issues: Issue[];
  onFocusField?: (fieldId: string) => void;
}) {
  if (issues.length === 0) return null;
  const { box, Icon, title } = STYLE[severity];
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-galet-ink">{title}</p>
      <div className="space-y-2">
        {issues.map((issue, i) => (
          <div key={`${issue.id}-${i}`} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${box}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <span>{issue.message}</span>
              {issue.fieldId && onFocusField && (
                <button
                  type="button"
                  onClick={() => onFocusField(issue.fieldId!)}
                  className="mt-1 flex items-center gap-1 text-[12px] font-medium underline-offset-2 hover:underline"
                >
                  Voir le champ <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ValidationPanel({
  issues,
  onFocusField,
}: {
  issues: Issue[];
  onFocusField?: (fieldId: string) => void;
}) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  return (
    <div className="space-y-4" aria-label="Validation de la carte">
      {errors.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-halo/30 bg-halo/5 px-3 py-2 text-sm font-medium text-halo">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Aucune erreur — votre carte est publiable.
        </div>
      )}
      <Group severity="error" issues={errors} onFocusField={onFocusField} />
      <Group severity="warning" issues={warnings} onFocusField={onFocusField} />
      <Group severity="info" issues={infos} onFocusField={onFocusField} />
    </div>
  );
}
