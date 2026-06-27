self.addEventListener("install", (e) => {
  console.log("[Service Worker] Instalado");
});

self.addEventListener("fetch", (e) => {
  // Aquí se configuraría el modo sin conexión a internet en el futuro
});