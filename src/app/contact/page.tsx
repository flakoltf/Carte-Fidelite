import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";
import { HaloWordmark } from "@/components/halo/HaloMark";
import { SiteFooter } from "@/components/site/SiteFooter";
import { company } from "@/content/legal/company";

export const metadata: Metadata = {
  title: "Contact & support — HALO",
  description: "Contactez l'équipe HALO — support, questions commerciales, presse.",
};

export const dynamic = "force-static";

function Value({ value, todo }: { value: string | null; todo: string }) {
  if (value) return <span className="text-onyx">{value}</span>;
  return (
    <mark
      className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.85em] font-medium text-amber-800"
      title="À compléter dans src/content/legal/company.ts"
    >
      à compléter : {todo}
    </mark>
  );
}

export default function Page() {
  const items = [
    { icon: Mail, label: "Email", value: company.emailContact, todo: "email de contact", href: company.emailContact ? `mailto:${company.emailContact}` : undefined },
    { icon: Phone, label: "Téléphone", value: company.telephone, todo: "téléphone", href: company.telephone ? `tel:${company.telephone.replace(/\s/g, "")}` : undefined },
    {
      icon: MapPin,
      label: "Adresse",
      value: company.adresse ? `${company.adresse}, ${company.npa ?? ""} ${company.localite}, ${company.pays}` : null,
      todo: "adresse",
      href: undefined,
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-calcaire">
      <header className="sticky top-0 z-10 border-b border-line-warm bg-calcaire/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Accueil HALO">
            <HaloWordmark className="text-base" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-galet-ink transition-colors hover:text-onyx">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
        <h1 className="font-display text-3xl font-medium text-onyx sm:text-4xl">Contact &amp; support</h1>
        <p className="mt-4 max-w-xl leading-relaxed text-galet-ink">
          Une question sur HALO, un besoin d&apos;assistance ou une demande commerciale&nbsp;? Nous
          répondons sous un jour ouvré.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {items.map(({ icon: Icon, label, value, todo, href }) => (
            <div key={label} className="rounded-2xl border border-line-warm bg-surface p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-halo/10 text-halo">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <p className="mt-4 text-sm font-medium text-galet-ink">{label}</p>
              <p className="mt-1 text-sm">
                {href ? (
                  <a href={href} className="text-halo underline decoration-halo/30 underline-offset-2 hover:decoration-halo">
                    {value}
                  </a>
                ) : (
                  <Value value={value} todo={todo} />
                )}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-galet-ink">
          Pour les questions relatives à vos données personnelles, consultez notre{" "}
          <Link href="/confidentialite" className="text-halo underline decoration-halo/30 underline-offset-2 hover:decoration-halo">
            politique de confidentialité
          </Link>
          .
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
