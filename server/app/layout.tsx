import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://spwit.app"),
  title: "Spwit",
  description: "Split the tab, settle up.",
  applicationName: "Spwit",
  openGraph: {
    title: "Spwit",
    description: "Split the tab, settle up.",
    siteName: "Spwit",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spwit",
    description: "Split the tab, settle up.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
