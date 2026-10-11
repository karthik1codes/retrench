/** User-side mail tools — open the user's own Gmail / mail app with the draft. */

export function gmailComposeUrl(opts: {
  to: string;
  subject: string;
  body: string;
}): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: opts.to,
    su: opts.subject,
    body: opts.body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function mailtoUrl(opts: {
  to: string;
  subject: string;
  body: string;
}): string {
  const q = new URLSearchParams({
    subject: opts.subject,
    body: opts.body,
  });
  return `mailto:${encodeURIComponent(opts.to)}?${q.toString()}`;
}

export function outlookComposeUrl(opts: {
  to: string;
  subject: string;
  body: string;
}): string {
  const params = new URLSearchParams({
    path: "/mail/action/compose",
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
  });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}
