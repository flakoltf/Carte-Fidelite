import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function ComptoirScreen() {
  return (
    <PlaceholderScreen
      testID="ecran-comptoir"
      eyebrow="Comptoir"
      title="Scanner une carte"
      description="C'est ici que vous créditerez un tampon, des points ou une visite, en scannant le QR code du client."
      soon={[
        "Scan du QR code client",
        "Crédit d'un tampon ou de points",
        "Confirmation immédiate et historique du jour",
      ]}
    />
  );
}
