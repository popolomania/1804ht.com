/**
 * Mailer — thin Nodemailer wrapper.
 *
 * Configure via env vars:
 *   SMTP_HOST     e.g. smtp.gmail.com  (or smtp.sendgrid.net / smtp.mailgun.org)
 *   SMTP_PORT     465 (SSL) or 587 (TLS/STARTTLS)
 *   SMTP_SECURE   "true" for port 465, omit/false for 587
 *   SMTP_USER     your SMTP username / email
 *   SMTP_PASS     your SMTP password or app-specific password
 *   EMAIL_FROM    "1804ht.com <noreply@1804ht.com>"
 *   APP_URL       https://www.1804ht.com  (used to build the verify link)
 *
 * In development with no SMTP config, emails are printed to the console
 * instead of being sent (Ethereal transport preview).
 */

import nodemailer, { type Transporter } from "nodemailer";

let _transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (_transporter) return _transporter;

  if (process.env.SMTP_HOST) {
    // Production SMTP
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Dev fallback: Ethereal test account — logs preview URL to console
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log("[mailer] No SMTP_HOST configured — using Ethereal test account");
    console.log(`[mailer] Ethereal user: ${testAccount.user}`);
  }

  return _transporter;
}

// ── Sender address ────────────────────────────────────────────────────────────
function fromAddress() {
  return process.env.EMAIL_FROM ?? "1804ht.com <noreply@1804ht.com>";
}

// ── App base URL ─────────────────────────────────────────────────────────────
function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:5000").replace(/\/$/, "");
}

// ── Send verification email ───────────────────────────────────────────────────
export async function sendVerificationEmail(opts: {
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const transport = await getTransporter();
  const verifyUrl = `${appUrl()}/api/auth/verify/${opts.token}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0d9488;padding:28px 32px;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-.5px;">1804ht.com</p>
            <p style="margin:4px 0 0;color:#ccfbf1;font-size:13px;">L'immobilier haïtien en ligne</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">
              Bonjour ${opts.name} 👋
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Merci de vous être inscrit(e) en tant qu'<strong>Agent / Propriétaire</strong> sur 1804ht.com.
              Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background:#0d9488;border-radius:8px;">
                  <a href="${verifyUrl}"
                     style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">
                    ✅ Vérifier mon email
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
              Ce lien expire dans <strong>24 heures</strong>.
              Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
              Lien alternatif : <a href="${verifyUrl}" style="color:#0d9488;">${verifyUrl}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} 1804ht.com — L'immobilier haïtien en ligne
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const info = await transport.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: "Vérifiez votre adresse email — 1804ht.com",
    html,
    text: `Bonjour ${opts.name},\n\nConfirmez votre email en visitant ce lien :\n${verifyUrl}\n\nCe lien expire dans 24 heures.\n\n— 1804ht.com`,
  });

  // In dev, log the Ethereal preview URL
  if (!process.env.SMTP_HOST) {
    console.log(`[mailer] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
}

// ── Send already-verified notice (optional, informational) ────────────────────
export async function sendWelcomeEmail(opts: { to: string; name: string }): Promise<void> {
  const transport = await getTransporter();
  await transport.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: "Votre compte Agent est activé — 1804ht.com",
    text: `Bonjour ${opts.name},\n\nVotre email a été vérifié avec succès. Vous pouvez maintenant publier des annonces sur 1804ht.com.\n\nBonne chance !\n\n— 1804ht.com`,
    html: `<p>Bonjour <strong>${opts.name}</strong>,</p>
<p>Votre email a été vérifié avec succès. Vous pouvez maintenant <a href="${appUrl()}/#/list-property">publier des annonces</a> sur 1804ht.com.</p>
<p>— 1804ht.com</p>`,
  });
}
