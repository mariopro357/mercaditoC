/**
 * index.js — MercaditoC
 * Carga y muestra los productos desde Supabase en la página principal.
 * Depende de auth.js (que expone `supabase` como variable global).
 */

// ── Variables de estado ───────────────────────────────────────
let currentCat = "todos";

// ── Formatear precio ──────────────────────────────────────────
const formatPrice = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

// ── Escapar HTML ──────────────────────────────────────────────
const escHTML = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ── Renderizar una tarjeta de producto ────────────────────────
function renderCard(p, index = 0) {
  const isLcp = index < 8; // Las primeras 8 imágenes cargan con prioridad
  const loadingAttr = isLcp ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';

  const imgContent = p.imagen_url
    ? `<img src="${escHTML(p.imagen_url)}" alt="${escHTML(p.titulo)}" ${loadingAttr} onerror="this.closest('.prod-card').remove();" />`
    : `<span class="no-img">🖼️</span>`;

  return `
    <article class="prod-card" data-id="${p.id}">
      <div class="prod-thumb">
        ${imgContent}
        ${p.categoria ? `<span class="cat-tag">${escHTML(p.categoria)}</span>` : ""}
      </div>
      <div class="prod-body">
        <h3 class="prod-title">${escHTML(p.titulo)}</h3>
        ${typeof getPriceHTML === "function" ? getPriceHTML(p.precio, p.moneda || "USD") : `
        <div class="prod-price">
          <span>$</span>${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(p.precio)}
        </div>`}
        <div class="prod-actions">
          <button class="btn-whatsapp btn-contactar" data-id="${p.id}" data-titulo="${escHTML(p.titulo)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.524 5.853L0 24l6.335-1.504A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.88 0-3.636-.495-5.152-1.358l-.369-.215-3.76.893.952-3.676-.241-.381A9.95 9.95 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            Contactar
          </button>
          <button class="btn-detail btn-ver" data-id="${p.id}">Ver más</button>
        </div>
      </div>
    </article>
  `;
}

// ── Mostrar skeletons de carga ────────────────────────────────
function mostrarSkeletons() {
  const grid = document.getElementById("products-grid");
  if (!grid) return;
  const sk = `<div class="skeleton-card"><div class="skeleton sk-thumb"></div><div class="sk-body"><div class="skeleton sk-line w-60"></div><div class="skeleton sk-line w-80"></div><div class="skeleton sk-line w-40"></div></div></div>`;
  grid.innerHTML = sk.repeat(8);
}

// ── Cargar productos desde Supabase ───────────────────────────
async function cargarProductos(query = "", categoria = "todos") {
  const grid = document.getElementById("products-grid");
  const countEl = document.getElementById("result-count");

  mostrarSkeletons();

  try {
    // Construir query
    let q = supabase.from("productos").select("*");

    // Filtrar por búsqueda de texto
    if (query) {
      q = q.ilike("titulo", `%${query}%`);
    }

    // Filtrar por categoría
    if (categoria && categoria !== "todos") {
      q = q.eq("categoria", categoria);
    }

    // Ordenar por más recientes
    q = q.order("created_at", { ascending: false });

    const { data: productos, error } = await q;

    if (error) throw error;

    if (!grid) return;

    if (productos && productos.length > 0) {
      grid.innerHTML = productos.map((p, i) => renderCard(p, i)).join("");
      if (countEl) countEl.textContent = `${productos.length} producto${productos.length !== 1 ? "s" : ""} encontrado${productos.length !== 1 ? "s" : ""}`;
    } else {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔍</div>
          <h3>No se encontraron productos</h3>
          <p>${query ? `No hay resultados para "<strong>${escHTML(query)}</strong>"` : "Aún no hay productos publicados. ¡Sé el primero en vender!"}</p>
        </div>`;
      if (countEl) countEl.textContent = "0 productos";
    }

    // Aplicar filtro de condición y ordenamiento (client-side)
    aplicarFiltrosLocales();

  } catch (err) {
    console.error("Error al cargar productos:", err);
    if (grid) grid.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error de conexión</h3><p>No se pudo conectar con la base de datos. Intenta de nuevo.</p></div>`;
    if (countEl) countEl.textContent = "Error";
  }
}

// ── Aplicar filtros locales (ordenar, condición) ──────────────
function aplicarFiltrosLocales() {
  const sortSelect = document.getElementById("sort-select");
  const condRadios = document.querySelectorAll("input[name='condicion']");

  const orden = sortSelect ? sortSelect.value : "reciente";
  let condicion = "todos";
  condRadios.forEach(r => { if (r.checked) condicion = r.value; });

  const grid = document.getElementById("products-grid");
  if (!grid) return;

  // Recolectar tarjetas existentes
  const cards = Array.from(grid.querySelectorAll(".prod-card"));
  if (cards.length === 0) return;

  // Filtrar por condición (usando el tag de categoría como proxy — ajustar si hay campo "condicion" en BD)
  // Por ahora simplemente reordena
  const sorted = cards.sort((a, b) => {
    const titleA = a.querySelector(".prod-title")?.textContent || "";
    const titleB = b.querySelector(".prod-title")?.textContent || "";
    const priceA = parseFloat(a.querySelector(".prod-price")?.textContent.replace(/[^0-9.]/g, "") || 0);
    const priceB = parseFloat(b.querySelector(".prod-price")?.textContent.replace(/[^0-9.]/g, "") || 0);

    if (orden === "precio_asc") return priceA - priceB;
    if (orden === "precio_desc") return priceB - priceA;
    if (orden === "az") return titleA.localeCompare(titleB);
    return 0; // reciente: ya viene ordenado desde Supabase
  });

  sorted.forEach(card => grid.appendChild(card));
}

// ── Abrir WhatsApp del vendedor ───────────────────────────────
async function contactarVendedor(productoId, titulo) {
  try {
    // Buscar el producto para obtener el vendedor_id
    const { data: producto, error: prodErr } = await supabase
      .from("productos")
      .select("vendedor_id")
      .eq("id", productoId)
      .single();

    if (prodErr || !producto?.vendedor_id) {
      alert("No se pudo obtener la información del vendedor.");
      return;
    }

    // Buscar el perfil del vendedor
    const { data: perfil, error: perfilErr } = await supabase
      .from("perfiles")
      .select("nombre, telefono_wa, ubicacion")
      .eq("id", producto.vendedor_id)
      .maybeSingle();

    if (perfilErr || !perfil?.telefono_wa) {
      alert("El vendedor aún no ha configurado su número de WhatsApp en su perfil.");
      return;
    }

    const mensaje = encodeURIComponent(
      `¡Hola${perfil.nombre ? " " + perfil.nombre : ""}! Vi tu producto "${titulo}" en MercaditoC y me interesa. ¿Sigue disponible?`
    );
    window.open(`https://wa.me/${perfil.telefono_wa}?text=${mensaje}`, "_blank");

  } catch (err) {
    console.error("Error al contactar vendedor:", err);
    alert("Ocurrió un error al intentar contactar al vendedor.");
  }
}

// ── Eventos de la UI ──────────────────────────────────────────
function wireEvents() {
  // Buscador — submit
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("q");

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = searchInput ? searchInput.value.trim() : "";
      cargarProductos(query, currentCat);
    });
  }

  // Buscador — debounce en tiempo real
  if (searchInput) {
    let debounce;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        cargarProductos(e.target.value.trim(), currentCat);
      }, 400);
    });
  }

  // Filtro de categorías (pills)
  const catPills = document.querySelectorAll(".cat-pill");
  catPills.forEach(pill => {
    pill.addEventListener("click", () => {
      catPills.forEach(p => { p.classList.remove("active"); p.setAttribute("aria-pressed", "false"); });
      pill.classList.add("active");
      pill.setAttribute("aria-pressed", "true");
      currentCat = pill.dataset.cat || "todos";
      const query = searchInput ? searchInput.value.trim() : "";
      cargarProductos(query, currentCat);
    });
  });

  // Ordenar y condición (filtros del sidebar)
  const sortSelect = document.getElementById("sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", aplicarFiltrosLocales);
  }

  const condRadios = document.querySelectorAll("input[name='condicion']");
  condRadios.forEach(r => r.addEventListener("change", aplicarFiltrosLocales));

  // Delegación de eventos en la grilla (contactar / ver más)
  const grid = document.getElementById("products-grid");
  if (grid) {
    grid.addEventListener("click", async (e) => {
      // Botón contactar (WhatsApp)
      const btnContactar = e.target.closest(".btn-contactar");
      if (btnContactar) {
        const id = btnContactar.dataset.id;
        const titulo = btnContactar.dataset.titulo;
        await contactarVendedor(id, titulo);
        return;
      }

      // Botón Ver más (detalle del producto)
      const btnVer = e.target.closest(".btn-ver");
      if (btnVer) {
        const id = btnVer.dataset.id;
        window.location.href = `producto.html?id=${id}`;
      }
    });
  }
}

// ── Inicialización ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  cargarProductos(); // Carga inicial desde Supabase
});

// Re-renderizar productos si las tasas cargan después
window.addEventListener("ratesLoaded", () => {
  const grid = document.getElementById("products-grid");
  if (grid && grid.innerHTML.trim() !== "") {
    const searchInput = document.getElementById("q");
    const query = searchInput ? searchInput.value.trim() : "";
    cargarProductos(query, currentCat);
  }
});