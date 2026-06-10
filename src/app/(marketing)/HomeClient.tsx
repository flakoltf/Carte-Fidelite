"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
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
  Quote,
  type LucideIcon,
} from "lucide-react";
import { HaloSymbol, HaloWordmark } from "@/components/halo/HaloMark";
import { LoyaltyCard, SAMPLE_CARDS } from "@/components/landing/LoyaltyCard";
import { SiteFooter } from "@/components/site/SiteFooter";

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

const TESTIMONIALS = [
  { quote: "Mes clients adorent — plus de carte en carton perdue. Le taux de retour a clairement augmenté.", name: "Camille R.", role: "Café, Genève" },
  { quote: "Mis en place en un après-midi, sans rien installer. Les notifications de proximité ramènent du monde le midi.", name: "Marco T.", role: "Pizzeria, Carouge" },
  { quote: "Enfin une carte de fidélité aussi soignée que ma boutique. Image au top.", name: "Sophie L.", role: "Boutique mode, Genève" },
];

export default function HomeClient() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-dvh bg-calcaire font-sans text-onyx selection:bg-halo/40 overflow-x-hidden">
      {/* ---------------- NAV ---------------- */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-line-warm bg-calcaire/80 py-3 backdrop-blur-md"
            : "border-transparent bg-transparent py-5"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link href="/" aria-label="HALO — accueil">
            <HaloWordmark className="text-lg" />
          </Link>
          <div className="hidden items-center gap-8 text-sm text-galet-ink md:flex">
            <a href="#fonctionnement" className="transition-colors hover:text-onyx">Fonctionnement</a>
            <a href="#mecaniques" className="transition-colors hover:text-onyx">Mécaniques</a>
            <a href="#galerie" className="transition-colors hover:text-onyx">Exemples</a>
            <a href="#tarifs" className="transition-colors hover:text-onyx">Tarifs</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-galet-ink transition-colors hover:text-onyx focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
            >
              Connexion
            </Link>
            <Link
              href="/demarrer"
              className="rounded-full bg-halo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-halo-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
            >
              Créer ma carte
            </Link>
          </div>
        </div>
      </nav>

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
            <h1 className="font-display text-5xl font-light leading-[1.05] tracking-tight sm:text-7xl">
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

        {/* hero card teaser */}
        <Reveal delay={0.2} className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_CARDS.slice(0, 3).map((c, i) => (
            <LoyaltyCard key={c.name} card={c} delay={i} />
          ))}
        </Reveal>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="fonctionnement" className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-galet-ink">Fonctionnement</p>
            <h2 className="mt-4 font-display text-4xl font-light tracking-tight sm:text-5xl">
              Trois étapes, <em className="italic text-halo">zéro complexité.</em>
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="flex h-full flex-col rounded-2xl border border-line-warm bg-surface p-7">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-halo/15 text-halo">
                      <s.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="font-display text-2xl text-galet-ink">0{i + 1}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-galet-ink">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- MECHANICS ---------------- */}
      <section id="mecaniques" className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-galet-ink">Les mécaniques</p>
            <h2 className="mt-4 font-display text-4xl font-light tracking-tight sm:text-5xl">
              Cinq façons de <em className="italic text-halo">fidéliser.</em>
            </h2>
            <p className="mt-4 text-galet-ink">Choisissez celle qui colle à votre métier. Changez quand vous voulez.</p>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MECHANICS.map((m, i) => (
              <Reveal key={m.title} delay={i * 0.06}>
                <div className="h-full rounded-2xl border border-line-warm bg-surface p-6 transition-colors hover:border-halo/40">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-halo/15 text-halo">
                    <m.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{m.title}</h3>
                  <p className="mt-1.5 text-sm text-galet-ink">{m.desc}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.12em] text-galet-ink/70">{m.ex}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- GALLERY ---------------- */}
      <section id="galerie" className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-galet-ink">Les exemples</p>
            <h2 className="mt-4 font-display text-4xl font-light tracking-tight sm:text-5xl">
              Chaque commerce, <em className="italic text-halo">sa carte.</em>
            </h2>
            <p className="mt-4 text-galet-ink">Trouvez votre métier — ou inspirez-vous d&apos;un voisin. Tout est personnalisable.</p>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_CARDS.map((c, i) => (
              <Reveal key={c.name} delay={(i % 3) * 0.06}>
                <LoyaltyCard card={c} delay={i} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- WHY HALO ---------------- */}
      <section className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-galet-ink">Pourquoi HALO</p>
            <h2 className="mt-4 font-display text-4xl font-light tracking-tight sm:text-5xl">
              Tout ce qu&apos;il faut, <em className="italic text-halo">rien de superflu.</em>
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={(i % 3) * 0.06}>
                <div className="flex h-full gap-4 rounded-2xl border border-line-warm bg-surface p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-halo/15 text-halo">
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

      {/* ---------------- TESTIMONIALS ---------------- */}
      <section className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-galet-ink">Ils utilisent HALO</p>
            <h2 className="mt-4 font-display text-4xl font-light tracking-tight sm:text-5xl">
              Des commerçants <em className="italic text-halo">convaincus.</em>
            </h2>
            <p className="mt-3 text-xs text-galet-ink/60">Témoignages illustratifs — à remplacer par de vrais avis.</p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.08}>
                <figure className="flex h-full flex-col rounded-2xl border border-line-warm bg-surface p-7">
                  <Quote className="h-6 w-6 text-halo" aria-hidden />
                  <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-onyx/90">
                    « {t.quote} »
                  </blockquote>
                  <figcaption className="mt-5 text-sm">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-galet-ink"> — {t.role}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- PRICING ---------------- */}
      <section id="tarifs" className="border-t border-line-warm px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-galet-ink">Tarifs</p>
            <h2 className="mt-4 font-display text-4xl font-light tracking-tight sm:text-5xl">
              Un prix clair, <em className="italic text-halo">sans surprise.</em>
            </h2>
            <p className="mt-4 text-galet-ink">Sans matériel. Toutes les fonctionnalités dans chaque palier — le prix évolue simplement avec votre nombre de cartes actives.</p>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRICING.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <div
                  className={`flex h-full flex-col rounded-2xl border p-8 ${
                    p.featured
                      ? "border-halo/40 bg-halo/[0.06] shadow-[0_16px_50px_-20px_rgba(13,107,94,0.35)]"
                      : "border-line-warm bg-surface shadow-sm"
                  }`}
                >
                  {p.featured && (
                    <span className="mb-4 inline-block w-fit rounded-full bg-halo px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                      Le plus populaire
                    </span>
                  )}
                  <h3 className="font-display text-2xl">{p.name}</h3>
                  <p className="mt-1 text-sm text-galet-ink">{p.tagline}</p>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-light">{p.price}</span>
                    {p.unit && <span className="text-sm text-galet-ink">{p.unit}</span>}
                  </div>
                  <ul className="mt-7 flex-1 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-onyx/90">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-halo" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={p.href}
                    className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo ${
                      p.featured
                        ? "bg-halo text-white hover:bg-halo-600"
                        : "border border-line-warm text-onyx hover:bg-calcaire"
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
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

      {/* ---------------- FINAL CTA ---------------- */}
      <section className="border-t border-line-warm px-6 py-28">
        <Reveal className="mx-auto max-w-3xl text-center">
          <HaloSymbol size={48} ring="var(--color-halo)" className="mx-auto mb-8" />
          <h2 className="font-display text-4xl font-light tracking-tight sm:text-6xl">
            Et la vôtre, elle ressemblerait <em className="italic text-halo">à quoi&nbsp;?</em>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-galet-ink">
            Créez votre carte de fidélité numérique en quelques minutes. Sans engagement.
          </p>
          <Link
            href="/demarrer"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-halo px-8 py-4 font-semibold text-white transition-all hover:bg-halo-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
          >
            Créer ma carte
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </Reveal>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <SiteFooter />
    </div>
  );
}
