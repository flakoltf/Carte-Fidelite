// Templates d'email transactionnel. Fonctions pures (testables sans réseau).
// Le contenu (titre/corps/nom marchand) vient d'une saisie marchand : on échappe
// systématiquement le HTML pour éviter toute injection.

export interface NotificationEmailInput {
  title: string;
  body: string;
  merchantName: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function notificationEmail({ title, body, merchantName }: NotificationEmailInput): RenderedEmail {
  const t = escapeHtml(title);
  const b = escapeHtml(body);
  const m = escapeHtml(merchantName);

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#F3F0E9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0E0F11;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:10px;overflow:hidden;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid #E8E4DA;">
            <span style="font-size:14px;color:#6E7073;">${m}</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:20px;color:#0D6B5E;">${t}</h1>
            <p style="margin:0;font-size:15px;line-height:1.5;">${b}</p>
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #E8E4DA;font-size:12px;color:#9B9DA0;">
            Vous recevez cet email car vous êtes membre du programme de fidélité de ${m}.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `${body}\n\n— ${merchantName}\nVous recevez cet email car vous êtes membre du programme de fidélité de ${merchantName}.`;

  return { subject: title, html, text };
}

export interface MerchantWelcomeInput {
  shopName: string;
  email: string;
  tempPassword: string;
}

// Email A1 de bienvenue marchand (séquence onboarding — crm/Sequences_Email_Marchands.md).
// Envoyé par HaloCard (pas de fromName modèle B) à la création du compte concierge.
export function merchantWelcomeEmail({ shopName, email, tempPassword }: MerchantWelcomeInput): RenderedEmail {
  const s = escapeHtml(shopName);
  const e = escapeHtml(email);
  const p = escapeHtml(tempPassword);

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#F3F0E9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0E0F11;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:10px;overflow:hidden;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid #E8E4DA;">
            <span style="font-size:14px;color:#6E7073;">HaloCard — Genève</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:20px;color:#0D6B5E;">Bienvenue chez HaloCard — vos accès pour ${s}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Votre carte de fidélité numérique est prête. Vos clients peuvent dès maintenant l'ajouter à Apple Wallet ou Google Wallet en scannant le QR posé à votre caisse — sans installer aucune application.</p>
            <p style="margin:0 0 6px;font-size:15px;"><strong>Vos accès :</strong></p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
              Tableau de bord : <a href="https://app.halocard.ch/login" style="color:#0D6B5E;">app.halocard.ch/login</a><br/>
              Identifiant : <strong>${e}</strong><br/>
              Mot de passe temporaire : <strong>${p}</strong><br/>
              <span style="font-size:13px;color:#6E7073;">(changez-le à votre première connexion : Tableau de bord → Sécurité)</span>
            </p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Votre QR d'inscription client est dans l'onglet <strong>« Ma carte »</strong> du tableau de bord — imprimez-le et posez-le en caisse, à hauteur des yeux.</p>
            <p style="margin:0;font-size:15px;line-height:1.5;"><strong>La seule chose à faire cette semaine :</strong> proposer la carte à chaque encaissement. Une phrase suffit : <em>« Vous avez notre carte de fidélité ? Elle va direct dans votre téléphone, ça prend 10 secondes. »</em></p>
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #E8E4DA;font-size:12px;color:#9B9DA0;">
            Une question ? Répondez simplement à cet email — c'est le fondateur qui lit. HaloCard · halocard.ch
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `Bienvenue chez HaloCard — vos accès pour ${shopName}

Votre carte de fidélité numérique est prête. Vos clients peuvent l'ajouter à Apple Wallet ou Google Wallet en scannant le QR posé à votre caisse.

Vos accès :
- Tableau de bord : https://app.halocard.ch/login
- Identifiant : ${email}
- Mot de passe temporaire : ${tempPassword} (changez-le à votre première connexion : Tableau de bord -> Sécurité)

Votre QR d'inscription client est dans l'onglet « Ma carte » du tableau de bord.

La seule chose à faire cette semaine : proposer la carte à chaque encaissement. « Vous avez notre carte de fidélité ? Elle va direct dans votre téléphone, ça prend 10 secondes. »

Une question ? Répondez à cet email. HaloCard · halocard.ch`;

  return { subject: `Bienvenue chez HaloCard — vos accès pour ${shopName}`, html, text };
}
