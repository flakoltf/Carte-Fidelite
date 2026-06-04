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
