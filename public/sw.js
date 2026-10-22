// Dummy Service Worker to satisfy PWA requirements
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Do nothing
});

self.addEventListener("fetch", (e) => {
  // Do nothing, let the browser handle it
});
