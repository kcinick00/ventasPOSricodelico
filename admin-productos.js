// =========================================================
// admin-productos.js - Administración de Productos (Inventario)
// =========================================================

let productoEditando = null;

// =========================================================
// ABRIR / CERRAR
// =========================================================
async function abrirAdminProductos() {
  console.log("⚙️ Abriendo admin productos");
  await cargarCategoriasSelect();
  await cargarListaProductosAdmin();
  document.getElementById('modalAdminProductos').classList.add('active');
}

function cerrarAdminProductos() {
  document.getElementById('modalAdminProductos').classList.remove('active');
  productoEditando = null;
  document.getElementById('adminFormProducto').classList.add('hidden');
  document.getElementById('adminBuscar').value = '';
}

// =========================================================
// CARGAR SELECT DE CATEGORÍAS
// =========================================================
async function cargarCategoriasSelect() {
  const select = document.getElementById('adminProductoCategoria');
  if (!select) return;
  
  select.innerHTML = '<option value="">-- Selecciona --</option>';
  CATEGORIAS.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.emoji || '📦'} ${cat.nombre}`;
    select.appendChild(opt);
  });
}

// =========================================================
// CARGAR LISTA DE PRODUCTOS
// =========================================================
async function cargarListaProductosAdmin(filtro = '') {
  const contenedor = document.getElementById('adminListaProductos');
  if (!contenedor) return;

  contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Cargando...</div>';

  try {
    let query = supabaseClient
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    let lista = data || [];

    if (filtro) {
      const f = normalizarNombre(filtro);
      lista = lista.filter(p => 
        normalizarNombre(p.nombre).includes(f) ||
        (p.nombre_normalizado || '').includes(f)
      );
    }

    if (lista.length === 0) {
      contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Sin productos</div>';
      return;
    }

    contenedor.innerHTML = lista.map(p => {
      const precio = parseFloat(p.precio_venta_usd) || 0;
      const tieneIva = parseFloat(p.iva) > 0;

      return `
        <div class="admin-producto-item" onclick="editarProducto(${p.id})">
          <img src="${p.imagen || 'imagenes/default.png'}" alt="${p.nombre}" onerror="this.src='imagenes/default.png'">
          <div class="admin-producto-info">
            <div class="admin-producto-nombre">${p.nombre}</div>
            <div class="admin-producto-cat">
              ${tieneIva ? '✅ IVA' : '🚫 Exento'} · Stock: ${p.stock || 0}
            </div>
            <div class="admin-producto-precio">$${precio.toFixed(2)}</div>
          </div>
          <button class="btn-eliminar-admin" onclick="event.stopPropagation(); eliminarProducto(${p.id})">🗑️</button>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error("❌ Error cargando productos:", error);
    contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#f87171;">Error al cargar</div>';
  }
}

function buscarEnAdmin(texto) {
  cargarListaProductosAdmin(texto);
}

// =========================================================
// NUEVO PRODUCTO
// =========================================================
function nuevoProducto() {
  productoEditando = null;
  document.getElementById('adminProductoId').value = '';
  document.getElementById('adminProductoNombre').value = '';
  document.getElementById('adminProductoCategoria').value = '';
  document.getElementById('adminProductoPrecio').value = '';
  document.getElementById('adminProductoIVA').checked = true;
  document.getElementById('adminProductoPalabras').value = '';
  document.getElementById('adminProductoImagenPreview').src = 'imagenes/default.png';
  document.getElementById('adminTituloForm').textContent = '➕ Nuevo Producto';
  document.getElementById('btnEliminarProducto').classList.add('hidden');
  document.getElementById('adminFormProducto').classList.remove('hidden');
  document.getElementById('adminProductoNombre').focus();
}

// =========================================================
// EDITAR PRODUCTO
// =========================================================
function editarProducto(id) {
  const prod = (window._productosAdminCache || []).find(p => p.id === id);
  if (!prod) {
    // Si no está en caché, buscar de nuevo
    supabaseClient
      .from('productos')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          abrirEditarProducto(data);
        }
      });
    return;
  }
  abrirEditarProducto(prod);
}

function abrirEditarProducto(prod) {
  productoEditando = prod;
  document.getElementById('adminProductoId').value = prod.id;
  document.getElementById('adminProductoNombre').value = prod.nombre || '';
  document.getElementById('adminProductoCategoria').value = prod.categoria_id || '';
  document.getElementById('adminProductoPrecio').value = parseFloat(prod.precio_venta_usd) || 0;
  document.getElementById('adminProductoIVA').checked = parseFloat(prod.iva) > 0;
  document.getElementById('adminProductoPalabras').value = (prod.palabras_clave || []).join(', ');
  document.getElementById('adminProductoImagenPreview').src = prod.imagen || 'imagenes/default.png';
  document.getElementById('adminTituloForm').textContent = '✏️ Editar Producto';
  document.getElementById('btnEliminarProducto').classList.remove('hidden');
  document.getElementById('adminFormProducto').classList.remove('hidden');
  document.getElementById('adminFormProducto').scrollIntoView({ behavior: 'smooth' });
}

// =========================================================
// SUBIR IMAGEN
// =========================================================
function subirImagenProducto(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Solo se permiten imágenes');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    alert('La imagen no debe pesar más de 2MB');
    return;
  }

  const preview = document.getElementById('adminProductoImagenPreview');
  preview.src = URL.createObjectURL(file);
  window._imagenProductoPendiente = file;
}

async function subirImagenProductoASupabase(file, nombreProducto) {
  try {
    const ext = file.name.split('.').pop();
    const nombreLimpio = normalizarNombre(nombreProducto).replace(/\s+/g, '_');
    const nombreArchivo = `prod_${nombreLimpio}_${Date.now()}.${ext}`;

    const { error } = await supabaseClient.storage
      .from('productos')
      .upload(nombreArchivo, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
      .from('productos')
      .getPublicUrl(nombreArchivo);

    return urlData.publicUrl;

  } catch (error) {
    console.error("❌ Error subiendo imagen:", error);
    return null;
  }
}

// =========================================================
// GUARDAR PRODUCTO
// =========================================================
async function guardarProducto() {
  const nombre = document.getElementById('adminProductoNombre').value.trim();
  const categoriaId = parseInt(document.getElementById('adminProductoCategoria').value);
  const precio = parseFloat(document.getElementById('adminProductoPrecio').value) || 0;
  const tieneIVA = document.getElementById('adminProductoIVA').checked;
  const palabrasTexto = document.getElementById('adminProductoPalabras').value.trim();

  if (!nombre) {
    alert('El nombre es obligatorio');
    return;
  }
  if (!precio || precio <= 0) {
    alert('El precio debe ser mayor a 0');
    return;
  }

  const palabrasClave = palabrasTexto
    ? palabrasTexto.split(',').map(p => p.trim()).filter(p => p)
    : [];

  let imagenUrl = document.getElementById('adminProductoImagenPreview').src;
  if (window._imagenProductoPendiente) {
    const urlSubida = await subirImagenProductoASupabase(window._imagenProductoPendiente, nombre);
    if (urlSubida) imagenUrl = urlSubida;
    window._imagenProductoPendiente = null;
  }

  const datos = {
    nombre: nombre,
    nombre_normalizado: normalizarNombre(nombre),
    categoria_id: categoriaId || null,
    precio_venta_usd: precio,
    iva: tieneIVA ? 16 : 0,
    palabras_clave: palabrasClave,
    imagen: imagenUrl,
    updated_at: new Date().toISOString()
  };

  try {
    if (productoEditando) {
      const { error } = await supabaseClient
        .from('productos')
        .update(datos)
        .eq('id', productoEditando.id);
      if (error) throw error;
      showToast('✅ Producto actualizado', 'success');
    } else {
      datos.activo = true;
      const { error } = await supabaseClient
        .from('productos')
        .insert([datos]);
      if (error) throw error;
      showToast('✅ Producto creado', 'success');
    }

    await cargarProductos();
    await cargarListaProductosAdmin();

    document.getElementById('adminFormProducto').classList.add('hidden');
    productoEditando = null;

  } catch (error) {
    console.error("❌ Error guardando:", error);
    alert('Error: ' + error.message);
  }
}

// =========================================================
// ELIMINAR PRODUCTO
// =========================================================
async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;

  try {
    const { error } = await supabaseClient
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('✅ Producto eliminado', 'success');
    await cargarProductos();
    await cargarListaProductosAdmin();
    document.getElementById('adminFormProducto').classList.add('hidden');

  } catch (error) {
    console.error("❌ Error eliminando:", error);
    alert('Error: ' + error.message);
  }
}
