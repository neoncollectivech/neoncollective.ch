import "@/styles/globals.css";
import { Viewport } from "next";
import clsx from "clsx";

import { fontSans, fontMono, fontDisplay } from "@/config/fonts";

export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning className="dark" lang="de">
      <head />
      <body
        className={clsx(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontMono.variable,
          fontDisplay.variable,
        )}
      >
        {children}
      </body>
    </html>
  );
}
