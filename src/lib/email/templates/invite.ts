import { sendEmail } from "@/lib/email/send";

export async function sendMerchantInviteEmail(params: {
  to: string;
  shopName: string;
  actionLink: string; // lien sécurisé Supabase (definir-mot-de-passe)
}): Promise<void> {
  const { to, shopName, actionLink } = params;
  const subject = "Bienvenue sur HaloCard — activez votre compte";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h1 style="color:#0D6B5E">Bienvenue sur HaloCard 🎉</h1>
      <p>Votre abonnement pour <strong>${shopName}</strong> est actif.</p>
      <p>Cliquez ci-dessous pour <strong>activer votre compte</strong> et définir votre mot de passe :</p>
      <p><a href="${actionLink}"
            style="display:inline-block;background:#0D6B5E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
            Activer mon compte</a></p>
      <p style="color:#888;font-size:13px">Ce lien est personnel et à usage unique. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    </div>`;
  await sendEmail({ to, subject, html });
}
