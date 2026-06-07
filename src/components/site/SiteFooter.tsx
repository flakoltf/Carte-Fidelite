import Link from "next/link";
import { HaloWordmark } from "@/components/halo/HaloMark";

const LEGAL_LINKS = [
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU" },
  { href: "/cgv", label: "CGV" },
  { href: "/cookies", label: "Cookies" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line-warm px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <HaloWordmark className="text-base" />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-galet-ink">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-onyx">
                {l.label}
              </Link>
            ))}
            <Link href="/#tarifs" className="transition-colors hover:text-onyx">
              Tarifs
            </Link>
            <Link href="/login" className="transition-colors hover:text-onyx">
              Connexion
            </Link>
          </nav>
        </div>
        <p className="text-sm text-galet-ink">
          © 2026 HALO — Cartes de fidélité numériques · Genève
        </p>
      </div>
    </footer>
  );
}
