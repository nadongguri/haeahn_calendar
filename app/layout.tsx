import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "haeahn_calendar",
  description: "Small-team meeting-room reservation app"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
