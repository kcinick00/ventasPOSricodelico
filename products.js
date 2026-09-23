// =========================================================
// products.js - Gestión de catálogo local / Supabase
// =========================================================

let categorias = [
  { id: "guapitos", nombre: "Guapitos/Arepas", emoji: "🫓", subproductos: [] },
  { id: "huevos", nombre: "Huevos", emoji: "🥚", subproductos: [] },
  { id: "leche", nombre: "Leche", emoji: "🥛", subproductos: [] },
  { id: "lomos", nombre: "Lomos/Carnes Artesanales", emoji: "🥩", subproductos: [] },
  { id: "mantequilla", nombre: "Mantequilla/Crema/Ricotta", emoji: "🧈", subproductos: [] },
  { id: "panes", nombre: "Panes/Tortillas", emoji: "🥖", subproductos: [] },
  { id: "quesos-blancos", nombre: "Quesos Blancos/Semiduros", emoji: "🧀", subproductos: [] },
  { id: "viveres-sin-iva", nombre: "Víveres sin IVA", emoji: "🛒", subproductos: [] },
  { id: "artesanales", nombre: "Productos Artesanales", emoji: "🎨", subproductos: [] },
  { id: "frutas", nombre: "Frutas/Verduras", emoji: "🥬", subproductos: [] },
  { id: "confiteria", nombre: "Confitería", emoji: "🍬", subproductos: [] },
  { id: "quesos-amarillos", nombre: "Quesos Amarillos/Curados", emoji: "🧀", subproductos: [] },
  { id: "refrescos", nombre: "Refrescos", emoji: "🥤", subproductos: [] },
  { id: "salchichones", nombre: "Salchichones/Curados", emoji: "🥓", subproductos: [] },
  { id: "salsas", nombre: "Salsas", emoji: "🥫", subproductos: [] },
  { id: "viveres-con-iva", nombre: "Víveres con IVA", emoji: "🛍️", subproductos: [] },
  { id: "embutidos", nombre: "Embutidos/Jamones", emoji: "🥓", subproductos: [] },
  { id: "higiene", nombre: "Higiene", emoji: "🧼", subproductos: [] }
];

let productosListaGlobal = [];

async function cargarProductos() {
  try {
    const { data, error } = await window.supabaseClient
      .from('productos')
      .select('*')
      .order('nombre');

    if (!error && data && data.length > 0) {
      productosListaGlobal = data;
      localStorage.setItem('ricodelico_productos_cache', JSON.stringify(data));
      organizarProductosEnCategorias(data);
      console.log("✅ Productos cargados desde Supabase");
      return;
    }
  } catch (e) {
    console.warn("⚠️ Fallo conexión con Supabase. Usando caché local.");
  }

  // Carga desde Caché en localStorage
  const cache = localStorage.getItem('ricodelico_productos_cache');
  if (cache) {
    productosListaGlobal = JSON.parse(cache);
    organizarProductosEnCategorias(productosListaGlobal);
  }
}

function organizarProductosEnCategorias(listaProductos) {
  // Resetear subproductos
  categorias.forEach(c => c.subproductos = []);

  listaProductos.forEach(p => {
    let cat = categorias.find(c => c.id === p.categoria || c.nombre === p.categoria);
    if (!cat) {
      cat = categorias.find(c => c.id === 'viveres-con-iva');
    }
    if (cat) {
      cat.subproductos.push({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        tiene_iva: p.tiene_iva,
        imagen_url: p.imagen_url,
        palabrasClave: Array.isArray(p.palabras_clave) ? p.palabras_clave : (p.palabras_clave || "").split(',').map(s => s.trim())
      });
    }
  });

  if (typeof renderCategorias === 'function') {
    renderCategorias();
  }
}