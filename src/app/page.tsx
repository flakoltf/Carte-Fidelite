"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, ArrowRight, CheckCircle, Smartphone, Database, Globe, Zap, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        scrolled ? "bg-zinc-950/80 backdrop-blur-md border-zinc-900 py-4" : "bg-transparent border-transparent py-6"
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="text-emerald-400 w-6 h-6" />
            <span className="text-xl font-bold italic tracking-tighter">WalletCard</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <Link href="#features" className="hover:text-white transition-colors">Fonctionnalités</Link>
            <Link href="#how-it-works" className="hover:text-white transition-colors">Fonctionnement</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Tarifs</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-bold px-4 py-2 hover:text-emerald-400 transition-colors">Connexion</Link>
            <Link href="/signup" className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold hover:bg-zinc-200 transition-all active:scale-95">
              Démarrer
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-5xl mx-auto text-center">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8 inline-block">
                    L'avenir de la fidélité est là
                </span>
                <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-8 bg-gradient-to-b from-white via-white to-zinc-600 bg-clip-text text-transparent leading-[1.1]">
                    Fidélisez vos clients <br className="hidden md:block" /> 
                    en un clin d'œil.
                </h1>
                <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
                    Créez des cartes de fidélité numériques directement dans le **Apple & Google Wallet** de vos clients. Pas d'application à télécharger, pas de papier à jeter.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link 
                        href="/signup" 
                        className="w-full sm:w-auto bg-emerald-500 text-black px-8 py-5 rounded-2xl font-bold text-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                        Créer ma boutique gratutement
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link 
                        href="/demo" 
                        className="w-full sm:w-auto bg-zinc-900 border border-zinc-800 text-white px-8 py-5 rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                    >
                        Voir la démo
                    </Link>
                </div>
            </motion.div>

            {/* Platform Preview */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="mt-24 relative"
            >
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10" />
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-[40px] p-4 backdrop-blur-sm">
                    <img 
                        src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426&ixlib=rb-4.0.3" 
                        alt="Dashboard Preview" 
                        className="rounded-[32px] w-full h-auto shadow-2xl opacity-80"
                    />
                </div>
            </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-bold mb-6">Tout ce dont vous avez besoin.</h2>
                <p className="text-zinc-500 max-w-xl mx-auto">Une plateforme complète pour gérer vos clients et booster vos ventes.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {[
                    { title: "Universal", desc: "Compatible Apple Wallet & Google Wallet sur tous les smartphones.", icon: Globe },
                    { title: "Instantané", desc: "Générez un lien ou un QR code de carte en moins de 2 secondes.", icon: Zap },
                    { title: "Sécurisé", desc: "Données chiffrées et accès protégé pour chaque marchand.", icon: ShieldCheck },
                ].map((f, i) => (
                    <div key={i} className="bg-zinc-900/40 border border-zinc-800 p-10 rounded-[32px] hover:border-emerald-500/20 transition-all group">
                        <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                            <f.icon className="text-emerald-400 w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-bold mb-4">{f.title}</h3>
                        <p className="text-zinc-500 leading-relaxed">{f.desc}</p>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[48px] p-12 md:p-20 text-center text-black relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 blur-[80px] rounded-full translate-x-32 -translate-y-32" />
            <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">Rejoignez la révolution de la fidélité.</h2>
            <Link 
                href="/signup" 
                className="inline-flex items-center gap-2 bg-black text-white px-10 py-5 rounded-2xl font-bold text-xl hover:bg-zinc-900 transition-all active:scale-95 shadow-2xl"
            >
                C'est parti !
                <ArrowRight className="w-6 h-6" />
            </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-900 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
                <Wallet className="text-emerald-400 w-5 h-5" />
                <span className="font-bold italic">WalletCard</span>
            </div>
            <p className="text-zinc-600 text-sm">© 2026 LetaiefSolution. Tous droits réservés.</p>
            <div className="flex gap-6 text-sm text-zinc-500">
                <Link href="#" className="hover:text-white underline">Mentions Légales</Link>
                <Link href="#" className="hover:text-white underline">Confidentialité</Link>
            </div>
        </div>
      </footer>

    </div>
  );
}
