import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

/**
 * Display face for the film itself. The chrome never uses it — it exists so the
 * preview has real typographic character, and so the eventual Remotion renderer
 * resolves the same face the browser does.
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
