import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HaloWordmark } from "@/components/halo/HaloMark";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Markdown } from "@/components/legal/Markdown";
import { hasMissingInfo } from "@/content/legal/company";

/** Gabarit commun aux pages légales : en-tête, contenu en prose, footer. */
export function LegalPage({ content }: { content: string }) {
  return (
    <div className="flex min-h-full flex-col bg-calcaire">
      <header className="sticky top-0 z-10 border-b border-line-warm bg-calcaire/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Accueil HALO">
            <HaloWordmark className="text-base" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-galet-ink transition-colors hover:text-onyx"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
        {hasMissingInfo && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Document en cours de finalisation : les éléments{" "}
            <mark className="rounded bg-amber-100 px-1 font-medium text-amber-800">surlignés</mark>{" "}
            seront complétés dès l'enregistrement de la société.
          </div>
        )}
        <article className="text-[15px]">
          <Markdown content={content} />
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
