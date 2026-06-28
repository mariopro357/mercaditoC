/**
 * currency.js — MercaditoC
 * Manejo de tasas de cambio usando DolarApi (BCV)
 * Carga tasas de Dólares y Euros oficiales y provee funciones de conversión.
 */

const CURRENCY_CACHE_KEY = 'mercaditoc_rates';
const CACHE_EXPIRATION_MS = 60 * 60 * 1000; // 1 hora de caché

// Variables en memoria
window.appRates = {
  USD: 1,      // Base de conversión (1 USD = X VES)
  EUR: 1,      // (1 EUR = Y VES)
  loaded: false
};

/**
 * Carga las tasas de cambio de la API o del caché.
 */
async function loadExchangeRates() {
  try {
    // 1. Revisar caché local
    const cached = sessionStorage.getItem(CURRENCY_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_EXPIRATION_MS) {
        window.appRates.USD = parsed.USD;
        window.appRates.EUR = parsed.EUR;
        window.appRates.loaded = true;
        
        // Disparar evento por si alguien espera a que carguen
        window.dispatchEvent(new Event('ratesLoaded'));
        return;
      }
    }

    // 2. Si no hay caché o expiró, obtener de API
    const [resUSD, resEUR] = await Promise.all([
      fetch('https://ve.dolarapi.com/v1/dolares/oficial'),
      fetch('https://ve.dolarapi.com/v1/euros/oficial')
    ]);

    if (!resUSD.ok || !resEUR.ok) throw new Error("Error fetching rates");

    const dataUSD = await resUSD.json();
    const dataEUR = await resEUR.json();

    window.appRates.USD = dataUSD.promedio;
    window.appRates.EUR = dataEUR.promedio;
    window.appRates.loaded = true;

    // Guardar en caché
    sessionStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify({
      USD: window.appRates.USD,
      EUR: window.appRates.EUR,
      timestamp: Date.now()
    }));
    
    window.dispatchEvent(new Event('ratesLoaded'));

  } catch (err) {
    console.error("Error al cargar tasas de cambio:", err);
    // Si falla, usar 1 temporalmente o evitar crashear
    window.appRates.USD = 1;
    window.appRates.EUR = 1;
    window.appRates.loaded = false;
    window.dispatchEvent(new Event('ratesLoaded'));
  }
}

/**
 * Convierte un precio desde su moneda base a USD, EUR y VES.
 * @param {number} amount Monto original
 * @param {string} baseCurrency Moneda de origen ("USD", "EUR", "VES")
 * @returns {object} { USD, EUR, VES } numéricos
 */
function convertPrice(amount, baseCurrency = "USD") {
  // Convertir primero a Bolívares (VES) como base intermedia
  let valueInVES = amount;
  if (baseCurrency === "USD") {
    valueInVES = amount * window.appRates.USD;
  } else if (baseCurrency === "EUR") {
    valueInVES = amount * window.appRates.EUR;
  }

  // De Bolívares a Dólares y Euros
  const valUSD = valueInVES / window.appRates.USD;
  const valEUR = valueInVES / window.appRates.EUR;

  return {
    USD: valUSD,
    EUR: valEUR,
    VES: valueInVES
  };
}

/**
 * Formatea un número como moneda
 */
function formatCurrency(amount, currencyStr) {
  let locale = "en-US";
  let cur = "USD";
  if (currencyStr === "EUR") { locale = "es-ES"; cur = "EUR"; }
  else if (currencyStr === "VES") { locale = "es-VE"; cur = "VES"; }
  
  return new Intl.NumberFormat(locale, { 
    style: "currency", 
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace("VES", "Bs."); // Mejora visual
}

/**
 * Devuelve HTML para el desglose de precios 
 */
function getPriceHTML(amount, baseCurrency = "USD") {
  if (!amount) return "";
  
  const converted = convertPrice(amount, baseCurrency);
  const baseFmt = formatCurrency(amount, baseCurrency);
  
  // Ocultar equivalentes si las tasas no cargaron para no mostrar info errónea
  if (!window.appRates.loaded) {
    return `<div class="prod-price">${baseFmt}</div>`;
  }

  let equivHTML = "";
  if (baseCurrency === "USD") {
    equivHTML = `<div class="prod-equiv" style="font-size:12px; color:var(--muted); margin-top:2px;">Bs. ${formatCurrency(converted.VES, 'VES').replace('Bs.', '').trim()} | ${formatCurrency(converted.EUR, 'EUR')}</div>`;
  } else if (baseCurrency === "EUR") {
    equivHTML = `<div class="prod-equiv" style="font-size:12px; color:var(--muted); margin-top:2px;">Bs. ${formatCurrency(converted.VES, 'VES').replace('Bs.', '').trim()} | ${formatCurrency(converted.USD, 'USD')}</div>`;
  } else {
    // Si la base fue VES
    equivHTML = `<div class="prod-equiv" style="font-size:12px; color:var(--muted); margin-top:2px;">${formatCurrency(converted.USD, 'USD')} | ${formatCurrency(converted.EUR, 'EUR')}</div>`;
  }

  return `
    <div class="prod-price-wrap">
      <div class="prod-price" style="margin-bottom:0;">${baseFmt}</div>
      ${equivHTML}
    </div>
  `;
}

// Iniciar carga de tasas inmediatamente
loadExchangeRates();
