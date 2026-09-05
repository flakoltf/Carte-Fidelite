import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function ClientsScreen() {
  return (
    <PlaceholderScreen
      testID="ecran-clients"
      eyebrow="Clients"
      title="Votre clientèle"
      description="Retrouvez vos habitués, leur progression et la date de leur dernière visite."
      soon={[
        "Recherche d'un client",
        "Progression et statut (bronze, argent, or)",
        "Dernière visite et récompenses en cours",
      ]}
    />
  );
}
