/* ──────────────────────────────────────────
   SETUP CANVAS
────────────────────────────────────────── */
const canvas       = document.getElementById('pizarra');
const ctx          = canvas.getContext('2d');
const colorPicker  = document.getElementById('colorPicker');
const grosorInput  = document.getElementById('grosorPincel');
const grosorPunto  = document.getElementById('grosorPunto');
const canvasHint   = document.getElementById('canvasHint');

function ajustarCanvas() {
    const wrap     = canvas.parentElement;
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width   = wrap.clientWidth;
    canvas.height  = 520;
    ctx.putImageData(snapshot, 0, 0);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
}
ajustarCanvas();
window.addEventListener('resize', ajustarCanvas);

/* ──────────────────────────────────────────
   ESTADO
────────────────────────────────────────── */
let dibujando      = false;
let herramienta    = 'lapiz';
let xIni = 0, yIni = 0;
let snapshotForma  = null;
let historial      = [];
let lienzoPristino = true;
let notaGuardada   = false;

/* ──────────────────────────────────────────
   MODAL SALIDA SIN GUARDAR
────────────────────────────────────────── */

// Inyectar HTML del modal si no existe en el HTML original
(function inyectarModal() {
    if (document.getElementById('modalSalida')) return;
    const overlay = document.createElement('div');
    overlay.id        = 'modalSalida';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-icono"><i class="fas fa-exclamation-triangle"></i></div>
            <h3>¿Salir sin guardar?</h3>
            <p>Tienes un dibujo sin guardar. Si sales ahora, <strong>se perderá todo el trabajo.</strong></p>
            <div class="modal-btns">
                <button class="btn-modal-cancelar" id="btnModalCancelar">Seguir editando</button>
                <button class="btn-modal-salir"    id="btnModalSalir">Sí, salir</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
})();

let urlDestino = null;

function mostrarModal(url) {
    urlDestino = url;
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
    // Cerrar al hacer clic en el fondo
    if (e.target.id === 'modalSalida') ocultarModal();
});

/* beforeunload — solo dispara si hay cambios sin guardar */
window.addEventListener('beforeunload', function(e) {
    if (!lienzoPristino && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

/* Botón Volver */
document.getElementById('btnVolver').addEventListener('click', function(e) {
    if (!lienzoPristino && !notaGuardada) {
        e.preventDefault();
        mostrarModal(this.getAttribute('href') || '/notas');
    }
});

/* ──────────────────────────────────────────
   UTILIDADES
────────────────────────────────────────── */
function obtenerCoordenadas(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return {
        x: (src.clientX - rect.left) * (canvas.width  / rect.width),
        y: (src.clientY - rect.top)  * (canvas.height / rect.height)
    };
}

function colorActual()  { return colorPicker.value; }
function grosorActual() { return parseInt(grosorInput.value); }

function guardarEstado() {
    if (historial.length >= 30) historial.shift();
    historial.push(canvas.toDataURL());
}

function aplicarConfiguracion() {
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
    ctx.lineWidth = grosorActual();
    if (herramienta === 'borrador') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = colorActual();
    }
}

/* ──────────────────────────────────────────
   EVENTOS DE DIBUJO
────────────────────────────────────────── */
function iniciar(e) {
    e.preventDefault();
    dibujando = true;
    const { x, y } = obtenerCoordenadas(e);
    xIni = x; yIni = y;

    guardarEstado();

    if (['linea','rectangulo','circulo'].includes(herramienta)) {
        snapshotForma = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    if (herramienta === 'lapiz' || herramienta === 'borrador') {
        aplicarConfiguracion();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    if (lienzoPristino) {
        lienzoPristino = false;
        notaGuardada   = false;
        canvasHint.style.opacity = '0';
    }
}

function dibujar(e) {
    if (!dibujando) return;
    e.preventDefault();
    const { x, y } = obtenerCoordenadas(e);
    aplicarConfiguracion();

    if (herramienta === 'lapiz' || herramienta === 'borrador') {
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);

    } else if (herramienta === 'linea') {
        ctx.putImageData(snapshotForma, 0, 0);
        ctx.beginPath();
        ctx.moveTo(xIni, yIni);
        ctx.lineTo(x, y);
        ctx.stroke();

    } else if (herramienta === 'rectangulo') {
        ctx.putImageData(snapshotForma, 0, 0);
        ctx.beginPath();
        ctx.strokeRect(xIni, yIni, x - xIni, y - yIni);

    } else if (herramienta === 'circulo') {
        ctx.putImageData(snapshotForma, 0, 0);
        const rx = Math.abs(x - xIni) / 2;
        const ry = Math.abs(y - yIni) / 2;
        const cx = xIni + (x - xIni) / 2;
        const cy = yIni + (y - yIni) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

function detener(e) {
    if (!dibujando) return;
    dibujando     = false;
    ctx.beginPath();
    snapshotForma = null;
}

canvas.addEventListener('mousedown',  iniciar);
canvas.addEventListener('mousemove',  dibujar);
canvas.addEventListener('mouseup',    detener);
canvas.addEventListener('mouseleave', detener);
canvas.addEventListener('touchstart', iniciar,  { passive: false });
canvas.addEventListener('touchmove',  dibujar,  { passive: false });
canvas.addEventListener('touchend',   detener);

/* ──────────────────────────────────────────
   DESHACER (Ctrl+Z)
────────────────────────────────────────── */
function deshacer() {
    if (historial.length === 0) {
        mostrarToast('No hay más pasos para deshacer');
        return;
    }
    const img = new Image();
    img.src = historial.pop();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    if (historial.length === 0) {
        lienzoPristino = true;
        canvasHint.style.opacity = '1';
    }
}

document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        deshacer();
    }
});

/* ──────────────────────────────────────────
   SELECCIONAR HERRAMIENTA
────────────────────────────────────────── */
function seleccionarHerramienta(nombre, btn) {
    herramienta = nombre;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('activo'));
    btn.classList.add('activo');
    canvas.style.cursor = nombre === 'borrador' ? 'cell' : 'crosshair';
}

/* ──────────────────────────────────────────
   PALETA RÁPIDA
────────────────────────────────────────── */
document.getElementById('paleta').addEventListener('click', e => {
    const el = e.target.closest('.color-rapido');
    if (!el) return;
    colorPicker.value = el.dataset.color;
    document.querySelectorAll('.color-rapido').forEach(c => c.classList.remove('seleccionado'));
    el.classList.add('seleccionado');
    if (herramienta === 'borrador') {
        seleccionarHerramienta('lapiz', document.getElementById('btnLapiz'));
    }
});

colorPicker.addEventListener('input', () => {
    document.querySelectorAll('.color-rapido').forEach(c => c.classList.remove('seleccionado'));
});

/* ──────────────────────────────────────────
   PREVIEW GROSOR
────────────────────────────────────────── */
grosorInput.addEventListener('input', () => {
    const v    = parseInt(grosorInput.value);
    const size = Math.min(Math.max(v * 0.9, 3), 28);
    grosorPunto.style.width      = size + 'px';
    grosorPunto.style.height     = size + 'px';
    grosorPunto.style.background = colorPicker.value;
});
colorPicker.addEventListener('input', () => {
    grosorPunto.style.background = colorPicker.value;
});

/* ──────────────────────────────────────────
   LIMPIAR
────────────────────────────────────────── */
document.getElementById('btnLimpiar').addEventListener('click', () => {
    if (lienzoPristino) return;
    guardarEstado();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lienzoPristino = true;
    canvasHint.style.opacity = '1';
    mostrarToast('Lienzo limpiado');
});

/* ──────────────────────────────────────────
   GUARDAR NOTA
────────────────────────────────────────── */
async function guardarNota() {
    const titulo      = document.getElementById('inputTitulo').value.trim()      || 'Dibujo sin título';
    const descripcion = document.getElementById('inputDescripcion').value.trim() || '';
    const etiquetas   = document.getElementById('inputEtiquetas').value.trim();

    if (lienzoPristino) {
        mostrarToast('El lienzo está vacío. Dibuja algo primero.');
        return;
    }

    const btns = [document.getElementById('btnGuardar'), document.getElementById('btnGuardar2')];
    btns.forEach(b => { b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; });

    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('titulo',      titulo);
        formData.append('descripcion', descripcion);
        formData.append('etiquetas',   etiquetas);
        formData.append('formato',     'dibujo');
        formData.append('imagen',      blob, `${titulo.replace(/\s+/g,'_')}.png`);

        try {
            const resp = await fetch('/guardar-nota-dibujo', { method: 'POST', body: formData });
            const data = await resp.json();

            if (data.success) {
                notaGuardada = true;
                mostrarToast('Nota guardada correctamente');
                const est = document.getElementById('estadoGuardado');
                est.classList.add('visible');
                setTimeout(() => est.classList.remove('visible'), 3000);
            } else {
                mostrarToast(data.error || 'Error al guardar');
            }
        } catch {
            mostrarToast('Error de conexión');
        } finally {
            btns.forEach(b => { b.disabled = false; b.innerHTML = '<i class="fas fa-save"></i> Guardar nota'; });
        }
    }, 'image/png');
}

document.getElementById('btnGuardar').addEventListener('click',  guardarNota);
document.getElementById('btnGuardar2').addEventListener('click', guardarNota);

/* ──────────────────────────────────────────
   TOAST
────────────────────────────────────────── */
let toastTimer = null;
function mostrarToast(msg) {
    const t = document.getElementById('toastDibujo');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 3000);
}