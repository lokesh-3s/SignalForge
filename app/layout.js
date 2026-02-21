import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BackgroundWrapper from "@/components/BackgroundWrapper";
import AuthProvider from "@/components/AuthProvider";
import ToastProvider from "@/components/ToastProvider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SignalForge - AI-Powered B2B Outreach Intelligence Engine",
  description: "Advanced outreach intelligence platform with AI-driven signal analysis, decision engine logic, and automated content generation for B2B sales excellence",
};

export default function RootLayout({ children }) {
  // Render without server-derived class, and let the pre-hydration script
  // set the correct theme class. suppressHydrationWarning avoids mismatches.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set initial theme early to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var s = localStorage.getItem('theme');
                  var d = s ? s === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  document.documentElement.classList.toggle('dark', d);
                } catch(e) {}
              })();
            `
          }}
        />
        {/* Favicon and meta */}
        <link rel="icon" href="/signal-forge.svg" />
        <link rel="apple-touch-icon" href="/signal-forge.svg" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <AuthProvider>
          <ToastProvider />
          <BackgroundWrapper>
            {children}
          </BackgroundWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
