import type { Metadata } from "next";
import { Figtree, Geist_Mono, Noto_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-noto-serif",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Signal Scout",
    template: "%s · Signal Scout",
  },
  description:
    "The signal graph for your outreach — funding, hiring, and exec moves, drafted for you to send.",
  icons: {
    icon: [{ url: "/brand/signal-scout-mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/signal-scout-oauth-logo.jpg" }],
    shortcut: ["/brand/signal-scout-mark.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`dark ${figtree.variable} ${notoSerif.variable} ${geistMono.variable}`}
    >
      <body className="min-h-[100svh] font-sans antialiased">
        <DirectionProvider direction="ltr">
          <TooltipProvider>
            <Providers>
              {children}
              <Toaster richColors position="top-center" closeButton />
            </Providers>
          </TooltipProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
