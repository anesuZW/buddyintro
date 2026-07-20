import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.tagline,
    start_url: "/home",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: "#0F172A",
    theme_color: "#2563EB",
    orientation: "portrait-primary",
    categories: ["social", "lifestyle"],
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    launch_handler: {
      client_mode: "navigate-existing",
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Introductions",
        short_name: "Intro",
        url: "/introductions",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Discoveries",
        short_name: "Discover",
        url: "/discoveries",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Messages",
        short_name: "Messages",
        url: "/messages",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
    screenshots: [
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        form_factor: "narrow",
        label: "BuddyIntro home",
      },
    ],
    share_target: {
      action: "/api/share/target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "media", accept: ["image/*", "video/*", "text/plain"] }],
      },
    },
    protocol_handlers: [
      {
        protocol: "web+buddyintro",
        url: "/share?url=%s",
      },
    ],
    file_handlers: [
      {
        action: "/share",
        accept: {
          "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"],
          "video/*": [".mp4", ".webm", ".mov"],
        },
      },
    ],
  } as unknown as MetadataRoute.Manifest;
}
