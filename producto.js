/**
 * producto.js — MercaditoC
 * Carga y muestra los detalles de un producto específico basado en el ID en la URL.
 * Depende de auth.js (que expone `supabase` como variable global).
 */
let currentProducto = null; // Para poder actualizar el precio si las tasas cargan tarde

const formatPrice = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

const escHTML = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

async function loadProductDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const content = document.getElementById('producto-content');

  if (!productId) {
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
    return;
  }

  try {
    // 1. Cargar datos del producto
    const { data: producto, error: prodErr } = await supabase
      .from('productos')
      .select('*')
      .eq('id', productId)
      .single();

    if (prodErr || !producto) throw new Error('Producto no encontrado');

    // 2. Cargar datos del vendedor
    const { data: perfil, error: perfilErr } = await supabase
      .from('perfiles')
      .select('nombre, telefono_wa, ubicacion')
      .eq('id', producto.vendedor_id)
      .maybeSingle();

    // 3. Llenar la interfaz
    document.title = `${producto.titulo} — MercaditoC`;
    
    document.getElementById('bread-cat').textContent = producto.categoria || 'Sin categoría';
    document.getElementById('bread-title').textContent = producto.titulo;
    
    const imgEl = document.getElementById('prod-img');
    if (producto.imagen_url) {
      imgEl.src = producto.imagen_url;
      // Si la imagen falla en cargar (fue borrada de storage), mostramos el error state
      imgEl.onerror = () => {
        content.style.display = 'none';
        errorState.style.display = 'block';
      };
    } else {
      imgEl.style.display = 'none';
    }

    currentProducto = producto;
    document.getElementById('prod-cat').textContent = producto.categoria || '';
    document.getElementById('prod-titulo').textContent = producto.titulo;
    
    const precioContainer = document.getElementById('prod-precio');
    if (typeof getPriceHTML === "function") {
      precioContainer.innerHTML = getPriceHTML(producto.precio, producto.moneda || "USD");
    } else {
      precioContainer.textContent = formatPrice(producto.precio);
    }
    
    if (producto.descripcion) {
      document.getElementById('prod-desc').textContent = producto.descripcion;
    }

    // Datos del vendedor
    const vendNombre = perfil?.nombre || 'Usuario de MercaditoC';
    document.getElementById('vend-nombre').textContent = vendNombre;
    document.getElementById('vend-ubicacion').textContent = perfil?.ubicacion || 'Ubicación no especificada';
    document.getElementById('vend-avatar').textContent = getInitials(vendNombre);

    // Botón de WhatsApp
    const btnWhatsapp = document.getElementById('btn-whatsapp');
    if (perfil?.telefono_wa) {
      btnWhatsapp.addEventListener('click', () => {
        const mensaje = encodeURIComponent(
          `¡Hola ${vendNombre}! Vi tu producto "${producto.titulo}" en MercaditoC y me interesa. ¿Sigue disponible?`
        );
        window.open(`https://wa.me/${perfil.telefono_wa}?text=${mensaje}`, "_blank");
      });
    } else {
      btnWhatsapp.disabled = true;
      btnWhatsapp.textContent = "El vendedor no tiene WhatsApp configurado";
      btnWhatsapp.style.background = "#ccc";
      btnWhatsapp.style.cursor = "not-allowed";
    }

    // Mostrar contenido
    loadingState.style.display = 'none';
    content.style.display = 'grid';

  } catch (error) {
    console.error('Error cargando producto:', error);
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadProductDetails();
});

// Actualizar precio si las tasas se cargan después
window.addEventListener("ratesLoaded", () => {
  if (currentProducto && typeof getPriceHTML === "function") {
    const precioContainer = document.getElementById('prod-precio');
    if (precioContainer) {
      precioContainer.innerHTML = getPriceHTML(currentProducto.precio, currentProducto.moneda || "USD");
    }
  }
});
