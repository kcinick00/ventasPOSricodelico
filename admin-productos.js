// =========================================================
// admin-categorias.js - Administración de Categorías
// =========================================================

let categoriaEditando = null;
let categoriasAdminCache = [];

// =========================================================
// ABRIR / CERRAR
// =========================================================
async function abrirAdminCategorias() {
  console.log("📁 Abriendo admin categorías");
  await cargarListaCategoriasAdmin();
  document.getElementById('modalAdminCategorias').classList.add('active');
}

function cerrarAdminCategorias() {
  document.getElementById('modalAdminCategorias').classList.remove('active');
  categoriaEditando = null;
  document.getElementById('adminFormCategoria').classList.add('hidden');
  document.getElementById('adminCatBuscar').value = '';
}

// =========================================================
// CARGAR LISTA
// =========================================================
async function cargarListaCategoriasAdmin(filtro = '') {
  const contenedor = document.getElementById('adminListaCategorias');
  if (!contenedor) return;

  contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Cargando...</div>';

  try {
    if (!supabaseClient) throw new Error("Supabase no conectado");

    const { data, error } = await supabaseClient
      .from('categorias_pos')
      .select('*')
      .order('orden', { ascending: true });

    if (error) throw error;

    categoriasAdminCache = data || [];

    let lista = categoriasAdminCache;
    if (filtro) {
      const f = normalizarNombre(filtro);
      lista = lista.filter(c => normalizarNombre(c.nombre).includes(f));
    }

    if (lista.length === 0) {
      contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Sin categorías</div>';
      return;
    }

    contenedor.innerHTML = lista.map(c => {
      const totalProds = PRODUCTOS.filter(p => p.categoriaId === c.id).length;

      let iconoHTML;
      if (c.imagen && c.imagen.trim() !== '') {
        iconoHTML = `<img src="${c.imagen}" alt="${c.nombre}" onerror="this.src='imagenes/default.png'">`;
      } else {
        iconoHTML = `<div class="admin-cat-emoji">${c.emoji || '📦'}</div>`;
      }

      return `
        <div class="admin-categoria-item" onclick="editarCategoria(${c.id})">
          ${iconoHTML}
          <div class="admin-categoria-info">
            <div class="admin-categoria-nombre">${c.nombre}</div>
            <div class="admin-categoria-meta">
              ${c.emoji ? c.emoji + ' · ' : ''}${totalProds} subproducto${totalProds !== 1 ? 's' : ''} · Orden ${c.orden || 0}
            </div>
          </div>
          <button class="btn-eliminar-admin" onclick="event.stopPropagation(); eliminarCategoria(${c.id})">🗑️</button>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error("❌ Error cargando categorías:", error);
    contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#f87171;">Error al cargar</div>';
  }
}

function filtrarCategoriasAdmin(texto) {
  cargarListaCategoriasAdmin(texto);
}

// =========================================================
// NUEVA CATEGORÍA
// =========================================================
function nuevaCategoria() {
  categoriaEditando = null;
  document.getElementById('adminCatId').value = '';
  document.getElementById('adminCatNombre').value = '';
  document.getElementById('adminCatEmoji').value = '📦';
  document.getElementById('adminCatOrden').value = 0;
  document.getElementById('adminCatImagenPreview').src = 'imagenes/default.png';
  document.getElementById('adminCatTituloForm').textContent = '➕ Nueva Categoría';
  document.getElementById('btnEliminarCategoria').classList.add('hidden');
  document.getElementById('adminFormCategoria').classList.remove('hidden');
  document.getElementById('adminCatNombre').focus();
}

// =========================================================
// EDITAR CATEGORÍA
// =========================================================
function editarCategoria(id) {
  const cat = categoriasAdminCache.find(c => c.id === id);
  if (!cat) return;

  categoriaEditando = cat;

  document.getElementById('adminCatId').value = cat.id;
  document.getElementById('adminCatNombre').value = cat.nombre || '';
  document.getElementById('adminCatEmoji').value = cat.emoji || '';
  document.getElementById('adminCatOrden').value = cat.orden || 0;
  document.getElementById('adminCatImagenPreview').src = cat.imagen || 'imagenes/default.png';
  document.getElementById('adminCatTituloForm').textContent = '✏️ Editar Categoría';
  document.getElementById('btnEliminarCategoria').classList.remove('hidden');
  document.getElementById('adminFormCategoria').classList.remove('hidden');
  document.getElementById('adminFormCategoria').scrollIntoView({ behavior: 'smooth' });
}

// =========================================================
// SUBIR IMAGEN
// =========================================================
function subirImagenCategoria(event) {
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

  const preview = document.getElementById('adminCatImagenPreview');
  preview.src = URL.createObjectURL(file);
  window._imagenCategoriaPendiente = file;
}

async function subirImagenCategoriaASupabase(file, nombreCategoria) {
  try {
    const ext = file.name.split('.').pop();
    const nombreLimpio = normalizarNombre(nombreCategoria).replace(/\s+/g, '_');
    const nombreArchivo = `cat_${nombreLimpio}_${Date.now()}.${ext}`;

    const { error } = await supabaseClient.storage
      .from('productos')
      .upload(nombreArchivo, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
      .from('productos')
      .getPublicUrl(nombreArchivo);

    console.log("✅ Imagen subida:", urlData.publicUrl);
    return urlData.publicUrl;

  } catch (error) {
    console.error("❌ Error subiendo imagen:", error);
    return null;
  }
}

// =========================================================
// GUARDAR CATEGORÍA
// =========================================================
async function guardarCategoria() {
  const nombre = document.getElementById('adminCatNombre').value.trim();
  const emoji = document.getElementById('adminCatEmoji').value.trim() || '📦';
  const orden = parseInt(document.getElementById('adminCatOrden').value) || 0;

  if (!nombre) {
    alert('El nombre es obligatorio');
    return;
  }

  let imagenUrl = document.getElementById('adminCatImagenPreview').src;
  if (window._imagenCategoriaPendiente) {
    const urlSubida = await subirImagenCategoriaASupabase(window._imagenCategoriaPendiente, nombre);
    if (urlSubida) imagenUrl = urlSubida;
    window._imagenCategoriaPendiente = null;
  }

  const datos = {
    nombre: nombre,
    emoji: emoji,
    orden: orden,
    imagen: imagenUrl
  };

  try {
    if (categoriaEditando) {
      const { error } = await supabaseClient
        .from('categorias_pos')
        .update(datos)
        .eq('id', categoriaEditando.id);

      if (error) throw error;
      console.log("✅ Categoría actualizada");

    } else {
      const { error } = await supabaseClient
        .from('categorias_pos')
        .insert([datos]);

      if (error) throw error;
      console.log("✅ Categoría creada");
    }

    await cargarProductos();
    await cargarListaCategoriasAdmin();

    document.getElementById('adminFormCategoria').classList.add('hidden');
    categoriaEditando = null;

    showToast('✅ Categoría guardada', 'success');

  } catch (error) {
    console.error("❌ Error guardando categoría:", error);
    alert('Error al guardar: ' + error.message);
  }
}

// =========================================================
// ELIMINAR CATEGORÍA
// =========================================================
async function eliminarCategoria(id) {
  const cat = categoriasAdminCache.find(c => c.id === id);
  if (!cat) return;

  const totalProds = PRODUCTOS.filter(p => p.categoriaId === id).length;

  let mensaje = `¿Eliminar la categoría "${cat.nombre}"?`;
  if (totalProds > 0) {
    mensaje += `\n\n⚠️ También se eliminarán ${totalProds} subproductos asociados.`;
  }
  mensaje += `\n\nEsta acción NO se puede deshacer.`;

  if (!confirm(mensaje)) return;

  try {
    const { error } = await supabaseClient
      .from('categorias_pos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log("✅ Categoría eliminada");
    await cargarProductos();
    await cargarListaCategoriasAdmin();
    document.getElementById('adminFormCategoria').classList.add('hidden');

    showToast('✅ Categoría eliminada', 'success');

  } catch (error) {
    console.error("❌ Error eliminando:", error);
    alert('Error: ' + error.message);
  }
}