import type { Metadata } from "next";
import { Sora, Syne } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Signal Scout — reach out when something real happened",
  description:
    "Scout any SaaS company on EC2, pull evidence-backed drafts, send from your own inbox.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${sora.variable} antialiased`}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
