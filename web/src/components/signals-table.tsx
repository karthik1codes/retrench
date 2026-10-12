"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OverviewSignal } from "@/lib/overview";
import { ButtonLink } from "@/components/ui/button-link";

export function SignalsTable({
  signals,
  error,
}: {
  signals: OverviewSignal[];
  error?: string;
}) {
  if (error && !signals.length) {
    return (
      <div className="mx-4 rounded-lg border border-border px-4 py-10 text-center text-sm text-muted-foreground sm:mx-6">
        {error}
      </div>
    );
  }

  if (!signals.length) {
    return (
      <div className="mx-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground sm:mx-6">
        No signals in the graph yet.{" "}
        <Link href="/scout" className="underline underline-offset-2">
          Run a scout
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-4 overflow-x-auto rounded-lg border border-border sm:mx-6">
      <Table className="min-w-[40rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Signal</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="text-end">Severity</TableHead>
            <TableHead className="text-end">Confidence</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {signals.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-medium">{row.company}</div>
                <div className="text-xs text-muted-foreground">{row.domain}</div>
              </TableCell>
              <TableCell>
                <div className="max-w-md">
                  <Badge variant="outline" className="mb-1">
                    {row.type}
                  </Badge>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {row.summary}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{row.state || "—"}</Badge>
              </TableCell>
              <TableCell className="text-end tabular-nums">{row.severity}</TableCell>
              <TableCell className="text-end tabular-nums">
                {row.confidence ?? "—"}
              </TableCell>
              <TableCell className="text-end">
                {row.domain ? (
                  <ButtonLink
                    href={`/scout?q=${encodeURIComponent(row.domain)}`}
                    size="sm"
                    variant="outline"
                  >
                    Scout
                  </ButtonLink>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
