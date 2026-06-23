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
let panX               = 0;
let panY               = 0;
let angulo             = 0;
let flipH              = false;
let flipV              = false;
let imagenCargada      = false;
let notaGuardada       = false;

// Herramienta activa: 'pincel' | 'borrador' | 'linea' | 'rect' | 'circulo' | 'texto' | 'cuentagotas' | 'sticker' | 'mano' | 'seleccion'
let herramientaActiva  = 'pincel';

// Estado de dibujo / mano
let dibujando          = false;
let xInicio = 0, yInicio = 0;
let xAnterior = 0, yAnterior = 0;
let snapshotAntesDibujo = null;
let panStartX = 0, panStartY = 0;

// Trazos y historial
let trazosPaint        = [];
let historial          = [];
let historialRedo      = [];
const MAX_HISTORIAL    = 30;

// Selección
let selectedIndex      = -1;
let isMoving           = false;
let isResizing         = false;
let resizeHandle       = '';
let moveOffsetX        = 0;
let moveOffsetY        = 0;
let resizeStartBounds  = null;

// Efectos activos (set de IDs)
const efectosActivos   = new Set();
let filtroMoradoActivo = false;

// Modal texto — posición donde insertar
let textoPosX = 0, textoPosY = 0;

// ══════════════════════════════════════════════════════════════════
//  HELPERS DE DOM
// ══════════════════════════════════════════════════════════════════
function $id(id) { return document.getElementById(id); }

// ══════════════════════════════════════════════════════════════════
//  WORD-WRAP HELPER
// ══════════════════════════════════════════════════════════════════
function wrapText(ctx, text, maxWidth) {
    if (maxWidth <= 0) return [text];
    var lines = [];
    var words = text.split(' ');
    var line = '';
    for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxWidth && line !== '') {
            lines.push(line);
            line = words[i];
        } else {
            line = test;
        }
    }
    if (line !== '') lines.push(line);
    if (lines.length === 0) lines.push(text);
    return lines;
}

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
        zoom, panX, panY, angulo, flipH, flipV,
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
        zoom, panX, panY, angulo, flipH, flipV,
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
        zoom, panX, panY, angulo, flipH, flipV,
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
    panX              = estado.panX || 0;
    panY              = estado.panY || 0;
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
        redibujarTrazos(ctxVisible);
        if (herramientaActiva === 'seleccion' && selectedIndex >= 0) {
            dibujarSeleccion(ctxVisible);
        }
    });
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
    canvasVisible.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
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
    sticker:     'cursor-texto',
    mano:        'cursor-mano',
    seleccion:   '',
};
const nombreHerr = {
    pincel:'Pincel', borrador:'Borrador', linea:'Línea', rect:'Rectángulo',
    circulo:'Círculo', texto:'Texto', cuentagotas:'Cuentagotas', sticker:'Sticker', mano:'Mano', seleccion:'Selección'
};

function setHerramienta(h) {
    herramientaActiva = h;

    // Panel de stickers
    var sp = $id('stickerPanel');
    if (h === 'sticker') {
        if (sp) sp.classList.add('visible');
    } else {
        if (sp) sp.classList.remove('visible');
    }

    // Cursor
    canvasContainer.className = 'canvas-container';
    if (cursorMap[h]) canvasContainer.classList.add(cursorMap[h]);
    else canvasContainer.style.cursor = 'crosshair';

    // Ocultar panel de propiedades de texto si no estamos en selección
    if (h !== 'seleccion') {
        selectedIndex = -1;
        syncTextPropsPanel();
    }

    // Botones toolbar
    ['btnHerPincel','btnHerBorrador','btnHerLinea','btnHerRect','btnHerCirculo','btnHerTexto','btnHerCuentagotas','btnHerSticker','btnHerMano','btnHerSeleccion'].forEach(id => {
        $id(id)?.classList.remove('activo');
    });
    // Botones lateral
    ['latPincel','latBorrador','latLinea','latRect','latCirculo','latTexto','latGota','latMano','latSeleccion'].forEach(id => {
        $id(id)?.classList.remove('activo');
    });

    const mapaBtn = { pincel:'btnHerPincel', borrador:'btnHerBorrador', linea:'btnHerLinea',
        rect:'btnHerRect', circulo:'btnHerCirculo', texto:'btnHerTexto', cuentagotas:'btnHerCuentagotas', sticker:'btnHerSticker', mano:'btnHerMano', seleccion:'btnHerSeleccion' };
    const mapaLat = { pincel:'latPincel', borrador:'latBorrador', linea:'latLinea',
        rect:'latRect', circulo:'latCirculo', texto:'latTexto', cuentagotas:'latGota', sticker:'btnHerSticker', mano:'latMano', seleccion:'latSeleccion' };
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
$id('btnHerSticker')?.addEventListener('click', () => setHerramienta('sticker'));
$id('btnHerMano')?.addEventListener('click',    () => setHerramienta('mano'));
$id('btnHerSeleccion')?.addEventListener('click', () => setHerramienta('seleccion'));

$id('latPincel')?.addEventListener('click',   () => setHerramienta('pincel'));
$id('latBorrador')?.addEventListener('click', () => setHerramienta('borrador'));
$id('latLinea')?.addEventListener('click',    () => setHerramienta('linea'));
$id('latRect')?.addEventListener('click',     () => setHerramienta('rect'));
$id('latCirculo')?.addEventListener('click',  () => setHerramienta('circulo'));
$id('latTexto')?.addEventListener('click',    () => setHerramienta('texto'));
$id('latGota')?.addEventListener('click',     () => setHerramienta('cuentagotas'));
$id('latMano')?.addEventListener('click',     () => setHerramienta('mano'));
$id('latSeleccion')?.addEventListener('click', () => setHerramienta('seleccion'));
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
        $id('textColorPicker').value = color;
        aplicarColorASeleccion(color);
    });
});

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

    // Cursor hover para selección
    if (herramientaActiva === 'seleccion' && !dibujando) {
        if (selectedIndex >= 0) {
            var b = getTrazoBounds(trazosPaint[selectedIndex]);
            var trazoSel = trazosPaint[selectedIndex];
            var handle = getHandleAt(pos.x, pos.y, b);
            if (handle) {
                // Para texto: handles e/w muestran cursor ↔ (anchar/desanchar)
                if (handle === 'n' || handle === 's') {
                    canvasContainer.style.cursor = 'ns-resize';
                } else if (handle === 'e' || handle === 'w') {
                    // Cursor especial de ancho (como esquina horizontal)
                    canvasContainer.style.cursor = 'ew-resize';
                } else if (handle === 'nw' || handle === 'se') {
                    canvasContainer.style.cursor = 'nwse-resize';
                } else if (handle === 'ne' || handle === 'sw') {
                    canvasContainer.style.cursor = 'nesw-resize';
                }
            } else if (getEdgeAt(pos.x, pos.y, b)) {
                var edge = getEdgeAt(pos.x, pos.y, b);
                if (edge === 'n' || edge === 's') canvasContainer.style.cursor = 'ns-resize';
                else if (edge === 'e' || edge === 'w') canvasContainer.style.cursor = 'ew-resize';
                else if (edge === 'nw' || edge === 'se') canvasContainer.style.cursor = 'nwse-resize';
                else if (edge === 'ne' || edge === 'sw') canvasContainer.style.cursor = 'nesw-resize';
            } else if (hitTestTrazo(pos.x, pos.y, trazoSel)) {
                canvasContainer.style.cursor = 'move';
            } else {
                canvasContainer.style.cursor = 'default';
            }
        } else {
            var idx = getTrazoEnPosicion(pos.x, pos.y);
            canvasContainer.style.cursor = idx >= 0 ? 'move' : 'default';
        }
    }
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

// Doble clic para editar texto existente
canvasVisible.addEventListener('dblclick', function(e) {
    if (!imagenCargada) return;
    var pos = obtenerPosCanvas(e);
    for (var i = trazosPaint.length - 1; i >= 0; i--) {
        var t = trazosPaint[i];
        if (t.tipo === 'texto' && hitTestTrazo(pos.x, pos.y, t)) {
            var modal = $id('modalTexto');
            var input = $id('modalTextoInput');
            if (!modal || !input) return;
            input.value = t.texto;
            textoPosX = t.x;
            textoPosY = t.y;
            selectedIndex = i;
            syncTextPropsPanel();
            actualizarRenderConSeleccion();
            modal.classList.add('visible');
            setTimeout(function() { input.focus(); input.select(); }, 100);
            return;
        }
    }
});

function iniciarDibujo(pos, e) {
    dibujando   = true;
    xInicio     = pos.x;
    yInicio     = pos.y;
    xAnterior   = pos.x;
    yAnterior   = pos.y;

    if (herramientaActiva === 'mano') {
        panStartX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        panStartY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        return;
    }

    if (herramientaActiva === 'seleccion') {
        if (selectedIndex >= 0) {
            var b = getTrazoBounds(trazosPaint[selectedIndex]);
            var handle = getHandleAt(pos.x, pos.y, b);
            if (!handle) handle = getEdgeAt(pos.x, pos.y, b);
            if (handle) {
                    isResizing = true;
                    resizeHandle = handle;
                    resizeStartBounds = { x: b.x, y: b.y, w: b.w, h: b.h };
                    moveOffsetX = pos.x;
                    moveOffsetY = pos.y;
                    return;
                }
            if (hitTestTrazo(pos.x, pos.y, trazosPaint[selectedIndex])) {
                isMoving = true;
                moveOffsetX = pos.x;
                moveOffsetY = pos.y;
                canvasContainer.style.cursor = 'grabbing';
                return;
            }
        }
        seleccionarTrazoEn(pos.x, pos.y);
        if (selectedIndex >= 0) {
            isMoving = true;
            moveOffsetX = pos.x;
            moveOffsetY = pos.y;
            canvasContainer.style.cursor = 'grabbing';
        } else {
            dibujando = false;
        }
        return;
    }

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
        mostrarModalTexto(pos.x, pos.y);
        return;
    }

    if (herramientaActiva === 'sticker') {
        dibujando = false;
        const panel = $id('stickerPanel');
        if (panel) panel.classList.toggle('visible');
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

    if (herramientaActiva === 'mano') {
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        panX += (clientX - panStartX);
        panY += (clientY - panStartY);
        panStartX = clientX;
        panStartY = clientY;
        aplicarZoom(zoom);
        canvasContainer.style.cursor = 'grabbing';
        return;
    }

    if (herramientaActiva === 'seleccion') {
        if (isMoving && selectedIndex >= 0) {
            var dx = pos.x - moveOffsetX;
            var dy = pos.y - moveOffsetY;
            moverTrazoSeleccionado(dx, dy);
            moveOffsetX = pos.x;
            moveOffsetY = pos.y;
            actualizarRenderConSeleccion();
            return;
        }
        if (isResizing && selectedIndex >= 0 && resizeStartBounds) {
            var dx = pos.x - xInicio;
            var dy = pos.y - yInicio;
            redimensionarTrazoSeleccionado(resizeHandle, resizeStartBounds, dx, dy);
            actualizarRenderConSeleccion();
            return;
        }
        return;
    }

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
    if (herramientaActiva === 'mano') {
        canvasContainer.style.cursor = 'grab';
    }
    if (herramientaActiva === 'seleccion') {
        if (isMoving || isResizing) {
            isMoving = false;
            isResizing = false;
            resizeStartBounds = null;
            canvasContainer.style.cursor = 'move';
            guardarHistorial();
            actualizarRenderConSeleccion();
        }
    }
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
            var fuente = trazo.fuente || 'Nunito';
            var tam    = trazo.tamano || Math.max(12, trazo.grosor * 3);
            var ctxTxt = ctx || ctxBuffer;
            ctxTxt.font = tam + 'px ' + fuente;
            var wrapW  = trazo.width || ctxTxt.measureText(trazo.texto).width + 10;
            var lines  = wrapText(ctxTxt, trazo.texto, wrapW);
            var lineH  = tam * 1.3;
            ctx.fillStyle = trazo.color;
            lines.forEach(function(line, i) {
                ctx.fillText(line, trazo.x, trazo.y + i * lineH);
            });
        } else if (trazo.tipo === 'sticker') {
            const size = trazo.tamano || trazo.size || Math.max(30, trazo.grosor * 5);
            ctx.font      = `${size}px sans-serif`;
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

// ══════════════════════════════════════════════════════════════════
//  SELECCIÓN — mover y redimensionar trazos
// ══════════════════════════════════════════════════════════════════
function getTrazoBounds(trazo) {
    var pad = 6;
    if (trazo.tipo === 'texto') {
        var tam = trazo.tamano || Math.max(12, trazo.grosor * 3);
        var fuente = trazo.fuente || 'Nunito';
        ctxBuffer.font = tam + 'px ' + fuente;
        // Usar trazo.width (ancho de ajuste) si existe, de lo contrario medir texto natural
        var naturalW = ctxBuffer.measureText(trazo.texto).width + 10;
        var wrapW = trazo.width || naturalW;
        var lines = wrapText(ctxBuffer, trazo.texto, wrapW);
        var lineH = tam * 1.3;
        var h = lines.length * lineH;
        // El ancho del bounding box es el ancho de ajuste (no el de las líneas individuales)
        // para que los handles E/W coincidan con el borde visual de wrap
        var boxW = Math.max(wrapW, naturalW);
        return { x: trazo.x - pad, y: trazo.y - tam - pad, w: boxW + pad * 2, h: h + pad * 2 };
    }
    if (trazo.tipo === 'sticker') {
        var sz = trazo.tamano || trazo.size || Math.max(30, trazo.grosor * 5);
        return { x: trazo.x - pad, y: trazo.y - sz - pad, w: sz * 1.2 + pad * 2, h: sz * 1.3 + pad * 2 };
    }
    if (trazo.tipo === 'linea' || trazo.tipo === 'rect' || trazo.tipo === 'circulo') {
        var x1 = trazo.x1, y1 = trazo.y1, x2 = trazo.x2, y2 = trazo.y2;
        var minX = Math.min(x1, x2) - pad, maxX = Math.max(x1, x2) + pad;
        var minY = Math.min(y1, y2) - pad, maxY = Math.max(y1, y2) + pad;
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    if (trazo.puntos && trazo.puntos.length > 0) {
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        trazo.puntos.forEach(function(p) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        var g = trazo.grosor || 5;
        return { x: minX - pad - g, y: minY - pad - g, w: maxX - minX + pad * 2 + g * 2, h: maxY - minY + pad * 2 + g * 2 };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
}

function hitTestTrazo(px, py, trazo) {
    var b = getTrazoBounds(trazo);
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

function getTrazoEnPosicion(px, py) {
    for (var i = trazosPaint.length - 1; i >= 0; i--) {
        if (hitTestTrazo(px, py, trazosPaint[i])) return i;
    }
    return -1;
}

function getHandlePoints(b) {
    var hs = 8;
    var handles = [
        { id:'nw', x: b.x, y: b.y },
        { id:'n',  x: b.x + b.w / 2, y: b.y },
        { id:'ne', x: b.x + b.w, y: b.y },
        { id:'e',  x: b.x + b.w, y: b.y + b.h / 2 },
        { id:'se', x: b.x + b.w, y: b.y + b.h },
        { id:'s',  x: b.x + b.w / 2, y: b.y + b.h },
        { id:'sw', x: b.x, y: b.y + b.h },
        { id:'w',  x: b.x, y: b.y + b.h / 2 },
    ];
    return handles;
}

function getHandleAt(px, py, b) {
    var hs = 10;
    var handles = getHandlePoints(b);
    for (var i = 0; i < handles.length; i++) {
        var h = handles[i];
        if (Math.abs(px - h.x) < hs && Math.abs(py - h.y) < hs) return h.id;
    }
    return '';
}

function getEdgeAt(px, py, b) {
    var margin = 6;
    var onLeft   = Math.abs(px - b.x) < margin && py >= b.y - margin && py <= b.y + b.h + margin;
    var onRight  = Math.abs(px - (b.x + b.w)) < margin && py >= b.y - margin && py <= b.y + b.h + margin;
    var onTop    = Math.abs(py - b.y) < margin && px >= b.x - margin && px <= b.x + b.w + margin;
    var onBottom = Math.abs(py - (b.y + b.h)) < margin && px >= b.x - margin && px <= b.x + b.w + margin;
    if (onLeft && onTop) return 'nw';
    if (onRight && onTop) return 'ne';
    if (onLeft && onBottom) return 'sw';
    if (onRight && onBottom) return 'se';
    if (onLeft) return 'w';
    if (onRight) return 'e';
    if (onTop) return 'n';
    if (onBottom) return 's';
    return '';
}

function dibujarSeleccion(ctx) {
    if (selectedIndex < 0 || selectedIndex >= trazosPaint.length) return;
    var trazo = trazosPaint[selectedIndex];
    var b = getTrazoBounds(trazo);

    ctx.save();
    ctx.strokeStyle = '#7c4dff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);

    // Determinar si el trazo admite redimensionado horizontal (anchar/desanchar)
    var esTexto = trazo.tipo === 'texto';
    var handles = getHandlePoints(b);
    ctx.lineWidth = 1.5;

    handles.forEach(function(h) {
        var esLateral = (h.id === 'e' || h.id === 'w');
        var esSupInf  = (h.id === 'n' || h.id === 's');

        if (esTexto && esLateral) {
            // Handle de ancho — rombo azul con flechas ↔ para indicar que se puede anchar
            ctx.fillStyle = '#7c4dff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            // Rombo
            ctx.beginPath();
            ctx.moveTo(h.x, h.y - 6);
            ctx.lineTo(h.x + 6, h.y);
            ctx.lineTo(h.x, h.y + 6);
            ctx.lineTo(h.x - 6, h.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Mini flechas horizontales ↔
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            // Flecha izquierda
            ctx.moveTo(h.x - 4, h.y); ctx.lineTo(h.x - 2, h.y);
            ctx.moveTo(h.x - 4, h.y); ctx.lineTo(h.x - 2.5, h.y - 1.5);
            ctx.moveTo(h.x - 4, h.y); ctx.lineTo(h.x - 2.5, h.y + 1.5);
            // Flecha derecha
            ctx.moveTo(h.x + 4, h.y); ctx.lineTo(h.x + 2, h.y);
            ctx.moveTo(h.x + 4, h.y); ctx.lineTo(h.x + 2.5, h.y - 1.5);
            ctx.moveTo(h.x + 4, h.y); ctx.lineTo(h.x + 2.5, h.y + 1.5);
            ctx.stroke();
        } else if (!esTexto && esSupInf) {
            // Para stickers/otros, el handle n/s no hace nada especial — cuadrado gris claro
            ctx.fillStyle = '#d1c4e9';
            ctx.strokeStyle = '#7c4dff';
            ctx.lineWidth = 1;
            ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
            ctx.strokeRect(h.x - 4, h.y - 4, 8, 8);
        } else {
            // Handle estándar — cuadrado blanco con borde morado
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#7c4dff';
            ctx.lineWidth = 1.5;
            ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
            ctx.strokeRect(h.x - 4, h.y - 4, 8, 8);
        }
    });
    ctx.restore();
}

function actualizarRenderConSeleccion() {
    actualizarLienzoCompleto();
    if (selectedIndex >= 0 && herramientaActiva === 'seleccion') {
        dibujarSeleccion(ctxVisible);
    }
}

function seleccionarTrazoEn(px, py) {
    var idx = getTrazoEnPosicion(px, py);
    if (idx >= 0) {
        selectedIndex = idx;
        isMoving = false;
        isResizing = false;
        canvasContainer.style.cursor = 'move';
    } else {
        selectedIndex = -1;
        canvasContainer.style.cursor = 'default';
    }
    syncTextPropsPanel();
    actualizarRenderConSeleccion();
}

function moverTrazoSeleccionado(dx, dy) {
    if (selectedIndex < 0) return;
    var trazo = trazosPaint[selectedIndex];
    if (trazo.tipo === 'texto' || trazo.tipo === 'sticker') {
        trazo.x += dx;
        trazo.y += dy;
    } else if (['linea','rect','circulo'].includes(trazo.tipo)) {
        trazo.x1 += dx; trazo.y1 += dy;
        trazo.x2 += dx; trazo.y2 += dy;
    } else if (trazo.puntos) {
        trazo.puntos.forEach(function(p) { p.x += dx; p.y += dy; });
    }
}

function redimensionarTrazoSeleccionado(handle, startBounds, dx, dy) {
    if (selectedIndex < 0) return;
    var trazo = trazosPaint[selectedIndex];
    var b = startBounds;
    var nx = b.x, ny = b.y, nw = b.w, nh = b.h;

    if (handle.indexOf('e') >= 0) nw += dx;
    if (handle.indexOf('w') >= 0) { nx += dx; nw -= dx; }
    if (handle.indexOf('s') >= 0) nh += dy;
    if (handle.indexOf('n') >= 0) { ny += dy; nh -= dy; }

    if (nw < 10) { nw = 10; if (handle.indexOf('w') >= 0) nx = b.x + b.w - 10; }
    if (nh < 10) { nh = 10; if (handle.indexOf('n') >= 0) ny = b.y + b.h - 10; }

    var pad = 6;
    if (trazo.tipo === 'sticker') {
        var newSize = Math.max(8, Math.round((nh - pad * 2) / 1.3));
        trazo.size = newSize;
        trazo.tamano = newSize;
        trazo.x = nx + pad;
        trazo.y = ny + newSize + pad;
    } else if (trazo.tipo === 'texto') {
        var wChanged = handle.indexOf('e') >= 0 || handle.indexOf('w') >= 0;
        var hChanged = handle.indexOf('s') >= 0 || handle.indexOf('n') >= 0;
        var oldTam = trazo.tamano || 18;
        if (wChanged) {
            trazo.width = Math.max(20, nw - pad * 2);
            if (handle.indexOf('w') >= 0) {
                trazo.x = nx + pad;
            }
        }
        if (hChanged) {
            var newSize = Math.max(8, Math.round((nh - pad * 2) / 1.3));
            trazo.grosor = Math.max(1, Math.round(newSize / 3));
            trazo.tamano = newSize;
            trazo.y = ny + newSize + pad;
        }
    } else if (['linea','rect','circulo'].includes(trazo.tipo)) {
        var cx = (trazo.x1 + trazo.x2) / 2;
        var cy = (trazo.y1 + trazo.y2) / 2;
        var sx = nw / b.w;
        var sy = nh / b.h;
        var hw = Math.abs(trazo.x2 - trazo.x1) / 2 * sx;
        var hh = Math.abs(trazo.y2 - trazo.y1) / 2 * sy;
        trazo.x1 = cx - hw;
        trazo.x2 = cx + hw;
        trazo.y1 = cy - hh;
        trazo.y2 = cy + hh;
    } else if (trazo.puntos) {
        var sx = nw / b.w;
        var sy = nh / b.h;
        var minX = Infinity, minY = Infinity;
        trazo.puntos.forEach(function(p) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; });
        trazo.puntos.forEach(function(p) {
            p.x = nx + (p.x - minX) * sx;
            p.y = ny + (p.y - minY) * sy;
        });
    }
}

// ══════════════════════════════════════════════════════════════════
//  PANEL DE PROPIEDADES DE TEXTO/SELECCIÓN
// ══════════════════════════════════════════════════════════════════
function aplicarColorASeleccion(color) {
    if (selectedIndex < 0 || selectedIndex >= trazosPaint.length) return;
    var t = trazosPaint[selectedIndex];
    t.color = color;
    actualizarRenderConSeleccion();
}

function syncTextPropsPanel() {
    var panel = $id('textPropsPanel');
    var brush = $id('brushSection');
    var showText = false;
    if (selectedIndex >= 0 && selectedIndex < trazosPaint.length) {
        var t = trazosPaint[selectedIndex];
        if (t.tipo === 'texto' || t.tipo === 'sticker') {
            showText = true;
            if (panel) {
                panel.style.display = 'block';
                $id('textColorPicker').value = t.color || '#7c4dff';
                $id('selectFuenteSel').value = t.fuente || 'Nunito';
                var op = Math.round((t.opacidad ?? 1) * 100);
                $id('textOpacitySlider').value = op;
                $id('textOpacityVal').textContent = op + '%';
                var sz = t.tamano || 18;
                $id('textSizeSlider').value = sz;
                $id('textSizeVal').textContent = sz;
            }
        }
    }
    if (panel) panel.style.display = showText ? 'block' : 'none';
    if (brush) brush.style.display = showText ? 'none' : 'block';
}

function aplicarPropsTexto() {
    if (selectedIndex < 0 || selectedIndex >= trazosPaint.length) return;
    var t = trazosPaint[selectedIndex];
    if (t.tipo === 'texto' || t.tipo === 'sticker') {
        t.color = $id('textColorPicker').value || '#7c4dff';
        if (t.tipo === 'texto') {
            t.fuente = $id('selectFuenteSel').value || 'Nunito';
        }
        var op = parseInt($id('textOpacitySlider').value) / 100;
        t.opacidad = op;
        var oldTam = t.tamano || 18;
        t.tamano = parseInt($id('textSizeSlider').value) || 18;
        if (t.tipo === 'texto') {
            ctxBuffer.font = t.tamano + 'px ' + (t.fuente || 'Nunito');
            var natural = ctxBuffer.measureText(t.texto).width + 10;
            t.width = Math.max(t.width || 260, Math.min(natural, 400), 60);
            t.y += (t.tamano - oldTam);
        } else {
            t.tamano = Math.max(t.tamano, 20);
            t.y += (t.tamano - oldTam);
        }
        actualizarRenderConSeleccion();
    }
}

// Listeners del panel de propiedades de texto
$id('textColorPicker')?.addEventListener('input', aplicarPropsTexto);
$id('selectFuenteSel')?.addEventListener('change', aplicarPropsTexto);
$id('textOpacitySlider')?.addEventListener('input', function() {
    $id('textOpacityVal').textContent = this.value + '%';
    aplicarPropsTexto();
});
$id('textSizeSlider')?.addEventListener('input', function() {
    $id('textSizeVal').textContent = this.value;
    aplicarPropsTexto();
});

// El slider de grosor también controla tamaño de letra cuando hay texto seleccionado
function actualizarGrosorUI(val) {
    $id('grosorPincel').value    = val;
    $id('grosorLateral').value   = val;
    $id('grosorValor').textContent = val;
    $id('grosorLateralVal').textContent = val + 'px';
    const size = Math.max(2, Math.min(20, val * 0.6));
    $id('grosortDot').style.width  = size + 'px';
    $id('grosortDot').style.height = size + 'px';

    // Si hay texto/sticker seleccionado, aplica como tamaño de letra
    if (selectedIndex >= 0 && selectedIndex < trazosPaint.length) {
        var t = trazosPaint[selectedIndex];
        if (t.tipo === 'texto' || t.tipo === 'sticker') {
            var oldTam = t.tamano || 18;
            t.tamano = val;
            if (t.tipo === 'texto') {
                ctxBuffer.font = t.tamano + 'px ' + (t.fuente || 'Nunito');
                var natural = ctxBuffer.measureText(t.texto).width + 10;
                t.width = Math.max(t.width || 260, Math.min(natural, 400), 60);
            }
            t.y += (t.tamano - oldTam);
            $id('textSizeSlider').value = val;
            $id('textSizeVal').textContent = val;
            actualizarRenderConSeleccion();
        }
    }
}

function resetearEstadoDibujo() {
    trazosPaint   = [];
    selectedIndex = -1;
    isMoving      = false;
    isResizing    = false;
    resizeStartBounds = null;
    dibujando     = false;
    snapshotAntesDibujo = null;
    syncTextPropsPanel();
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
    panX               = 0;
    panY               = 0;
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
//  EXPORTAR con transformación (rotación/volteo)
// ══════════════════════════════════════════════════════════════════
function exportarConTransformacion(callback) {
    // Crea un canvas temporal, aplica rotación+volteo, dibuja imagen y trazos, y pasa el canvas al callback
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width  = canvasVisible.width;
    tempCanvas.height = canvasVisible.height;
    const tempCtx = tempCanvas.getContext('2d');
    aplicarTransformCanvas(tempCtx, () => {
        tempCtx.drawImage(canvasBuffer, 0, 0);
        redibujarTrazos(tempCtx);
    });
    callback(tempCanvas);
}

// ══════════════════════════════════════════════════════════════════
//  DESCARGAR
// ══════════════════════════════════════════════════════════════════
function descargarResultado() {
    if (!imagenCargada) { mostrarToast('Carga una imagen primero', 'error'); return; }
    procesarEnBuffer();
    exportarConTransformacion(function(tempCanvas) {
        const link     = document.createElement('a');
        const titulo   = $id('inputTitulo')?.value.trim() || 'noteflow_imagen';
        link.download  = `${titulo}.png`;
        link.href      = tempCanvas.toDataURL('image/png');
        link.click();
        mostrarToast('Imagen descargada ✓');
    });
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

    // Renderizar todo con transformación
    procesarEnBuffer();
    exportarConTransformacion(function(tempCanvas) {
        tempCanvas.toBlob(async (blob) => {
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
    });
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
    if (e.key === 'h' || e.key === 'H') { if (e.shiftKey) setHerramienta('mano'); else voltear('h'); }
    if (e.key === 'v' || e.key === 'V') voltear('v');
    if (e.key === 'm' || e.key === 'M') setHerramienta('mano');
    if (e.key === 's' || e.key === 'S') { if (!e.ctrlKey && !e.metaKey) setHerramienta('sticker'); }
    if (e.key === 'q' || e.key === 'Q') setHerramienta('seleccion');

    // Eliminar selección
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndex >= 0) {
        guardarHistorial();
        trazosPaint.splice(selectedIndex, 1);
        selectedIndex = -1;
        syncTextPropsPanel();
        actualizarLienzoCompleto();
        actualizarStatsTrazos();
        e.preventDefault();
    }
    // Escape: deseleccionar
    if (e.key === 'Escape' && selectedIndex >= 0) {
        selectedIndex = -1;
        syncTextPropsPanel();
        actualizarLienzoCompleto();
        canvasContainer.style.cursor = 'default';
    }
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
//  PANEL DE EMOJIS / STICKERS
// ══════════════════════════════════════════════════════════════════
(function initEmojiPicker() {
    var EMOJIS = [
        '😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛',
        '😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔',
        '😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🤠','🥳','🥺','😢','😭','😤','😠','😡','🤬',
        '💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
        '💋','👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇',
        '👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻',
        '👀','🧠','🫀','🫁','🦷','👅','👄','👶','🧒','👦','👧','🧑','👨','👩','🧔','👴','👵','🧓','🙋','💁',
        '👨‍💻','👩‍💻','👨‍🎓','👩‍🎓','👨‍🎨','👩‍🎨','👨‍🚀','👩‍🚀','👨‍⚕️','👩‍⚕️','👮','🕵️','💂','🥷','👷','🤴','👸','🤵','👰','🤰',
        '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆',
        '🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🦂','🐢','🐍','🦎','🦖',
        '🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🦭','🐅','🐆','🦓','🦍','🦧',
        '🐘','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐓',
        '🌸','💮','🏵️','🌹','🥀','🌺','🌻','🌼','🌷','🌱','🌲','🌳','🌴','🌵','🌾','🌿','🍀','🍁','🍂','🍃',
        '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑',
        '🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫',
        '🍰','🎂','🍦','🍩','🍪','🍫','🍬','🍭','🍮','🎂','🍡','🥟','🦪','🍤','🍙','🍚','🍛','🍜','🍝','🍠',
        '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳',
        '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🛺','🚲','🛴','🛹',
        '🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','✈️','🛫','🛬','💺','🛰️','🚀','🛸','🚁','🛶',
        '🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌',
        '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️',
        '⭐','🌟','✨','⚡','🔥','💥','💫','💨','💦','💤','🌟','🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️',
        '🎉','🎊','🎈','🎁','🎀','🪄','🕯️','💡','🔦','🏆','🏅','🥇','🥈','🥉','🎖️','🎗️','📯','🎵','🎶','🎤',
        '📱','💻','🖥️','🖨️','⌨️','🖱️','🖲️','💽','💾','💿','📀','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟',
        '🔒','🔓','🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️','🔧','🔩','⚙️','🗜️','⚖️','🪛','🔗','⛓️','🧰','🧲',
        '🇨🇴','🇺🇸','🇬🇧','🇪🇸','🇫🇷','🇩🇪','🇮🇹','🇧🇷','🇯🇵','🇰🇷','🇨🇳','🇮🇳','🇷🇺','🇦🇷','🇲🇽','🇨🇱','🇵🇪','🇻🇪','🇨🇺','🇵🇦'
    ];

    var grid = document.getElementById('emojiGrid');
    var search = document.getElementById('emojiSearch');
    if (!grid) return;

    function renderEmojis(filter) {
        filter = filter.toLowerCase();
        grid.innerHTML = '';
        EMOJIS.forEach(function(e) {
            if (filter && !e.toLowerCase().includes(filter)) return;
            var el = document.createElement('div');
            el.className = 'emoji-item';
            el.textContent = e;
            el.addEventListener('click', function() {
                guardarHistorial();
                var cx = canvasVisible.width / 2;
                var cy = canvasVisible.height / 2;
                var size = Math.max(getGrosor() * 5, 40);
                ctxVisible.save();
                ctxVisible.font = size + 'px sans-serif';
                ctxVisible.globalAlpha = getOpacidad();
                ctxVisible.fillText(e, cx - size/2, cy + size/3);
                ctxVisible.restore();
                trazosPaint.push({ tipo:'sticker', texto:e, x:cx - size/2, y:cy + size/3, color:'#000', grosor:getGrosor(), fuente:'sans-serif', opacidad:getOpacidad(), size:size, tamano: parseInt($id('textSizeSlider')?.value) || size });
                actualizarStatsTrazos();
                mostrarToast('Emoji colocado en el centro');
            });
            grid.appendChild(el);
        });
        if (grid.children.length === 0) {
            grid.innerHTML = '<div style="padding:20px;color:#b39ddb;text-align:center;">Sin resultados</div>';
        }
    }

    renderEmojis('');
    if (search) {
        search.addEventListener('input', function() { renderEmojis(search.value); });
    }
})();

// ══════════════════════════════════════════════════════════════════
//  MODAL DE TEXTO
// ══════════════════════════════════════════════════════════════════
function mostrarModalTexto(x, y) {
    textoPosX = x;
    textoPosY = y;
    var modal = $id('modalTexto');
    var input = $id('modalTextoInput');
    if (!modal || !input) return;
    input.value = '';
    modal.classList.add('visible');
    setTimeout(function() { input.focus(); }, 100);
}

$id('btnModalTextoInsertar')?.addEventListener('click', function() {
    var modal = $id('modalTexto');
    var input = $id('modalTextoInput');
    if (!modal || !input) return;
    var texto = input.value.trim();
    if (texto) {
        guardarHistorial();
        var fuente  = $id('selectFuente')?.value || 'Nunito';
        var grosor  = getGrosor();
        var tamTxt  = parseInt($id('textSizeSlider')?.value) || 18;
        // Si hay texto seleccionado (edición con doble clic), actualizarlo
        if (selectedIndex >= 0 && selectedIndex < trazosPaint.length && trazosPaint[selectedIndex].tipo === 'texto') {
            var t = trazosPaint[selectedIndex];
            var oldTam = t.tamano || 18;
            t.texto = texto;
            t.fuente = fuente;
            t.tamano = tamTxt;
            ctxVisible.save();
            ctxVisible.font = tamTxt + 'px ' + fuente;
            t.width = Math.min(ctxVisible.measureText(texto).width + 10, 260);
            ctxVisible.restore();
            t.y += (t.tamano - oldTam);
            actualizarLienzoCompleto();
            syncTextPropsPanel();
        } else {
            ctxVisible.save();
            ctxVisible.font         = tamTxt + 'px ' + fuente;
            ctxVisible.fillStyle    = getColor();
            ctxVisible.globalAlpha  = getOpacidad();
            var txtWidth = Math.min(ctxVisible.measureText(texto).width + 10, 260);
            ctxVisible.fillText(texto, textoPosX, textoPosY);
            ctxVisible.restore();
            trazosPaint.push({ tipo:'texto', texto:texto, x:textoPosX, y:textoPosY, color:getColor(), grosor:grosor, fuente:fuente, opacidad:getOpacidad(), tamano: tamTxt, width: txtWidth });
        }
        actualizarStatsTrazos();
    }
    modal.classList.remove('visible');
});

$id('btnModalTextoCancelar')?.addEventListener('click', function() {
    var modal = $id('modalTexto');
    if (modal) modal.classList.remove('visible');
    // Si se canceló una edición, limpiar selección
    syncTextPropsPanel();
});

$id('modalTexto')?.addEventListener('click', function(e) {
    if (e.target.id === 'modalTexto') this.classList.remove('visible');
});

// Enter en el input inserta
$id('modalTextoInput')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        $id('btnModalTextoInsertar')?.click();
    }
});

// ══════════════════════════════════════════════════════════════════
//  INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════════
actualizarGrosorUI(5);
actualizarBtnHistorial();