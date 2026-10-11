import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type MailBody = {
  to: string;
  subject: string;
  text: string;
  from?: string;
  /** Gmail / Outlook address used as SMTP user */
  email?: string;
  /** App password or SMTP password (sent from client session — demo only) */
  appPassword?: string;
  provider?: "gmail" | "outlook" | "smtp";
  smtpHost?: string;
  smtpPort?: number;
};

function transportFor(body: MailBody) {
  const user = body.email || body.from;
  const pass = body.appPassword;
  if (!user || !pass) {
    throw new Error("Connect your email first (address + app password)");
  }

  if (body.provider === "outlook") {
    return nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
  }

  if (body.provider === "smtp" && body.smtpHost) {
    return nodemailer.createTransport({
      host: body.smtpHost,
      port: body.smtpPort || 587,
      secure: false,
      auth: { user, pass },
    });
  }

  // default Gmail
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MailBody;
    if (!body.to || !body.subject || !body.text) {
      return NextResponse.json(
        { error: "to, subject, and text are required" },
        { status: 400 },
      );
    }

    const transporter = transportFor(body);
    const from = body.from || body.email;
    const info = await transporter.sendMail({
      from,
      to: body.to,
      subject: body.subject,
      text: body.text,
    });

    return NextResponse.json({
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "send failed";
    let hint = raw;
    if (/Invalid login|EAUTH|Username and Password not accepted/i.test(raw)) {
      hint =
        "Gmail rejected the password. Use a Google App Password (not your normal password), or use “Open in Gmail” instead — that sends from your browser session.";
    } else if (/connect|ETIMEDOUT|ENOTFOUND|ECONNREFUSED/i.test(raw)) {
      hint =
        "Could not reach the mail server. Check network, or use “Open in Gmail” (user-side, no SMTP).";
    }
    return NextResponse.json({ ok: false, error: hint }, { status: 500 });
  }
}
