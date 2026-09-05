import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function MessagesScreen() {
  return (
    <PlaceholderScreen
      testID="ecran-messages"
      eyebrow="Messages"
      title="Relancer vos clients"
      description="Envoyez une notification dans le Wallet de vos clients : une offre, une nouveauté, un rappel."
      soon={[
        "Envoi d'un message à un segment",
        "Historique des envois",
        "Taux d'ouverture et de retour",
      ]}
    />
  );
}
