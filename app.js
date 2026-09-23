// =========================================================
// app.js - RICODELICO CAJA v7.0
// Impresión optimizada para tablet + todos los cambios
// =========================================================

// =========================================================
// VARIABLES GLOBALES
// =========================================================
let pedido = [];
let tasaBCV = 0;
let tasaActual = null;
let categoriaActual = null;
let montoProductoActual = null;
let montoActualTexto = "";
let historial = [];
let productosCategoriaActual = [];
let esCategoriaInventario = false;

// =========================================================
// UTILIDADES
// =========================================================
const fmtUSD = n => "$" + (parseFloat(n) || 0).toFixed(2);

const fmtBs = n => (parseFloat(n) || 0).toLocaleString("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}) + " Bs";

// =========================================================
// TOAST
// =========================================================
function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? "✓" : type === "remove" ? "✕" : "ℹ";
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.classList.add("toast-hiding");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// =========================================================
// TASA BCV
// =========================================================
async function cargarTasa() {
  const inputTasa = document.getElementById("tasa-bcv");
  const ultimaTasa = localStorage.getItem("ricodelico_tasa");
  const ultimaFecha = localStorage.getItem("ricodelico_fecha_tasa");

  if (ultimaTasa && ultimaFecha) {
    inputTasa.value = parseFloat(ultimaTasa).toFixed(2);
    tasaBCV = parseFloat(ultimaTasa);
    tasaActual = tasaBCV;
  }

  let tasaSupabase = null;
  let fechaSupabase = null;

  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('tasa_bcv')
        .select('*')
        .eq('id', 1)
        .single();

      if (!error && data && data.tasa > 0) {
        tasaSupabase = parseFloat(data.tasa);
        fechaSupabase = data.fecha || 'Sin fecha';
        console.log(`✅ Tasa en Supabase: ${tasaSupabase} (${fechaSupabase})`);
      }
    }
  } catch (e) {
    console.warn('⚠️ Supabase tasa:', e.message);
  }

  let tasaEsReciente = false;
  if (fechaSupabase && fechaSupabase !== 'Sin fecha') {
    try {
      const [fechaParte] = fechaSupabase.split(',');
      const [dia, mes, anio] = fechaParte.trim().split('/').map(Number);
      const fechaTasa = new Date(anio, mes - 1, dia);
      const diffDias = Math.floor((new Date() - fechaTasa) / (1000 * 60 * 60 * 24));
      if (diffDias <= 2) tasaEsReciente = true;
    } catch (e) {}
  }

  if (tasaSupabase && tasaEsReciente) {
    aplicarTasa(tasaSupabase, fechaSupabase);
    return;
  }

  const apis = [
    { name: 'DolarAPI', url: 'https://ve.dolarapi.com/v1/dolares/oficial',
      parse: d => d && d.promedio ? { tasa: parseFloat(d.promedio), fecha: new Date() } : null },
    { name: 'CriptoYa', url: 'https://criptoya.com/api/dolaroficial',
      parse: d => d && d.bcv && d.bcv.price ? { tasa: parseFloat(d.bcv.price), fecha: new Date() } : null }
  ];

  for (const api of apis) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(api.url, { signal: controller.signal, cache: 'no-cache' });
      clearTimeout(timeoutId);

      if (!resp.ok) continue;
      const data = await resp.json();
      const resultado = api.parse(data);

      if (resultado && resultado.tasa > 0) {
        const fechaStr = resultado.fecha.toLocaleString('es-VE', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });

        try {
          if (supabaseClient) {
            await supabaseClient.from('tasa_bcv').upsert({
              id: 1, tasa: resultado.tasa, fecha: fechaStr,
              updated_at: new Date().toISOString()
            });
          }
        } catch (e) {}

        aplicarTasa(resultado.tasa, fechaStr);
        return;
      }
    } catch (e) {
      console.warn(`⚠️ ${api.name} falló:`, e.message);
    }
  }

  if (tasaSupabase) {
    aplicarTasa(tasaSupabase, fechaSupabase + ' (vieja)');
  }
}

function aplicarTasa(tasa, fechaStr) {
  const inputTasa = document.getElementById("tasa-bcv");
  const tasaAnterior = tasaBCV;

  tasaBCV = tasa;
  tasaActual = tasa;
  localStorage.setItem("ricodelico_tasa", tasaBCV);
  localStorage.setItem("ricodelico_fecha_tasa", fechaStr);

  if (inputTasa) inputTasa.value = tasaBCV.toFixed(2);
  actualizarTotales();

  console.log(`✅ Tasa aplicada: ${tasaBCV.toFixed(2)} Bs (${fechaStr})`);

  if (tasaAnterior && Math.abs(tasaAnterior - tasa) > 0.01) {
    showToast(`💱 Nueva tasa: ${tasaBCV.toFixed(2)} Bs`, "info");
  }
}

function guardarTasa(valor) {
  tasaBCV = parseFloat(valor) || 0;
  tasaActual = tasaBCV;
  localStorage.setItem("ricodelico_tasa", tasaBCV);
  actualizarTotales();
  actualizarPreviewMonto();
}

// =========================================================
// SELECCIONAR CATEGORÍA
// =========================================================
async function seleccionarCategoria(cat) {
  esCategoriaInventario = cat.nombre.toLowerCase().includes('inventario');

  if (esCategoriaInventario) {
    await cargarProductosInventario();
  } else {
    await cargarSubproductos(cat.id);
  }

  if (productosCategoriaActual.length === 0) {
    showToast(`No hay productos en "${cat.nombre}"`, "remove");
    return;
  }

  document.getElementById("modal-categoria-nombre").textContent =
    `${cat.emoji || '📦'} ${cat.nombre}`;

  const buscador = document.getElementById("buscador-subproductos");
  const buscadorContainer = buscador.parentElement;

  if (esCategoriaInventario) {
    buscadorContainer.style.display = "block";
    buscador.value = "";
    
    buscador.oninput = (e) => {
      const filtro = normalizarNombre(e.target.value);
      if (!filtro) {
        renderSubproductos(productosCategoriaActual);
        return;
      }
      const filtrados = productosCategoriaActual.filter(p =>
        p.nombreNormalizado.includes(filtro)
      );
      renderSubproductos(filtrados);
    };
  } else {
    buscadorContainer.style.display = "none";
    buscador.value = "";
    buscador.oninput = null;
  }

  renderSubproductos(productosCategoriaActual);

  document.getElementById("modal-subproductos").classList.add("active");

  if (esCategoriaInventario) {
    setTimeout(() => buscador.focus(), 200);
  }
}

// =========================================================
// CARGAR SUBPRODUCTOS
// =========================================================
async function cargarSubproductos(categoriaId) {
  productosCategoriaActual = [];

  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('subproductos_pos')
        .select('*')
        .eq('categoria_id', categoriaId)
        .eq('activo', true)
        .order('orden', { ascending: true });

      if (error) throw error;

      productosCategoriaActual = (data || []).map(p => ({
        id: p.id,
        nombre: p.nombre,
        nombreNormalizado: normalizarNombre(p.nombre),
        precioUSD: parseFloat(p.precio_usd) || 0,
        tieneIVA: false,
        categoriaId: p.categoria_id
      }));
    }
  } catch (error) {
    console.error("❌ Error cargando subproductos:", error);
  }
}

// =========================================================
// CARGAR PRODUCTOS DE INVENTARIO
// =========================================================
async function cargarProductosInventario() {
  productosCategoriaActual = [];

  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;

      productosCategoriaActual = (data || []).map(p => ({
        id: p.id,
        nombre: p.nombre,
        nombreNormalizado: p.nombre_normalizado || normalizarNombre(p.nombre),
        precioUSD: parseFloat(p.precio_venta_usd) || parseFloat(p.precio_compra_usd) || 0,
        tieneIVA: parseFloat(p.iva) > 0,
        esInventario: true
      }));
    }
  } catch (error) {
    console.error("❌ Error cargando inventario:", error);
  }
}

// =========================================================
// RENDERIZAR SUBPRODUCTOS
// =========================================================
function renderSubproductos(lista) {
  const contenedor = document.getElementById("subproductos-lista");

  if (lista.length === 0) {
    contenedor.innerHTML = '<div class="empty-msg" style="grid-column: 1/-1; padding: 20px;">Sin resultados</div>';
    return;
  }

  contenedor.innerHTML = lista.map(p => `
    <div class="subproducto" onclick="abrirModalMontoConPrecio(${p.id}, ${esCategoriaInventario})">
      <div style="font-weight: 800; font-size: 18px; line-height: 1.35;">
        ${p.nombre}
      </div>
      ${p.precioUSD > 0
        ? `<div style="margin-top: 8px; color: var(--accent); font-weight: 900; font-size: 18px; font-family: 'JetBrains Mono', monospace;">$${p.precioUSD.toFixed(2)}</div>`
        : ''}
    </div>
  `).join("");
}

function cerrarModalSubproductos() {
  document.getElementById("modal-subproductos").classList.remove("active");
}

// =========================================================
// MODAL MONTO
// =========================================================
function abrirModalMontoConPrecio(productoId, esInventario = false) {
  const producto = productosCategoriaActual.find(p => p.id === productoId);
  if (!producto) return;

  cerrarModalSubproductos();

  montoProductoActual = {
    id: producto.id,
    nombre: producto.nombre,
    categoria: esInventario ? 'Inventario' : 'General',
    esInventario: esInventario
  };

  document.getElementById("monto-producto").textContent = producto.nombre;

  if (producto.precioUSD > 0) {
    const centavos = Math.round(producto.precioUSD * 100);
    montoActualTexto = centavos.toString();
  } else {
    montoActualTexto = "";
  }

  document.getElementById("monto-display").textContent = formatearMontoDisplay(montoActualTexto);
  actualizarPreviewMonto();
  document.getElementById("modal-monto").classList.add("active");
}

function cerrarModalMonto() {
  document.getElementById("modal-monto").classList.remove("active");
  montoProductoActual = null;
  montoActualTexto = "";
}

// =========================================================
// TECLADO NUMÉRICO (formato centavos automático)
// =========================================================
function presionarTecla(tecla) {
  if (tecla === 'C') {
    montoActualTexto = "";
  } else if (tecla === '.') {
    return;
  } else {
    if (!/^\d$/.test(tecla)) return;
    if (montoActualTexto.length >= 8) return;
    
    if (montoActualTexto === "0") {
      montoActualTexto = tecla;
    } else {
      montoActualTexto += tecla;
    }
  }

  document.getElementById("monto-display").textContent = formatearMontoDisplay(montoActualTexto);
  actualizarPreviewMonto();
}

function formatearMontoDisplay(texto) {
  if (!texto || texto === "") return "0.00";
  
  const num = parseInt(texto, 10) || 0;
  const dolares = Math.floor(num / 100);
  const centavos = num % 100;
  
  return `${dolares}.${centavos.toString().padStart(2, '0')}`;
}

function obtenerMontoNumerico() {
  if (!montoActualTexto || montoActualTexto === "") return 0;
  const num = parseInt(montoActualTexto, 10) || 0;
  return num / 100;
}

function actualizarPreviewMonto() {
  const monto = obtenerMontoNumerico();
  const preview = document.getElementById("monto-bs-preview");
  if (preview) preview.textContent = fmtBs(monto * tasaBCV);
}

function confirmarMonto() {
  const monto = obtenerMontoNumerico();

  if (!monto || monto <= 0) {
    showToast("Ingresa un monto válido", "remove");
    return;
  }
  if (tasaBCV <= 0) {
    showToast("Configura la tasa BCV primero", "remove");
    return;
  }

  pedido.push({
    id: montoProductoActual.id,
    nombre: montoProductoActual.nombre,
    categoria: montoProductoActual.categoria,
    montoUSD: monto,
    montoBs: monto * tasaBCV
  });

  showToast(`${montoProductoActual.nombre} agregado`, "success");
  cerrarModalMonto();
  renderPedido();
  actualizarTotales();
}

// =========================================================
// PEDIDO
// =========================================================
function renderPedido() {
  const lista = document.getElementById("pedido-lista");
  if (!lista) return;
  lista.innerHTML = "";

  if (pedido.length === 0) {
    lista.innerHTML = '<li class="empty-msg">Sin productos aún</li>';
    return;
  }

  pedido.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "pedido-item";
    li.innerHTML = `
      <span class="pedido-nombre">${item.nombre}</span>
      <span class="pedido-usd">${fmtUSD(item.montoUSD)}</span>
      <span class="pedido-bs">${fmtBs(item.montoBs)}</span>
      <button class="pedido-eliminar" onclick="eliminarItem(${idx})">🗑</button>
    `;
    lista.appendChild(li);
  });
}

function eliminarItem(idx) {
  const item = pedido[idx];
  if (!item) return;
  pedido.splice(idx, 1);
  showToast(`${item.nombre} eliminado`, "remove");
  renderPedido();
  actualizarTotales();
}

function actualizarTotales() {
  const totalUSD = pedido.reduce((s, i) => s + i.montoUSD, 0);
  const totalBs = pedido.reduce((s, i) => s + i.montoBs, 0);
  document.getElementById("total-usd").textContent = fmtUSD(totalUSD);
  document.getElementById("total-bs").textContent = fmtBs(totalBs);
}

function limpiarPedido() {
  if (pedido.length === 0) return;
  if (!confirm("¿Eliminar todos los productos?")) return;
  pedido = [];
  renderPedido();
  actualizarTotales();
  showToast("Pedido limpiado", "info");
}

// =========================================================
// IMPRIMIR TICKET (compatible con Android/Tablet)
// =========================================================
async function imprimirTicket() {
  if (pedido.length === 0) {
    showToast("No hay productos", "remove");
    return;
  }
  if (tasaBCV <= 0) {
    showToast("Configura la tasa BCV", "remove");
    return;
  }

  const totalUSD = pedido.reduce((s, i) => s + i.montoUSD, 0);
  const totalBs = pedido.reduce((s, i) => s + i.montoBs, 0);

  const ahora = new Date();
  const fecha = ahora.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = ahora.toTimeString().slice(0, 8);
  const numero = Date.now().toString().slice(-6);

  let itemsHTML = "";
  pedido.forEach(item => {
    itemsHTML += `
      <tr>
        <td class="prod">${item.nombre}</td>
        <td class="usd">${fmtUSD(item.montoUSD)}</td>
        <td class="bs">${item.montoBs.toLocaleString("es-VE", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      </tr>
    `;
  });

  const ticketHTML = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo RICODELICO</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      
      html, body {
        background: #E5E5E5;
        font-family: 'Arial', sans-serif;
        margin: 0;
        padding: 0;
      }
      
      .barra-acciones {
        position: sticky;
        top: 0;
        background: #0F0F0F;
        padding: 14px;
        display: flex;
        gap: 10px;
        z-index: 100;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      
      .btn-imprimir {
        flex: 2;
        background: #B4FF39;
        color: #000;
        border: none;
        padding: 18px;
        border-radius: 10px;
        font-size: 20px;
        font-weight: 900;
        cursor: pointer;
        letter-spacing: 1px;
      }
      
      .btn-cerrar {
        flex: 1;
        background: #333;
        color: #FFF;
        border: none;
        padding: 18px;
        border-radius: 10px;
        font-size: 18px;
        font-weight: 900;
        cursor: pointer;
      }
      
      .ticket {
        width: 80mm;
        max-width: 100%;
        margin: 16px auto;
        background: #FFF;
        padding: 10px 12px;
        color: #000;
        font-size: 13px;
        font-weight: bold;
        line-height: 1.3;
      }
      
      .ticket .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
      .ticket .header h1 { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
      .ticket .header p { font-size: 11px; font-weight: bold; margin: 2px 0; }
      .ticket .info { font-size: 12px; font-weight: bold; margin-bottom: 8px; }
      .ticket .info-row { display: flex; justify-content: space-between; padding: 2px 0; }
      .ticket .info-row .label { font-weight: 900; }
      .ticket .separator { border-top: 1px dashed #000; margin: 8px 0; }
      .ticket table { width: 100%; border-collapse: collapse; margin: 6px 0; }
      .ticket table th { font-size: 12px; font-weight: 900; text-align: left; border-bottom: 1px solid #000; padding: 4px 0; text-transform: uppercase; }
      .ticket table th.usd, .ticket table th.bs { text-align: right; }
      .ticket table td { padding: 3px 0; font-size: 12px; font-weight: bold; vertical-align: top; }
      .ticket table td.usd, .ticket table td.bs { text-align: right; font-weight: 900; }
      .ticket table td.prod { text-transform: uppercase; }
      .ticket .total { display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 900; padding: 8px 0; margin-top: 6px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
      .ticket .footer { text-align: center; font-size: 11px; font-weight: bold; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000; }
      .ticket .gracias { font-size: 15px; font-weight: 900; margin-top: 6px; }
      .ticket .tasa-ref { font-size: 11px; text-align: center; margin-top: 6px; }
      
      @media print {
        html, body {
          background: #FFF;
          width: 80mm;
          max-width: 80mm;
        }
        .barra-acciones { display: none !important; }
        .ticket {
          margin: 0;
          padding: 4px 6px;
          width: 80mm;
          max-width: 80mm;
          box-shadow: none;
        }
      }
    </style>
    </head>
    <body>
    
    <div class="barra-acciones">
      <button class="btn-imprimir" onclick="window.print()">🖨️ IMPRIMIR</button>
      <button class="btn-cerrar" onclick="window.close()">✕ CERRAR</button>
    </div>
    
    <div class="ticket">
      <div class="header">
        <h1>RICODELICO, C.A.</h1>
        <p>J-50395785-9</p>
        <p>CALLE 41 SECTOR CANAIMA CC VIENTO NORTE LOCAL 4</p>
        <p>MARACAIBO, EDO. ZULIA.</p>
      </div>
      <div class="info">
        <div class="info-row"><span class="label">Recibo:</span><span>${numero}</span></div>
        <div class="info-row"><span class="label">Fecha:</span><span>${fecha} ${hora}</span></div>
      </div>
      <div class="separator"></div>
      <table>
        <thead><tr><th>Producto</th><th class="usd">USD</th><th class="bs">Bs</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
      </table>
      <div class="total"><span>Total USD</span><span>${fmtUSD(totalUSD)}</span></div>
      <div class="total"><span>Total Bs</span><span>${totalBs.toLocaleString("es-VE", {minimumFractionDigits: 2, maximumFractionDigits: 2})} Bs.</span></div>
      <div class="tasa-ref">Tasa REF.: ${tasaBCV.toLocaleString("es-VE", {minimumFractionDigits: 2, maximumFractionDigits: 2})} Bs.</div>
      <div class="footer"><p class="gracias">GRACIAS POR SU COMPRA!!!</p></div>
    </div>
    
    </body></html>
  `;

  const printWindow = window.open("", "_blank", "width=500,height=800");
  
  if (!printWindow) {
    showToast("⚠️ Permite las ventanas emergentes para imprimir", "remove");
    return;
  }
  
  printWindow.document.open();
  printWindow.document.write(ticketHTML);
  printWindow.document.close();

  await guardarEnHistorial({ numero, fecha, hora, items: [...pedido], totalUSD, totalBs, tasaBCV });
  // ✅ Limpiar el pedido automáticamente después de imprimir
  pedido = [];
  renderPedido();
  actualizarTotales();
  
  showToast("✅ Ticket generado. Pedido listo para el siguiente cliente.", "success");}

// =========================================================
// HISTORIAL DE FACTURAS
// =========================================================
async function guardarEnHistorial(factura) {
  historial.push(factura);
  localStorage.setItem("ricodelico_historial", JSON.stringify(historial));

  if (supabaseClient) {
    try {
      const fechaISO = factura.fecha.split('/').reverse().join('-');
      
      const { error } = await supabaseClient
        .from('facturas_pos')
        .insert([{
          numero: factura.numero,
          fecha: fechaISO,
          hora: factura.hora,
          items: factura.items,
          total_usd: factura.totalUSD,
          total_bs: factura.totalBs,
          tasa_bcv: factura.tasaBCV
        }]);
      
      if (error) {
        console.error("❌ Error guardando en Supabase:", error);
      } else {
        console.log("✅ Factura guardada en Supabase");
      }
    } catch (e) {
      console.error("❌ Error guardando factura:", e);
    }
  }
}

function cargarHistorial() {
  const guardado = localStorage.getItem("ricodelico_historial");
  if (guardado) {
    try { historial = JSON.parse(guardado) || []; }
    catch(e) { historial = []; }
  }
}

async function abrirHistorial() {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById("filtro-fecha-historial").value = hoy;
  await cargarHistorialPorFecha(hoy);
  document.getElementById("modal-historial").classList.add("active");
}

async function cargarHistorialPorFecha(fechaISO) {
  const lista = document.getElementById("historial-lista");
  lista.innerHTML = '<div class="empty-msg" style="text-align: center; padding: 20px; color: #888;">Cargando...</div>';

  if (!fechaISO) {
    fechaISO = new Date().toISOString().split('T')[0];
    document.getElementById("filtro-fecha-historial").value = fechaISO;
  }

  let facturas = [];

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('facturas_pos')
        .select('*')
        .eq('fecha', fechaISO)
        .order('hora', { ascending: false });

      if (error) throw error;

      facturas = (data || []).map(f => ({
        id: f.id,
        numero: f.numero,
        fecha: fechaISO.split('-').reverse().join('/'),
        hora: f.hora,
        items: f.items || [],
        totalUSD: parseFloat(f.total_usd) || 0,
        totalBs: parseFloat(f.total_bs) || 0,
        tasaBCV: parseFloat(f.tasa_bcv) || 0
      }));
    } catch (e) {
      console.error("❌ Error cargando facturas:", e);
    }
  }

  const totalUSD = facturas.reduce((s, f) => s + f.totalUSD, 0);
  const totalBs = facturas.reduce((s, f) => s + f.totalBs, 0);

  document.getElementById("resumen-count").textContent = facturas.length;
  document.getElementById("resumen-usd").textContent = fmtUSD(totalUSD);
  document.getElementById("resumen-bs").textContent = fmtBs(totalBs);

  if (facturas.length === 0) {
    lista.innerHTML = '<div class="empty-msg" style="text-align: center; padding: 30px; color: #888; font-size: 15px;">Sin facturas en esta fecha</div>';
    return;
  }

  lista.innerHTML = facturas.map(f => {
    const itemsTexto = f.items.map(i => i.nombre).join(', ');
    return `
      <div class="factura-card" onclick="abrirDetalleFacturaHistorial(${f.id})">
        <div class="factura-card-header">
          <span class="factura-numero">#${f.numero}</span>
          <span class="factura-hora">🕐 ${f.hora}</span>
        </div>
        <div class="factura-totales">
          <span class="factura-total-usd">${fmtUSD(f.totalUSD)}</span>
          <span class="factura-total-bs">${fmtBs(f.totalBs)}</span>
        </div>
        <div class="factura-items">
          📦 ${f.items.length} producto${f.items.length !== 1 ? 's' : ''}: ${itemsTexto.substring(0, 60)}${itemsTexto.length > 60 ? '...' : ''}
        </div>
      </div>
    `;
  }).join("");

  window._facturasActuales = facturas;
}

function abrirDetalleFacturaHistorial(facturaId) {
  const factura = window._facturasActuales?.find(f => f.id === facturaId);
  if (!factura) return;

  let itemsHTML = factura.items.map(item => `
    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 15px;">
      <span style="font-weight: 600;">${item.nombre}</span>
      <span style="font-family: 'JetBrains Mono', monospace; color: var(--accent); font-weight: 800;">
        ${fmtUSD(item.montoUSD)}
      </span>
    </div>
  `).join("");

  const detalleHTML = `
    <div style="padding: 10px;">
      <div style="background: var(--bg); padding: 14px; border-radius: 10px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 12px; font-weight: 700;">FACTURA</span>
          <span style="font-weight: 900; color: var(--accent); font-size: 16px;">#${factura.numero}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 12px; font-weight: 700;">FECHA</span>
          <span style="font-size: 15px;">${factura.fecha} ${factura.hora}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted); font-size: 12px; font-weight: 700;">TASA BCV</span>
          <span style="font-size: 15px;">${fmtBs(factura.tasaBCV).replace(' Bs', '')} Bs/USD</span>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
          Productos (${factura.items.length})
        </div>
        ${itemsHTML}
      </div>
      
      <div style="background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%); padding: 16px; border-radius: 10px; color: #0F0F0F;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 800; font-size: 14px;">TOTAL USD</span>
          <span style="font-weight: 900; font-family: 'JetBrains Mono', monospace; font-size: 18px;">${fmtUSD(factura.totalUSD)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: 800; font-size: 14px;">TOTAL Bs</span>
          <span style="font-weight: 900; font-family: 'JetBrains Mono', monospace; font-size: 16px;">${fmtBs(factura.totalBs)}</span>
        </div>
      </div>
      
      <button onclick="reimprimirTicketHistorial(${factura.id})" 
              style="width: 100%; margin-top: 16px; padding: 14px; background: var(--card); color: var(--text); border: 2px solid var(--border); border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 16px;">
        🖨 Reimprimir Ticket
      </button>
    </div>
  `;

  const modal = document.getElementById("modal-detalle-factura");
  if (!modal) {
    const newModal = document.createElement("div");
    newModal.id = "modal-detalle-factura";
    newModal.className = "modal-overlay";
    newModal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2>Detalle de Factura</h2>
          <button class="modal-close" onclick="document.getElementById('modal-detalle-factura').classList.remove('active')">✕</button>
        </div>
        <div class="modal-body" id="modal-detalle-factura-body"></div>
      </div>
    `;
    document.body.appendChild(newModal);
  }

  document.getElementById("modal-detalle-factura-body").innerHTML = detalleHTML;
  document.getElementById("modal-detalle-factura").classList.add("active");
}

function reimprimirTicketHistorial(facturaId) {
  const factura = window._facturasActuales?.find(f => f.id === facturaId);
  if (!factura) return;

  const pedidoOriginal = [...pedido];
  const tasaOriginal = tasaBCV;

  pedido = factura.items;
  tasaBCV = factura.tasaBCV;

  imprimirTicket();

  pedido = pedidoOriginal;
  tasaBCV = tasaOriginal;
}

function cerrarHistorial() {
  document.getElementById("modal-historial").classList.remove("active");
}

// =========================================================
// TECLADO FÍSICO
// =========================================================
document.addEventListener("keydown", (e) => {
  const modalMonto = document.getElementById("modal-monto");
  if (!modalMonto || !modalMonto.classList.contains("active")) return;

  const tecla = e.key;

  if (tecla >= '0' && tecla <= '9') {
    e.preventDefault();
    presionarTecla(tecla);
    return;
  }

  if (tecla === '.' || tecla === ',') {
    e.preventDefault();
    return;
  }

  if (tecla === 'Backspace') {
    e.preventDefault();
    if (montoActualTexto.length > 0) {
      montoActualTexto = montoActualTexto.slice(0, -1);
      document.getElementById("monto-display").textContent = formatearMontoDisplay(montoActualTexto);
      actualizarPreviewMonto();
    }
    return;
  }

  if (tecla === 'Escape' || tecla === 'Delete') {
    e.preventDefault();
    presionarTecla('C');
    return;
  }

  if (tecla === 'Enter') {
    e.preventDefault();
    confirmarMonto();
    return;
  }
});

// =========================================================
// CÓDIGO DE BARRAS
// =========================================================
let bufferCodigoBarras = "";
let ultimoTiempoTecla = 0;

document.addEventListener("keypress", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  
  const ahora = Date.now();
  
  if (ahora - ultimoTiempoTecla > 100) {
    bufferCodigoBarras = "";
  }
  
  ultimoTiempoTecla = ahora;
  
  if (e.key === "Enter" && bufferCodigoBarras.length > 3) {
    const codigo = bufferCodigoBarras;
    bufferCodigoBarras = "";
    console.log("🔍 Código de barras:", codigo);
    buscarPorCodigoBarras(codigo);
    return;
  }
  
  bufferCodigoBarras += e.key;
});

async function buscarPorCodigoBarras(codigo) {
  if (!supabaseClient) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('productos')
      .select('*')
      .eq('codigo_barras', codigo)
      .single();
    
    if (error || !data) {
      showToast(`Código ${codigo} no encontrado`, "remove");
      return;
    }
    
    const precio = parseFloat(data.precio_venta_usd) || 0;
    
    pedido.push({
      id: data.id,
      nombre: data.nombre,
      categoria: 'Inventario',
      montoUSD: precio,
      montoBs: precio * tasaBCV
    });
    
    showToast(`✓ ${data.nombre} agregado`, "success");
    renderPedido();
    actualizarTotales();
    
  } catch (e) {
    console.error("Error buscando código:", e);
  }
}

// =========================================================
// INICIALIZACIÓN
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 POS Ricodelico iniciado");

  await cargarTasa();
  await cargarProductos();
  cargarHistorial();
  renderPedido();
  actualizarTotales();

  const tasaInput = document.getElementById("tasa-bcv");
  if (tasaInput) {
    tasaInput.addEventListener("change", (e) => guardarTasa(e.target.value));
  }

  const dictadoInput = document.getElementById("dictado-input");
  if (dictadoInput) {
    dictadoInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        procesarDictadoManual(dictadoInput.value);
        dictadoInput.value = "";
      }
    });
  }
});

function procesarDictadoManual(texto) {
  if (!texto || !texto.trim()) return;
  procesarDictado(texto.trim());
}
