import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const font = Public_Sans({ subsets: ["latin"], variable: "--font-public" });

export const metadata: Metadata = { title: "Timesheet", description: "Employee timesheet and attendance" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
