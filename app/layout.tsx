import type { Metadata } from "next";
import { Manrope, Instrument_Serif } from "next/font/google";
import "./globals.css";

/**
 * Manrope is the system's single voice — 400/500/600/650/700/750 per the
 * adoption checklist. No second UI face.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/**
 * Display face for the FILM ONLY.
 *
 * The system prohibits display-serif fonts in product UI, and none is used
 * there. This face never touches the chrome: it belongs to the artefact the
 * user is authoring, the same way an uploaded photo would. Loaded here so the
 * browser preview and the server render resolve the same file.
 */
const instrument = Instrument_Serif({
  variable: "--film-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "PrismLaunch",
  description:
    "An agent-native launch-video studio for software. You direct; your agent turns the product you built into the film that launches it.",
};

/**
 * `data-theme` is set before paint by an inline script so the first frame is
 * already correct — a theme flash is a visual bug, and the system requires the
 * user's choice to persist.
 */
const THEME_INIT = `
try {
  var stored = localStorage.getItem("prism-theme");
  var system = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = stored || system;
} catch (e) {
  document.documentElement.dataset.theme = "light";
}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${manrope.variable} ${instrument.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      {/*
        Browser extensions — Grammarly, most often — stamp attributes onto
        <body> before React hydrates, and React would otherwise report the
        mismatch on every load. Suppressed on this element only.
      */}
      <body className="h-full" suppressHydrationWarning>
        <a className="skip-link" href="#studio">
          Skip to the studio
        </a>
        {children}
      </body>
    </html>
  );
}
