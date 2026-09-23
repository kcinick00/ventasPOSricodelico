// =========================================================
// admin-subproductos.js - Administración de Subproductos
// =========================================================

let subproductoEditando = null;
let subproductosAdminCache = [];

// =========================================================
// ABRIR / CERRAR
// =========================================================
async function abrirAdminSubproductosGlobal() {
  console.log("📦 Abriendo admin subproductos");
  await cargarFiltroCategoriasSubproductos();
  await cargarListaSubproductosAdmin();
  document.getElementById('modalAdminSubproductos').classList.add('active');
}

function cerrarAdminSubproductos() {
  document.getElementById('modalAdminSubproductos').classList.remove('active');
  subproductoEditando = null;
  document.getElementById('adminFormSubproducto').classList.add('hidden');
  document.getElementById('adminSubBuscar').value = '';
  document.getElementById('adminSubFiltroCategoria').value = '';
}

// =========================================================
// CARGAR FILTRO DE CATEGORÍAS
// =========================================================
async function cargarFiltroCategoriasSubproductos() {
  const selectFiltro = document.getElementById('adminSubFiltroCategoria');
  const selectForm = document.getElementById('adminSubCategoria');

  selectFiltro.innerHTML = '<option value="">Todas las categorías</option>';
  selectForm.innerHTML = '<option value="">-- Selecciona --</option>';

  CATEGORIAS.forEach(cat => {
    const opt1 = document.createElement('option');
    opt1.value = cat.id;
    opt1.textContent = `${cat.emoji || '📦'} ${cat.nombre}`;
    selectFiltro.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = cat.id;
    opt2.textContent = `${cat.emoji || '📦'} ${cat.nombre}`;
    selectForm.appendChild(opt2);
  });
}

// =========================================================
// CARGAR LISTA
// =========================================================
async function cargarListaSubproductosAdmin() {
  const contenedor = document.getElementById('adminListaSubproductos');
  if (!contenedor) return;

  contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Cargando...</div>';

  try {
    if (!supabaseClient) throw new Error("Supabase no conectado");

    const filtroCat = document.getElementById('adminSubFiltroCategoria').value;
    const filtroTexto = document.getElementById('adminSubBuscar').value.trim().toLowerCase();

    let query = supabaseClient
      .from('subproductos_pos')
      .select('*')
      .order('categoria_id', { ascending: true })
      .order('orden', { ascending: true });

    if (filtroCat) query = query.eq('categoria_id', parseInt(filtroCat));

    const { data, error } = await query;
    if (error) throw error;

    subproductosAdminCache = data || [];

    let lista = subproductosAdminCache;
    if (filtroTexto) {
      lista = lista.filter(s => s.nombre.toLowerCase().includes(filtroTexto));
    }

    if (lista.length === 0) {
      contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Sin subproductos</div>';
      return;
    }

    contenedor.innerHTML = lista.map(s => {
      const cat = CATEGORIAS.find(c => c.id === s.categoria_id);
      const precio = parseFloat(s.precio_usd) || 0;

      return `
        <div class="admin-categoria-item" onclick="editarSubproducto(${s.id})">
          <div class="admin-cat-emoji">${cat?.emoji || '📦'}</div>
          <div class="admin-categoria-info">
            <div class="admin-categoria-nombre">${s.nombre}</div>
            <div class="admin-categoria-meta">
              ${cat ? cat.nombre : 'Sin categoría'} · 
              ${precio > 0 ? '$' + precio.toFixed(2) : 'Sin precio fijo'} · 
              ${s.activo ? '✅ Activo' : '❌ Inactivo'}
            </div>
          </div>
          <button class="btn-eliminar-admin" onclick="event.stopPropagation(); eliminarSubproducto(${s.id})">🗑️</button>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error("❌ Error cargando subproductos:", error);
    contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#f87171;">Error al cargar</div>';
  }
}

// =========================================================
// NUEVO SUBPRODUCTO
// =========================================================
function nuevoSubproducto() {
  subproductoEditando = null;
  document.getElementById('adminSubId').value = '';
  document.getElementById('adminSubNombre').value = '';
  document.getElementById('adminSubCategoria').value = '';
  document.getElementById('adminSubPrecio').value = '0';
  document.getElementById('adminSubOrden').value = '0';
  document.getElementById('adminSubTituloForm').textContent = '➕ Nuevo Subproducto';
  document.getElementById('btnEliminarSubproducto').classList.add('hidden');
  document.getElementById('adminFormSubproducto').classList.remove('hidden');
  document.getElementById('adminSubNombre').focus();
}

// =========================================================
// EDITAR SUBPRODUCTO
// =========================================================
function editarSubproducto(id) {
  const sub = subproductosAdminCache.find(s => s.id === id);
  if (!sub) return;

  subproductoEditando = sub;
  document.getElementById('adminSubId').value = sub.id;
  document.getElementById('adminSubNombre').value = sub.nombre || '';
  document.getElementById('adminSubCategoria').value = sub.categoria_id || '';
  document.getElementById('adminSubPrecio').value = sub.precio_usd || 0;
  document.getElementById('adminSubOrden').value = sub.orden || 0;
  document.getElementById('adminSubTituloForm').textContent = '✏️ Editar Subproducto';
  document.getElementById('btnEliminarSubproducto').classList.remove('hidden');
  document.getElementById('adminFormSubproducto').classList.remove('hidden');
  document.getElementById('adminFormSubproducto').scrollIntoView({ behavior: 'smooth' });
}

// =========================================================
// GUARDAR SUBPRODUCTO
// =========================================================
async function guardarSubproducto() {
  const nombre = document.getElementById('adminSubNombre').value.trim();
  const categoriaId = parseInt(document.getElementById('adminSubCategoria').value);
  const precio = parseFloat(document.getElementById('adminSubPrecio').value) || 0;
  const orden = parseInt(document.getElementById('adminSubOrden').value) || 0;

  if (!nombre) {
    alert('El nombre es obligatorio');
    return;
  }
  if (!categoriaId) {
    alert('Selecciona una categoría');
    return;
  }

  const datos = {
    nombre: nombre,
    categoria_id: categoriaId,
    precio_usd: precio,
    orden: orden,
    activo: true
  };

  try {
    if (subproductoEditando) {
      const { error } = await supabaseClient
        .from('subproductos_pos')
        .update(datos)
        .eq('id', subproductoEditando.id);
      if (error) throw error;
      showToast('✅ Subproducto actualizado', 'success');
    } else {
      const { error } = await supabaseClient
        .from('subproductos_pos')
        .insert([datos]);
      if (error) throw error;
      showToast('✅ Subproducto creado', 'success');
    }

    await cargarListaSubproductosAdmin();
    await cargarProductos();
    document.getElementById('adminFormSubproducto').classList.add('hidden');
    subproductoEditando = null;

  } catch (error) {
    console.error("❌ Error:", error);
    alert('Error: ' + error.message);
  }
}

// =========================================================
// ELIMINAR SUBPRODUCTO
// =========================================================
async function eliminarSubproducto(id) {
  const sub = subproductosAdminCache.find(s => s.id === id);
  if (!sub) return;

  if (!confirm(`¿Eliminar el subproducto "${sub.nombre}"?`)) return;

  try {
    const { error } = await supabaseClient
      .from('subproductos_pos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('✅ Subproducto eliminado', 'success');
    await cargarListaSubproductosAdmin();
    await cargarProductos();
    document.getElementById('adminFormSubproducto').classList.add('hidden');

  } catch (error) {
    console.error("❌ Error:", error);
    alert('Error: ' + error.message);
  }
}
