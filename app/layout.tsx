import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXIS",
  description: "Privates Finanz- und AI-Dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AXIS",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="bg-bg text-ink antialiased">
        {/* Reine Handy-PWA: immer im Phone-Format, egal auf welchem Gerät/Fenster
            geöffnet - kein responsives Desktop-Layout. */}
        <div className="max-w-[430px] mx-auto min-h-dvh bg-bg relative md:shadow-[0_0_60px_rgba(0,0,0,0.08)]">
          {children}
        </div>
        <RegisterSW />
      </body>
    </html>
  );
}
