/*
 * One-time cleanup, imported into the generated service worker.
 *
 * The photo cache used to be called "perennials-images" and it was full of OPAQUE
 * responses: the <img> tags fetched cross-origin without a crossorigin attribute,
 * so the browser handed the service worker responses it could not read. Chrome
 * pads every opaque entry by about 7 MB in its storage accounting, so a few dozen
 * photos reported hundreds of megabytes, and Cache Storage eventually hit the
 * quota and refused every further write — silently, while the photos still
 * rendered online. The photos are CORS now and the cache is called
 * "perennials-photos", so the old one is dead weight on her phone.
 *
 * It also cannot simply be reused: CacheFirst matches on URL, so a stale opaque
 * entry would be served to the new CORS request, fail its cross-origin check, and
 * paint the "no photo" mark for a plant whose photo is sitting right there.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete("perennials-images"));
});
