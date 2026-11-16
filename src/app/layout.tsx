import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const font = Public_Sans({ subsets: ["latin"], variable: "--font-public" });

export const metadata: Metadata = {
  title: { default: "Tracker", template: "%s · Tracker" },
  description: "Attendance and timesheets. A product by Capslock Studio.",
};

// Applied before the first paint so dark-mode users never see a white flash.
const themeScript = `
(function () {
  try {
    var key = "tracker-theme";
    var stored = localStorage.getItem(key);
    var dark = stored === "dark" || (stored !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
