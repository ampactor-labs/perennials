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
        // Android paints this full-screen as the splash on every cold launch of the
        // installed app, before a line of CSS runs, and no media query can reach it.
        // Cream meant a dark-adapted gardener opening the guide at dusk got a
        // full-brightness white flash every time. A dark splash in daylight costs
        // nothing; a white one at night costs her night vision.
        background_color: "#171b14",
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
        // Deletes the old, opaque-padded photo cache on activate.
        importScripts: ["sw-purge.js"],
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
            urlPattern: /^https:\/\/api-production-5338\.up\.railway\.app\/data\/[^/]+\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "perennials-data",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
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
            // Plant photos, resized by our own service. Immutable for a given plant
            // and width, so cache-first, and keep a lot of them: a thumbnail is now
            // ~20 KB rather than a 58 KB original.
            //
            // The cache is renamed because the old one ("perennials-images") is full
            // of opaque entries that this route must never match again — see
            // public/sw-purge.js, which deletes it on activate.
            urlPattern: /^https:\/\/api-production-5338\.up\.railway\.app\/img\//,
            handler: "CacheFirst",
            options: {
              cacheName: "perennials-photos",
              expiration: {
                maxEntries: 8000,
                maxAgeSeconds: 60 * 60 * 24 * 180,
                // The only self-heal path Workbox has. Eviction is otherwise driven
                // by a successful write, and when the quota is what's failing, the
                // write is exactly what cannot succeed — so without this a wedged
                // cache stays wedged forever.
                purgeOnQuotaError: true,
              },
              // 200 only. Status 0 means an opaque response, and admitting those is
              // what padded the cache ~7 MB per photo. It also launders errors: a
              // no-cors 404 comes back opaque with status 0, matches, and is then
              // served as that plant's photo for six months.
              cacheableResponse: { statuses: [200] },
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
