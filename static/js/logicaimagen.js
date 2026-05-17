// ══════════════════════════════════════════════════════════════════
//  SETUP — Referencias DOM
// ══════════════════════════════════════════════════════════════════
const canvasVisible    = document.getElementById('canvasVisible');
const ctxVisible       = canvasVisible.getContext('2d');
const canvasBuffer     = document.getElementById('canvasBuffer');
const ctxBuffer        = canvasBuffer.getContext('2d');
const fileInput        = document.getElementById('upload-input');
const placeholder      = document.getElementById('canvasPlaceholder');
const canvasContainer  = document.getElementById('canvasContainer');

// ══════════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════
let imgOriginal        = new Image();
let zoom               = 1;
let angulo             = 0;
let flipH              = false;
let flipV              = false;
let imagenCargada      = false;
let notaGuardada       = false;

// Herramienta activa: 'pincel' | 'borrador' | 'linea' | 'rect' | 'circulo' | 'texto' | 'cuentagotas'
let herramientaActiva  = 'pincel';

// Estado de dibujo
let dibujando          = false;
let xInicio = 0, yInicio = 0;
let xAnterior = 0, yAnterior = 0;
let snapshotAntesDibujo = null;

// Trazos y historial
let trazosPaint        = [];
let historial          = [];
let historialRedo      = [];
const MAX_HISTORIAL    = 30;

// Efectos activos (set de IDs)
const efectosActivos   = new Set();
let filtroMoradoActivo = false;

// ══════════════════════════════════════════════════════════════════
//  HELPERS DE DOM
// ══════════════════════════════════════════════════════════════════
function $id(id) { return document.getElementById(id); }
function mostrarToast(msg, tipo = 'info') {
    const t = $id('toastImagen');
    if (!t) return;
    t.textContent = msg;
    t.className   = 'toast-img visible';
    if (tipo === 'success') t.classList.add('success');
    if (tipo === 'error')   t.classList.add('error');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.classList.remove('visible'), 3200);
}
function actualizarBtnHistorial() {
    [$id('btnDeshacer'), $id('latDeshacer')].forEach(b => { if (b) b.disabled = historial.length === 0; });
    [$id('btnRehacer'),  $id('latRehacer') ].forEach(b => { if (b) b.disabled = historialRedo.length === 0; });
}

// ══════════════════════════════════════════════════════════════════
//  CARGA DE IMAGEN
// ══════════════════════════════════════════════════════════════════
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    actualizarStatsPeso(file);
    const reader = new FileReader();
    reader.onload = () => { imgOriginal.src = reader.result; };
    reader.readAsDataURL(file);
    e.target.value = '';
});

imgOriginal.onload = () => {
    resetearEstadoDibujo();
    historial    = [];
    historialRedo = [];
    actualizarBtnHistorial();
    efectosActivos.clear();
    document.querySelectorAll('.efecto-btn').forEach(b => b.classList.remove('activo'));
    filtroMoradoActivo = false;

    canvasVisible.width  = imgOriginal.naturalWidth;
    canvasVisible.height = imgOriginal.naturalHeight;
    canvasBuffer.width   = imgOriginal.naturalWidth;
    canvasBuffer.height  = imgOriginal.naturalHeight;
    canvasVisible.style.display = 'block';
    placeholder.style.display   = 'none';

    imagenCargada = true;
    notaGuardada  = false;

    // Stats
    $id('statDim').textContent = `${imgOriginal.naturalWidth} × ${imgOriginal.naturalHeight} px`;
    $id('statsBar').classList.add('visible');
    $id('coordBar').classList.add('visible');
    actualizarStatsTrazos();
    actualizarStatsEfectos();

    aplicarZoom(zoom);
    actualizarLienzoCompleto();
    guardarHistorial();
    mostrarToast('Imagen cargada correctamente 🖼️');
};

// RESTAURACIÓN PARA EDICIÓN
(function cargarImagenExistente() {
    const url = $id('editImagenUrl')?.value;
    if (!url) return;
    imgOriginal.crossOrigin = "Anonymous";
    imgOriginal.src = (url.startsWith('http') || url.startsWith('https')) ? url : '/static/' + url;
    // Marcar como guardada para no disparar modal
    setTimeout(() => { notaGuardada = true; }, 800);
})();

// ══════════════════════════════════════════════════════════════════
//  HISTORIAL (Deshacer / Rehacer)
// ══════════════════════════════════════════════════════════════════
function guardarHistorial() {
    if (!imagenCargada) return;
    if (historial.length >= MAX_HISTORIAL) historial.shift();
    historial.push({
        trazosPaint: JSON.parse(JSON.stringify(trazosPaint)),
        zoom, angulo, flipH, flipV,
        filtros: capturarValoresFiltros(),
        efectos: new Set(efectosActivos),
        filtroMorado: filtroMoradoActivo,
    });
    historialRedo = [];
    actualizarBtnHistorial();
}

function deshacerAccion() {
    if (historial.length <= 1) { mostrarToast('Nada que deshacer'); return; }
    historialRedo.push({
        trazosPaint: JSON.parse(JSON.stringify(trazosPaint)),
        zoom, angulo, flipH, flipV,
        filtros: capturarValoresFiltros(),
        efectos: new Set(efectosActivos),
        filtroMorado: filtroMoradoActivo,
    });
    historial.pop();
    const estado = historial[historial.length - 1];
    restaurarEstado(estado);
    actualizarBtnHistorial();
    mostrarToast('Deshacer aplicado');
}

function rehacerAccion() {
    if (historialRedo.length === 0) { mostrarToast('Nada que rehacer'); return; }
    const estado = historialRedo.pop();
    historial.push({
        trazosPaint: JSON.parse(JSON.stringify(trazosPaint)),
        zoom, angulo, flipH, flipV,
        filtros: capturarValoresFiltros(),
        efectos: new Set(efectosActivos),
        filtroMorado: filtroMoradoActivo,
    });
    restaurarEstado(estado);
    actualizarBtnHistorial();
    mostrarToast('Rehacer aplicado');
}

function capturarValoresFiltros() {
    return {
        brightness: $id('brightness').value,
        contrast:   $id('contrast').value,
        saturation: $id('saturation').value,
        grayscale:  $id('grayscale').value,
        hueRotate:  $id('hueRotate').value,
        blur:       $id('blur').value,
        sepia:      $id('sepia').value,
        invert:     $id('invert').value,
    };
}

function restaurarEstado(estado) {
    trazosPaint       = JSON.parse(JSON.stringify(estado.trazosPaint));
    zoom              = estado.zoom;
    angulo            = estado.angulo;
    flipH             = estado.flipH;
    flipV             = estado.flipV;
    filtroMoradoActivo = estado.filtroMorado;
    efectosActivos.clear();
    estado.efectos.forEach(e => efectosActivos.add(e));
    document.querySelectorAll('.efecto-btn').forEach(b => b.classList.remove('activo'));
    efectosActivos.forEach(id => { const b = $id(id); if (b) b.classList.add('activo'); });

    const f = estado.filtros;
    Object.entries(f).forEach(([k, v]) => {
        const el = $id(k); if (el) { el.value = v; actualizarLabelFiltro(k, v); actualizarGradientFiltro(el); }
    });
    aplicarZoom(zoom);
    actualizarLienzoCompleto();
    actualizarStatsTrazos();
    actualizarStatsEfectos();
}

// ══════════════════════════════════════════════════════════════════
//  RENDER PRINCIPAL
// ══════════════════════════════════════════════════════════════════
function actualizarLienzoCompleto() {
    if (!imagenCargada) return;
    procesarEnBuffer();
    ctxVisible.clearRect(0, 0, canvasVisible.width, canvasVisible.height);
    aplicarTransformCanvas(ctxVisible, () => {
        ctxVisible.drawImage(canvasBuffer, 0, 0);
    });
    redibujarTrazos(ctxVisible);
}

function procesarEnBuffer() {
    ctxBuffer.save();
    ctxBuffer.clearRect(0, 0, canvasBuffer.width, canvasBuffer.height);

    const b  = $id('brightness').value || 100;
    const c  = $id('contrast').value   || 100;
    const s  = $id('saturation').value || 100;
    const g  = $id('grayscale').value  || 0;
    const h  = $id('hueRotate').value  || 0;
    const bl = $id('blur').value       || 0;
    const se = $id('sepia').value      || 0;
    const iv = $id('invert').value     || 0;

    ctxBuffer.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) grayscale(${g}%) hue-rotate(${h}deg) blur(${bl}px) sepia(${se}%) invert(${iv}%)`;
    ctxBuffer.drawImage(imgOriginal, 0, 0);

    if (filtroMoradoActivo) {
        ctxBuffer.filter = 'none';
        ctxBuffer.fillStyle = "rgba(124, 77, 255, 0.28)";
        ctxBuffer.globalCompositeOperation = "multiply";
        ctxBuffer.fillRect(0, 0, canvasBuffer.width, canvasBuffer.height);
    }
    ctxBuffer.restore();
}

function aplicarTransformCanvas(ctx, drawFn) {
    ctx.save();
    ctx.translate(canvasVisible.width / 2, canvasVisible.height / 2);
    ctx.rotate((angulo * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.translate(-canvasVisible.width / 2, -canvasVisible.height / 2);
    drawFn();
    ctx.restore();
}

// ══════════════════════════════════════════════════════════════════
//  FILTROS SLIDERS — labels + gradients
// ══════════════════════════════════════════════════════════════════
const filtroLabels = {
    brightness: 'valBrillo', contrast:  'valContraste',
    saturation: 'valSaturacion', grayscale: 'valGrises',
    hueRotate:  'valTono',   blur:      'valBlur',
    sepia:      'valSepia',  invert:    'valInvertir',
};
const filtroUnidades = {
    brightness: '%', contrast: '%', saturation: '%', grayscale: '%',
    hueRotate: '°', blur: 'px', sepia: '%', invert: '%',
};

function actualizarLabelFiltro(id, val) {
    const labelId = filtroLabels[id];
    if (labelId) $id(labelId).textContent = val;
}

function actualizarGradientFiltro(slider) {
    const min  = parseFloat(slider.min);
    const max  = parseFloat(slider.max);
    const val  = parseFloat(slider.value);
    const pct  = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, #7c4dff ${pct}%, #d1c4e9 ${pct}%)`;
}

document.querySelectorAll('.filter-slider').forEach(slider => {
    actualizarGradientFiltro(slider);
    slider.addEventListener('input', () => {
        actualizarLabelFiltro(slider.id, slider.value);
        actualizarGradientFiltro(slider);
        actualizarLienzoCompleto();
    });
    slider.addEventListener('change', () => guardarHistorial());
});

$id('btnResetFiltros').addEventListener('click', () => {
    guardarHistorial();
    const defaults = { brightness:100, contrast:100, saturation:100, grayscale:0, hueRotate:0, blur:0, sepia:0, invert:0 };
    Object.entries(defaults).forEach(([k, v]) => {
        const el = $id(k);
        if (el) { el.value = v; actualizarLabelFiltro(k, v); actualizarGradientFiltro(el); }
    });
    actualizarLienzoCompleto();
    mostrarToast('Ajustes restablecidos');
});

// ══════════════════════════════════════════════════════════════════
//  EFECTOS PREDEFINIDOS
// ══════════════════════════════════════════════════════════════════
const efectosConfig = {
    efVibrante:  () => ({ saturation:180, contrast:120 }),
    efVintage:   () => ({ sepia:60, brightness:95, contrast:90, saturation:80 }),
    efFrio:      () => ({ hueRotate:30, saturation:80, brightness:105 }),
    efCalido:    () => ({ hueRotate:-20, saturation:130, brightness:108 }),
    efDramatico: () => ({ contrast:175, brightness:90, saturation:90 }),
    efSoft:      () => ({ blur:2, brightness:108, contrast:90, saturation:90 }),
    efNeon:      () => ({ saturation:200, contrast:130, brightness:110 }),
    efMorado:    null, // Especial
    efNoir:      () => ({ grayscale:100, contrast:150, brightness:85 }),
    efFade:      () => ({ saturation:40, brightness:115, contrast:85 }),
};

document.querySelectorAll('.efecto-btn[id^="ef"]').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!imagenCargada) { mostrarToast('Carga una imagen primero', 'error'); return; }
        guardarHistorial();

        const id = btn.id;

        if (id === 'efMorado') {
            filtroMoradoActivo = !filtroMoradoActivo;
            btn.classList.toggle('activo', filtroMoradoActivo);
            if (filtroMoradoActivo) efectosActivos.add(id); else efectosActivos.delete(id);
            actualizarLienzoCompleto();
            actualizarStatsEfectos();
            mostrarToast(filtroMoradoActivo ? 'Filtro púrpura activado 💜' : 'Filtro púrpura quitado');
            return;
        }

        const cfg = efectosConfig[id];
        if (!cfg) return;

        if (efectosActivos.has(id)) {
            // Quitar efecto — resetear todos los filtros a default (si no hay otros)
            efectosActivos.delete(id);
            btn.classList.remove('activo');
            // Re-aplicar todos los efectos activos restantes
            aplicarEfectosActivos();
        } else {
            efectosActivos.add(id);
            btn.classList.add('activo');
            aplicarEfectosActivos();
        }
        actualizarLienzoCompleto();
        actualizarStatsEfectos();
        mostrarToast(efectosActivos.has(id) ? `Efecto "${btn.textContent.trim()}" aplicado` : `Efecto quitado`);
    });
});

function aplicarEfectosActivos() {
    // Resetear
    const defaults = { brightness:100, contrast:100, saturation:100, grayscale:0, hueRotate:0, blur:0, sepia:0, invert:0 };

    // Acumular efectos (última prioridad gana por cada propiedad)
    let merged = { ...defaults };
    efectosActivos.forEach(id => {
        if (id === 'efMorado') return;
        const cfg = efectosConfig[id];
        if (cfg) Object.assign(merged, cfg());
    });

    Object.entries(merged).forEach(([k, v]) => {
        const el = $id(k);
        if (el) { el.value = v; actualizarLabelFiltro(k, v); actualizarGradientFiltro(el); }
    });
}

// ══════════════════════════════════════════════════════════════════
//  ZOOM
// ══════════════════════════════════════════════════════════════════
function aplicarZoom(z) {
    zoom = Math.max(0.05, Math.min(10, z));
    canvasVisible.style.transform = `scale(${zoom})`;
    canvasVisible.style.transformOrigin = 'center center';
    $id('coordZoom').textContent = Math.round(zoom * 100);
}
function ajustarZoom(delta) { aplicarZoom(zoom + delta); }

$id('btnZoomIn') .addEventListener('click', () => ajustarZoom(0.15));
$id('btnZoomOut').addEventListener('click', () => ajustarZoom(-0.15));
$id('btnZoom100').addEventListener('click', () => { aplicarZoom(1); mostrarToast('Zoom 100%'); });
$id('btnZoomFit').addEventListener('click', () => {
    if (!imagenCargada) return;
    const cw = canvasContainer.clientWidth  - 40;
    const ch = canvasContainer.clientHeight - 40;
    const fitZ = Math.min(cw / canvasVisible.width, ch / canvasVisible.height);
    aplicarZoom(fitZ);
    mostrarToast('Ajustado a ventana');
});

// Rueda del ratón para zoom
canvasContainer.addEventListener('wheel', (e) => {
    if (!imagenCargada) return;
    e.preventDefault();
    ajustarZoom(e.deltaY < 0 ? 0.08 : -0.08);
}, { passive: false });

// ══════════════════════════════════════════════════════════════════
//  TRANSFORMAR (rotar, voltear)
// ══════════════════════════════════════════════════════════════════
function rotar(grados) {
    if (!imagenCargada) return;
    guardarHistorial();
    angulo = (angulo + grados + 360) % 360;
    actualizarLienzoCompleto();
}
function voltear(eje) {
    if (!imagenCargada) return;
    guardarHistorial();
    if (eje === 'h') flipH = !flipH;
    if (eje === 'v') flipV = !flipV;
    actualizarLienzoCompleto();
    mostrarToast(eje === 'h' ? 'Volteado horizontal' : 'Volteado vertical');
}

[$id('btnRotarDer'), $id('latRotDer')].forEach(b => b?.addEventListener('click', () => rotar(90)));
[$id('btnRotarIzq'), $id('latRotIzq')].forEach(b => b?.addEventListener('click', () => rotar(-90)));
[$id('btnFlipH'),    $id('latFlipH') ].forEach(b => b?.addEventListener('click', () => voltear('h')));
[$id('btnFlipV'),    $id('latFlipV') ].forEach(b => b?.addEventListener('click', () => voltear('v')));

// ══════════════════════════════════════════════════════════════════
//  HERRAMIENTAS DE DIBUJO
// ══════════════════════════════════════════════════════════════════
const cursorMap = {
    pincel:      'cursor-pincel',
    borrador:    'cursor-borrador',
    texto:       'cursor-texto',
    cuentagotas: 'cursor-cuentagotas',
    linea:       '',
    rect:        '',
    circulo:     '',
};
const nombreHerr = {
    pincel:'Pincel', borrador:'Borrador', linea:'Línea', rect:'Rectángulo',
    circulo:'Círculo', texto:'Texto', cuentagotas:'Cuentagotas'
};

function setHerramienta(h) {
    herramientaActiva = h;
    // Cursor
    canvasContainer.className = 'canvas-container';
    if (cursorMap[h]) canvasContainer.classList.add(cursorMap[h]);
    else canvasContainer.style.cursor = 'crosshair';

    // Botones toolbar
    ['btnHerPincel','btnHerBorrador','btnHerLinea','btnHerRect','btnHerCirculo','btnHerTexto','btnHerCuentagotas'].forEach(id => {
        $id(id)?.classList.remove('activo');
    });
    // Botones lateral
    ['latPincel','latBorrador','latLinea','latRect','latCirculo','latTexto','latGota'].forEach(id => {
        $id(id)?.classList.remove('activo');
    });

    const mapaBtn = { pincel:'btnHerPincel', borrador:'btnHerBorrador', linea:'btnHerLinea',
        rect:'btnHerRect', circulo:'btnHerCirculo', texto:'btnHerTexto', cuentagotas:'btnHerCuentagotas' };
    const mapaLat = { pincel:'latPincel', borrador:'latBorrador', linea:'latLinea',
        rect:'latRect', circulo:'latCirculo', texto:'latTexto', cuentagotas:'latGota' };
    $id(mapaBtn[h])?.classList.add('activo');
    $id(mapaLat[h])?.classList.add('activo');

    // Mostrar/ocultar fuente
    $id('wrapFuente').style.display = h === 'texto' ? 'flex' : 'none';
    $id('coordHerr').textContent = nombreHerr[h] || h;
}

$id('btnHerPincel')?.addEventListener('click', () => setHerramienta('pincel'));
$id('btnHerBorrador')?.addEventListener('click', () => setHerramienta('borrador'));
$id('btnHerLinea')?.addEventListener('click', () => setHerramienta('linea'));
$id('btnHerRect')?.addEventListener('click', () => setHerramienta('rect'));
$id('btnHerCirculo')?.addEventListener('click', () => setHerramienta('circulo'));
$id('btnHerTexto')?.addEventListener('click', () => setHerramienta('texto'));
$id('btnHerCuentagotas')?.addEventListener('click', () => setHerramienta('cuentagotas'));

$id('latPincel')?.addEventListener('click',   () => setHerramienta('pincel'));
$id('latBorrador')?.addEventListener('click', () => setHerramienta('borrador'));
$id('latLinea')?.addEventListener('click',    () => setHerramienta('linea'));
$id('latRect')?.addEventListener('click',     () => setHerramienta('rect'));
$id('latCirculo')?.addEventListener('click',  () => setHerramienta('circulo'));
$id('latTexto')?.addEventListener('click',    () => setHerramienta('texto'));
$id('latGota')?.addEventListener('click',     () => setHerramienta('cuentagotas'));
$id('latLimpiar')?.addEventListener('click',  () => limpiarTrazos());

// ══════════════════════════════════════════════════════════════════
//  COLOR Y GROSOR — sincronización toolbar ↔ lateral
// ══════════════════════════════════════════════════════════════════
function getColor() { return $id('colorPrimario').value || $id('colorLateral').value || '#7c4dff'; }
function getGrosor() { return parseInt($id('grosorPincel').value) || 5; }
function getOpacidad() { return parseInt($id('opacidadPincel').value) / 100; }
function getPunta() { return $id('selectPunta').value || 'round'; }

// Sincronizar pickers
[$id('colorPrimario'), $id('colorLateral')].forEach(el => {
    el?.addEventListener('input', () => {
        $id('colorPrimario').value = el.value;
        $id('colorLateral').value  = el.value;
    });
});

// Paletas rápidas
document.querySelectorAll('.paleta-color').forEach(swatch => {
    swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        $id('colorPrimario').value = color;
        $id('colorLateral').value  = color;
    });
});

// Grosor sincronizado
function actualizarGrosorUI(val) {
    $id('grosorPincel').value    = val;
    $id('grosorLateral').value   = val;
    $id('grosorValor').textContent = val;
    $id('grosorLateralVal').textContent = val + 'px';
    const size = Math.max(2, Math.min(20, val * 0.6));
    $id('grosortDot').style.width  = size + 'px';
    $id('grosortDot').style.height = size + 'px';
}
$id('grosorPincel').addEventListener('input',  e => actualizarGrosorUI(e.target.value));
$id('grosorLateral').addEventListener('input', e => actualizarGrosorUI(e.target.value));

// Opacidad
$id('opacidadPincel').addEventListener('input', e => {
    $id('opacidadValor').textContent = e.target.value + '%';
});

// ══════════════════════════════════════════════════════════════════
//  DIBUJO — eventos de canvas
// ══════════════════════════════════════════════════════════════════
function obtenerPosCanvas(e) {
    const rect   = canvasVisible.getBoundingClientRect();
    const scaleX = canvasVisible.width  / rect.width;
    const scaleY = canvasVisible.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top)  * scaleY,
    };
}

// Coordenadas en tiempo real
canvasVisible.addEventListener('mousemove', (e) => {
    if (!imagenCargada) return;
    const pos = obtenerPosCanvas(e);
    const x   = Math.round(pos.x);
    const y   = Math.round(pos.y);
    if (x >= 0 && x < canvasVisible.width && y >= 0 && y < canvasVisible.height) {
        $id('coordX').textContent = x;
        $id('coordY').textContent = y;
        // Mostrar color del pixel
        const pixel = ctxVisible.getImageData(x, y, 1, 1).data;
        const hex   = '#' + [pixel[0],pixel[1],pixel[2]].map(v => v.toString(16).padStart(2,'0')).join('');
        const coordColorEl = $id('coordColor');
        coordColorEl.textContent = hex;
        coordColorEl.style.background = hex;
        coordColorEl.style.color = (pixel[0]*0.299 + pixel[1]*0.587 + pixel[2]*0.114) > 150 ? '#333' : '#fff';
    }
    if (dibujando) dibujarMovimiento(e);
});

canvasVisible.addEventListener('mousedown', (e) => {
    if (!imagenCargada) return;
    const pos = obtenerPosCanvas(e);
    iniciarDibujo(pos, e);
});
window.addEventListener('mouseup', (e) => {
    if (dibujando && imagenCargada) finalizarDibujo(e);
});

// Touch
canvasVisible.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!imagenCargada) return;
    const pos = obtenerPosCanvas(e);
    iniciarDibujo(pos, e);
}, { passive: false });
canvasVisible.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (dibujando) dibujarMovimiento(e);
}, { passive: false });
window.addEventListener('touchend', (e) => {
    if (dibujando && imagenCargada) finalizarDibujo(e);
});

function iniciarDibujo(pos, e) {
    dibujando   = true;
    xInicio     = pos.x;
    yInicio     = pos.y;
    xAnterior   = pos.x;
    yAnterior   = pos.y;

    if (herramientaActiva === 'cuentagotas') {
        const pixel = ctxVisible.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
        const hex   = '#' + [pixel[0],pixel[1],pixel[2]].map(v => v.toString(16).padStart(2,'0')).join('');
        $id('colorPrimario').value = hex;
        $id('colorLateral').value  = hex;
        mostrarToast(`Color capturado: ${hex}`);
        dibujando = false;
        return;
    }

    if (herramientaActiva === 'texto') {
        dibujando = false;
        const texto = prompt('Escribe el texto a insertar:');
        if (texto) {
            guardarHistorial();
            const fuente  = $id('selectFuente')?.value || 'Nunito';
            const grosor  = getGrosor();
            ctxVisible.save();
            ctxVisible.font         = `${Math.max(12, grosor * 3)}px ${fuente}`;
            ctxVisible.fillStyle    = getColor();
            ctxVisible.globalAlpha  = getOpacidad();
            ctxVisible.fillText(texto, pos.x, pos.y);
            ctxVisible.restore();
            trazosPaint.push({ tipo:'texto', texto, x:pos.x, y:pos.y, color:getColor(), grosor, fuente, opacidad:getOpacidad() });
            actualizarStatsTrazos();
        }
        return;
    }

    if (['linea','rect','circulo'].includes(herramientaActiva)) {
        // Capturar snapshot para preview en tiempo real
        snapshotAntesDibujo = ctxVisible.getImageData(0, 0, canvasVisible.width, canvasVisible.height);
        trazosPaint.push({
            tipo:     herramientaActiva,
            x1:       pos.x, y1: pos.y,
            x2:       pos.x, y2: pos.y,
            color:    getColor(),
            grosor:   getGrosor(),
            opacidad: getOpacidad(),
            punta:    getPunta(),
        });
        return;
    }

    // Pincel o borrador
    trazosPaint.push({
        tipo:     herramientaActiva,
        puntos:   [{ x: pos.x, y: pos.y }],
        color:    herramientaActiva === 'borrador' ? $id('colorFondo').value : getColor(),
        grosor:   getGrosor(),
        opacidad: getOpacidad(),
        punta:    getPunta(),
    });

    // Dibujar punto inicial
    ctxVisible.save();
    ctxVisible.beginPath();
    ctxVisible.arc(pos.x, pos.y, getGrosor() / 2, 0, Math.PI * 2);
    ctxVisible.fillStyle   = herramientaActiva === 'borrador' ? $id('colorFondo').value : getColor();
    ctxVisible.globalAlpha = getOpacidad();
    ctxVisible.fill();
    ctxVisible.restore();
}

function dibujarMovimiento(e) {
    if (!dibujando || !imagenCargada) return;
    const pos = obtenerPosCanvas(e);

    if (['linea','rect','circulo'].includes(herramientaActiva)) {
        // Restaurar snapshot y dibujar preview
        if (snapshotAntesDibujo) ctxVisible.putImageData(snapshotAntesDibujo, 0, 0);
        const trazo = trazosPaint[trazosPaint.length - 1];
        trazo.x2 = pos.x; trazo.y2 = pos.y;
        dibujarForma(ctxVisible, trazo);
        return;
    }

    // Pincel / borrador — dibujo continuo
    const color = herramientaActiva === 'borrador' ? $id('colorFondo').value : getColor();
    ctxVisible.save();
    ctxVisible.beginPath();
    ctxVisible.moveTo(xAnterior, yAnterior);
    ctxVisible.lineTo(pos.x, pos.y);
    ctxVisible.strokeStyle = color;
    ctxVisible.lineWidth   = getGrosor();
    ctxVisible.lineCap     = getPunta();
    ctxVisible.lineJoin    = 'round';
    ctxVisible.globalAlpha = getOpacidad();
    ctxVisible.stroke();
    ctxVisible.restore();

    if (trazosPaint.length > 0) {
        trazosPaint[trazosPaint.length - 1].puntos.push({ x: pos.x, y: pos.y });
    }
    xAnterior = pos.x;
    yAnterior = pos.y;
}

function finalizarDibujo(e) {
    dibujando           = false;
    snapshotAntesDibujo = null;
    actualizarStatsTrazos();
    guardarHistorial();
}

function dibujarForma(ctx, trazo) {
    ctx.save();
    ctx.strokeStyle = trazo.color;
    ctx.lineWidth   = trazo.grosor;
    ctx.lineCap     = trazo.punta || 'round';
    ctx.lineJoin    = 'round';
    ctx.globalAlpha = trazo.opacidad ?? 1;
    ctx.beginPath();

    if (trazo.tipo === 'linea') {
        ctx.moveTo(trazo.x1, trazo.y1);
        ctx.lineTo(trazo.x2, trazo.y2);
        ctx.stroke();
    } else if (trazo.tipo === 'rect') {
        ctx.strokeRect(trazo.x1, trazo.y1, trazo.x2 - trazo.x1, trazo.y2 - trazo.y1);
    } else if (trazo.tipo === 'circulo') {
        const rx = Math.abs(trazo.x2 - trazo.x1) / 2;
        const ry = Math.abs(trazo.y2 - trazo.y1) / 2;
        const cx = (trazo.x1 + trazo.x2) / 2;
        const cy = (trazo.y1 + trazo.y2) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function redibujarTrazos(ctx) {
    trazosPaint.forEach(trazo => {
        ctx.save();
        ctx.globalAlpha = trazo.opacidad ?? 1;

        if (trazo.tipo === 'texto') {
            const fuente = trazo.fuente || 'Nunito';
            ctx.font      = `${Math.max(12, trazo.grosor * 3)}px ${fuente}`;
            ctx.fillStyle = trazo.color;
            ctx.fillText(trazo.texto, trazo.x, trazo.y);
        } else if (['linea','rect','circulo'].includes(trazo.tipo)) {
            dibujarForma(ctx, trazo);
        } else if (trazo.puntos && trazo.puntos.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(trazo.puntos[0].x, trazo.puntos[0].y);
            ctx.strokeStyle = trazo.color;
            ctx.lineWidth   = trazo.grosor;
            ctx.lineCap     = trazo.punta || 'round';
            ctx.lineJoin    = 'round';
            for (let i = 1; i < trazo.puntos.length; i++) {
                ctx.lineTo(trazo.puntos[i].x, trazo.puntos[i].y);
            }
            ctx.stroke();
        } else if (trazo.puntos && trazo.puntos.length === 1) {
            ctx.beginPath();
            ctx.arc(trazo.puntos[0].x, trazo.puntos[0].y, trazo.grosor / 2, 0, Math.PI * 2);
            ctx.fillStyle = trazo.color;
            ctx.fill();
        }
        ctx.restore();
    });
}

function resetearEstadoDibujo() {
    trazosPaint   = [];
    dibujando     = false;
    snapshotAntesDibujo = null;
}

// ══════════════════════════════════════════════════════════════════
//  HISTORIAL — eventos de botones
// ══════════════════════════════════════════════════════════════════
[$id('btnDeshacer'), $id('latDeshacer')].forEach(b => b?.addEventListener('click', deshacerAccion));
[$id('btnRehacer'),  $id('latRehacer') ].forEach(b => b?.addEventListener('click', rehacerAccion));

// ══════════════════════════════════════════════════════════════════
//  TOGGLES PANELES
// ══════════════════════════════════════════════════════════════════
$id('btnToggleFiltros').addEventListener('click', () => {
    $id('filtrosPanel').classList.toggle('visible');
    $id('btnToggleFiltros').classList.toggle('activo');
});
$id('btnToggleEfectos').addEventListener('click', () => {
    $id('efectosPanel').classList.toggle('visible');
    $id('btnToggleEfectos').classList.toggle('activo');
});

// ══════════════════════════════════════════════════════════════════
//  LIMPIAR TRAZOS / RESETEAR
// ══════════════════════════════════════════════════════════════════
function limpiarTrazos() {
    if (!imagenCargada) return;
    guardarHistorial();
    trazosPaint = [];
    actualizarLienzoCompleto();
    actualizarStatsTrazos();
    mostrarToast('Trazos borrados');
}

function resetearTodo(limpiarImg = true) {
    angulo             = 0;
    flipH              = false;
    flipV              = false;
    filtroMoradoActivo = false;
    zoom               = 1;
    aplicarZoom(1);
    efectosActivos.clear();
    document.querySelectorAll('.efecto-btn').forEach(b => b.classList.remove('activo'));

    const defaults = { brightness:100, contrast:100, saturation:100, grayscale:0, hueRotate:0, blur:0, sepia:0, invert:0 };
    Object.entries(defaults).forEach(([k, v]) => {
        const el = $id(k);
        if (el) { el.value = v; actualizarLabelFiltro(k, v); actualizarGradientFiltro(el); }
    });
    trazosPaint = [];

    if (limpiarImg) {
        imagenCargada = false;
        imgOriginal   = new Image();
        imgOriginal.onload = () => {};
        ctxVisible.clearRect(0, 0, canvasVisible.width, canvasVisible.height);
        canvasVisible.style.display = 'none';
        placeholder.style.display   = 'flex';
        $id('statsBar').classList.remove('visible');
        $id('coordBar').classList.remove('visible');
    } else {
        actualizarLienzoCompleto();
    }
    historial     = [];
    historialRedo = [];
    actualizarBtnHistorial();
    actualizarStatsTrazos();
    actualizarStatsEfectos();
    mostrarToast('Todo restablecido');
}

[$id('latLimpiarTodo')].forEach(b => b?.addEventListener('click', limpiarTrazos));
[$id('latResetear')   ].forEach(b => b?.addEventListener('click', () => resetearTodo(true)));

// ══════════════════════════════════════════════════════════════════
//  DESCARGAR
// ══════════════════════════════════════════════════════════════════
function descargarResultado() {
    if (!imagenCargada) { mostrarToast('Carga una imagen primero', 'error'); return; }
    procesarEnBuffer();
    redibujarTrazos(ctxBuffer);
    const link     = document.createElement('a');
    const titulo   = $id('inputTitulo')?.value.trim() || 'noteflow_imagen';
    link.download  = `${titulo}.png`;
    link.href      = canvasBuffer.toDataURL('image/png');
    link.click();
    mostrarToast('Imagen descargada ✓');
}

[$id('btnDescargar'), $id('latDescargar')].forEach(b => b?.addEventListener('click', descargarResultado));

// ══════════════════════════════════════════════════════════════════
//  GUARDAR EN BACKEND — sin tocar los endpoints
// ══════════════════════════════════════════════════════════════════
async function guardarEnBackend() {
    if (!imagenCargada) { mostrarToast('Carga una imagen primero', 'error'); return; }

    const titulo      = $id('inputTitulo')?.value.trim()      || 'Imagen sin título';
    const descripcion = $id('inputDescripcion')?.value.trim() || '';
    const etiquetas   = $id('inputEtiquetas')?.value.trim()   || '';

    const btns = [$id('btnGuardar'), $id('btnGuardarBottom')].filter(Boolean);
    btns.forEach(b => { b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; });

    // Renderizar todo al buffer
    procesarEnBuffer();
    redibujarTrazos(ctxBuffer);

    canvasBuffer.toBlob(async (blob) => {
        const editId   = $id('editNotaId')?.value;
        const isUpdate = !!editId;
        const url      = isUpdate ? `/actualizar-nota-imagen/${editId}` : '/guardar-nota-imagen';

        const formData = new FormData();
        formData.append('titulo',      titulo);
        formData.append('descripcion', descripcion);
        formData.append('etiquetas',   etiquetas);
        formData.append('imagen',      blob, `${titulo.replace(/\s+/g,'_')}.png`);

        try {
            const resp = await fetch(url, { method:'POST', body: formData });
            const data = await resp.json();

            if (data.success) {
                notaGuardada = true;
                mostrarToast(data.mensaje || '¡Nota guardada correctamente!', 'success');
                const est = $id('estadoGuardado');
                if (est) { est.classList.add('visible'); setTimeout(() => est.classList.remove('visible'), 3000); }
                if (data.redirect) setTimeout(() => { window.location.href = data.redirect; }, 1200);
            } else {
                mostrarToast(data.error || 'Error al guardar', 'error');
            }
        } catch (err) {
            console.error(err);
            mostrarToast('Error de conexión', 'error');
        } finally {
            const label = isUpdate ? 'Actualizar nota' : 'Guardar nota';
            btns.forEach(b => { if (b) { b.disabled = false; b.innerHTML = `<i class="fas fa-floppy-disk"></i> ${label}`; } });
        }
    }, 'image/png');
}

[$id('btnGuardar'), $id('btnGuardarBottom')].forEach(b => b?.addEventListener('click', guardarEnBackend));

// ══════════════════════════════════════════════════════════════════
//  MODAL SALIDA SIN GUARDAR
// ══════════════════════════════════════════════════════════════════
let urlDestino = null;
$id('btnVolver').addEventListener('click', (e) => {
    if (imagenCargada && !notaGuardada) {
        e.preventDefault();
        urlDestino = e.currentTarget.getAttribute('href') || '/notas';
        $id('modalSalida').classList.add('visible');
    }
});
$id('btnModalCancelar').addEventListener('click', () => $id('modalSalida').classList.remove('visible'));
$id('btnModalSalir').addEventListener('click', () => {
    notaGuardada = true;
    $id('modalSalida').classList.remove('visible');
    window.location.href = urlDestino || '/notas';
});
$id('modalSalida').addEventListener('click', (e) => {
    if (e.target.id === 'modalSalida') $id('modalSalida').classList.remove('visible');
});
window.addEventListener('beforeunload', (e) => {
    if (imagenCargada && !notaGuardada) { e.preventDefault(); e.returnValue = ''; }
});

// ══════════════════════════════════════════════════════════════════
//  ATAJOS DE TECLADO
// ══════════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
    const tag     = document.activeElement?.tagName;
    const esInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
                    || document.activeElement?.isContentEditable;
    if (esInput) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); deshacerAccion(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); rehacerAccion();  return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); guardarEnBackend(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); ajustarZoom(0.15); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '-')                    { e.preventDefault(); ajustarZoom(-0.15); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '0')                    { e.preventDefault(); aplicarZoom(1); return; }

    if (!imagenCargada) return;
    if (e.key === 'p' || e.key === 'P') setHerramienta('pincel');
    if (e.key === 'e' || e.key === 'E') setHerramienta('borrador');
    if (e.key === 't' || e.key === 'T') setHerramienta('texto');
    if (e.key === 'l' || e.key === 'L') setHerramienta('linea');
    if (e.key === 'r' || e.key === 'R') { if (e.shiftKey) rotar(90); else setHerramienta('rect'); }
    if (e.key === 'c' || e.key === 'C') setHerramienta('circulo');
    if (e.key === 'i' || e.key === 'I') setHerramienta('cuentagotas');
    if (e.key === 'h' || e.key === 'H') voltear('h');
    if (e.key === 'v' || e.key === 'V') voltear('v');
});

// ══════════════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════════════
function actualizarStatsPeso(file) {
    if (!file) return;
    $id('statPeso').textContent = formatBytes(file.size);
    $id('statFmt').textContent  = file.name.split('.').pop().toUpperCase();
}
function actualizarStatsTrazos() {
    const n = trazosPaint.length;
    const w = $id('statTrazosWrap');
    if (!w) return;
    if (n > 0) {
        w.style.display = 'flex';
        $id('statTrazos').textContent = `${n} trazo${n !== 1 ? 's' : ''}`;
    } else {
        w.style.display = 'none';
    }
}
function actualizarStatsEfectos() {
    const n = efectosActivos.size;
    const w = $id('statEfectosWrap');
    if (!w) return;
    if (n > 0) {
        w.style.display = 'flex';
        $id('statEfectos').textContent = `${n} efecto${n !== 1 ? 's' : ''}`;
    } else {
        w.style.display = 'none';
    }
}
function formatBytes(bytes) {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ══════════════════════════════════════════════════════════════════
//  INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════════
actualizarGrosorUI(5);
actualizarBtnHistorial();