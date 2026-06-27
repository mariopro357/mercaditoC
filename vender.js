/**
 * vender.js — MercaditoC
 * Lógica de la página "Publicar Producto":
 *  1. Verifica que el usuario tenga sesión activa (si no, muestra guard)
 *  2. Previsualiza la imagen antes de subirla
 *  3. Sube la imagen al bucket "imagenes" de Supabase Storage
 *  4. Guarda el producto en la tabla "productos"
 *
 * Depende de auth.js (que expone `supabase` como variable global).
 */

let currentUser = null;

// ── 1. Verificar sesión y mostrar el formulario ───────────────
async function initVender() {
  const { data: { session }, error } = await supabase.auth.getSession();

  const guard     = document.getElementById("auth-guard");
  const container = document.getElementById("form-vender-container");

  if (error || !session) {
    // Sin sesión → mostrar mensaje de login
    if (guard)     guard.style.display     = "block";
    if (container) container.style.display = "none";
    return;
  }

  // Con sesión → mostrar formulario
  currentUser = session.user;
  if (guard)     guard.style.display     = "none";
  if (container) container.style.display = "block";
}

// ── 2. Preview de imagen ──────────────────────────────────────
function initImagePreview() {
  const input       = document.getElementById("imagen");
  const previewImg  = document.getElementById("img-preview-img");
  const placeholder = document.getElementById("preview-placeholder");

  if (!input || !previewImg) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showAlert("La imagen no puede superar 5 MB.", "error");
      input.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.style.display = "block";
      if (placeholder) placeholder.style.display = "none";
    };
    reader.readAsDataURL(file);
  });
}

// ── 3. Mostrar alerta en el formulario ────────────────────────
function showAlert(msg, type) {
  const el = document.getElementById("vender-alert");
  if (!el) return;
  el.textContent = msg;
  el.className = `vender-alert ${type}`;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideAlert() {
  const el = document.getElementById("vender-alert");
  if (el) el.className = "vender-alert";
}

// ── 4. Submit del formulario ──────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();
  hideAlert();

  const titulo      = document.getElementById("titulo")?.value.trim();
  const precioInput = document.getElementById("precio")?.value;
  const categoria   = document.getElementById("categoria")?.value;
  const descripcion = document.getElementById("descripcion")?.value.trim() || "";
  const fileInput   = document.getElementById("imagen");
  const file        = fileInput?.files?.[0];

  // Validaciones
  if (!titulo) {
    showAlert("⚠️ El título del producto es obligatorio.", "error"); return;
  }
  if (!precioInput || isNaN(parseFloat(precioInput)) || parseFloat(precioInput) < 0) {
    showAlert("⚠️ Ingresa un precio válido (número mayor o igual a 0).", "error"); return;
  }
  if (!categoria) {
    showAlert("⚠️ Selecciona una categoría.", "error"); return;
  }
  if (!file) {
    showAlert("⚠️ Debes seleccionar una imagen del producto.", "error"); return;
  }
  if (!currentUser) {
    showAlert("❌ Tu sesión expiró. Por favor inicia sesión de nuevo.", "error"); return;
  }

  const precio = parseFloat(precioInput);

  const btn = document.getElementById("btn-publicar");
  if (btn) { btn.disabled = true; btn.classList.add("loading"); }

  try {
    // ── 4a. Subir imagen a Supabase Storage ──────────────────
    const ext      = file.name.split(".").pop().toLowerCase();
    const fileName = `productos/${currentUser.id}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("imagenes")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (uploadError) throw uploadError;

    // ── 4b. Obtener URL pública ───────────────────────────────
    const { data: { publicUrl } } = supabase.storage
      .from("imagenes")
      .getPublicUrl(fileName);

    // ── 4c. Guardar producto en la tabla ─────────────────────
    const { error: dbError } = await supabase.from("productos").insert([{
      titulo:      titulo,
      precio:      precio,
      categoria:   categoria,
      descripcion: descripcion,
      imagen_url:  publicUrl,
      vendedor_id: currentUser.id,   // ← imprescindible para mostrar en perfil y contactar
    }]);

    if (dbError) throw dbError;

    // ── 4d. Éxito ─────────────────────────────────────────────
    showAlert("✅ ¡Producto publicado con éxito! Redirigiendo a la tienda…", "success");
    setTimeout(() => { window.location.href = "index.html"; }, 2000);

  } catch (err) {
    console.error("Error al publicar:", err);
    showAlert("❌ Error al publicar: " + (err.message || "Inténtalo de nuevo."), "error");
    if (btn) { btn.disabled = false; btn.classList.remove("loading"); }
  }
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await initVender();
  initImagePreview();

  const form = document.getElementById("form-vender");
  if (form) form.addEventListener("submit", handleSubmit);
});