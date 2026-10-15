import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "AJUDA AQUI — Pessoas ajudando pessoas.",
    template: "%s · Ajuda Aqui",
  },
  description:
    "Peça ou ofereça pequenas ajudas perto de você, com segurança e simplicidade. Compras, entregas, tecnologia, animais e muito mais.",
  applicationName: "Ajuda Aqui",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Ajuda Aqui", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    title: "AJUDA AQUI — Pessoas ajudando pessoas.",
    description: "Peça ou ofereça pequenas ajudas perto de você.",
    locale: "pt_BR",
    type: "website",
    siteName: "Ajuda Aqui",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // usa a área toda em iPhones com notch (respeitamos safe-area nos componentes)
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* marca que há JS antes da pintura: animações de entrada só se aplicam com JS */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:font-semibold"
        >
          Pular para o conteúdo
        </a>
        {children}
        <InstallPrompt />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
