// ══════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════
const canvasVisible  = document.getElementById('canvasVisible');
const ctxVisible     = canvasVisible.getContext('2d');
const canvasBuffer   = document.getElementById('canvasBuffer');
const ctxBuffer      = canvasBuffer.getContext('2d');
const fileInput      = document.getElementById('upload-input');
const placeholder    = document.getElementById('canvasPlaceholder');

// ══════════════════════════════════════════════
//  ESTADO
// ══════════════════════════════════════════════
let imgOriginal        = new Image();
let zoom               = 1;
let angulo             = 0;
let filtroMoradoActivo = false;
let dibujando          = false;
let xAnterior = 0, yAnterior = 0;
let trazosPaint        = [];
let imagenCargada      = false;
let notaGuardada       = false;

// ══════════════════════════════════════════════
//  MODAL SALIDA SIN GUARDAR
// ══════════════════════════════════════════════

(function inyectarModal() {
    const overlay = document.createElement('div');
    overlay.id        = 'modalSalida';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-icono"><i class="fas fa-exclamation-triangle"></i></div>
            <h3>¿Salir sin guardar?</h3>
            <p>Tienes cambios sin guardar. Si sales ahora, <strong>se perderá todo el trabajo.</strong></p>
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
    if (e.target.id === 'modalSalida') ocultarModal();
});

window.addEventListener('beforeunload', function(e) {
    if (imagenCargada && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

document.getElementById('btnVolver').addEventListener('click', function(e) {
    if (imagenCargada && !notaGuardada) {
        e.preventDefault();
        mostrarModal(this.getAttribute('href') || '/notas');
    }
});

// ══════════════════════════════════════════════
//  CARGA DE IMAGEN
// ══════════════════════════════════════════════
fileInput.addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = () => { imgOriginal.src = reader.result; };
    reader.readAsDataURL(e.target.files[0]);
});

imgOriginal.onload = () => {
    resetearTodo(false);
    canvasVisible.width  = imgOriginal.width;
    canvasVisible.height = imgOriginal.height;
    canvasBuffer.width   = imgOriginal.width;
    canvasBuffer.height  = imgOriginal.height;
    canvasVisible.style.display = 'block';
    placeholder.style.display   = 'none';
    imagenCargada = true;
    notaGuardada  = false;
    actualizarLienzoCompleto();
};

// ══════════════════════════════════════════════
//  FILTROS Y PROCESAMIENTO
// ══════════════════════════════════════════════
function actualizarLienzoCompleto() {
    if (!imgOriginal.src || !imagenCargada) return;
    procesarImagenEnBuffer();
    ctxVisible.clearRect(0, 0, canvasVisible.width, canvasVisible.height);
    canvasVisible.style.transform = `scale(${zoom}) rotate(${angulo}deg)`;
    ctxVisible.drawImage(canvasBuffer, 0, 0);
    redibujarTrazosPaint();
}

function procesarImagenEnBuffer() {
    ctxBuffer.save();
    ctxBuffer.clearRect(0, 0, canvasBuffer.width, canvasBuffer.height);
    const b = document.getElementById('brightness').value;
    const c = document.getElementById('contrast').value;
    const s = document.getElementById('saturation').value;
    const g = document.getElementById('grayscale').value;
    ctxBuffer.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) grayscale(${g}%)`;
    ctxBuffer.drawImage(imgOriginal, 0, 0);
    if (filtroMoradoActivo) {
        ctxBuffer.fillStyle = "rgba(139, 92, 246, 0.3)";
        ctxBuffer.globalCompositeOperation = "multiply";
        ctxBuffer.fillRect(0, 0, canvasBuffer.width, canvasBuffer.height);
    }
    ctxBuffer.restore();
}

document.querySelectorAll('.filter-slider').forEach(slider => {
    slider.addEventListener('input', actualizarLienzoCompleto);
});

// ══════════════════════════════════════════════
//  TRANSFORMAR
// ══════════════════════════════════════════════
function ajustarZoom(valor) {
    zoom += valor;
    if (zoom < 0.1) zoom = 0.1;
    actualizarLienzoCompleto();
}

function rotar(grados) {
    angulo += grados;
    actualizarLienzoCompleto();
}

function toggleFiltroMorado() {
    filtroMoradoActivo = !filtroMoradoActivo;
    document.getElementById('btnFiltroMorado').classList.toggle('active');
    actualizarLienzoCompleto();
}

// ══════════════════════════════════════════════
//  PINCEL / DIBUJO
// ══════════════════════════════════════════════
function obtenerPosicionReal(e) {
    const rect   = canvasVisible.getBoundingClientRect();
    const scaleX = canvasVisible.width  / rect.width;
    const scaleY = canvasVisible.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top)  * scaleY
    };
}

canvasVisible.addEventListener('mousedown', (e) => {
    if (!imagenCargada) return;
    dibujando = true;
    const pos = obtenerPosicionReal(e);
    xAnterior = pos.x; yAnterior = pos.y;
    trazosPaint.push({
        color: document.getElementById('colorPincel').value,
        grosor: document.getElementById('grosorPincel').value,
        puntos: [{ x: pos.x, y: pos.y }]
    });
});

canvasVisible.addEventListener('mousemove', (e) => {
    if (!dibujando || !imagenCargada) return;
    const pos = obtenerPosicionReal(e);
    ctxVisible.beginPath();
    ctxVisible.moveTo(xAnterior, yAnterior);
    ctxVisible.lineTo(pos.x, pos.y);
    ctxVisible.strokeStyle = document.getElementById('colorPincel').value;
    ctxVisible.lineWidth   = document.getElementById('grosorPincel').value;
    ctxVisible.lineCap     = "round";
    ctxVisible.lineJoin    = "round";
    ctxVisible.stroke();
    trazosPaint[trazosPaint.length - 1].puntos.push({ x: pos.x, y: pos.y });
    xAnterior = pos.x; yAnterior = pos.y;
});

window.addEventListener('mouseup', () => dibujando = false);

function redibujarTrazosPaint() {
    trazosPaint.forEach(trazo => {
        if (trazo.puntos.length < 2) return;
        ctxVisible.beginPath();
        ctxVisible.moveTo(trazo.puntos[0].x, trazo.puntos[0].y);
        ctxVisible.strokeStyle = trazo.color;
        ctxVisible.lineWidth   = trazo.grosor;
        ctxVisible.lineCap     = "round";
        ctxVisible.lineJoin    = "round";
        for (let i = 1; i < trazo.puntos.length; i++) {
            ctxVisible.lineTo(trazo.puntos[i].x, trazo.puntos[i].y);
        }
        ctxVisible.stroke();
    });
}

function limpiarDibujo() {
    trazosPaint = [];
    actualizarLienzoCompleto();
    mostrarToast('Trazos borrados');
}

// ══════════════════════════════════════════════
//  RESETEAR
// ══════════════════════════════════════════════
function resetearTodo(limpiarImagen = true) {
    zoom               = 1;
    angulo             = 0;
    filtroMoradoActivo = false;
    document.getElementById('btnFiltroMorado').classList.remove('active');
    document.querySelectorAll('.filter-slider').forEach(f => f.value = f.id === 'grayscale' ? 0 : 100);
    trazosPaint = [];
    if (limpiarImagen) {
        imagenCargada = false;
        imgOriginal   = new Image();
        ctxVisible.clearRect(0, 0, canvasVisible.width, canvasVisible.height);
        canvasVisible.style.display   = 'none';
        placeholder.style.display     = 'flex';
        canvasVisible.style.transform = 'none';
    } else {
        actualizarLienzoCompleto();
    }
}

// ══════════════════════════════════════════════
//  DESCARGAR
// ══════════════════════════════════════════════
function descargarResultado() {
    if (!imagenCargada) { mostrarToast('Carga una imagen primero'); return; }
    procesarImagenEnBuffer();
    trazosPaint.forEach(trazo => {
        if (trazo.puntos.length < 2) return;
        ctxBuffer.beginPath();
        ctxBuffer.moveTo(trazo.puntos[0].x, trazo.puntos[0].y);
        ctxBuffer.strokeStyle = trazo.color;
        ctxBuffer.lineWidth   = trazo.grosor;
        ctxBuffer.lineCap     = "round";
        ctxBuffer.lineJoin    = "round";
        for (let i = 1; i < trazo.puntos.length; i++) ctxBuffer.lineTo(trazo.puntos[i].x, trazo.puntos[i].y);
        ctxBuffer.stroke();
    });
    const link    = document.createElement('a');
    link.download = 'noteflow_imagen.png';
    link.href     = canvasBuffer.toDataURL();
    link.click();
}

// ══════════════════════════════════════════════
//  GUARDAR EN BACKEND
// ══════════════════════════════════════════════
async function guardarEnBackend() {
    if (!imagenCargada) { mostrarToast('Carga una imagen primero'); return; }

    const titulo      = document.getElementById('inputTitulo').value.trim()      || 'Imagen sin título';
    const descripcion = document.getElementById('inputDescripcion').value.trim() || '';
    const etiquetas   = document.getElementById('inputEtiquetas').value.trim();

    const btn = document.getElementById('btnGuardar');
    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    procesarImagenEnBuffer();
    trazosPaint.forEach(trazo => {
        if (trazo.puntos.length < 2) return;
        ctxBuffer.beginPath();
        ctxBuffer.moveTo(trazo.puntos[0].x, trazo.puntos[0].y);
        ctxBuffer.strokeStyle = trazo.color;
        ctxBuffer.lineWidth   = trazo.grosor;
        ctxBuffer.lineCap     = "round";
        ctxBuffer.lineJoin    = "round";
        for (let i = 1; i < trazo.puntos.length; i++) ctxBuffer.lineTo(trazo.puntos[i].x, trazo.puntos[i].y);
        ctxBuffer.stroke();
    });

    canvasBuffer.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('titulo',      titulo);
        formData.append('descripcion', descripcion);
        formData.append('etiquetas',   etiquetas);
        formData.append('imagen',      blob, `${titulo.replace(/\s+/g,'_')}.png`);

        try {
            const resp = await fetch('/guardar-nota-imagen', { method: 'POST', body: formData });
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
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar nota';
        }
    }, 'image/png');
}

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
let toastTimer = null;
function mostrarToast(msg) {
    const t = document.getElementById('toastImagen');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 3000);
}