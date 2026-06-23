import Link from "next/link";
import { QrCode, ArrowRight } from "lucide-react";

// Bandeau non bloquant, posé en haut du Comptoir quand la carte est configurée
// mais qu'aucune carte n'a encore été distribuée. Rôle : un seul rappel doux —
// « obtenez et posez votre QR » — sans jamais couper le geste du comptoir.
export default function ComptoirDistributeBanner() {
  return (
    <Link
      href="/dashboard/card"
      data-testid="comptoir-distribute-banner"
      className="flex min-h-12 items-center gap-3 bg-halo/[0.08] px-5 py-2.5 text-onyx transition-colors hover:bg-halo/[0.12]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-halo text-white">
        <QrCode className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight">Distribuez votre QR</span>
        <span className="block truncate text-xs text-galet-ink">
          Téléchargez-le et posez-le en caisse pour vos premiers clients.
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-halo" aria-hidden="true" />
    </Link>
  );
}
