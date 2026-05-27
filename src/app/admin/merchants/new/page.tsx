import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewMerchantForm from "./NewMerchantForm";

export const dynamic = "force-dynamic";

export default function NewMerchantPage() {
  return (
    <div className="max-w-lg">
      <Link
        href="/admin/merchants"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux marchands
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Nouveau marchand</h1>
      <p className="text-zinc-500 mb-8">Un mot de passe temporaire sera généré à transmettre au marchand.</p>
      <NewMerchantForm />
    </div>
  );
}
