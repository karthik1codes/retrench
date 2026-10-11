export type MailSession = {
  provider: "gmail" | "outlook" | "smtp";
  email: string;
  appPassword: string;
  smtpHost?: string;
  smtpPort?: number;
  connectedAt: string;
};

const KEY = "signalscout.mail";

export function loadMailSession(): MailSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MailSession;
  } catch {
    return null;
  }
}

export function saveMailSession(session: MailSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearMailSession() {
  localStorage.removeItem(KEY);
}
