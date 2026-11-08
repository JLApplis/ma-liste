/*
    Ma Liste — service worker : permet d'ouvrir l'appli sans réseau (dans le magasin)
    Copyright (C) 2026 Jluc — JLApplis — Licence GPL v3 (voir LICENSE.txt)

    - Pages de l'appli : réseau d'abord (pour avoir la dernière version), copie gardée en secours.
      Si le réseau ne répond pas en 4 secondes, la copie est utilisée.
    - Polices : copie gardée et réutilisée.
    - Les listes elles-mêmes sont dans le navigateur (localStorage), pas dans ce cache.
*/
const CACHE = "ma-liste-v1";
const BASE = ["./", "index.html", "aide.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(BASE);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function reseauAvecDelai(req, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error("délai dépassé")), ms);
    fetch(req).then((r) => { clearTimeout(t); ok(r); }, (err) => { clearTimeout(t); ko(err); });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const memeSite = url.origin === self.location.origin;
  const police = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

  if (memeSite) {                       // réseau d'abord, copie en secours
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await reseauAvecDelai(req, 4000);
        if (r && r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        return (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await c.match("index.html") : undefined) || Response.error();
      }
    })());
  } else if (police) {         // copie d'abord, réseau sinon
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const deja = await c.match(req);
      if (deja) return deja;
      try {
        const r = await fetch(req);
        if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone());
        return r;
      } catch (err) {
        return Response.error();
      }
    })());
  }
});
