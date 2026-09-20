import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jev Traps Registry",
  description: "Open intelligence on web content designed to manipulate AI agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
