// =========================================================
// voice.js - Reconocimiento de voz para RICODELICO
// v3.0 - Integrado + precio automático si no menciona monto
// =========================================================

let recognition = null;
let isListening = false;

// =========================================================
// INICIALIZAR
// =========================================================
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn("⚠️ Reconocimiento de voz no soportado");
    return null;
  }
  
  const rec = new SpeechRecognition();
  rec.lang = "es-VE";
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  
  rec.onstart = () => {
    isListening = true;
    updateMicButton(true);
    console.log("🎤 Escuchando...");
  };
  
  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("📝 Texto reconocido:", transcript);
    procesarDictado(transcript);
  };
  
  rec.onerror = (event) => {
    console.error("❌ Error de voz:", event.error);
    isListening = false;
    updateMicButton(false);
    
    if (event.error === "no-speech") {
      showToast("🎤 No te escuché, intenta de nuevo", "remove");
    } else if (event.error === "not-allowed") {
      showToast("⚠️ Permite el micrófono en la configuración", "remove");
    } else if (event.error === "service-not-allowed") {
      showToast("⚠️ Se requiere HTTPS. Sube la app a GitHub Pages", "remove");
    } else if (event.error === "audio-capture") {
      showToast("⚠️ No hay micrófono disponible", "remove");
    } else if (event.error === "network") {
      showToast("⚠️ Sin conexión a internet", "remove");
    } else {
      showToast(`⚠️ Error: ${event.error}`, "remove");
    }
  };
  
  rec.onend = () => {
    isListening = false;
    updateMicButton(false);
    console.log("🔇 Detenido");
  };
  
  return rec;
}

// =========================================================
// TOGGLE (activar/desactivar)
// =========================================================
function toggleVoiceRecognition() {
  if (!recognition) {
    recognition = initVoiceRecognition();
    if (!recognition) {
      showToast("⚠️ Reconocimiento de voz no soportado en este dispositivo", "remove");
      return;
    }
  }
  
  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch(e) {
      console.error("Error al iniciar:", e);
      recognition.stop();
    }
  }
}

// =========================================================
// PARSEAR MONTO DESDE TEXTO
// Convierte "1.80", "1,80", "180", "uno ochenta" a número
// =========================================================
function parsearMontoVoz(texto) {
  let t = texto.toLowerCase().trim();
  
  // Diccionario de números en palabras
  const palabrasNumeros = {
    "cero": 0, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4,
    "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9,
    "diez": 10, "once": 11, "doce": 12, "trece": 13, "catorce": 14,
    "quince": 15, "dieciseis": 16, "dieciséis": 16, "diecisiete": 17,
    "dieciocho": 18, "diecinueve": 19, "veinte": 20, "treinta": 30,
    "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70,
    "ochenta": 80, "noventa": 90, "cien": 100, "ciento": 100
  };
  
  // Reemplazar palabras por números
  let textoNumerico = t;
  Object.keys(palabrasNumeros).forEach(palabra => {
    const regex = new RegExp(`\\b${palabra}\\b`, "g");
    textoNumerico = textoNumerico.replace(regex, palabrasNumeros[palabra]);
  });
  
  // Normalizar separadores decimales
  textoNumerico = textoNumerico
    .replace(/\s+punto\s+/g, ".")
    .replace(/\s+coma\s+/g, ".")
    .replace(/\s+con\s+/g, ".")
    .replace(/\s+y\s+/g, ".")
    .replace(/,/g, ".");
  
  // Caso especial: "180" → "1.80"
  const matchEntero = textoNumerico.match(/\b(\d{3,})\b/);
  if (matchEntero && !textoNumerico.includes(".")) {
    const num = matchEntero[1];
    const entero = num.slice(0, -2);
    const decimales = num.slice(-2);
    textoNumerico = textoNumerico.replace(num, `${entero}.${decimales}`);
  }
  
  // Extraer el primer número
  const matchDecimal = textoNumerico.match(/(\d+(?:\.\d+)?)/);
  if (!matchDecimal) return null;
  
  let monto = parseFloat(matchDecimal[1]);
  
  if (monto >= 100 && Number.isInteger(monto)) {
    monto = monto / 100;
  }
  
  return monto;
}

// =========================================================
// PROCESAR DICTADO
// =========================================================
async function procesarDictado(texto) {
  console.log("🎯 Procesando:", texto);
  
  const textoLimpio = texto.toLowerCase()
    .replace(/[!?¿¡]/g, "")
    .replace(/dólares?|dolares?|usd|\$/g, " ")
    .replace(/de\s+/g, " ")
    .trim();
  
  // ========================================
  // 1. Intentar detectar el monto
  // ========================================
  let monto = parsearMontoVoz(textoLimpio);
  
  // ========================================
  // 2. Extraer el nombre del producto
  // ========================================
  let productoTexto = textoLimpio
    .replace(/\d+(?:[.,]\d+)?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  if (!productoTexto) {
    showToast("No entendí el producto", "remove");
    return;
  }
  
  console.log("🔍 Buscando:", productoTexto);
  
  // ========================================
  // 3. Buscar el producto en TODAS las fuentes
  // ========================================
  const resultado = await buscarProductoEnTodo(productoTexto);
  
  if (!resultado) {
    showToast(`No encontré "${productoTexto}"`, "remove");
    return;
  }
  
  // ========================================
  // 4. Si no hay monto, usar el precio del producto
  // ========================================
  if (!monto || monto <= 0) {
    if (resultado.precioUSD && resultado.precioUSD > 0) {
      monto = resultado.precioUSD;
      console.log(`💰 Usando precio del producto: $${monto}`);
    } else {
      showToast(`No entendí el monto para "${resultado.nombre}"`, "remove");
      return;
    }
  }
  
  // ========================================
  // 5. Validar tasa BCV
  // ========================================
  if (tasaBCV <= 0) {
    showToast("⚠️ Configura la tasa BCV primero", "remove");
    return;
  }
  
  // ========================================
  // 6. Agregar al pedido
  // ========================================
  pedido.push({
    id: resultado.id,
    nombre: resultado.nombre,
    categoria: resultado.categoria,
    montoUSD: monto,
    montoBs: monto * tasaBCV
  });
  
  showToast(`✓ ${resultado.nombre} $${monto.toFixed(2)}`, "success");
  renderPedido();
  actualizarTotales();
}

// =========================================================
// BUSCAR PRODUCTO EN TODO (subproductos + inventario + caché)
// =========================================================
async function buscarProductoEnTodo(texto) {
  const t = normalizarNombre(texto);
  if (!t) return null;
  
  // ========================================
  // 1. BUSCAR EN SUBPRODUCTOS (Supabase)
  // ========================================
  try {
    const { data: subs } = await supabaseClient
      .from('subproductos_pos')
      .select('*')
      .eq('activo', true);
    
    if (subs && subs.length > 0) {
      // Coincidencia exacta
      let match = subs.find(s => normalizarNombre(s.nombre) === t);
      
      // Coincidencia parcial
      if (!match) {
        match = subs.find(s => {
          const ns = normalizarNombre(s.nombre);
          return ns.includes(t) || t.includes(ns);
        });
      }
      
      // Por palabras clave
      if (!match) {
        match = subs.find(s => {
          const palabras = normalizarNombre(s.nombre).split(' ');
          return palabras.some(p => p.length > 3 && t.includes(p));
        });
      }
      
      if (match) {
        const cat = CATEGORIAS.find(c => c.id === match.categoria_id);
        return {
          id: match.id,
          nombre: match.nombre,
          categoria: cat ? cat.nombre : 'General',
          precioUSD: parseFloat(match.precio_usd) || 0
        };
      }
    }
  } catch (e) {
    console.warn("Error buscando en subproductos:", e);
  }
  
  // ========================================
  // 2. BUSCAR EN PRODUCTOS (inventario)
  // ========================================
  try {
    const { data: prods } = await supabaseClient
      .from('productos')
      .select('*');
    
    if (prods && prods.length > 0) {
      // Coincidencia exacta
      let match = prods.find(p => 
        (p.nombre_normalizado || normalizarNombre(p.nombre)) === t
      );
      
      // Coincidencia parcial
      if (!match) {
        match = prods.find(p => {
          const np = p.nombre_normalizado || normalizarNombre(p.nombre);
          return np.includes(t) || t.includes(np);
        });
      }
      
      // Por palabras
      if (!match) {
        match = prods.find(p => {
          const np = p.nombre_normalizado || normalizarNombre(p.nombre);
          const palabras = np.split(' ');
          return palabras.some(pal => pal.length > 3 && t.includes(pal));
        });
      }
      
      if (match) {
        return {
          id: match.id,
          nombre: match.nombre,
          categoria: 'Inventario',
          precioUSD: parseFloat(match.precio_venta_usd) || parseFloat(match.precio_compra_usd) || 0
        };
      }
    }
  } catch (e) {
    console.warn("Error buscando en productos:", e);
  }
  
  // ========================================
  // 3. BUSCAR EN CACHÉ LOCAL
  // ========================================
  const match = buscarProducto(texto);
  if (match) {
    return {
      id: match.id,
      nombre: match.nombre,
      categoria: 'General',
      precioUSD: match.precioUSD
    };
  }
  
  return null;
}

// =========================================================
// ACTUALIZAR BOTÓN DE MICRÓFONO
// =========================================================
function updateMicButton(listening) {
  const btn = document.getElementById("voice-btn");
  if (!btn) return;
  
  if (listening) {
    btn.classList.add("listening");
    btn.innerHTML = "🎙️";
  } else {
    btn.classList.remove("listening");
    btn.innerHTML = "🎤";
  }
}

// =========================================================
// INICIALIZAR AL CARGAR LA PÁGINA
// =========================================================
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("voice-btn");
  if (btn) {
    btn.addEventListener("click", toggleVoiceRecognition);
    console.log("🎤 Botón de voz conectado");
  }
});
