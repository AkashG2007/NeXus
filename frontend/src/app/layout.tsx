import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "TRINETRA OS — Tactical Digital Twin",
  description: "Real-time 3D mobility intelligence and ITS command center for Indian Metro corridors",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-[#05070A]">
        {children}
      </body>
    </html>
  );
}
