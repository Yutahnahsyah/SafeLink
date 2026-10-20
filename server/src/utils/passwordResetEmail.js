const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function createPasswordResetUrl({ frontendUrl = process.env.CLIENT_URL, environment = process.env.NODE_ENV, token }) {
  // Production email links must have an explicitly configured frontend destination.
  if (!frontendUrl && environment === 'production') throw new Error('Password reset frontend URL is not configured.');
  const base = new URL(frontendUrl || 'http://localhost:5173');
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Password reset frontend URL is invalid.');
  }
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/reset-password`;
  base.searchParams.set('token', token);
  return base.toString();
}

function passwordResetEmail({ firstName, resetUrl }) {
  const name = String(firstName || 'there');
  const subject = 'SafeLink — Reset Your Password';
  const message = 'We received a request to reset the password for your SafeLink account.';
  const instruction = 'Click the button below to create a new password. For your security, this link expires in 15 minutes.';
  const notice = "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.";
  const footer = 'SafeLink — Connecting Communities. Strengthening Safety.';
  return {
    subject,
    text: `SAFELINK\n\nReset your SafeLink password\n\nHello, ${name}!\n\n${message}\n\n${instruction}\n\nReset My Password:\n${resetUrl}\n\n${notice}\n\n${footer}`,
    // Presentation tables and inline styles keep the activation email's visual
    // language readable in Gmail, mobile clients, and Outlook's Word renderer.
    // Rounded corners gracefully fall back to square corners in classic Outlook.
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f7f8;color:#17324d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f7f8" style="width:100%;background:#f3f7f8;">
    <tr><td align="center" style="padding:32px 12px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dbe7ea;border-radius:18px;">
        <tr><td style="padding:32px 24px;">
          <p style="margin:0 0 12px;color:#087d85;font-size:13px;font-weight:700;letter-spacing:1.2px;">SAFELINK</p>
          <h1 style="margin:0 0 24px;color:#102f4f;font-size:26px;line-height:34px;font-weight:700;">Reset your SafeLink password</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:25px;">Hello, ${escapeHtml(name)}!</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:25px;">${message}</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:25px;">${instruction}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
            <tr><td align="center" bgcolor="#087d85" style="background:#087d85;border-radius:10px;mso-padding-alt:14px 24px;">
              <a href="${escapeHtml(resetUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:16px;line-height:22px;font-weight:700;text-decoration:none;border-radius:10px;mso-padding-alt:0;">Reset My Password</a>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;color:#587086;font-size:14px;line-height:22px;">${escapeHtml(notice)}</p>
          <p style="margin:0;padding-top:20px;border-top:1px solid #dbe7ea;color:#587086;font-size:12px;line-height:20px;">${footer}</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`,
  };
}

module.exports = { createPasswordResetUrl, passwordResetEmail };
