import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Analytica — product sample",
  description: "Clickable product sample for performance marketers (fictional data).",
};

// P3-04: edge-to-edge on notched phones so the sticky action bar can sit in
// the safe area.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#070b12] text-slate-100">
        <Shell />
      </body>
    </html>
  );
}
