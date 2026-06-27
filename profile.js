/**
 * profile.js — MercaditoC
 * Página de perfil del vendedor:
 *   • Protege la página (redirige a login si no hay sesión)
 *   • Carga datos del perfil desde la tabla `perfiles`
 *   • Guarda cambios (nombre, teléfono WhatsApp, ubicación) en `perfiles`
 *   • Muestra los productos del vendedor con opción de eliminar
 *
 * TABLA REQUERIDA EN SUPABASE: `perfiles`
 *   - id              uuid  (PRIMARY KEY, referencia a auth.users.id)
 *   - nombre          text
 *   - telefono_wa     text  (número WhatsApp en formato internacional, ej: 5215512345678)
 *   - ubicacion       text
 *   - updated_at      timestamptz
 */

// ── Supabase (reutilizamos el cliente de auth.js) ─────────────
// `supabase` está disponible porque perfil.html carga auth.js primero

const $ = (sel, ctx = document) => ctx.querySelector(sel);

let currentUser = null; // Se asigna tras verificar sesión

// ── 1. Proteger la página y cargar datos ─────────────────────
async function init() {
  // Verificar sesión activa
  const { data: { session }, error: sessErr } = await supabase.auth.getSession();

  if (sessErr || !session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;

  // Mostrar email en la cabecera
  const emailEl = $("#profile-email");
  if (emailEl) emailEl.textContent = currentUser.email;

  // Cargar perfil guardado en la tabla `perfiles`
  await loadPerfil();

}

// ── 2. Cargar perfil desde Supabase ──────────────────────────
async function loadPerfil() {
  const { data, error } = await supabase
    .from("perfiles")
    .select("nombre, telefono_wa, ubicacion")
    .eq("id", currentUser.id)
    .maybeSingle(); // No falla si el perfil aún no existe

  if (error) {
    console.error("Error al cargar perfil:", error.message);
    return;
  }

  if (data) {
    const nombreInput    = $("#prof-name");
    const telefonoInput  = $("#prof-phone");
    const ubicacionInput = $("#prof-location");

    if (nombreInput   && data.nombre)      nombreInput.value   = data.nombre;
    if (telefonoInput && data.telefono_wa) telefonoInput.value = data.telefono_wa;
    if (ubicacionInput && data.ubicacion)  ubicacionInput.value = data.ubicacion;
  }
}

// ── 3. Guardar perfil en Supabase ─────────────────────────────
async function savePerfil(e) {
  e.preventDefault();

  const nombre     = $("#prof-name")?.value.trim()     || "";
  const telefonoRaw = $("#prof-phone")?.value.trim()   || "";
  const ubicacion  = $("#prof-location")?.value.trim() || "";

  // Limpiar teléfono: quitar espacios, guiones, paréntesis y el símbolo +
  // Supabase/WhatsApp necesita solo dígitos en formato internacional
  const telefono_wa = telefonoRaw.replace(/[\s\-\(\)\+]/g, "");

  // Validación básica del teléfono (al menos 8 dígitos)
  if (telefono_wa && !/^\d{8,15}$/.test(telefono_wa)) {
    showFormFeedback(
      "⚠️ El número de WhatsApp debe contener solo dígitos (8-15 dígitos). Ejemplo: 5215512345678",
      "error"
    );
    return;
  }

  const btn = $("#btn-save-profile");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando…"; }

  try {
    // upsert: crea el registro si no existe, lo actualiza si ya existe
    const { error } = await supabase
      .from("perfiles")
      .upsert(
        {
          id:          currentUser.id,
          nombre:      nombre,
          telefono_wa: telefono_wa,
          ubicacion:   ubicacion,
          updated_at:  new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) throw error;

    showFormFeedback("✅ ¡Perfil guardado! Los compradores ya pueden contactarte por WhatsApp.", "success");
  } catch (err) {
    console.error("Error al guardar perfil:", err.message);
    showFormFeedback("❌ Error al guardar: " + err.message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Guardar cambios"; }
  }
}

// ── 4. Mostrar feedback en el formulario ─────────────────────
function showFormFeedback(msg, type) {
  let el = $("#profile-feedback");
  if (!el) {
    el = document.createElement("p");
    el.id = "profile-feedback";
    el.style.cssText = "margin-top:10px; font-size:13px; border-radius:6px; padding:10px 12px;";
    $("#btn-save-profile")?.insertAdjacentElement("afterend", el);
  }
  el.textContent = msg;
  el.style.background = type === "success" ? "#f0fff7" : "#fff0f0";
  el.style.color       = type === "success" ? "#00a650" : "#f23d4f";
  el.style.border      = type === "success" ? "1px solid #b3f0d1" : "1px solid #ffd0d0";
  setTimeout(() => { if (el) el.remove(); }, 5000);
}

// ── Helpers ────────────────────────────────────────────────────
const escHTML = (s = "") => String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  init();
  const form = $("#form-profile-data");
  if (form) form.addEventListener("submit", savePerfil);
});