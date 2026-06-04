// =============================================================================
// Email sending — strategy pattern (Resend / console fallback)
// =============================================================================

import { config } from '../utils/config.js';

/** @type {EmailProvider} */
let provider;

async function getProvider() {
  if (provider) return provider;

  if (config.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    provider = new ResendProvider(new Resend(config.RESEND_API_KEY));
  } else {
    console.warn('[email] No RESEND_API_KEY — using console logger');
    provider = new ConsoleProvider();
  }
  return provider;
}

// ---------------------------------------------------------------------------
// Interface (duck-typed)
// ---------------------------------------------------------------------------
class ConsoleProvider {
  async send({ to, subject, text, html }) {
    console.log('[email:console]', { to, subject, textLength: text?.length, htmlLength: html?.length });
    return { id: `console_${Date.now()}` };
  }
}

class ResendProvider {
  #client;
  constructor(client) { this.#client = client; }

  async send({ to, subject, text, html }) {
    const { data, error } = await this.#client.emails.send({
      from: 'CodSpoke <hello@codspoke.tech>',
      to,
      subject,
      text,
      html,
    });
    if (error) throw error;
    return { id: data?.id };
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export async function sendVerificationEmail({ to, token }) {
  const link = `${config.FRONTEND_URL}/verify?token=${token}`;
  const prov = await getProvider();

  return prov.send({
    to,
    subject: 'Verify your CodSpoke account',
    text: `Click the link to verify your email: ${link}\n\nThis link expires in 1 hour.`,
    html: `<p>Click <a href="${link}">here</a> to verify your CodSpoke account.</p><p>This link expires in 1 hour.</p>`,
  });
}

export async function sendPasswordResetEmail({ to, token }) {
  const link = `${config.FRONTEND_URL}/reset-password?token=${token}`;
  const prov = await getProvider();

  return prov.send({
    to,
    subject: 'Reset your CodSpoke password',
    text: `Click the link to reset your password: ${link}\n\nThis link expires in 1 hour.`,
    html: `<p>Click <a href="${link}">here</a> to reset your CodSpoke password.</p><p>This link expires in 1 hour.</p>`,
  });
}

export async function sendTrialEndingEmail({ to }) {
  const prov = await getProvider();
  return prov.send({
    to,
    subject: 'Your CodSpoke trial ends soon',
    text: 'Your 24-hour trial is almost over. Subscribe to keep your projects and continue building.',
    html: '<p>Your 24-hour trial is almost over. <a href="https://codespoke.tech/pricing">Subscribe now</a> to keep your projects.</p>',
  });
}
