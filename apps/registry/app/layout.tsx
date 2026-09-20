import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jev Traps Registry",
  description: "Open intelligence on web content designed to manipulate AI agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Extensions (e.g. Scribe) may inject attributes on <html> before hydration.
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
