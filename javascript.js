// ====== Utils ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const formatMoney = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

// ====== Estado de la Aplicación ======
let products = []; // Se llenará con la base de datos
let currentPage = 1;
let perPage = 12;
let currentQuery = "";
let currentUser = null; // Guardará el usuario autenticado
let activeChatChannel = null; // Suscripción en tiempo real activa

// ====== Cargar Productos desde Supabase ======
async function loadProducts() {
  try {
    // Traemos todos los productos ordenados por los más recientes
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    products = data || [];
    render();
  } catch (error) {
    console.error("Error al cargar productos:", error.message);
  }
}

// ====== Escuchar el Estado de la Sesión ======
function listenAuthChanges() {
  supabase.auth.onAuthStateChange((event, session) => {
    const btnAuthNav = $("#btn-auth-nav");
    
    if (session) {
      currentUser = session.user;
      if (btnAuthNav) btnAuthNav.textContent = "Mi Perfil"; // <--- MODIFICADO AQUÍ
    } else {
      currentUser = null;
      if (btnAuthNav) btnAuthNav.textContent = "Iniciar Sesión";
    }
  });
}

// ====== Render card ======
function productCardHTML(p) {
  return `
    <article class="card" data-product-id="${p.id}" data-product-name="${p.name}">
      <a href="#producto-${p.id}" class="thumb" aria-label="Ver producto">
        <span>Imagen</span>
        ${p.tag ? `<span class="tag">${p.tag}</span>` : ``}
      </a>

      <div class="content">
        <div class="meta">${p.meta}</div>
        <h3 class="name">${p.name}</h3>

        <div class="price-row">
          <div>
            <div class="price">${formatMoney(p.price)}</div>
            <div class="installments">${p.installments || '1 cuota'}</div>
          </div>
          <div class="like" role="button" tabindex="0" aria-label="Agregar a favoritos">♥</div>
        </div>

        <div class="actions">
          <button type="button" class="btn btn-chat-trigger">Chat con vendedor</button>
          <button type="button" class="btn secondary">Ver detalles</button>
        </div>
      </div>
    </article>
  `;
}

function getFilteredProducts() {
  const q = currentQuery.trim().toLowerCase();
  if (!q) return [...products];
  return products.filter(p =>
    [p.name, p.meta, p.tag].some(x => (x || "").toLowerCase().includes(q))
  );
}

function getSortedProducts(list, ordenar) {
  const arr = [...list];
  switch (ordenar) {
    case "precio_asc": return arr.sort((a,b) => a.price - b.price);
    case "precio_desc": return arr.sort((a,b) => b.price - a.price);
    default: return arr;
  }
}

function render() {
  const container = $(".products");
  const resultCount = $("#resultCount");
  const ordenar = $("#ordenar")?.value || "relevancia";

  const filtered = getFilteredProducts();
  const sorted = getSortedProducts(filtered, ordenar);

  if (resultCount) resultCount.textContent = `${filtered.length} resultados`;

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * perPage;
  const pageItems = sorted.slice(start, start + perPage);

  if (container) {
    container.innerHTML = pageItems.length > 0 
      ? pageItems.map(productCardHTML).join("")
      : `<p style="padding: 20px;">No se encontraron productos.</p>`;
  }

  const pageNumber = $("#pageNumber");
  pageNumber && (pageNumber.textContent = String(currentPage));

  const prevBtn = $(".pagination .page-btn:nth-of-type(1)");
  const nextBtn = $(".pagination .page-btn:nth-of-type(2)");
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// ====== Manejo de Modales y Formularios ======
function setupModalsAndChat() {
  const modalAuth = $("#modal-auth");
  const modalPublicar = $("#modal-publicar");
  const panelChat = $("#panel-chat");
  
  const btnAuthNav = $("#btn-auth-nav");
  const btnPublicarNav = $("#btn-publicar-nav");
  const btnPublicarFooter = $("#btn-publicar-footer");

  const closeAllModals = () => {
    if(modalAuth) modalAuth.style.display = "none";
    if(modalPublicar) modalPublicar.style.display = "none";
  };

  $$(".close-modal").forEach(btn => btn.addEventListener("click", closeAllModals));

  if($("#close-chat")) {
    $("#close-chat").addEventListener("click", () => {
      panelChat.style.display = "none";
      if (activeChatChannel) supabase.removeChannel(activeChatChannel); // Cerramos canal en tiempo real al cerrar chat
    });
  }

  $$(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeAllModals(); });
  });

  // Evento Login / Logout en Nav
  if (btnAuthNav) {
    btnAuthNav.addEventListener("click", async (e) => {
      e.preventDefault();
      if (currentUser) {
        // ¡Si está logueado, lo mandamos a su panel de perfil directamente!
        window.location.href = "perfil.html"; // <--- MODIFICADO AQUÍ
      } else {
        modalAuth.style.display = "flex";
      }
    });
  }

  // Alternar Login / Registro en el modal
  const btnAuthToggle = $("#btn-auth-toggle");
  const authTitle = $("#auth-title");
  const btnAuthSubmit = $("#btn-auth-submit");
  let isLoginMode = true;

  if (btnAuthToggle) {
    btnAuthToggle.addEventListener("click", () => {
      isLoginMode = !isLoginMode;
      authTitle.textContent = isLoginMode ? "Ingresar a Mercadito" : "Crea tu cuenta";
      btnAuthSubmit.textContent = isLoginMode ? "Iniciar Sesión" : "Registrarme";
      btnAuthToggle.textContent = isLoginMode ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Ingresa";
    });
  }

  // SUBMIT AUTENTICACIÓN REAL
  const formAuth = $("#form-auth");
  if(formAuth) {
    formAuth.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#auth-email").value;
      const password = $("#auth-password").value; 

      try {
        if (isLoginMode) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          
          // ¡Al iniciar sesión con éxito, lo redirigimos a su perfil!
          window.location.href = "perfil.html"; // <--- MODIFICADO AQUÍ
        } else {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          alert("¡Registro exitoso! Ya puedes iniciar sesión con tus datos."); // <--- MODIFICADO AQUÍ
          
          // Cambiar automáticamente a modo login para comodidad del usuario
          isLoginMode = true;
          authTitle.textContent = "Ingresar a Mercadito";
          btnAuthSubmit.textContent = "Iniciar Sesión";
          btnAuthToggle.textContent = "¿No tienes cuenta? Regístrate";
        }
        closeAllModals();
        formAuth.reset();
      } catch (error) {
        alert("Error de autenticación: " + error.message);
      }
    });
  }

  // Abrir Modal Publicar con Validación de Sesión
  const handleOpenPublicar = (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Debes iniciar sesión primero para vender.");
      modalAuth.style.display = "flex";
      return;
    }
    modalPublicar.style.display = "flex";
  };

  if (btnPublicarNav) btnPublicarNav.addEventListener("click", handleOpenPublicar);
  if (btnPublicarFooter) btnPublicarFooter.addEventListener("click", handleOpenPublicar);

  // SUBMIT PUBLICACIÓN REAL
  const formPublicar = $("#form-publicar");
  if(formPublicar) {
    formPublicar.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const newProduct = {
        name: $("#prod-titulo").value,
        price: parseFloat($("#prod-precio").value),
        tag: "Nuevo",
        meta: `${$("#prod-categoria").value} • Reciente`,
        installments: "Negociable",
        vendedor_id: currentUser.id // Vinculado al usuario actual
      };

      try {
        const { error } = await supabase.from('productos').insert([newProduct]);
        if (error) throw error;

        alert("¡Producto publicado con éxito!");
        formPublicar.reset();
        closeAllModals();
        loadProducts(); // Recargamos los productos directo desde Supabase
      } catch (error) {
        alert("Error al publicar: " + error.message);
      }
    });
  }
}

// ====== Sistema de Chat en Tiempo Real ======
async function openChatRealtime(productoId, productName) {
  const panelChat = $("#panel-chat");
  const chatBox = $("#chat-box");
  const chatTitle = $("#chat-vendedor-nombre");

  chatTitle.textContent = `Vendedor de ${productName}`;
  chatBox.innerHTML = `<p style="font-size:12px; color:gray; text-align:center;">Cargando mensajes anteriores...</p>`;
  panelChat.style.display = "flex";
  panelChat.dataset.activeProductId = productoId;

  // 1. Cargar mensajes antiguos de este producto
  try {
    const { data: mensajesAntiguos, error } = await supabase
      .from('mensajes')
      .select('*')
      .eq('producto_id', productoId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    chatBox.innerHTML = ""; // Limpiamos
    if(mensajesAntiguos.length === 0) {
      chatBox.innerHTML = `<div class="msg incoming">¡Hola! ¿Te interesa el artículo <b>${productName}</b>?</div>`;
    } else {
      mensajesAntiguos.forEach(m => appendMessageHTML(m));
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (error) {
    console.error("Error cargando mensajes:", error.message);
  }

  // 2. Conectar al canal de Tiempo Real de Supabase para este producto
  if (activeChatChannel) supabase.removeChannel(activeChatChannel); // Desconectar canal previo si existía

  activeChatChannel = supabase
    .channel(`chat-producto-${productoId}`)
    .on(
      'postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `producto_id=eq.${productoId}` }, 
      (payload) => {
        appendMessageHTML(payload.new);
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    )
    .subscribe();
}

function appendMessageHTML(msg) {
  const chatBox = $("#chat-box");
  const esMio = currentUser && msg.remitente_id === currentUser.id;
  
  const estilo = esMio 
    ? 'text-align: right; background: #e0f2fe; margin-left: auto;' 
    : 'background: #f1f5f9;';

  chatBox.innerHTML += `
    <div class="msg" style="padding: 8px; border-radius: 8px; margin: 4px 0; max-width: 80%; ${estilo}">
      ${msg.texto}
    </div>
  `;
}

// ====== Eventos Generales ======
function wireEvents() {
  // Buscador
  const searchForm = $(".search");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      currentQuery = $("#q")?.value || "";
      currentPage = 1;
      render();
    });
  }

  // select de ordenamiento
  if ($("#ordenar")) {
    $("#ordenar").addEventListener("change", () => { currentPage = 1; render(); });
  }

  // Delegación de eventos sobre las tarjetas creadas dinámicamente
  document.addEventListener("click", (e) => {
    const chatBtn = e.target.closest(".btn-chat-trigger");
    if (chatBtn) {
      if (!currentUser) {
        alert("Por favor inicia sesión para usar el chat.");
        $("#modal-auth").style.display = "flex";
        return;
      }
      const card = e.target.closest(".card");
      const id = card?.dataset?.productId;
      const name = card?.dataset?.productName;
      openChatRealtime(id, name);
      return;
    }
  });

  // Submit al enviar mensaje de texto en el chat
  const formChatSend = $("#form-chat-send");
  if (formChatSend) {
    formChatSend.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = $("#chat-input-text");
      const texto = input.value.trim();
      const productoId = $("#panel-chat").dataset.activeProductId;

      if (texto && productoId) {
        input.value = "";
        // Insertamos en Supabase. El Realtime se encargará de pintarlo en pantalla automáticamente
        const { error } = await supabase
          .from('mensajes')
          .insert([{ producto_id: productoId, remitente_id: currentUser.id, texto: texto }]);
        
        if (error) console.error("Error enviando mensaje:", error.message);
      }
    });
  }
}

// ====== Inicialización ======
document.addEventListener("DOMContentLoaded", () => {
  listenAuthChanges();
  wireEvents();
  setupModalsAndChat();
  loadProducts(); // Carga inicial desde Supabase
});
