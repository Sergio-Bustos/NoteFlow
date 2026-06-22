// ========== LÍMITES POR PLAN ==========
const LIMITES = {
    'gratis': 5000,
    'quincenal': 15000,
    'mensual': 50000,
    'anual': 250000
};

const PLAN_ACTUAL = window.USER_PLAN || 'gratis';
const LIMITE_CARACTERES = LIMITES[PLAN_ACTUAL] || LIMITES['gratis'];

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

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('cuerpo-nota');
    const limitDisplay = document.getElementById('char-limit');
    
    if (limitDisplay) limitDisplay.textContent = LIMITE_CARACTERES.toLocaleString();
    
    actualizarContador();

    // Eventos para el contador y límite
    if (editor) {
        editor.addEventListener('input', () => {
            actualizarContador();
            verificarLimite();
        });

        // Manejo de pegado (Paste) para quitar fondo negro y estilos extraños
        editor.addEventListener('paste', (e) => {
            e.preventDefault();
            const html = e.clipboardData.getData('text/html');
            const text = e.clipboardData.getData('text/plain');

            if (html) {
                // Limpiar el HTML: remover estilos de fondo y colores que vienen de Google/etc
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Remover todos los estilos de fondo y forzar herencia o limpieza
                const allElements = doc.querySelectorAll('*');
                allElements.forEach(el => {
                    el.style.backgroundColor = '';
                    // Si el color es negro puro y estamos en tema oscuro, quizás queramos dejarlo, 
                    // pero lo mejor es limpiar el color de fondo totalmente.
                    if (el.style.color === 'rgb(0, 0, 0)' || el.style.color === '#000000') {
                        el.style.color = ''; 
                    }
                });

                document.execCommand('insertHTML', false, doc.body.innerHTML);
            } else {
                document.execCommand('insertText', false, text);
            }
            actualizarContador();
        });
    }
});

function actualizarContador() {
    const editor = document.getElementById('cuerpo-nota');
    const contador = document.getElementById('char-count');
    if (!editor || !contador) return;

    const longitud = editor.innerText.length;
    contador.textContent = longitud.toLocaleString();

    if (longitud > LIMITE_CARACTERES) {
        contador.style.color = 'var(--rojo)';
    } else {
        contador.style.color = 'var(--morado-medio)';
    }
}

function verificarLimite() {
    const editor = document.getElementById('cuerpo-nota');
    if (!editor) return;

    if (editor.innerText.length > LIMITE_CARACTERES) {
        mostrarToast(`Has superado el límite de ${LIMITE_CARACTERES} caracteres para tu plan ${PLAN_ACTUAL}.`);
    }
}

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
    const editor = document.getElementById('cuerpo-nota');
    if (editor) editor.focus();
    actualizarContador();
}

function cambiarTamano(valor) {
    if (!valor) return;
    document.execCommand('fontSize', false, valor);
    const editor = document.getElementById('cuerpo-nota');
    if (editor) editor.focus();
}

function cambiarColor(color) {
    document.execCommand('foreColor', false, color);
    const visual = document.getElementById('colorMuestra');
    if (visual) visual.style.backgroundColor = color;
    const editor = document.getElementById('cuerpo-nota');
    if (editor) editor.focus();
}

// ========== GUARDAR NOTA ==========
async function guardarNota() {
    const titulo      = document.getElementById('inputTitulo').value.trim();
    const descripcion = document.getElementById('inputDescripcion').value.trim();
    const etiquetas   = document.getElementById('inputEtiquetas').value.trim();
    const cuerpo      = document.getElementById('cuerpo-nota');
    if (!cuerpo) return;
    
    const contenido   = cuerpo.innerHTML;
    const textoPlano  = cuerpo.innerText.trim();

    if (!textoPlano) {
        mostrarToast('La nota está vacía');
        cuerpo.focus();
        return;
    }

    // Verificar límite antes de guardar
    if (cuerpo.innerText.length > LIMITE_CARACTERES) {
        mostrarToast(`No puedes guardar la nota porque excede el límite de ${LIMITE_CARACTERES} caracteres de tu plan.`);
        return;
    }

    const formData = new FormData();
    formData.append('titulo',      titulo);
    formData.append('descripcion', descripcion || `Nota de texto: ${titulo}`);
    formData.append('contenido',   contenido);
    formData.append('etiquetas',   etiquetas);

    const editId = document.getElementById('editNotaId')?.value;
    const url    = editId ? `/actualizar-nota-texto/${editId}` : '/guardar-nota-texto';

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

    try {
        const res  = await fetch(url, { method: 'POST', headers: { 'X-CSRFToken': csrfToken }, body: formData });
        const data = await res.json();

        if (data.success) {
            notaGuardada = true;
            mostrarToast(data.mensaje || 'Nota guardada correctamente');
            setTimeout(() => {
                window.location.href = data.redirect || '/notas';
            }, 1200);
        } else {
            mostrarToast(data.error || 'Error al guardar');
        }
    } catch (err) {
        console.error('Error en fetch:', err);
        mostrarToast('Error de conexión al servidor');
    }
}


// ========== BOTÓN VOLVER ==========
const btnVolver = document.getElementById('btnVolver');
if (btnVolver) {
    btnVolver.addEventListener('click', function(e) {
        e.preventDefault();
        const editor = document.getElementById('cuerpo-nota');
        const textoPlano = editor ? editor.innerText.trim() : '';
        if (textoPlano && !notaGuardada) {
            urlDestino = '/notas';
            mostrarModal();
        } else {
            notaGuardada = true;
            window.location.href = '/notas';
        }
    });
}

// ========== ADVERTENCIA AL CERRAR PESTAÑA ==========
window.addEventListener('beforeunload', function(e) {
    const editor = document.getElementById('cuerpo-nota');
    const textoPlano = editor ? editor.innerText.trim() : '';
    if (textoPlano && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ========== TOAST ==========
function mostrarToast(mensaje) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = mensaje;
    t.className   = 'toast';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}