import type { Metadata } from "next";
import "./globals.css";
import "./experience.css";
export const metadata: Metadata = {
  title: "Nile — the next life of coffee",
  description:
    "A coffee waste-to-value workspace for compatible matches, clear economics and confirmed handovers.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
