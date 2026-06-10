// FAQ de la landing — copy orientée objections marchand (terrain Genève).
// Donnée partagée : la section visible (HomeClient) et le JSON-LD FAQPage
// (page.tsx, server) lisent la même source. Pas de stat inventée : chaque
// affirmation est vérifiable ou formulée prudemment.

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "J'ai déjà une carte papier qui marche. Pourquoi changer ?",
    answer:
      "Parce que votre carte papier travaille à moitié. Quand elle est oubliée ou perdue, le client repart de zéro — et son envie de revenir avec. Et surtout, elle ne vous dit rien : vous ne savez ni qui revient, ni qui a disparu. La carte dans le téléphone est toujours là, toujours à jour, et vous pouvez envoyer un message à vos clients fidèles — chose impossible avec du carton. Vous gardez le même geste en caisse : on remplace le tampon, pas vos habitudes.",
  },
  {
    question: "Mes clients doivent-ils installer une application ?",
    answer:
      "Non, et c'est tout l'intérêt. La carte s'ajoute dans Apple Wallet ou Google Wallet, déjà présents sur leur téléphone. Un scan de votre QR en caisse, trois champs à remplir, et c'est fait — aucun téléchargement, aucun compte à créer, aucun mot de passe.",
  },
  {
    question: "Et mes clients plus âgés, ou ceux qui n'ont pas de smartphone ?",
    answer:
      "Gardez quelques cartes papier pour eux — rien ne vous en empêche, et c'est ce que font nos commerçants. HaloCard remplace la carte pour la grande majorité qui vit avec son téléphone ; pour les autres, votre bon sens fait le reste. Bonus : beaucoup de clients « pas technophiles » utilisent déjà leur Wallet sans le savoir, pour leur carte d'embarquement ou leurs billets.",
  },
  {
    question: "69 CHF par mois, c'est un vrai budget pour mon commerce.",
    answer:
      "C'est 2,30 CHF par jour — moins qu'un café. Si la carte fait revenir un seul client de plus tous les deux jours, elle est payée ; tout le reste est de la marge. Comparez aussi avec ce que coûte la version papier : impression, réimpressions, fraude au tampon, et zéro information sur vos clients. Ici, tout est inclus, sans engagement : si ça ne vous rapporte pas, vous arrêtez le mois suivant.",
  },
  {
    question: "Ça prend combien de temps en caisse ?",
    answer:
      "Le même geste qu'un coup de tampon : le client présente sa carte, vous scannez avec votre propre téléphone, c'est crédité. Quelques secondes, aucun terminal à acheter, aucun matériel à brancher.",
  },
  {
    question: "Et combien de temps pour démarrer ?",
    answer:
      "On fait tout avec vous, en personne : vous nous donnez votre logo, vos couleurs et votre règle (par exemple « 9 cafés = le 10e offert »), et on configure votre carte sur place. Vous repartez avec le QR à poser en caisse et votre premier scan déjà fait. Votre seule mission ensuite : proposer la carte à chaque encaissement.",
  },
  {
    question: "Les notifications, ce n'est pas du spam pour mes clients ?",
    answer:
      "C'est vous qui décidez de chaque envoi : une offre ponctuelle, un rappel aux clients qu'on n'a pas vus depuis un moment, un message quand ils passent dans le quartier. Un client qui supprime sa carte ne reçoit plus rien. Utilisée avec mesure, c'est la différence entre un client qui vous oublie et un client qui revient.",
  },
  {
    question: "Où vont les données de mes clients ? Et si j'arrête ?",
    answer:
      "Vos données clients restent les vôtres : si vous partez, vous récupérez votre fichier. Elles sont hébergées en Europe et traitées selon le droit suisse (nLPD) — avec un contrat de sous-traitance en bonne et due forme, signé avec chaque commerçant. HaloCard est une entreprise genevoise : votre interlocuteur a un prénom, pas un ticket.",
  },
];

// JSON-LD FAQPage (schema.org). NB : depuis 2023, Google réserve l'affichage
// enrichi FAQ à une poignée de sites — le balisage reste correct et sans
// risque, mais la vraie valeur de cette FAQ est sur la page, pas dans la SERP.
export function faqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
