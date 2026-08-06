import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/branding";

const BASE = (
  process.env.NEXT_PUBLIC_APP_URL || `https://${BRAND.domain}`
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/settings/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
