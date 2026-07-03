"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronRight, Menu, X } from "lucide-react";
import { HaloSymbol, HaloWordmark } from "@/components/halo/HaloMark";
import { FAQ_ITEMS } from "@/content/faq";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PricingTiers } from "./_components/PricingTiers";
import { CardConfigurator } from "./_components/CardConfigurator";

/* ---------- motion helper (respects reduced-motion) ---------- */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/* Les 3 étapes CONCIERGE (colonne droite du hero) : le parcours du marchand
   avec nous, pas celui du client final — c'est le modèle done-for-you. */
const CONCIERGE_STEPS: { title: string; desc: string }[] = [
  { title: "Vous nous dites votre commerce.", desc: "Une minute, par téléphone ou en deux clics." },
  { title: "On vous montre votre carte.", desc: "Maquette à vos couleurs sous un jour ouvré, offerte." },
  { title: "Vos clients l'ajoutent d'un scan.", desc: "Apple & Google Wallet. Rien à installer, jamais." },
];

const WHY: { title: string; desc: string }[] = [
  { title: "Zéro appli.", desc: "La carte vit dans le Wallet du téléphone, ajoutée en un scan." },
  { title: "À votre image.", desc: "Vos couleurs, votre logo, votre nom. White-label complet." },
  { title: "Notifications push.", desc: "Relancez un client inactif ou annoncez une offre, gratuitement." },
  { title: "Notifications de proximité.", desc: "Votre message quand le client passe près de chez vous." },
  { title: "Stats & tableau de bord.", desc: "Comprenez et pilotez votre fidélisation, en temps réel." },
  { title: "Scan en caisse.", desc: "Validez un passage ou créditez des points d'un simple scan." },
];

const PRICING = [
  {
    name: "Essentiel",
    price: "69",
    unit: "CHF/mois",
    tagline: "jusqu'à 200 cartes actives",
    featured: false,
    cta: "Choisir Essentiel",
    href: "/demarrer?plan=essentiel",
  },
  {
    name: "Croissance",
    price: "129",
    unit: "CHF/mois",
    tagline: "jusqu'à 750 cartes actives",
    featured: true,
    cta: "Choisir Croissance",
    href: "/demarrer?plan=croissance",
  },
  {
    name: "Premium",
    price: "199",
    unit: "CHF/mois",
    tagline: "jusqu'à 2 000 cartes actives",
    featured: false,
    cta: "Choisir Premium",
    href: "/demarrer?plan=premium",
  },
];

const NAV_LINKS: [href: string, label: string][] = [
  ["#fonctionnement", "Comment on travaille"],
  ["#configurateur", "Votre carte"],
  ["#comptoir", "Le comptoir"],
  ["#tarifs", "Tarifs"],
  ["#faq", "FAQ"],
];

/* Index mono émeraude des listes à filets (hero + features). */
function MonoIndex({ n }: { n: number }) {
  return (
    <span aria-hidden className="font-mono text-[13px] leading-[1.55] text-halo">
      {String(n).padStart(2, "0")}
    </span>
  );
}

export default function HomeClient() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy : surligne la section courante dans la nav.
  useEffect(() => {
    const sections = NAV_LINKS.map(([href]) => document.getElementById(href.slice(1))).filter(
      (el): el is HTMLElement => el !== null
    );
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top) setActiveId(top.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-dvh bg-calcaire font-sans text-onyx selection:bg-halo/40 overflow-x-hidden">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-halo focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        Aller au contenu
      </a>
      {/* ---------------- NAV ---------------- */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
          scrolled || menuOpen
            ? "border-line-warm bg-calcaire/80 py-3 backdrop-blur-md"
            : "border-transparent bg-transparent py-5"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link href="/" aria-label="HALO — accueil">
            <HaloWordmark className="text-lg" />
          </Link>
          <div className="hidden items-center gap-8 text-sm text-galet-ink md:flex">
            {NAV_LINKS.map(([href, label]) => {
              const active = activeId === href.slice(1);
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={active ? "true" : undefined}
                  className={`transition-colors ${active ? "text-onyx" : "hover:text-onyx"}`}
                >
                  {label}
                </a>
              );
            })}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-galet-ink transition-colors hover:text-onyx focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo md:inline-flex"
            >
              Connexion
            </Link>
            <Link
              href="/demarrer"
              className="rounded-full bg-halo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-halo-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
            >
              Voir ma carte
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="flex h-11 w-11 items-center justify-center rounded-full text-onyx transition-colors hover:bg-line-warm/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {/* mobile section menu */}
        {menuOpen && (
          <div id="mobile-menu" className="mx-auto max-w-7xl px-6 pb-4 pt-2 md:hidden">
            <div className="flex flex-col gap-1 rounded-2xl border border-line-warm bg-surface p-2 text-sm shadow-[0_8px_30px_-12px_rgba(14,15,17,0.18)]">
              {NAV_LINKS.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 font-medium text-onyx transition-colors hover:bg-calcaire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
                >
                  {label}
                </a>
              ))}
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 font-medium text-galet-ink transition-colors hover:bg-calcaire hover:text-onyx focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
              >
                Connexion
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main id="contenu" tabIndex={-1}>
      {/* ---------------- HERO — grille asymétrique typographique ---------------- */}
      <section className="border-b border-line-warm px-6 pt-24 sm:pt-28">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-[1.35fr_1fr]">
          {/* Colonne gauche : la promesse */}
          <div className="pb-12 pt-12 lg:border-r lg:border-line-warm lg:pb-16 lg:pr-14 lg:pt-[76px]">
            <Reveal>
              <p className="font-mono text-xs tracking-[0.22em] text-halo">
                GENÈVE — CARTES DE FIDÉLITÉ NUMÉRIQUES
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-7 font-display text-[clamp(3rem,10vw,6rem)] font-light leading-[0.98] tracking-[-0.03em] lg:text-[clamp(3rem,7vw,6rem)]">
                La fidélité,
                <br />
                sans papier,
                <br />
                <em className="italic text-halo">sans appli.</em>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-[30px] max-w-[46ch] text-lg leading-relaxed text-galet-ink">
                Une carte dans Apple &amp; Google Wallet, à vos couleurs, créée pour vous. On est
                de Genève — on s&apos;occupe de tout, vous encaissez les retours.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-10 flex flex-col gap-3.5 sm:flex-row">
                <Link
                  href="/demarrer"
                  className="inline-flex items-center justify-center rounded-full bg-halo px-[30px] py-4 font-semibold text-white transition-all hover:bg-halo-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
                >
                  Voir ma carte — offert
                </Link>
                <a
                  href="#fonctionnement"
                  className="inline-flex items-center justify-center rounded-full border border-line-warm bg-surface px-[30px] py-4 font-medium text-onyx transition-colors hover:bg-calcaire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
                >
                  Comment on travaille
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-14 font-mono text-xs tracking-[0.08em] text-galet-ink">
                CAROUGE — EAUX-VIVES — PLAINPALAIS — CHAMPEL — SERVETTE
              </p>
            </Reveal>
          </div>

          {/* Colonne droite : les 3 étapes concierge + le prix d'entrée */}
          <div id="fonctionnement" className="flex flex-col border-t border-line-warm lg:border-t-0">
            {CONCIERGE_STEPS.map((s, i) => (
              <Reveal
                key={s.title}
                delay={i * 0.06}
                className={`flex gap-[18px] py-7 lg:pl-12 ${
                  i === 0 ? "lg:pt-11" : ""
                } ${i < CONCIERGE_STEPS.length - 1 ? "border-b border-line-warm" : ""}`}
              >
                <MonoIndex n={i + 1} />
                <p className="text-[15px] leading-[1.55]">
                  <strong className="font-semibold text-onyx">{s.title}</strong>
                  <br />
                  <span className="text-galet-ink">{s.desc}</span>
                </p>
              </Reveal>
            ))}
            <Reveal className="mt-auto border-t border-line-warm pb-11 pt-7 lg:pl-12">
              <p className="font-display text-[64px] font-light leading-none tracking-[-0.03em] lg:text-[92px]">
                69<span className="text-[24px] text-galet-ink lg:text-[30px]"> CHF/mois</span>
              </p>
              <p className="mt-2 text-sm text-galet-ink">
                Tout inclus, dès le premier palier. Sans matériel, sans engagement.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- CONFIGURATEUR ---------------- */}
      <section id="configurateur" className="border-b border-line-warm px-6 py-[88px]">
        <Reveal className="mx-auto max-w-7xl">
          <CardConfigurator />
        </Reveal>
      </section>

      {/* ---------------- LE MOMENT RÉCOMPENSE ---------------- */}
      <section className="border-b border-line-warm px-6 py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <p className="font-mono text-xs tracking-[0.22em] text-gold-deep">
              LE MOMENT QUI FAIT REVENIR
            </p>
            <h2 className="mt-5 font-display text-4xl font-light leading-[1.08] tracking-[-0.02em] sm:text-[46px]">
              Le 9ᵉ café, c&apos;est vous qui l&apos;offrez. La fête, c&apos;est la carte qui la
              fait.
            </h2>
            <p className="mt-5 max-w-[48ch] leading-[1.65] text-galet-ink">
              Quand un client atteint sa récompense, sa carte passe à l&apos;or et son téléphone le
              prévient. Petit moment, grande habitude — c&apos;est pour ça qu&apos;ils reviennent.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="flex justify-center">
            {/* La carte or — le SEUL déploiement du dégradé doré de la page. */}
            <div
              className="w-full max-w-[440px] rotate-2 rounded-3xl p-[30px] shadow-[0_30px_60px_-25px_rgba(201,149,47,0.55)]"
              style={{ background: "var(--color-gold-grad)" }}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-onyx">Café du Marché</p>
                <span className="font-mono text-[11px] text-onyx/55">№ 0417</span>
              </div>
              <p className="mb-1.5 mt-[34px] text-[13px] text-onyx/60">9 / 9 cafés</p>
              <p className="font-display text-3xl italic text-onyx">Celui-ci est offert.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- TOUT CE QU'IL FAUT — liste à filets ---------------- */}
      <section className="border-b border-line-warm px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <h2 className="font-display text-4xl font-light tracking-[-0.02em] sm:text-[46px]">
              Tout ce qu&apos;il faut, rien de superflu.
            </h2>
          </Reveal>
          <div className="mt-11 grid sm:grid-cols-2 sm:gap-x-[72px]">
            {WHY.map((w, i) => (
              <Reveal
                key={w.title}
                delay={(i % 2) * 0.06}
                className={`flex gap-[18px] border-t border-line-warm py-5 ${
                  i === WHY.length - 1 ? "border-b" : ""
                } ${i === WHY.length - 2 ? "sm:border-b" : ""}`}
              >
                <MonoIndex n={i + 1} />
                <p className="text-[15px] leading-[1.55]">
                  <strong className="font-semibold text-onyx">{w.title}</strong>{" "}
                  <span className="text-galet-ink">{w.desc}</span>
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- LE COMPTOIR — le produit, montré ---------------- */}
      <section id="comptoir" className="border-b border-line-warm px-6 py-[88px]">
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1fr_1.1fr]">
          <Reveal className="flex justify-center">
            {/* Mockup fidèle de l'écran ComptoirHome (dashboard/scan) — les
                chiffres sont des valeurs démo, la hiérarchie est la vraie. */}
            <div className="flex w-[340px] flex-col gap-[22px] rounded-[36px] border border-line-warm bg-surface px-[22px] pb-[22px] pt-[26px] shadow-[0_30px_60px_-25px_rgba(14,15,17,0.3)]">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full font-display text-sm"
                  style={{ background: "#3E2C22", color: "var(--color-gold)" }}
                >
                  C
                </span>
                <span className="font-display text-base font-medium">Café du Marché</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pb-1 pt-2 text-center">
                {[
                  { n: "14", label: ["PASSAGES", "AUJOURD'HUI"], gold: false },
                  { n: "312", label: ["CARTES", "ACTIVES"], gold: false },
                  { n: "3", label: ["RÉCOMPENSES", "OFFERTES"], gold: true },
                ].map((kpi) => (
                  <div key={kpi.label.join(" ")}>
                    <p
                      className={`font-display text-[34px] leading-none ${
                        kpi.gold ? "text-gold-deep" : "text-onyx"
                      }`}
                    >
                      {kpi.n}
                    </p>
                    <p className="mt-1.5 text-[10.5px] tracking-[0.08em] text-galet-ink">
                      {kpi.label[0]}
                      <br />
                      {kpi.label[1]}
                    </p>
                  </div>
                ))}
              </div>
              <div
                aria-hidden
                className="flex h-[116px] items-center justify-center rounded-3xl bg-halo text-[22px] font-extrabold tracking-[-0.01em] text-white shadow-[0_14px_30px_-12px_rgba(13,107,94,0.5)]"
              >
                Scanner une carte
              </div>
              <p className="text-center text-[11px] text-galet-ink">● connecté — v1</p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="font-mono text-xs tracking-[0.22em] text-halo">LE COMPTOIR</p>
            <h2 className="mt-5 font-display text-4xl font-light leading-[1.08] tracking-[-0.02em] sm:text-[46px]">
              Pensé pour le coup de feu, pas pour la salle de réunion.
            </h2>
            <p className="mt-5 max-w-[50ch] leading-[1.65] text-galet-ink">
              Un écran, trois chiffres, un bouton. Vous scannez d&apos;une main pendant le rush de
              midi — les statistiques complètes attendent que vous ayez le temps. C&apos;est
              l&apos;écran que vos concurrents n&apos;osent pas montrer, parce qu&apos;ils
              n&apos;en ont pas.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------- TARIFS ---------------- */}
      <section id="tarifs" className="border-b border-line-warm px-6 py-[88px]">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <h2 className="font-display text-4xl font-light tracking-[-0.02em] sm:text-[46px]">
              Un prix clair, sans surprise.
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            {/* Le « inclus » dit UNE fois, pas répété ×3 dans les cartes. */}
            <div className="mb-10 mt-7 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-line-warm bg-surface px-6 py-[18px] text-sm">
              <span className="font-bold">Tout est toujours inclus :</span>
              <span className="text-galet-ink">
                carte à votre image · Apple &amp; Google Wallet · notifications push &amp;
                proximité · base clients &amp; stats · mise en service offerte.
              </span>
              <span className="font-semibold">Seul le nombre de cartes actives change.</span>
            </div>
          </Reveal>
          <PricingTiers tiers={PRICING} />
          <Reveal>
            <p className="mt-6 text-[13px] text-galet-ink">
              Sans engagement. Paiement annuel : 2 mois offerts. Plusieurs commerces : tarif sur
              demande. Carte active = au moins une activité sur 90 jours.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------- FAQ — liste à filets ---------------- */}
      <section id="faq" className="border-b border-line-warm px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <h2 className="font-display text-4xl font-light leading-[1.1] tracking-[-0.02em] sm:text-[46px]">
              Les vraies questions, sans détour.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div>
              {FAQ_ITEMS.map((item, i) => (
                <details
                  key={item.question}
                  className={`group border-t border-line-warm py-[18px] ${
                    i === FAQ_ITEMS.length - 1 ? "border-b" : ""
                  }`}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-onyx [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-galet-ink transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-galet-ink">{item.answer}</p>
                </details>
              ))}
              <p className="mt-8 text-sm text-galet-ink">
                Une question qui n&apos;est pas là ?{" "}
                <Link href="/demarrer" className="font-semibold text-halo hover:underline">
                  Posez-la nous — on vous montre votre carte au passage.
                </Link>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- FINAL CTA ---------------- */}
      <section className="px-6 py-[72px]">
        <Reveal className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-halo to-halo-600 px-6 py-[76px] text-center">
            {/* le moment doré (rationné) : lueur chaude de la récompense */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 h-[320px] w-[620px] max-w-[130%] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-40 blur-[100px]"
              style={{ background: "radial-gradient(circle, var(--color-gold), transparent 65%)" }}
            />
            <HaloSymbol size={52} ring="var(--color-gold)" className="relative mx-auto mb-8" />
            <h2 className="relative text-balance font-display text-4xl font-light tracking-[-0.02em] text-white sm:text-[52px]">
              On vous montre votre carte.{" "}
              <em className="italic text-gold-soft">Après, vous décidez.</em>
            </h2>
            <p className="relative mx-auto mt-[18px] max-w-[44ch] leading-relaxed text-white/80">
              Maquette offerte sous un jour ouvré. Sans engagement, sans carte bancaire.
            </p>
            <Link
              href="/demarrer"
              className="group relative mt-[34px] inline-flex items-center gap-2 rounded-full bg-white px-[34px] py-[17px] font-bold text-halo transition-all hover:bg-calcaire active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-halo-600"
            >
              Voir ma carte — offert
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
      </main>

      {/* ---------------- FOOTER ---------------- */}
      <SiteFooter />
    </div>
  );
}
