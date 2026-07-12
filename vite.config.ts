import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// Field-guide green used for the install/theme chrome.
const THEME = "#3f6b3f";

// Served from ampactor.dev/perennials/ (org GitHub Pages), so everything hangs
// off this base path — assets, router, service-worker scope, manifest.
export default defineConfig({
  base: "/perennials/",
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
        name: "Perennials — Permaculture Field Guide",
        short_name: "Perennials",
        description:
          "Search permaculture perennials by bloom, light, moisture, function and use, then arrange them in a plot.",
        theme_color: THEME,
        background_color: "#f4efe3",
        display: "standalone",
        orientation: "portrait",
        id: "/perennials/",
        start_url: "/perennials/",
        scope: "/perennials/",
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
        navigateFallbackDenylist: [/^\/perennials\/data\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Hosted data API (cross-origin): cache for offline. Workbox applies a
            // cross-origin RegExp route only when it matches from the start of the URL.
            urlPattern: /^https:\/\/api-production-25c9\.up\.railway\.app\/data\/[^/]+\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "perennials-data",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Bundled static snapshot (local dev + fallback): serve fast, refresh in background.
            urlPattern: /\/data\/[^/]+\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "perennials-data",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Permapeople plant photos.
            urlPattern: /^https:\/\/cdn\.permapeople\.org\//,
            handler: "CacheFirst",
            options: {
              cacheName: "perennials-images",
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
