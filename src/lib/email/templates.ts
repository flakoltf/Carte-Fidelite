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

export function escapeHtml(s: string): string {
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

// ── Parcours self-service (Agent C) ─────────────────────────────────────────

function haloShell(inner: string): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#F3F0E9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0E0F11;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:10px;overflow:hidden;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid #E8E4DA;">
            <span style="font-size:14px;color:#6E7073;">HaloCard — Genève</span>
          </td></tr>
          <tr><td style="padding:32px;">${inner}</td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #E8E4DA;font-size:12px;color:#9B9DA0;">
            Une question ? Répondez simplement à cet email — c'est le fondateur qui lit. HaloCard · halocard.ch
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// Email de vérification d'adresse (inscription self-service). Le lien est
// généré côté serveur (jeton Supabase haché) — jamais de secret réutilisable.
export function signupVerificationEmail({ confirmUrl }: { confirmUrl: string }): RenderedEmail {
  const u = escapeHtml(confirmUrl);

  const html = haloShell(`
            <h1 style="margin:0 0 12px;font-size:20px;color:#0D6B5E;">Confirmez votre adresse — votre carte vous attend</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Bienvenue chez HaloCard. Un clic pour confirmer votre adresse, puis quelques minutes pour mettre votre carte de fidélité en ligne — sans carte bancaire.</p>
            <p style="margin:0 0 20px;">
              <a href="${u}" style="display:inline-block;background:#0D6B5E;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:14px;">Confirmer mon adresse</a>
            </p>
            <p style="margin:0;font-size:13px;color:#6E7073;line-height:1.5;">Ce lien est valable 24 heures et ne sert qu'une fois. Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email — rien ne sera créé.</p>`);

  const text = `Confirmez votre adresse — votre carte vous attend

Bienvenue chez HaloCard. Confirmez votre adresse pour mettre votre carte de fidélité en ligne (sans carte bancaire) :

${confirmUrl}

Ce lien est valable 24 heures et ne sert qu'une fois. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.

HaloCard · halocard.ch`;

  return { subject: "Confirmez votre adresse — HaloCard", html, text };
}

// Envoyé quand quelqu'un tente de s'inscrire avec une adresse déjà utilisée.
// La réponse HTTP reste indistincte (anti-énumération) ; le titulaire, lui,
// est informé et guidé vers la connexion. `loginUrl` peut être un lien de
// connexion en un clic (jeton haché à usage unique) ou, à défaut, /login.
export function signupExistingAccountEmail({ loginUrl }: { loginUrl?: string } = {}): RenderedEmail {
  const u = escapeHtml(loginUrl || "https://app.halocard.ch/login");

  const html = haloShell(`
            <h1 style="margin:0 0 12px;font-size:20px;color:#0D6B5E;">Vous avez déjà un compte HaloCard</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Quelqu'un — sans doute vous — vient de tenter de créer un compte avec cette adresse. Bonne nouvelle : il existe déjà.</p>
            <p style="margin:0 0 20px;">
              <a href="${u}" style="display:inline-block;background:#0D6B5E;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:14px;">Me connecter</a>
            </p>
            <p style="margin:0;font-size:13px;color:#6E7073;line-height:1.5;">Si ce n'était pas vous, vous n'avez rien à faire : votre compte reste protégé, votre mot de passe n'a pas changé et aucune information n'a été communiquée.</p>`);

  const text = `Vous avez déjà un compte HaloCard

Quelqu'un — sans doute vous — vient de tenter de créer un compte avec cette adresse. Il existe déjà : connectez-vous ici :

${loginUrl || "https://app.halocard.ch/login"}

Si ce n'était pas vous, vous n'avez rien à faire : votre compte reste protégé et votre mot de passe n'a pas changé.

HaloCard · halocard.ch`;

  return { subject: "Vous avez déjà un compte HaloCard", html, text };
}

// « Votre programme est en ligne » — fin du wizard self-service.
export function programLiveEmail({ shopName, enrollUrl }: { shopName: string; enrollUrl: string }): RenderedEmail {
  const s = escapeHtml(shopName);
  const u = escapeHtml(enrollUrl);

  const html = haloShell(`
            <h1 style="margin:0 0 12px;font-size:20px;color:#0D6B5E;">${s} : votre programme de fidélité est en ligne 🎉</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Vos clients peuvent dès maintenant ajouter votre carte à Apple Wallet ou Google Wallet — sans installer d'application.</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
              Page d'inscription de vos clients : <a href="${u}" style="color:#0D6B5E;">${u}</a><br/>
              Votre QR à imprimer : onglet <strong>« Ma carte »</strong> du tableau de bord.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.5;"><strong>La seule chose à faire cette semaine :</strong> proposer la carte à chaque encaissement. <em>« Vous avez notre carte de fidélité ? Elle va direct dans votre téléphone, ça prend 10 secondes. »</em></p>`);

  const text = `${shopName} : votre programme de fidélité est en ligne

Vos clients peuvent dès maintenant ajouter votre carte à Apple Wallet ou Google Wallet — sans installer d'application.

Page d'inscription de vos clients : ${enrollUrl}
Votre QR à imprimer : onglet « Ma carte » du tableau de bord (https://app.halocard.ch/dashboard/card).

La seule chose à faire cette semaine : proposer la carte à chaque encaissement. « Vous avez notre carte de fidélité ? Elle va direct dans votre téléphone, ça prend 10 secondes. »

HaloCard · halocard.ch`;

  return { subject: `${shopName} : votre programme de fidélité est en ligne`, html, text };
}

// « Votre carte est en ligne, notre équipe peaufine le design » — fin du
// parcours concierge (fork onboarding). Le QR fonctionne déjà ; on annonce la
// personnalisation sous 24 h ouvrées, mise à jour automatique côté clients.
export function conciergeLiveEmail({ shopName, enrollUrl }: { shopName: string; enrollUrl: string }): RenderedEmail {
  const s = escapeHtml(shopName);
  const u = escapeHtml(enrollUrl);

  const html = haloShell(`
            <h1 style="margin:0 0 12px;font-size:20px;color:#0D6B5E;">${s} : votre carte est en ligne 🎉</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Votre QR fonctionne dès maintenant : vos clients peuvent ajouter votre carte à Apple Wallet ou Google Wallet, sans installer d'application.</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
              Page d'inscription de vos clients : <a href="${u}" style="color:#0D6B5E;">${u}</a><br/>
              Votre QR à imprimer : onglet <strong>« Ma carte »</strong> du tableau de bord.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.5;"><strong>Et le design ?</strong> Notre équipe personnalise votre carte sous 24 h ouvrées. Les cartes déjà installées par vos clients se mettront à jour automatiquement — vous n'avez rien à faire.</p>`);

  const text = `${shopName} : votre carte est en ligne

Votre QR fonctionne dès maintenant : vos clients peuvent ajouter votre carte à Apple Wallet ou Google Wallet, sans installer d'application.

Page d'inscription de vos clients : ${enrollUrl}
Votre QR à imprimer : onglet « Ma carte » du tableau de bord (https://app.halocard.ch/dashboard/card).

Et le design ? Notre équipe personnalise votre carte sous 24 h ouvrées. Les cartes déjà installées par vos clients se mettront à jour automatiquement — vous n'avez rien à faire.

HaloCard · halocard.ch`;

  return { subject: `${shopName} : votre carte est en ligne — design en cours de personnalisation`, html, text };
}

// Notification interne — nouvelle entrée dans la file « cartes à personnaliser ».
export function conciergeQueueEmail({
  shopName,
  businessType,
  merchantId,
}: {
  shopName: string;
  businessType: string;
  merchantId: string;
}): RenderedEmail {
  const s = escapeHtml(shopName);
  const b = escapeHtml(businessType);
  const adminUrl = `https://app.halocard.ch/admin/concierge`;

  const html = haloShell(`
            <h1 style="margin:0 0 12px;font-size:20px;color:#0D6B5E;">Nouvelle carte à personnaliser : ${s}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Un marchand vient de choisir le parcours « HALO crée ma carte ». Sa carte provisoire (design par défaut) est déjà en ligne — objectif : livrer le design sur-mesure sous 24 h ouvrées.</p>
            <p style="margin:0;font-size:15px;line-height:1.7;">
              Commerce : <strong>${s}</strong> (${b})<br/>
              File de personnalisation : <a href="${adminUrl}" style="color:#0D6B5E;">${adminUrl}</a>
            </p>`);

  const text = `Nouvelle carte à personnaliser : ${shopName}

Un marchand vient de choisir le parcours « HALO crée ma carte ». Sa carte provisoire (design par défaut) est déjà en ligne — objectif : livrer le design sur-mesure sous 24 h ouvrées.

Commerce : ${shopName} (${businessType})
Marchand : ${merchantId}
File de personnalisation : ${adminUrl}

HaloCard · interne`;

  return { subject: `[Concierge] Carte à personnaliser — ${shopName}`, html, text };
}
