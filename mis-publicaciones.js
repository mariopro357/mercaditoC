/**
 * mis-publicaciones.js — MercaditoC
 * Administra las publicaciones del vendedor (ver, eliminar).
 * Depende de auth.js (que expone `supabase` como variable global).
 */

let currentUser = null;

async function init() {
  const { data: { session }, error: sessErr } = await supabase.auth.getSession();

  if (sessErr || !session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;
  await loadMyProducts();
}

const escHTML = (s = "") => String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

const formatPrice = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

async function loadMyProducts() {
  const container = document.getElementById("my-products-container");
  if (!container) return;

  const { data, error } = await supabase
    .from("productos")
    .select("id, titulo, precio, imagen_url")
    .eq("vendedor_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = `<p style="color:var(--danger);font-size:14px;">Error al cargar tus productos: ${escHTML(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--muted);grid-column: 1 / -1;">
        <div style="font-size:48px;margin-bottom:12px;">📦</div>
        <h3 style="color:var(--text);margin-bottom:8px;">No tienes publicaciones activas</h3>
        <p style="margin-bottom:20px;">Aún no tienes productos publicados. ¡Vende lo que ya no usas!</p>
        <a href="vender.html" class="btn-primary" style="display:inline-block;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;">Publicar mi primer producto</a>
      </div>`;
    return;
  }

  container.innerHTML = data.map(p => {
    const imgSrc = p.imagen_url ? escHTML(p.imagen_url) : '';
    const imgHTML = imgSrc ? `<img src="${imgSrc}" alt="${escHTML(p.titulo)}" loading="lazy">` : `<div style="font-size:32px;">🖼️</div>`;

    return `
      <div class="mini-card" data-id="${p.id}">
        <div class="mc-img-wrap">
          ${imgHTML}
        </div>
        <div class="mc-title">${escHTML(p.titulo)}</div>
        <div class="mc-price">${formatPrice(p.precio)}</div>
        <button class="delete-btn" data-id="${p.id}" data-url="${imgSrc}" aria-label="Eliminar ${escHTML(p.titulo)}">
          🗑 Eliminar
        </button>
      </div>
    `;
  }).join("");

  // Eventos de eliminación
  container.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteProduct(btn.dataset.id, btn.dataset.url, btn.closest(".mini-card")));
  });
}

async function deleteProduct(id, imageUrl, cardEl) {
  if (!confirm("¿Seguro que quieres eliminar esta publicación permanentemente?")) return;

  const btn = cardEl.querySelector('.delete-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = "Eliminando...";
  btn.disabled = true;

  try {
    // Si queremos eliminar la imagen de Storage también (opcional pero recomendado)
    if (imageUrl && imageUrl.includes('supabase.co/storage/v1/object/public/imagenes/')) {
      const filePath = imageUrl.split('/imagenes/')[1];
      if (filePath) {
        // Intentamos borrar la imagen, pero si falla no bloqueamos el borrado del producto
        try {
          await supabase.storage.from('imagenes').remove([filePath]);
        } catch(imgErr) {
          console.warn("No se pudo borrar la imagen del storage (quizás ya no existe o faltan permisos):", imgErr);
        }
      }
    }

    const { data: deletedRows, error } = await supabase
      .from("productos")
      .delete()
      .eq("id", id)
      .eq("vendedor_id", currentUser.id)
      .select();

    if (error) throw error;
    
    // Si no borró nada, significa que las reglas de seguridad (RLS) de Supabase lo están bloqueando
    if (!deletedRows || deletedRows.length === 0) {
      throw new Error("Permiso denegado: Supabase no eliminó el producto. Faltan permisos de DELETE en la base de datos.");
    }

    cardEl.style.transition = "opacity .25s, transform .25s";
    cardEl.style.opacity = "0";
    cardEl.style.transform = "scale(0.95)";
    setTimeout(() => {
      cardEl.remove();
      const container = document.getElementById("my-products-container");
      if (container.querySelectorAll('.mini-card').length === 0) {
        loadMyProducts(); // Recargar para mostrar el empty state
      }
    }, 260);

  } catch (err) {
    alert("Error al eliminar: " + err.message);
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init();
});
