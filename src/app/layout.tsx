import { Metadata, Viewport } from "next";
import "../../styles/global.css";

export const metadata: Metadata = {
  title: "Remotion rendering on Vercel Sandbox",
  description: "Remotion rendering on Vercel Sandbox",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/vfa5uyg.css" />
      </head>
      <body className="bg-background">{children}</body>
    </html>
  );
}
