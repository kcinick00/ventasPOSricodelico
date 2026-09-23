// =========================================================
// config-letras.js - Configurador de tamaños de letra
// =========================================================

const TAMANOS_DEFAULT = {
  'categoria-nombre': 17,
  'subproducto': 20,
  'pedido-nombre': 15,
  'total-value': 22,
  'monto-display': 48,
  'modal-header h2': 30,
  'section-title': 24
};

let tamanosActuales = {};

// =========================================================
// ABRIR MODAL
// =========================================================
function abrirConfiguracionLetras() {
  // Cargar valores guardados
  cargarTamanosGuardados();

  // Actualizar sliders
  actualizarSliders();

  document.getElementById('modalConfigLetras').classList.add('active');
}

function cerrarConfiguracionLetras() {
  document.getElementById('modalConfigLetras').classList.remove('active');
}

// =========================================================
// CARGAR TAMAÑOS GUARDADOS
// =========================================================
function cargarTamanosGuardados() {
  const guardado = localStorage.getItem('ricodelico_tamanos_letras');
  if (guardado) {
    try {
      tamanosActuales = JSON.parse(guardado);
    } catch(e) {
      tamanosActuales = { ...TAMANOS_DEFAULT };
    }
  } else {
    tamanosActuales = { ...TAMANOS_DEFAULT };
  }

  // Aplicar todos los tamaños guardados
  Object.keys(tamanosActuales).forEach(clave => {
    aplicarTamanoLetra(clave, tamanosActuales[clave]);
  });

  // Actualizar la UI de los sliders
  actualizarSliders();
}

// =========================================================
// ACTUALIZAR SLIDERS CON VALORES ACTUALES
// =========================================================
function actualizarSliders() {
  const mapa = {
    'sliderCatNombre': { key: 'categoria-nombre', label: 'valCatNombre' },
    'sliderSubNombre': { key: 'subproducto', label: 'valSubNombre' },
    'sliderPedidoNombre': { key: 'pedido-nombre', label: 'valPedidoNombre' },
    'sliderTotales': { key: 'total-value', label: 'valTotales' },
    'sliderMontoDisplay': { key: 'monto-display', label: 'valMontoDisplay' },
    'sliderModalTitulo': { key: 'modal-header h2', label: 'valModalTitulo' },
    'sliderSeccionTitulo': { key: 'section-title', label: 'valSeccionTitulo' }
  };

  Object.keys(mapa).forEach(idSlider => {
    const slider = document.getElementById(idSlider);
    const label = document.getElementById(mapa[idSlider].label);
    const valor = tamanosActuales[mapa[idSlider].key] || TAMANOS_DEFAULT[mapa[idSlider].key];

    if (slider) slider.value = valor;
    if (label) label.textContent = valor + 'px';
  });
}

// =========================================================
// CAMBIAR TAMAÑO DE LETRA
// =========================================================
function cambiarTamanoLetra(clave, valor, idLabel) {
  const valorNum = parseInt(valor);
  tamanosActuales[clave] = valorNum;

  // Aplicar
  aplicarTamanoLetra(clave, valorNum);

  // Actualizar label
  const label = document.getElementById(idLabel);
  if (label) label.textContent = valorNum + 'px';

  // Guardar
  guardarTamanos();
}

// =========================================================
// APLICAR TAMAÑO A LOS ELEMENTOS
// =========================================================
function aplicarTamanoLetra(clave, valor) {
  // Caso especial: total-value (aplica a .value-usd y .value-bs)
  if (clave === 'total-value') {
    document.querySelectorAll('.total-row .value-usd').forEach(el => {
      el.style.fontSize = valor + 'px';
    });
    document.querySelectorAll('.total-row .value-bs').forEach(el => {
      el.style.fontSize = (valor - 4) + 'px'; // 4px menos que el USD
    });
    document.querySelectorAll('.total-row.total-final .value-bs').forEach(el => {
      el.style.fontSize = (valor + 2) + 'px';
    });
    return;
  }

  // Caso especial: subproducto
  if (clave === 'subproducto') {
    document.querySelectorAll('.subproducto').forEach(el => {
      el.style.fontSize = valor + 'px';
    });
    return;
  }

  // Caso normal: aplicar a todos los elementos con esa clase
  document.querySelectorAll('.' + clave.replace(/\s+/g, '.')).forEach(el => {
    el.style.fontSize = valor + 'px';
  });

  // También aplica a elementos con clase que coincida con clave
  document.querySelectorAll(clave).forEach(el => {
    el.style.fontSize = valor + 'px';
  });
}

// =========================================================
// GUARDAR EN LOCALSTORAGE
// =========================================================
function guardarTamanos() {
  localStorage.setItem('ricodelico_tamanos_letras', JSON.stringify(tamanosActuales));
}

// =========================================================
// RESETEAR A VALORES POR DEFECTO
// =========================================================
function resetearLetras() {
  if (!confirm('¿Restaurar todos los tamaños de letra por defecto?')) return;

  tamanosActuales = { ...TAMANOS_DEFAULT };
  guardarTamanos();

  // Aplicar todos
  Object.keys(tamanosActuales).forEach(clave => {
    aplicarTamanoLetra(clave, tamanosActuales[clave]);
  });

  // Actualizar sliders
  actualizarSliders();

  showToast('✅ Tamaños reseteados', 'success');
}

// =========================================================
// INICIALIZAR AL CARGAR LA PÁGINA
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  // Esperar un poco a que carguen todos los demás scripts
  setTimeout(() => {
    cargarTamanosGuardados();
  }, 500);
});
