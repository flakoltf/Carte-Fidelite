"use client";

import { useState } from "react";

export default function Home() {
  const [saveUrl, setSaveUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generatePass = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-google-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: "Test Xiaomi", currentStamps: 5 })
      });
      const data = await res.json();
      
      if (data.saveUrl) {
        setSaveUrl(data.saveUrl);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (e: any) {
      setError("Erreur de connexion au serveur");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4 font-sans">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold mb-2">Test Google Wallet</h1>
        <p className="text-zinc-400 mb-8 text-sm">Générez une vraie carte pour la tester sur votre téléphone.</p>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-6 w-full text-sm">
            {error}
          </div>
        )}

        {!saveUrl ? (
          <button 
            onClick={generatePass} 
            disabled={loading}
            className="w-full bg-white text-black hover:bg-gray-200 transition-colors font-semibold py-3 px-6 rounded-xl shadow-lg disabled:opacity-50"
          >
            {loading ? "Création du lien..." : "Générer ma carte"}
          </button>
        ) : (
          <div className="flex flex-col items-center w-full animate-in fade-in zoom-in duration-300">
            <p className="font-medium text-emerald-400 mb-6">✅ Lien généré avec succès !</p>
            
            <div className="bg-white p-4 rounded-2xl shadow-inner mb-6">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=svg&data=${encodeURIComponent(saveUrl)}`} 
                alt="QR Code Google Wallet" 
                className="w-48 h-48"
              />
            </div>
            
            <p className="text-sm text-zinc-400 mb-6">
              Ouvrez l'appareil photo de votre Xiaomi et scannez le code pour l'ajouter à Wallet.
            </p>

            <button 
              onClick={() => setSaveUrl("")}
              className="text-sm text-zinc-500 hover:text-white transition-colors underline"
            >
              Recommencer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
