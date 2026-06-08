import { redirect } from "next/navigation";

// Inscription publique désactivée : les comptes marchands sont créés par l'admin
// depuis /admin/merchants. On redirige toute visite vers la connexion.
export default function SignupPage() {
  redirect("/login");
}
