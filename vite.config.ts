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
        // Precache the app shell only — the multi-MB dataset is runtime-cached,
        // not baked into the shell.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        globIgnores: ["**/data/**"],
        navigateFallbackDenylist: [/^\/perrenials\/data\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // The dataset: serve fast from cache, refresh in the background.
            urlPattern: /\/data\/[^/]+\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "perrenials-data",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Permapeople plant photos.
            urlPattern: /^https:\/\/cdn\.permapeople\.org\//,
            handler: "CacheFirst",
            options: {
              cacheName: "perrenials-images",
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
