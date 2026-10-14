import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/seguranca", "/termos", "/privacidade"].map((p) => ({
    url: `${publicEnv.siteUrl}${p}`,
    lastModified: now,
  }));
}
