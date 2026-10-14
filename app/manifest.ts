import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ajuda Aqui — Pessoas ajudando pessoas.",
    short_name: "Ajuda Aqui",
    description: "Peça ou ofereça pequenas ajudas perto de você.",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
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
    shortcuts: [
      { name: "Preciso de ajuda", url: "/pedido/novo" },
      { name: "Explorar pedidos", url: "/explorar" },
    ],
  };
}
