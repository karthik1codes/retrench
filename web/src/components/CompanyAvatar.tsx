"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignalScoutLogo } from "@/components/SignalScoutLogo";
import { cn } from "@/lib/utils";

function hostFromDomain(domain?: string | null) {
  if (!domain) return null;
  const host = domain.replace(/^https?:\/\//i, "").split("/")[0]?.trim();
  return host || null;
}

function isPlaceholderName(name?: string | null) {
  const n = (name || "").trim().toLowerCase();
  return (
    !n ||
    n === "none" ||
    n === "unknown" ||
    n === "matched company" ||
    n === "signal scout" ||
    n === "company"
  );
}

function initialsFrom(name?: string | null, domain?: string | null) {
  const source = (name || domain || "?").trim();
  if (isPlaceholderName(source) && !domain) return null;
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/** Prefer API logo, then clearbit, then high-res favicon. */
export function companyLogoCandidates(
  domain?: string | null,
  logoUrl?: string | null,
): string[] {
  const out: string[] = [];
  if (logoUrl && /^https?:\/\//i.test(logoUrl)) out.push(logoUrl);
  const host = hostFromDomain(domain);
  if (host) {
    out.push(`https://logo.clearbit.com/${encodeURIComponent(host)}`);
    out.push(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    );
    out.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`);
  }
  return [...new Set(out)];
}

type CompanyAvatarProps = {
  name?: string | null;
  domain?: string | null;
  logoUrl?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function CompanyAvatar({
  name,
  domain,
  logoUrl,
  size = "lg",
  className,
}: CompanyAvatarProps) {
  const candidates = useMemo(
    () => companyLogoCandidates(domain, logoUrl),
    [domain, logoUrl],
  );
  const [index, setIndex] = useState(0);
  const [exhausted, setExhausted] = useState(candidates.length === 0);
  useEffect(() => {
    setIndex(0);
    setExhausted(candidates.length === 0);
  }, [domain, logoUrl, candidates.length]);
  const src = !exhausted ? candidates[index] : undefined;
  const initials = initialsFrom(name, domain);
  const useBrandMark =
    exhausted && (isPlaceholderName(name) || !initials || !hostFromDomain(domain));

  const sizeClass =
    size === "lg" ? "size-12" : size === "sm" ? "size-8" : "size-10";
  const iconSize =
    size === "lg" ? "size-5" : size === "sm" ? "size-3.5" : "size-4";

  if (useBrandMark) {
    return (
      <SignalScoutLogo
        className={cn(sizeClass, "rounded-lg", className)}
        iconClassName={iconSize}
      />
    );
  }

  return (
    <Avatar
      size={size}
      className={cn(
        "rounded-lg after:rounded-lg",
        size === "lg" && "size-12",
        className,
      )}
    >
      {src ? (
        <AvatarImage
          src={src}
          alt={name ? `${name} logo` : "Company logo"}
          className="rounded-lg object-contain p-1"
          onError={() => {
            setIndex((i) => {
              if (i + 1 < candidates.length) return i + 1;
              setExhausted(true);
              return i;
            });
          }}
        />
      ) : null}
      <AvatarFallback className="rounded-lg text-sm font-medium">
        {initials || (
          <SignalScoutLogo
            className="size-full rounded-lg bg-transparent"
            iconClassName={iconSize}
          />
        )}
      </AvatarFallback>
    </Avatar>
  );
}
