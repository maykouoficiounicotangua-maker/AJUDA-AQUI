import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ajuda Aqui — Pessoas ajudando pessoas.",
    short_name: "Ajuda Aqui",
    description: "Peça ou ofereça pequenas ajudas perto de você.",
    id: "/",
    // "/" decide sozinho: visitante vê a apresentação; quem já entrou vai direto para o início
    start_url: "/?origem=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f766e",
    lang: "pt-BR",
    categories: ["social", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/screenshots/mobile-1.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Início do Ajuda Aqui" },
      { src: "/screenshots/mobile-2.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Peça ajuda em poucos passos" },
      { src: "/screenshots/desktop-1.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "Ajuda Aqui no computador" },
    ],
    shortcuts: [
      { name: "Preciso de ajuda", url: "/pedido/novo" },
      { name: "Ver pedidos", url: "/explorar" },
      { name: "Mensagens", url: "/mensagens" },
    ],
  };
}
