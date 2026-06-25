import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.tagline,
    start_url: "/home",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#2563EB",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/apple-icon-180.svg",
        sizes: "180x180",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    share_target: {
      action: "/api/share/target",
      method: "post",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "media",
            accept: ["image/*", "video/*", "text/plain"],
          },
        ],
      },
    },
  } as unknown as MetadataRoute.Manifest;
}
