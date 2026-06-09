import type { Metadata } from "next";
export const metadata: Metadata = { title: "Merci — HaloCard" };

export default function MerciPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-bold text-halo">Merci pour votre abonnement 🎉</h1>
        <p className="mt-4 text-galet-ink">
          Un email vient de vous être envoyé pour <strong>activer votre compte</strong> et
          définir votre mot de passe. Pensez à vérifier vos spams.
        </p>
      </div>
    </div>
  );
}
