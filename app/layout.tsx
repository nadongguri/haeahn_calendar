import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "haeahn_calendar",
  description: "회의실 예약 앱"
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
