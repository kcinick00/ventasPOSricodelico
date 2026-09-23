// =========================================================
// productos.js - Carga de productos desde Supabase y CSV
// v3.0 - Soporte para imágenes de categorías
// =========================================================

let CATEGORIAS = [];
let PRODUCTOS = [];
let PRODUCTOS_POR_CATEGORIA = {};

// =========================================================
// CARGAR TODO
// =========================================================
async function cargarProductos() {
  console.log("📥 Cargando productos...");

  const exito = await cargarDesdeSupabase();

  if (!exito || PRODUCTOS.length === 0) {
    console.log("⚠️ Cargando desde CSV local...");
    await cargarDesdeCSV();
  }

  agruparPorCategoria();
  renderCategorias();
  console.log(`✅ ${PRODUCTOS.length} productos cargados`);
}

// =========================================================
// CARGAR DESDE SUPABASE
// =========================================================
async function cargarDesdeSupabase() {
  if (!supabaseClient) return false;

  try {
    // 1. Categorías (con imagen)
    const { data: cats, error: errCats } = await supabaseClient
      .from('categorias_pos')
      .select('*')
      .order('orden', { ascending: true });

    if (errCats) throw errCats;

    CATEGORIAS = (cats || []).map(c => ({
      id: c.id,
      nombre: c.nombre,
      emoji: c.emoji || '📦',
      imagen: c.imagen || null,
      orden: c.orden || 0
    }));

    // 2. Productos (de la tabla 'productos')
    const { data: prods, error: errProds } = await supabaseClient
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true });

    if (errProds) throw errProds;

    PRODUCTOS = (prods || []).map(p => ({
      id: p.id,
      nombre: p.nombre,
      nombreNormalizado: p.nombre_normalizado || normalizarNombre(p.nombre),
      categoriaId: null,
      precioUSD: parseFloat(p.precio_venta_usd) || parseFloat(p.precio_compra_usd) || 0,
      tieneIVA: parseFloat(p.iva) > 0,
      imagen: p.imagen || 'imagenes/default.png',
      palabrasClave: [],
      activo: true,
      esInventario: true
    }));

    console.log(`✅ Supabase: ${CATEGORIAS.length} cats, ${PRODUCTOS.length} prods`);
    return true;

  } catch (error) {
    console.error("❌ Error Supabase:", error);
    return false;
  }
}

// =========================================================
// CARGAR DESDE CSV LOCAL (respaldo)
// =========================================================
async function cargarDesdeCSV() {
  try {
    const resp = await fetch('datos/productos.csv');
    if (!resp.ok) throw new Error("No se encontró el CSV");

    const texto = await resp.text();
    const lineas = texto.split('\n').filter(l => l.trim() && !l.startsWith('#'));

    const headers = lineas[0].split(',').map(h => h.trim());
    const catsUnicas = new Map();

    PRODUCTOS = lineas.slice(1).map((linea, idx) => {
      const campos = linea.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h] = (campos[i] || '').trim());

      const nombreCat = obj.categoria || 'Sin categoría';
      if (!catsUnicas.has(nombreCat)) {
        catsUnicas.set(nombreCat, {
          id: catsUnicas.size + 1,
          nombre: nombreCat,
          emoji: '📦',
          imagen: null,
          orden: catsUnicas.size
        });
      }
      const cat = catsUnicas.get(nombreCat);

      return {
        id: idx + 1,
        nombre: obj.nombre,
        nombreNormalizado: normalizarNombre(obj.nombre),
        categoriaId: cat.id,
        precioUSD: parseFloat(obj.precio_usd) || 0,
        tieneIVA: obj.tiene_iva === 'true' || obj.tiene_iva === '1',
        imagen: obj.imagen || 'imagenes/default.png',
        palabrasClave: (obj.palabras_clave || '').split('|').filter(p => p),
        activo: true
      };
    });

    CATEGORIAS = Array.from(catsUnicas.values());
    console.log(`✅ CSV: ${CATEGORIAS.length} cats, ${PRODUCTOS.length} prods`);

  } catch (error) {
    console.error("❌ Error CSV:", error);
    CATEGORIAS = [];
    PRODUCTOS = [];
  }
}

// =========================================================
// AGRUPAR POR CATEGORÍA
// =========================================================
function agruparPorCategoria() {
  PRODUCTOS_POR_CATEGORIA = {};
  CATEGORIAS.forEach(cat => {
    PRODUCTOS_POR_CATEGORIA[cat.id] = PRODUCTOS.filter(p => p.categoriaId === cat.id);
  });
}

// =========================================================
// BUSCAR PRODUCTO
// =========================================================
function buscarProducto(texto) {
  if (!texto) return null;
  const t = normalizarNombre(texto);

  for (const p of PRODUCTOS) {
    for (const palabra of p.palabrasClave) {
      if (t.includes(normalizarNombre(palabra))) return p;
    }
  }

  for (const p of PRODUCTOS) {
    if (p.nombreNormalizado.includes(t) || t.includes(p.nombreNormalizado)) return p;
  }

  const palabras = t.split(' ');
  for (const p of PRODUCTOS) {
    const nombreP = p.nombreNormalizado;
    if (palabras.some(pal => pal.length > 3 && nombreP.includes(pal))) return p;
  }

  return null;
}

// =========================================================
// RENDER CATEGORÍAS (con soporte de imágenes)
// =========================================================
function renderCategorias() {
  const grid = document.getElementById("categorias-grid");
  if (!grid) return;
  grid.innerHTML = "";

  CATEGORIAS.forEach(cat => {
    const count = PRODUCTOS_POR_CATEGORIA[cat.id]?.length || 0;
    const div = document.createElement("div");
    div.className = "categoria";
    div.onclick = () => seleccionarCategoria(cat);

    let iconoHTML;
    if (cat.imagen && cat.imagen.trim() !== '' && !cat.imagen.includes('default.png')) {
      iconoHTML = `
        <div style="width: 60px; height: 60px; border-radius: 12px; overflow: hidden; background: var(--bg-soft); display: flex; align-items: center; justify-content: center;">
          <img src="${cat.imagen}" alt="${cat.nombre}"
               style="width: 100%; height: 100%; object-fit: cover;"
               onerror="this.parentElement.innerHTML='<span style=\\'font-size:32px;\\'>${cat.emoji || '📦'}</span>'">
        </div>
      `;
    } else {
      iconoHTML = `<span class="categoria-emoji">${cat.emoji || '📦'}</span>`;
    }

    div.innerHTML = `
      ${count > 0 ? `<span class="categoria-count">${count}</span>` : ""}
      ${iconoHTML}
      <span class="categoria-nombre">${cat.nombre}</span>
    `;
    grid.appendChild(div);
  });
}