import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/branding";

const BASE = (
  process.env.NEXT_PUBLIC_APP_URL || `https://${BRAND.domain}`
).replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const paths = ["", "/login", "/signup", "/privacy", "/terms", "/cookies"];

  return paths.map((path) => ({
    url: `${BASE}${path || "/"}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
