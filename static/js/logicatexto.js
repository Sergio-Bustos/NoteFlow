// ========== ESTADO ==========
let notaGuardada = false;
let urlDestino   = null;

// ========== TEMA ==========
(function aplicarTema() {
    const match = document.cookie.split(';').find(c => c.trim().startsWith('tema='));
    if (!match) return;
    const valor   = match.split('=')[1]?.trim();
    const esOscuro = valor === 'Negro';
    document.body.classList.toggle('tema-oscuro', esOscuro);
    document.body.classList.toggle('tema-claro',  !esOscuro);
})();

window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
        const match = document.cookie.split(';').find(c => c.trim().startsWith('tema='));
        if (!match) return;
        const esOscuro = match.split('=')[1]?.trim() === 'Negro';
        document.body.classList.toggle('tema-oscuro', esOscuro);
        document.body.classList.toggle('tema-claro',  !esOscuro);
    }
});

// ========== MODAL SALIDA SIN GUARDAR ==========

// El HTML del editor ya trae #modalSalida; si no existiera lo inyectamos.
(function inyectarModalSiNoExiste() {
    if (document.getElementById('modalSalida')) return;
    const overlay = document.createElement('div');
    overlay.id        = 'modalSalida';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-icono"><i class="fas fa-exclamation-triangle"></i></div>
            <h3>¿Salir sin guardar?</h3>
            <p>Tienes cambios sin guardar. Si sales ahora, <strong>se perderán.</strong></p>
            <div class="modal-btns">
                <button class="btn-modal-cancelar" id="btnModalCancelar">Quedarse</button>
                <button class="btn-modal-salir"    id="btnModalSalir">Salir igual</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
})();

// Si el HTML original usa clases distintas, actualizamos el modal existente para que
// use las clases del sistema unificado.
(function normalizarModalHTML() {
    const overlay = document.getElementById('modalSalida');
    if (!overlay) return;
    const box = overlay.querySelector('.modal-box');
    if (!box) return;

    // Aseguramos que tenga el icono
    if (!box.querySelector('.modal-icono')) {
        const icono = document.createElement('div');
        icono.className = 'modal-icono';
        icono.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        box.insertBefore(icono, box.firstChild);
    }

    // Normalizar botones a las clases unificadas
    const btnCancelar = box.querySelector('.btn-cancelar-modal, #btnModalCancelar');
    const btnSalir    = box.querySelector('.btn-salir-modal, #btnModalSalir');
    if (btnCancelar) { btnCancelar.className = 'btn-modal-cancelar'; btnCancelar.id = 'btnModalCancelar'; }
    if (btnSalir)    { btnSalir.className    = 'btn-modal-salir';    btnSalir.id    = 'btnModalSalir';    }
})();

function mostrarModal() {
    document.getElementById('modalSalida').classList.add('visible');
}
function ocultarModal() {
    document.getElementById('modalSalida').classList.remove('visible');
    urlDestino = null;
}

document.addEventListener('click', function(e) {
    if (e.target.id === 'btnModalCancelar') ocultarModal();
    if (e.target.id === 'btnModalSalir') {
        notaGuardada = true;            // desactiva beforeunload
        ocultarModal();
        window.location.href = urlDestino || '/notas';
    }
    if (e.target.id === 'modalSalida') ocultarModal();
});

// ========== TOOLBAR ==========
function fmt(comando, e) {
    if (e) e.preventDefault();
    document.execCommand(comando, false, null);
    document.getElementById('cuerpo-nota').focus();
}

function cambiarTamano(valor) {
    if (!valor) return;
    document.execCommand('fontSize', false, valor);
    document.getElementById('cuerpo-nota').focus();
}

function cambiarColor(color) {
    document.execCommand('foreColor', false, color);
    const visual = document.getElementById('colorMuestra');
    if (visual) visual.style.backgroundColor = color;
    document.getElementById('cuerpo-nota').focus();
}

// ========== GUARDAR NOTA ==========
async function guardarNota() {
    const titulo      = document.getElementById('inputTitulo').value.trim();
    const descripcion = document.getElementById('inputDescripcion').value.trim();
    const etiquetas   = document.getElementById('inputEtiquetas').value.trim();
    const contenido   = document.getElementById('cuerpo-nota').innerHTML;
    const textoPlano  = document.getElementById('cuerpo-nota').innerText.trim();

    if (!titulo) {
        mostrarToast('Escribe un título para la nota');
        document.getElementById('inputTitulo').focus();
        return;
    }
    if (!textoPlano) {
        mostrarToast('La nota está vacía');
        document.getElementById('cuerpo-nota').focus();
        return;
    }

    const formData = new FormData();
    formData.append('titulo',      titulo);
    formData.append('descripcion', descripcion || `Nota de texto: ${titulo}`);
    formData.append('contenido',   contenido);
    formData.append('etiquetas',   etiquetas);

    try {
        const res  = await fetch('/guardar-nota-texto', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            notaGuardada = true;
            mostrarToast('Nota guardada correctamente');
            setTimeout(() => {
                window.location.href = data.redirect || '/notas';
            }, 1200);
        } else {
            mostrarToast(data.error || 'Error al guardar');
        }
    } catch (err) {
        console.error(err);
        mostrarToast('Error de conexión al servidor');
    }
}

// ========== BOTÓN VOLVER ==========
document.getElementById('btnVolver').addEventListener('click', function(e) {
    e.preventDefault();
    const textoPlano = document.getElementById('cuerpo-nota').innerText.trim();
    if (textoPlano && !notaGuardada) {
        urlDestino = '/notas';
        mostrarModal();
    } else {
        notaGuardada = true;
        window.location.href = '/notas';
    }
});

// ========== ADVERTENCIA AL CERRAR PESTAÑA ==========
window.addEventListener('beforeunload', function(e) {
    const textoPlano = document.getElementById('cuerpo-nota').innerText.trim();
    if (textoPlano && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ========== TOAST ==========
function mostrarToast(mensaje) {
    const t = document.getElementById('toast');
    t.textContent = mensaje;
    t.className   = 'toast';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}