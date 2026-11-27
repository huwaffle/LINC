import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LINC — Lasallian Information Network and Community",
  description:
    "A centralized campus information and student engagement system for De La Salle Araneta University.",
};

/** `cover` lets safe-area insets reach the notch and home indicator on phones. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

const THEME_BOOT_SCRIPT = `(function(){try{var stored=localStorage.getItem("linc-theme");var dark=stored?stored==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(dark){document.documentElement.classList.add("dark");}document.documentElement.style.colorScheme=dark?"dark":"light";}catch(error){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
