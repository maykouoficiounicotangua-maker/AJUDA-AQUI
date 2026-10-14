import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/** Só páginas institucionais são indexáveis. Pedidos, perfis, conversas e admin NUNCA. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/seguranca", "/termos", "/privacidade"],
      disallow: ["/api/", "/admin", "/pedido", "/usuario", "/conversa", "/perfil", "/inicio", "/explorar", "/mensagens", "/notificacoes", "/configuracoes", "/auth/"],
    },
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
