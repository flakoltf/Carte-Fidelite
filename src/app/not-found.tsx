import Link from "next/link";
import { HaloSymbol } from "@/components/halo/HaloMark";

// 404 globale — c'est ce que voit un client qui scanne un vieux QR : elle doit
// parler français et ramener vers halocard.ch, pas afficher la page Next en anglais.
export default function NotFound() {
  return (
    <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center p-6">
      <div className="flex flex-col items-center text-center max-w-md">
        <HaloSymbol size={44} className="mb-4 text-halo" />
        <h1 className="font-display text-3xl tracking-tight mb-2">Cette page n&apos;existe plus.</h1>
        <p className="text-galet-ink mb-6">
          Le lien que vous avez suivi n&apos;est plus valable ou a changé d&apos;adresse.
        </p>
        <Link
          href="https://halocard.ch"
          className="bg-halo text-white font-semibold px-6 py-3 rounded-2xl hover:bg-halo-600 transition-all"
        >
          Aller sur halocard.ch
        </Link>
      </div>
    </div>
  );
}
