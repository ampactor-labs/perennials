import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// Field-guide green used for the install/theme chrome.
const THEME = "#3f6b3f";

// Served from ampactor.dev/perrenials/ (org GitHub Pages), so everything hangs
// off this base path — assets, router, service-worker scope, manifest.
export default defineConfig({
  base: "/perrenials/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Perrenials — Permaculture Field Guide",
        short_name: "Perrenials",
        description:
          "Search permaculture perennials by bloom, light, moisture, function and use, then arrange them in a plot.",
        theme_color: THEME,
        background_color: "#f4efe3",
        display: "standalone",
        orientation: "portrait",
        id: "/perrenials/",
        start_url: "/perrenials/",
        scope: "/perrenials/",
        categories: ["lifestyle", "education", "utilities"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
