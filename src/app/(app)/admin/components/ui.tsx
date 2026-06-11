import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Primitives partagées des pages du panneau admin (Server Components —
// territoire agent B, indépendantes du design-system marchand).

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-4 inline-flex items-center gap-2 text-sm text-galet-ink transition-colors hover:text-onyx"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel ?? "Retour"}
          </Link>
        )}
        <h1 className="mb-2 font-display text-3xl tracking-tight text-onyx">{title}</h1>
        {subtitle && <p className="max-w-2xl text-galet-ink">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  name,
  value,
  hint,
  icon: Icon,
  color = "text-halo",
}: {
  name: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  color?: string;
}) {
  return (
    <div className="rounded-3xl border border-line-warm bg-surface p-5 shadow-sm">
      <div className={`mb-3 w-fit rounded-xl border border-line-warm bg-calcaire p-2 ${color}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="text-2xl font-bold text-onyx">{value}</div>
      <div className="text-sm font-medium text-galet-ink">{name}</div>
      {hint && <div className="mt-1 text-xs text-galet">{hint}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-onyx">{title}</h2>
          {description && <p className="mt-1 text-sm text-galet-ink">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line-warm p-8 text-center text-galet-ink">
      <p className="font-semibold text-onyx">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-sm">{children}</p>}
    </div>
  );
}

const PILL_TONES = {
  vert: "bg-emerald-500/10 text-emerald-700",
  orange: "bg-amber-500/15 text-amber-700",
  rouge: "bg-red-500/10 text-red-700",
  neutre: "bg-galet/15 text-galet-ink",
  halo: "bg-halo/10 text-halo",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof PILL_TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function formatDateCH(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return withTime ? d.toLocaleString("fr-CH") : d.toLocaleDateString("fr-CH");
}

export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return "jamais";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}
