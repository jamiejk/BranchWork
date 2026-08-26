import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Branchwork",
  description:
    "An open-source spatial writing and research environment. Nonlinear thinking upstream; linear writing downstream.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon-256.png", type: "image/png", sizes: "256x256" },
    ],
    apple: "/apple-touch-icon-precomposed.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
