"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearMailSession,
  loadMailSession,
  saveMailSession,
  type MailSession,
} from "@/lib/mail-session";
import { toast } from "sonner";

export function ConnectMailDialog({
  onChange,
}: {
  onChange?: (session: MailSession | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<MailSession | null>(null);
  const [provider, setProvider] = useState<MailSession["provider"]>("gmail");
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState("");

  useEffect(() => {
    const s = loadMailSession();
    setSession(s);
    if (s) {
      setProvider(s.provider);
      setEmail(s.email);
      setSmtpHost(s.smtpHost || "");
    }
    onChange?.(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  function connect() {
    if (!email.trim() || !appPassword.trim()) {
      toast.error("Email and app password required");
      return;
    }
    const next: MailSession = {
      provider,
      email: email.trim(),
      appPassword: appPassword.trim(),
      smtpHost: provider === "smtp" ? smtpHost.trim() : undefined,
      smtpPort: provider === "smtp" ? 587 : undefined,
      connectedAt: new Date().toISOString(),
    };
    saveMailSession(next);
    setSession(next);
    onChange?.(next);
    setAppPassword("");
    setOpen(false);
    toast.success(`Connected ${next.email}`);
  }

  function disconnect() {
    clearMailSession();
    setSession(null);
    onChange?.(null);
    toast.message("Email disconnected");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={session ? "secondary" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {session ? `Mail · ${session.email}` : "Connect email"}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect your mail</DialogTitle>
          <DialogDescription>
            Use a Gmail / Outlook app password so you can send drafts yourself.
            Credentials stay in this browser only.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as MailSession["provider"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="outlook">Outlook</SelectItem>
                <SelectItem value="smtp">Custom SMTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mail-email">Email</Label>
            <Input
              id="mail-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mail-pass">App password</Label>
            <Input
              id="mail-pass"
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="16-character app password"
            />
          </div>
          {provider === "smtp" ? (
            <div className="grid gap-2">
              <Label htmlFor="smtp-host">SMTP host</Label>
              <Input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {session ? (
            <Button type="button" variant="ghost" onClick={disconnect}>
              Disconnect
            </Button>
          ) : null}
          <Button type="button" onClick={connect}>
            Save connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
