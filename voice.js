// =========================================================
// voice.js - Reconocimiento de voz
// =========================================================

let recognition = null;
let isListening = false;

function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Reconocimiento de voz no soportado");
    return null;
  }
  
  const rec = new SpeechRecognition();
  rec.lang = "es-VE";
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  
  rec.onstart = () => { isListening = true; updateMicButton(true); };
  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("Texto:", transcript);
    procesarDictado(transcript);
  };
  rec.onerror = (event) => {
    console.error("Error voz:", event.error);
    isListening = false;
    updateMicButton(false);
    if (event.error === "no-speech") showToast("No te escuché", "remove");
    else if (event.error === "not-allowed") showToast("Permite el micrófono", "remove");
  };
  rec.onend = () => { isListening = false; updateMicButton(false); };
  
  return rec;
}

function toggleVoiceRecognition() {
  if (!recognition) {
    recognition = initVoiceRecognition();
    if (!recognition) {
      showToast("Reconocimiento de voz no soportado", "remove");
      return;
    }
  }
  
  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
      showToast("🎤 Escuchando...", "info");
    } catch(e) { recognition.stop(); }
  }
}

function parsearMonto(texto) {
  let t = texto.toLowerCase().trim();
  
  const palabrasNumeros = {
    "cero": 0, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4,
    "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9,
    "diez": 10, "once": 11, "doce": 12, "trece": 13, "catorce": 14,
    "quince": 15, "dieciseis": 16, "dieciséis": 16, "diecisiete": 17,
    "dieciocho": 18, "diecinueve": 19, "veinte": 20, "treinta": 30,
    "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70,
    "ochenta": 80, "noventa": 90, "cien": 100, "ciento": 100
  };
  
  let textoNumerico = t;
  Object.keys(palabrasNumeros).forEach(palabra => {
    const regex = new RegExp(`\\b${palabra}\\b`, "g");
    textoNumerico = textoNumerico.replace(regex, palabrasNumeros[palabra]);
  });
  
  textoNumerico = textoNumerico
    .replace(/\s+punto\s+/g, ".")
    .replace(/\s+coma\s+/g, ".")
    .replace(/\s+con\s+/g, ".")
    .replace(/\s+y\s+/g, ".")
    .replace(/,/g, ".");
  
  const matchEntero = textoNumerico.match(/\b(\d{3,})\b/);
  if (matchEntero && !textoNumerico.includes(".")) {
    const num = matchEntero[1];
    const entero = num.slice(0, -2);
    const decimales = num.slice(-2);
    textoNumerico = textoNumerico.replace(num, `${entero}.${decimales}`);
  }
  
  const matchDecimal = textoNumerico.match(/(\d+(?:\.\d+)?)/);
  if (!matchDecimal) return null;
  
  let monto = parseFloat(matchDecimal[1]);
  if (monto >= 100 && Number.isInteger(monto)) monto = monto / 100;
  
  return monto;
}

function procesarDictado(texto) {
  const textoLimpio = texto.toLowerCase()
    .replace(/[!?¿¡]/g, "")
    .replace(/dólares?|dolares?|usd|\$/g, " ")
    .trim();
  
  const monto = parsearMonto(textoLimpio);
  
  if (!monto || monto <= 0) {
    showToast("No entendí el monto. Ej: 1.80 de madurado", "remove");
    return;
  }
  
  if (tasaBCV <= 0) {
    showToast("Configura la tasa BCV primero", "remove");
    return;
  }
  
  let productoTexto = "";
  const matchDe = textoLimpio.match(/(?:de|del)\s+(.+)$/i);
  if (matchDe) {
    productoTexto = matchDe[1].trim();
  } else {
    productoTexto = textoLimpio.replace(/\d+(?:[.,]\d+)?/g, "").trim();
  }
  
  const coincidencia = buscarProducto(productoTexto);
  
  if (!coincidencia) {
    showToast(`No reconocí "${productoTexto}"`, "remove");
    return;
  }
  
  pedido.push({
    id: coincidencia.id,
    nombre: coincidencia.nombre,
    categoria: CATEGORIAS.find(c => c.id === coincidencia.categoriaId)?.nombre || 'General',
    montoUSD: monto,
    montoBs: monto * tasaBCV
  });
  
  showToast(`✓ ${coincidencia.nombre} $${monto.toFixed(2)}`, "success");
  renderPedido();
  actualizarTotales();
}

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

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("voice-btn");
  if (btn) btn.addEventListener("click", toggleVoiceRecognition);
});