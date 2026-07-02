"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, User, Mail, Store, Download, Smartphone, AlertCircle, Check } from "lucide-react";
import { readableTextOn } from "@/lib/cardDesign/color";

// Tant que le publishing access Google Wallet n'est pas approuvé, le bouton
// mènerait à un échec opaque au comptoir. Le jour de l'approbation : passer
// NEXT_PUBLIC_GOOGLE_WALLET_READY=true dans Vercel et redéployer.
const GOOGLE_WALLET_READY = process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY === "true";

interface Props {
  // Identifiant public du marchand. L'enrollment_token (secret rotatif) ne doit
  // jamais atteindre le navigateur : la résolution se fait côté serveur.
  slug: string;
  shopName: string;
  primaryColor: string;
  logoUrl: string | null;
  rewardLabel: string | null;
}

export default function EnrollClient({ slug, shopName, primaryColor, logoUrl, rewardLabel }: Props) {
  // Les designs publiés ont souvent des fonds sombres : le texte du CTA et
  // l'icône de repli doivent rester lisibles quel que soit primaryColor.
  const textOnPrimary = readableTextOn(primaryColor);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cardId, setCardId] = useState<string | null>(null);
  const [walletError, setWalletError] = useState("");
  const [downloading, setDownloading] = useState(false);

  // Détection de la plateforme APRÈS hydratation (jamais au rendu serveur, qui ne
  // connaît pas l'appareil) : sur Android, un .pkpass est une impasse — on propose
  // la carte web de repli ; sur iOS, Google Wallet n'a pas sa place.
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");
  useEffect(() => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/i.test(ua)) setPlatform("ios");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, firstName, lastName, email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Une erreur est survenue. Réessayez.");
        return;
      }
      setCardId(body.cardId);
    } catch {
      setError("Erreur de connexion. Vérifiez votre réseau.");
    } finally {
      setLoading(false);
    }
  };

  const appleUrl = cardId ? `/api/enroll/${cardId}?s=${encodeURIComponent(slug)}&wallet=apple` : "#";
  const googleUrl = cardId ? `/api/enroll/${cardId}?s=${encodeURIComponent(slug)}&wallet=google` : "#";
  // Carte web de repli (Android sans Google Wallet) : même QR que le pass.
  const webCardUrl = cardId ? `/c/${encodeURIComponent(slug)}/carte/${cardId}` : "#";

  // Un simple <a href> naviguerait vers du JSON brut en cas d'échec (429/500) :
  // on télécharge via fetch → blob et on affiche l'erreur dans la page.
  const handleAppleDownload = async () => {
    if (!cardId || downloading) return;
    setDownloading(true);
    setWalletError("");
    try {
      const res = await fetch(appleUrl);
      if (!res.ok) {
        setWalletError("Réessayez dans un instant.");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "carte-fidelite.pkpass";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      setWalletError("Réessayez dans un instant.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-surface border border-line-warm rounded-3xl p-8 shadow-sm"
      >
        {/* En-tête / branding marchand */}
        <div className="flex flex-col items-center text-center mb-8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={shopName} className="w-16 h-16 rounded-2xl object-cover mb-4" />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: primaryColor }}
            >
              <Store className="w-8 h-8" style={{ color: textOnPrimary }} />
            </div>
          )}
          <h1 className="font-display text-2xl font-bold text-onyx">{shopName}</h1>
          {/* Le bénéfice AVANT l'effort : ce que le client y gagne, pas le formulaire. */}
          <p className="text-galet-ink text-sm mt-1">
            {cardId
              ? "Votre carte est prête 🎉"
              : `${rewardLabel?.trim() || "Vos passages récompensés"} — votre carte, direct dans votre téléphone.`}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!cardId ? (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-galet-ink ml-1">Prénom</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-3.5 w-5 h-5 text-galet group-focus-within:text-halo transition-colors" />
                    <input
                      required
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={60}
                      placeholder="Marie"
                      className="w-full bg-surface border border-line-warm rounded-2xl py-3.5 pl-12 pr-3 focus:border-halo outline-none transition-all placeholder:text-galet"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-galet-ink ml-1">Nom</label>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={60}
                    placeholder="Nom (facultatif)"
                    className="w-full bg-surface border border-line-warm rounded-2xl py-3.5 px-4 focus:border-halo outline-none transition-all placeholder:text-galet"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-galet-ink ml-1">Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-galet group-focus-within:text-halo transition-colors" />
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    placeholder="marie.dupont@email.com"
                    className="w-full bg-surface border border-line-warm rounded-2xl py-3.5 pl-12 pr-4 focus:border-halo outline-none transition-all placeholder:text-galet"
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-600 rounded-2xl px-4 py-3 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: primaryColor, color: textOnPrimary }}
                className="w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Créer ma carte</>
                )}
              </button>

              <p className="text-center text-xs text-galet">
                Vos coordonnées sont utilisées par {shopName} pour gérer votre carte de
                fidélité. HALO les traite pour son compte.{" "}
                <a href="/confidentialite" className="underline hover:text-galet-ink transition-colors">
                  Confidentialité
                </a>
              </p>
            </motion.form>
          ) : (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-2 text-halo text-sm mb-2">
                <Check className="w-4 h-4" />
                Carte créée. Ajoutez-la à votre téléphone :
              </div>

              {platform === "android" ? (
                <a
                  href={webCardUrl}
                  className="flex items-center justify-center gap-2 bg-surface border border-line-warm text-galet-ink py-4 rounded-2xl font-bold hover:bg-calcaire transition-all"
                >
                  <Smartphone className="w-5 h-5" />
                  Afficher ma carte
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleAppleDownload}
                  disabled={downloading}
                  className="w-full flex items-center justify-center gap-2 bg-surface border border-line-warm text-galet-ink py-4 rounded-2xl font-bold hover:bg-calcaire transition-all disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  Ajouter à Apple Wallet
                </button>
              )}

              <AnimatePresence>
                {walletError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-600 rounded-2xl px-4 py-3 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {walletError}
                  </motion.div>
                )}
              </AnimatePresence>

              {platform === "ios" ? null : GOOGLE_WALLET_READY ? (
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-surface border border-line-warm text-galet-ink py-4 rounded-2xl font-bold hover:bg-calcaire transition-all"
                >
                  <Smartphone className="w-5 h-5" />
                  Ajouter à Google Wallet
                </a>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 bg-surface border border-dashed border-line-warm text-galet py-4 px-4 rounded-2xl text-center">
                  <span className="flex items-center gap-2 font-bold">
                    <Smartphone className="w-5 h-5" />
                    Google Wallet — bientôt disponible
                  </span>
                  <span className="text-xs">
                    Votre carte est créée et vos tampons comptent déjà. Vous pourrez l&apos;ajouter à
                    Google Wallet très prochainement.
                  </span>
                </div>
              )}

              <p className="text-center text-xs text-galet pt-2">
                Présentez votre carte en caisse à chaque passage.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
