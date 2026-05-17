import {
  Space_Grotesk as FontSans,
  JetBrains_Mono as FontMono,
} from "next/font/google";
import localFont from "next/font/local";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const fontDisplay = localFont({
  src: [
    { path: "../public/fonts/integral-bold.woff2", weight: "700" },
    { path: "../public/fonts/integral-demibold.woff2", weight: "600" },
  ],
  variable: "--font-display",
  display: "swap",
});
