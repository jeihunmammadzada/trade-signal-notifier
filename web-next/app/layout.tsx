import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crypto Siqnal Paneli",
  description: "Next.js trading signal dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
