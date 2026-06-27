/**
 * auth.js — MercaditoC
 * Inicialización de Supabase + lógica de autenticación compartida
 * (sesión, navbar dinámica, logout). Cargado en TODAS las páginas.
 */

// ── 1. Credenciales y cliente Supabase ───────────────────────
const SUPABASE_URL      = "https://owyqhluhxqhdfepmfwud.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_QSsVOM4R-msWVzrFr_wbeg_WQvc6ZyG";

// Creamos el cliente como variable global "supabase" para que
// todos los demás scripts (index.js, profile.js, vender.js) lo usen directamente.
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 2. Helpers ────────────────────────────────────────────────
/** Devuelve las iniciales de un email o nombre (máx 2 chars) */
function getInitials(text = "") {
  const parts = text.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ── 3. Actualizar Navbar según estado de sesión ───────────────
async function updateNavbar(session) {
  const navAuth = document.getElementById("nav-auth");
  const navUser = document.getElementById("nav-user");

  if (!navAuth || !navUser) return; // página sin navbar

  if (session) {
    // Usuario autenticado → mostrar panel de usuario
    navAuth.style.display = "none";
    navUser.style.display = "flex";

    const user     = session.user;
    const email    = user.email || "";
    const nombre   = user.user_metadata?.nombre || email.split("@")[0];
    const initials = getInitials(nombre);

    const elNombre = document.getElementById("nav-nombre");
    const elAvatar = document.getElementById("nav-avatar");
    const ddNombre = document.getElementById("dd-nombre");
    const ddEmail  = document.getElementById("dd-email");
    const ddAvatar = document.getElementById("dd-avatar");

    if (elNombre) elNombre.textContent = nombre;
    if (elAvatar) elAvatar.textContent = initials;
    if (ddNombre) ddNombre.textContent = nombre;
    if (ddEmail)  ddEmail.textContent  = email;
    if (ddAvatar) ddAvatar.textContent = initials;
  } else {
    // Sin sesión → mostrar botones de login/registro
    navAuth.style.display = "flex";
    navUser.style.display = "none";
  }
}

// ── 4. Toggle del dropdown de usuario ────────────────────────
function initUserDropdown() {
  const btn      = document.getElementById("btn-user-menu");
  const dropdown = document.getElementById("user-dropdown");
  if (!btn || !dropdown) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");
    dropdown.classList.toggle("open", !isOpen);
    btn.setAttribute("aria-expanded", String(!isOpen));
  });

  // Cerrar al hacer click fuera
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });

  // Cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dropdown.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

// ── 5. Logout ─────────────────────────────────────────────────
function initLogout() {
  const btnLogout = document.getElementById("btn-logout");
  if (!btnLogout) return;

  btnLogout.addEventListener("click", async () => {
    btnLogout.disabled = true;
    btnLogout.textContent = "Cerrando sesión…";
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error al cerrar sesión:", error.message);
      showToast("Error al cerrar sesión. Intenta de nuevo.", "error");
      btnLogout.disabled = false;
      btnLogout.textContent = "🚪 Cerrar sesión";
    } else {
      showToast("Sesión cerrada correctamente.", "success");
      window.location.href = "index.html";
    }
  });
}

// ── 6. Toast global ───────────────────────────────────────────
function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── 7. Escuchar cambios de sesión (global) ────────────────────
supabase.auth.onAuthStateChange((_event, session) => {
  updateNavbar(session);
});

// ── 8. Init al cargar el DOM ──────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  await updateNavbar(session);
  initUserDropdown();
  initLogout();
});