"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  Smartphone,
  Palette,
  Bell,
  MapPin,
  BarChart3,
  Stamp,
  Coins,
  Crown,
  PiggyBank,
  CalendarCheck,
  HeartHandshake,
  QrCode,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { HaloSymbol, HaloWordmark } from "@/components/halo/HaloMark";
import { FAQ_ITEMS } from "@/content/faq";
import { LoyaltyCard, SAMPLE_CARDS, type CardData } from "@/components/landing/LoyaltyCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PricingTiers } from "./_components/PricingTiers";

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

const MECHANICS: { Icon: LucideIcon; title: string; desc: string; ex: string }[] = [
  { Icon: Stamp, title: "Tampons", desc: "X achats = 1 offert.", ex: "Café, boulangerie, coiffeur, pizzeria" },
  { Icon: Coins, title: "Points cumulés", desc: "Des points à chaque franc dépensé.", ex: "Restaurant, fleuriste, retail" },
  { Icon: Crown, title: "Paliers VIP", desc: "Bronze → Argent → Or, avantages croissants.", ex: "Boutique, concept-store" },
  { Icon: PiggyBank, title: "Cashback", desc: "Un % de la dépense rendu en cagnotte.", ex: "Institut beauté, spa" },
  { Icon: CalendarCheck, title: "Passages", desc: "Suivi d'assiduité et d'abonnement.", ex: "Salle de sport, studio" },
];

const STEPS: { Icon: LucideIcon; title: string; desc: string }[] = [
  { Icon: Palette, title: "Créez votre carte", desc: "Vos couleurs, votre logo, votre mécanique. Prête en quelques minutes, sans matériel." },
  { Icon: Smartphone, title: "Le client l'ajoute au Wallet", desc: "Un scan, et la carte vit dans Apple ou Google Wallet. Aucune appli à télécharger." },
  { Icon: HeartHandshake, title: "Vous fidélisez", desc: "Points, tampons et notifications font revenir vos clients — et vous voyez tout dans votre tableau de bord." },
];

const WHY: { Icon: LucideIcon; title: string; desc: string }[] = [
  { Icon: Smartphone, title: "Zéro appli", desc: "La carte vit dans le Wallet du téléphone. Le client l'ajoute en un scan." },
  { Icon: Palette, title: "À votre image", desc: "Vos couleurs, votre logo, votre nom. White-label complet." },
  { Icon: Bell, title: "Notifications push", desc: "Relancez un client inactif ou annoncez une offre, gratuitement." },
  { Icon: MapPin, title: "Notifications de proximité", desc: "Le client reçoit votre message quand il passe près de votre commerce." },
  { Icon: BarChart3, title: "Stats & tableau de bord", desc: "Comprenez et pilotez votre fidélisation, en temps réel." },
  { Icon: QrCode, title: "Scan en caisse", desc: "Validez un passage ou créditez des points d'un simple scan." },
];

// Toutes les fonctionnalités sont incluses dans chaque palier — seul le volume de clients actifs change.
const PLAN_FEATURES = [
  "Toutes les fonctionnalités incluses",
  "Carte 100% à votre image",
  "Apple & Google Wallet (sans appli)",
  "Notifications push & de proximité",
  "Base clients & statistiques",
  "Mise en service offerte",
];

const PRICING = [
  {
    name: "Essentiel",
    price: "69",
    unit: "CHF / mois",
    tagline: "Jusqu'à 200 cartes actives",
    featured: false,
    cta: "Choisir Essentiel",
    href: "/demarrer?plan=essentiel",
    features: PLAN_FEATURES,
  },
  {
    name: "Croissance",
    price: "129",
    unit: "CHF / mois",
    tagline: "Jusqu'à 750 cartes actives",
    featured: true,
    cta: "Choisir Croissance",
    href: "/demarrer?plan=croissance",
    features: PLAN_FEATURES,
  },
  {
    name: "Premium",
    price: "199",
    unit: "CHF / mois",
    tagline: "Jusqu'à 2 000 cartes actives",
    featured: false,
    cta: "Choisir Premium",
    href: "/demarrer?plan=premium",
    features: PLAN_FEATURES,
  },
];

/* Carte vedette du hero : le Café, mais en version compacte (sans la longue
   liste « showcase ») pour tenir proprement dans l'écran du téléphone. */
const HERO_CARD: CardData = {
  ...SAMPLE_CARDS[0],
  showcase: undefined,
  mechanic: { kind: "stamps", total: 9, filled: 6, label: "6 / 9 cafés" },
  reward: "Le 9ᵉ café offert.",
};

const NAV_LINKS: [href: string, label: string][] = [
  ["#fonctionnement", "Fonctionnement"],
  ["#mecaniques", "Mécaniques"],
  ["#galerie", "Exemples"],
  ["#tarifs", "Tarifs"],
  ["#faq", "FAQ"],
];

export default function HomeClient() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState("");
  const reduce = useReducedMotion();

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
              Créer ma carte
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
      {/* ---------------- HERO ---------------- */}
      <section className="relative px-6 pb-16 pt-36 sm:pt-44">
        <div
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[560px] w-[900px] max-w-[110vw] -translate-x-1/2 rounded-full opacity-[0.10] blur-[120px]"
          style={{ background: "radial-gradient(circle, var(--color-halo), transparent 62%)" }}
          aria-hidden
        />
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="mb-7 inline-block rounded-full border border-line-warm bg-surface px-4 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-halo">
              Cartes de fidélité numériques · Genève
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance font-display text-5xl font-light leading-[1.05] tracking-tight sm:text-7xl">
              La carte de fidélité numérique des grandes
              <br className="hidden sm:block" /> enseignes, <em className="italic text-halo">à votre image.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-7 max-w-xl text-lg text-galet-ink">
              Lancez votre carte de fidélité dans Apple &amp; Google Wallet — sans
              appli à télécharger. Tampons, points, paliers, cashback : prête en
              quelques minutes.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/demarrer"
                className="group inline-flex items-center gap-2 rounded-full bg-halo px-7 py-3.5 font-semibold text-white transition-all hover:bg-halo-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
              >
                Créer ma carte
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <a
                href="#galerie"
                className="rounded-full border border-line-warm px-7 py-3.5 font-medium text-onyx transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
              >
                Voir des exemples
              </a>
            </div>
          </Reveal>
        </div>

        {/* ---- hero showpiece : la carte dans le téléphone du client ---- */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="relative mx-auto mt-16 flex max-w-5xl justify-center sm:mt-20"
        >
          {/* lumière émeraude derrière le téléphone (sur fond clair) */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-[120px]"
            style={{ background: "radial-gradient(circle, var(--color-halo-glow), transparent 68%)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[46%] h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[80px]"
            style={{ background: "radial-gradient(circle, var(--color-halo), transparent 62%)" }}
          />

          {/* MOCKUP IPHONE */}
          <div className="halo-float relative">
            <div className="relative w-[262px] rounded-[3rem] bg-onyx p-2.5 shadow-[0_50px_90px_-35px_rgba(13,107,94,0.35),0_30px_60px_-25px_rgba(14,15,17,0.45)] ring-1 ring-black/10 [transform:rotate(-3deg)] sm:w-[300px]">
              {/* écran */}
              <div className="relative overflow-hidden rounded-[2.4rem] bg-gradient-to-b from-[#15161a] to-[#0d0e10] pb-7">
                {/* dynamic island */}
                <div className="absolute left-1/2 top-3 z-20 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
                {/* barre d'état */}
                <div className="flex items-center justify-between px-7 pb-1 pt-3.5 text-[12px] font-semibold text-white">
                  <span>9:41</span>
                  <span className="flex items-center gap-1.5 text-white" aria-hidden>
                    <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect y="7" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="6" rx="1" /><rect x="10" y="2.5" width="3" height="8.5" rx="1" /><rect x="15" width="3" height="11" rx="1" /></svg>
                    <svg width="16" height="11" viewBox="0 0 16 12" fill="currentColor"><path d="M8 9.4a1.3 1.3 0 100 2.6 1.3 1.3 0 000-2.6z" /><path d="M8 5.4c1.9 0 3.6.8 4.9 2.1l-1.5 1.4A4.7 4.7 0 008 7.4c-1.3 0-2.5.5-3.4 1.5L3.1 7.5A6.7 6.7 0 018 5.4z" opacity="0.85" /><path d="M8 1.4c3 0 5.8 1.2 7.7 3.3l-1.4 1.4A8.6 8.6 0 008 3.4 8.6 8.6 0 001.7 6.1L.3 4.7A10.6 10.6 0 018 1.4z" /></svg>
                    <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" opacity="0.45" /><rect x="2" y="2" width="17" height="8" rx="1.5" fill="currentColor" /><rect x="24" y="3.5" width="1.5" height="5" rx="0.75" fill="currentColor" opacity="0.6" /></svg>
                  </span>
                </div>
                {/* wallet */}
                <div className="px-3 pt-5">
                  <p className="mb-3 px-1 font-sans text-[17px] font-bold text-white">Cartes</p>
                  <LoyaltyCard card={HERO_CARD} />
                  {/* autres cartes « repliées » (pile Wallet) */}
                  <div className="mt-3.5">
                    {[SAMPLE_CARDS[1], SAMPLE_CARDS[2]].map((c, i) => {
                      const Icon = c.Icon;
                      return (
                        <div
                          key={c.name}
                          className={`flex items-center gap-2 rounded-t-[1.3rem] px-4 pb-4 pt-2.5 text-[11px] font-semibold text-white shadow-[0_-7px_18px_rgba(0,0,0,0.32)] ${i === 0 ? "" : "-mt-3"}`}
                          style={{ background: c.bg }}
                        >
                          <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                          {c.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* home indicator iOS */}
                <div className="mx-auto mt-4 h-[5px] w-[120px] rounded-full bg-white/35" aria-hidden />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="fonctionnement" className="border-t border-line-warm px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal className="max-w-2xl">
            <h2 className="text-balance font-display text-4xl font-light tracking-tight sm:text-5xl">
              Trois étapes, <em className="italic text-halo">zéro complexité.</em>
            </h2>
          </Reveal>
          <div className="relative mt-12 grid gap-10 sm:mt-14 sm:gap-8 md:grid-cols-3">
            {/* connecteur (desktop) */}
            <div aria-hidden className="absolute left-[12%] right-[12%] top-7 hidden border-t border-dashed border-line-warm md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08} className="relative">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-halo text-white shadow-[0_12px_26px_-10px_rgba(13,107,94,0.5)]">
                  <s.Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="mt-5 flex items-baseline gap-2.5">
                  <span className="font-display text-base text-halo">0{i + 1}</span>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                </div>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-galet-ink">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- MECHANICS ---------------- */}
      <section id="mecaniques" className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <h2 className="text-balance font-display text-4xl font-light tracking-tight sm:text-5xl">
              Cinq façons de <em className="italic text-halo">fidéliser.</em>
            </h2>
            <p className="mt-4 text-galet-ink">Choisissez celle qui colle à votre métier. Changez quand vous voulez.</p>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MECHANICS.map((m, i) => (
              <Reveal key={m.title} delay={i * 0.06}>
                <div className="h-full rounded-2xl border border-line-warm bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-halo/40 hover:shadow-md">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-halo text-white shadow-[0_10px_22px_-10px_rgba(13,107,94,0.55)]">
                    <m.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{m.title}</h3>
                  <p className="mt-1.5 text-sm text-galet-ink">{m.desc}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.12em] text-galet-deep">{m.ex}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- GALLERY (aperçu) ---------------- */}
      <section id="galerie" className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <h2 className="text-balance font-display text-4xl font-light tracking-tight sm:text-5xl">
              Chaque commerce, <em className="italic text-halo">sa carte.</em>
            </h2>
            <p className="mt-4 text-galet-ink">Vos couleurs, votre logo, votre mécanique. Trois exemples — il y en a pour chaque métier.</p>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[SAMPLE_CARDS[3], SAMPLE_CARDS[4], SAMPLE_CARDS[6]].map((c, i) => (
              <Reveal key={c.name} delay={i * 0.08}>
                <LoyaltyCard card={c} />
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1}>
            <div className="mt-10 flex justify-center">
              <Link
                href="/exemples"
                className="group inline-flex items-center gap-2 rounded-full border border-line-warm bg-surface px-6 py-3 font-medium text-onyx shadow-sm transition-all hover:-translate-y-0.5 hover:border-halo/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
              >
                Voir tous les exemples
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- WHY HALO ---------------- */}
      <section className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <h2 className="text-balance font-display text-4xl font-light tracking-tight sm:text-5xl">
              Tout ce qu&apos;il faut, <em className="italic text-halo">rien de superflu.</em>
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={(i % 3) * 0.06}>
                <div className="flex h-full gap-4 rounded-2xl border border-line-warm bg-surface p-6 shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-halo text-white shadow-[0_10px_22px_-10px_rgba(13,107,94,0.55)]">
                    <w.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-semibold">{w.title}</h3>
                    <p className="mt-1 text-sm text-galet-ink">{w.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- PRICING ---------------- */}
      <section id="tarifs" className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <h2 className="text-balance font-display text-4xl font-light tracking-tight sm:text-5xl">
              Un prix clair, <em className="italic text-halo">sans surprise.</em>
            </h2>
            <p className="mt-4 text-galet-ink">Sans matériel. Toutes les fonctionnalités dans chaque palier — le prix évolue simplement avec votre nombre de cartes actives.</p>
          </Reveal>
          <PricingTiers tiers={PRICING} />
          <Reveal>
            <p className="mt-8 text-center text-sm text-galet-ink">
              Sans engagement. Paiement annuel : <span className="text-onyx">2 mois offerts</span>.
              <br />
              Plusieurs commerces ? <span className="text-onyx">Tarif sur demande</span>, établi selon votre réseau de points de vente.
              <br />
              Une <span className="text-onyx">carte active</span> = une carte installée dans un wallet avec au moins une activité
              (installation, scan ou mise à jour) au cours des 90 derniers jours.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-balance font-display text-4xl font-light tracking-tight sm:text-5xl">
              Les vraies questions, <em className="italic text-halo">sans détour.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-12 divide-y divide-line-warm rounded-2xl border border-line-warm bg-surface">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question} className="group px-6 py-5 open:bg-halo/[0.03]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-onyx [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-galet-ink transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-galet-ink">{item.answer}</p>
                </details>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-8 text-center text-sm text-galet-ink">
              Une question qui n&apos;est pas là ?{" "}
              <Link href="/demarrer" className="font-semibold text-halo hover:underline">
                Posez-la nous — on vous montre votre carte au passage.
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------- FINAL CTA ---------------- */}
      <section className="border-t border-line-warm px-6 py-20 sm:py-24">
        <Reveal className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-halo to-halo-600 px-6 py-16 text-center sm:py-20">
            {/* le moment doré (rationné) : lueur chaude de la récompense */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 h-[320px] w-[620px] max-w-[130%] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-40 blur-[100px]"
              style={{ background: "radial-gradient(circle, var(--color-gold), transparent 65%)" }}
            />
            <HaloSymbol size={52} ring="var(--color-gold)" className="relative mx-auto mb-8" />
            <h2 className="relative text-balance font-display text-4xl font-light tracking-tight text-white sm:text-6xl">
              Et la vôtre, elle ressemblerait <em className="italic text-gold-soft">à quoi&nbsp;?</em>
            </h2>
            <p className="relative mx-auto mt-6 max-w-md text-white/80">
              Créez votre carte de fidélité numérique en quelques minutes. Sans engagement.
            </p>
            <Link
              href="/demarrer"
              className="group relative mt-9 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-halo transition-all hover:bg-calcaire active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-halo-600"
            >
              Créer ma carte
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
