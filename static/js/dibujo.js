/* ──────────────────────────────────────────
   SETUP CANVAS FABRIC.JS
────────────────────────────────────────── */
const canvasElement = document.getElementById('pizarra');
// Desactivar caché para que letras y formas no se pixelen
fabric.Object.prototype.objectCaching = false;

const fcanvas = new fabric.Canvas('pizarra', {
    isDrawingMode: true,
    backgroundColor: '#ffffff',
    fireRightClick: true,
    stopContextMenu: true
});

const colorPicker  = document.getElementById('colorPicker');
const grosorInput  = document.getElementById('grosorPincel');
const grosorPunto  = document.getElementById('grosorPunto');
const canvasHint   = document.getElementById('canvasHint');

// Tamaño actual del lienzo (puede crecer con expandirLienzo)
let lienzW = 900;
let lienzH = 520;
let zoomActual = 1;
let _pinchActive = false;

// ── Límites según Plan ──
const limitW = { 'gratis': 1100, 'quincenal': 1400, 'mensual': 2400, 'anual': 3600 };
const limitH = { 'gratis': 640,  'quincenal': 900,  'mensual': 1400, 'anual': 2000 };
const userPlan = document.getElementById('userPlanPremium')?.value || 'gratis';
const maxW = limitW[userPlan] || limitW['gratis'];
const maxH = limitH[userPlan] || limitH['gratis'];

function esPremium() {
    return userPlan !== 'gratis';
}
function requierePremium() {
    if (esPremium()) return true;
    mostrarToast('🔒 Funciones premium. Mejora tu plan para acceder.');
    return false;
}

function actualizarInfoTamaño() {
    const el = document.getElementById('canvasSizeInfo');
    if (el) {
        el.innerHTML = `<span style="cursor:pointer;" title="Haz clic para cambiar tamaño manualmente">${lienzW} × ${lienzH}px <i class="fas fa-edit" style="font-size:0.7rem; opacity:0.6;"></i></span>`;
        el.onclick = () => {
            const val = prompt(`Introduce el nuevo tamaño (ej: 1200x800). Máximo para tu plan: ${maxW}x${maxH}`, `${lienzW}x${lienzH}`);
            if(val) {
                const parts = val.toLowerCase().split('x');
                if (parts.length === 2) {
                    const w = parseInt(parts[0]);
                    const h = parseInt(parts[1]);
                    if (!isNaN(w) && !isNaN(h)) {
                        if (w > maxW || h > maxH) return mostrarToast(`Límite superado. El máximo para tu plan es ${maxW}x${maxH}px`);
                        if (w < 400 || h < 400) return mostrarToast(`El tamaño mínimo es 400x400px`);
                        lienzW = w;
                        lienzH = h;
                        ajustarCanvas();
                        mostrarToast(`Lienzo ajustado manualmente a ${w}x${h}px`);
                    }
                }
            }
        };
    }
    actualizarEstadoBotonesExpand();
}

function actualizarEstadoBotonesExpand() {
    const btnR = document.querySelector('.expander-right');
    const btnL = document.querySelector('.expander-left');
    const btnB = document.querySelector('.expander-bottom');
    const btnT = document.querySelector('.expander-top');
    const step = 200;

    const lockHTML = '<i class="fas fa-lock"></i>';
    const plusHTML = '<i class="fas fa-plus"></i>';

    if (btnR) { btnR.innerHTML = (lienzW + step > maxW) ? lockHTML : plusHTML; btnR.style.opacity = (lienzW + step > maxW) ? 0.6 : 1; }
    if (btnL) { btnL.innerHTML = (lienzW + step > maxW) ? lockHTML : plusHTML; btnL.style.opacity = (lienzW + step > maxW) ? 0.6 : 1; }
    if (btnB) { btnB.innerHTML = (lienzH + step > maxH) ? lockHTML : plusHTML; btnB.style.opacity = (lienzH + step > maxH) ? 0.6 : 1; }
    if (btnT) { btnT.innerHTML = (lienzH + step > maxH) ? lockHTML : plusHTML; btnT.style.opacity = (lienzH + step > maxH) ? 0.6 : 1; }
}

function ajustarCanvas() {
    var visualW = Math.round(lienzW * zoomActual);
    var visualH = Math.round(lienzH * zoomActual);
    fcanvas.setDimensions({ width: visualW, height: visualH });
    fcanvas.setZoom(zoomActual);
    
    const wrap = document.getElementById('canvasWrap');
    if (wrap) {
        var cs = window.getComputedStyle(wrap);
        var baseM = parseFloat(cs.getPropertyValue('--canvas-mg')) || 100;
        wrap.style.margin = baseM + 'px';
    }

    var outer = document.getElementById('canvasOuter');
    if (outer) {
        outer.style.overflow = zoomActual > zoomToFit() ? 'auto' : 'hidden';
    }

    fcanvas.calcOffset();
    if (simetriaActiva) {
        eliminarEjeSimetria();
        crearEjeSimetria();
    }
    fcanvas.renderAll();
    actualizarInfoTamaño();
}
ajustarCanvas();
window.addEventListener('resize', () => {
    const outer = document.getElementById('canvasOuter');
    const sl = outer.scrollLeft, st = outer.scrollTop;
    ajustarCanvas();
    outer.scrollLeft = sl;
    outer.scrollTop = st;
});

// ── Orientación ──
function mostrarModalOrientacion() {
    var modal = document.getElementById('orientacionModal');
    if (modal) modal.classList.add('visible');
}

function establecerOrientacion(orientacion) {
    if (orientacion === 'vertical') {
        lienzW = 600;
        lienzH = 800;
    } else {
        lienzW = 900;
        lienzH = 520;
    }
    zoomActual = getClampZoom(zoomToFit());
    ajustarCanvas();
    document.getElementById('zoomLabel').textContent = Math.round(zoomActual * 100) + '%';
    document.getElementById('orientacionModal').classList.remove('visible');
    // Guardar estado inicial con el nuevo tamaño
    bloqueado = true;
    fcanvas.clear();
    bloqueado = false;
    guardarEstado();
    actualizarHint();
    mostrarToast('Formato ' + (orientacion === 'vertical' ? 'vertical' : 'horizontal') + ' listo');
}

// Mostrar modal de orientación para notas nuevas
var editNotaId = document.getElementById('editNotaId')?.value;
if (!editNotaId) {
    setTimeout(mostrarModalOrientacion, 600);
}

/* ──────────────────────────────────────────
   SISTEMA DE CAPAS (LAYERS)
────────────────────────────────────────── */
let layers = [];
let activeLayerIndex = 0;
let layerIdCounter = 0;

function initLayers() {
    layers = [{ id: 'layer_' + (layerIdCounter++), name: 'Capa 1', visible: true, locked: false }];
    activeLayerIndex = 0;
}

function getActiveLayer() { return layers[activeLayerIndex]; }

function getLayerIndexById(id) { return layers.findIndex(function(l) { return l.id === id; }); }

function addLayer(nombre) {
    if (!requierePremium()) return;
    var name = nombre || 'Capa ' + (layers.length + 1);
    var newLayer = { id: 'layer_' + (layerIdCounter++), name: name, visible: true, locked: false };
    layers.push(newLayer);
    setActiveLayer(layers.length - 1);
    renderLayerPanel();
    guardarEstado();
}

function deleteLayer(index) {
    if (layers.length <= 1) { mostrarToast('Debe haber al menos una capa'); return; }
    var layerId = layers[index].id;
    // Mover objetos de la capa eliminada a la activa
    var activeId = getActiveLayer().id;
    fcanvas.getObjects().forEach(function(obj) {
        if (obj._layerId === layerId) obj._layerId = activeId;
    });
    layers.splice(index, 1);
    if (activeLayerIndex >= layers.length) activeLayerIndex = layers.length - 1;
    if (activeLayerIndex === index && index > 0) activeLayerIndex--;
    updateCanvasFromLayers();
    renderLayerPanel();
    guardarEstado();
}

function setActiveLayer(index) {
    activeLayerIndex = index;
    updateCanvasFromLayers();
    renderLayerPanel();
}

function toggleVisibility(index) {
    layers[index].visible = !layers[index].visible;
    updateCanvasFromLayers();
    renderLayerPanel();
    guardarEstado();
}

function toggleLock(index) {
    layers[index].locked = !layers[index].locked;
    updateCanvasFromLayers();
    renderLayerPanel();
}

function moveLayer(index, dir) {
    var newIndex = index + dir;
    if (newIndex < 0 || newIndex >= layers.length) return;
    var temp = layers[index];
    layers[index] = layers[newIndex];
    layers[newIndex] = temp;
    if (activeLayerIndex === index) activeLayerIndex = newIndex;
    else if (activeLayerIndex === newIndex) activeLayerIndex = index;
    reorderObjectsByLayers();
    updateCanvasFromLayers();
    renderLayerPanel();
    guardarEstado();
}

function reorderObjectsByLayers() {
    // Reordenar objetos en fabric según el orden de capas (abajo→arriba)
    var allObjects = fcanvas.getObjects().slice();
    // Ordenar: objetos de capas inferiores primero
    allObjects.sort(function(a, b) {
        var idxA = getLayerIndexById(a._layerId);
        var idxB = getLayerIndexById(b._layerId);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });
    allObjects.forEach(function(obj, i) { fcanvas.moveTo(obj, i); });
    fcanvas.renderAll();
}

function updateCanvasFromLayers() {
    var activeId = getActiveLayer() ? getActiveLayer().id : null;
    var defaultId = layers[0] ? layers[0].id : null;
    fcanvas.getObjects().forEach(function(obj) {
        // Asignar objetos legacy a la primera capa
        if (!obj._layerId) obj._layerId = defaultId || 'layer_0';
        var layerIdx = getLayerIndexById(obj._layerId);
        var layer = layers[layerIdx];
        if (!layer) {
            obj.visible = false;
            obj.selectable = false;
            obj.evented = false;
            return;
        }
        obj.visible = layer.visible;
        obj.selectable = !layer.locked && layer.visible;
        obj.evented = !layer.locked && layer.visible;
        // Atenuar opacidad de capas inactivas (pero no las bloqueadas, que ya son no editables)
        if (layer.visible && obj._layerId !== activeId) {
            if (obj._savedOpacity === undefined) obj._savedOpacity = obj.opacity;
            obj.opacity = 0.35;
        } else if (obj._layerId === activeId) {
            if (obj._savedOpacity !== undefined) {
                obj.opacity = obj._savedOpacity;
                obj._savedOpacity = undefined;
            }
        }
    });
    fcanvas.renderAll();
}

function renderLayerPanel() {
    var list = document.getElementById('layerList');
    if (!list) return;
    list.innerHTML = '';
    for (var i = layers.length - 1; i >= 0; i--) {
        (function(idx) {
            var layer = layers[idx];
            var item = document.createElement('div');
            item.className = 'layer-item' + (idx === activeLayerIndex ? ' active' : '');
            
            var eye = document.createElement('button');
            eye.className = 'layer-btn layer-eye';
            eye.innerHTML = layer.visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash" style="opacity:0.4"></i>';
            eye.title = layer.visible ? 'Ocultar capa' : 'Mostrar capa';
            eye.addEventListener('click', function(e) { e.stopPropagation(); toggleVisibility(idx); });
            
            var name = document.createElement('span');
            name.className = 'layer-name';
            name.textContent = layer.name;
            name.addEventListener('dblclick', function() {
                var nuevo = prompt('Nombre de la capa:', layer.name);
                if (nuevo && nuevo.trim()) { layer.name = nuevo.trim(); renderLayerPanel(); guardarEstado(); }
            });
            
            var lock = document.createElement('button');
            lock.className = 'layer-btn layer-lock';
            lock.innerHTML = layer.locked ? '<i class="fas fa-lock"></i>' : '<i class="fas fa-unlock"></i>';
            lock.title = layer.locked ? 'Desbloquear capa' : 'Bloquear capa';
            lock.addEventListener('click', function(e) { e.stopPropagation(); toggleLock(idx); });
            
            item.appendChild(eye);
            item.appendChild(name);
            item.appendChild(lock);
            item.addEventListener('click', function() { setActiveLayer(idx); });
            list.appendChild(item);
        })(i);
    }
    var label = document.getElementById('layerPanelActive');
    if (label && layers[activeLayerIndex]) {
        label.textContent = 'Activa: ' + layers[activeLayerIndex].name;
    }
}

function toggleLayerPanel() {
    var panel = document.getElementById('layerPanel');
    if (panel) panel.classList.toggle('visible');
}

// Inicializar capas
initLayers();

// ── Variables del Estabilizador ──
let stabilizerPoints = [];

// ── Tipo de Pincel ──
let brushType = 'pencil';

// ── Simetría ──
var simetriaActiva = false;
var simetriaEje = null;

window.toggleSimetria = function() {
    if (simetriaActiva) {
        // Permitir desactivar sin ser premium
    } else if (!requierePremium()) return;
    simetriaActiva = !simetriaActiva;
    var btn = document.getElementById('btnSimetria');
    if (btn) {
        btn.classList.toggle('activo', simetriaActiva);
        btn.style.background = simetriaActiva ? 'var(--morado-vivo)' : '';
        btn.style.color = simetriaActiva ? '#fff' : '';
    }
    if (simetriaActiva) {
        crearEjeSimetria();
    } else {
        eliminarEjeSimetria();
    }
};

function crearEjeSimetria() {
    eliminarEjeSimetria();
    var midX = lienzW / 2;
    simetriaEje = new fabric.Line([midX, 0, midX, lienzH], {
        stroke: '#7c4dff',
        strokeWidth: 1.5,
        strokeDashArray: [6, 4],
        selectable: false,
        evented: false,
        excludeFromExport: true,
        opacity: 0.6
    });
    fcanvas.add(simetriaEje);
    simetriaEje.moveTo(0);
    fcanvas.renderAll();
}

function eliminarEjeSimetria() {
    if (simetriaEje) {
        fcanvas.remove(simetriaEje);
        simetriaEje = null;
    }
}

function espejarObjeto(obj) {
    if (!simetriaActiva) return;
    if (obj === simetriaEje || obj._isMirror || obj._isEraser) return;
    // Pausar guardarEstado para que el espejado no genere historia extra
    var oldBloqueado = bloqueado;
    bloqueado = true;
    obj.clone(function(clon) {
        var midX = lienzW / 2;
        var center = obj.getCenterPoint();
        var mirrorX = 2 * midX - center.x;
        
        clon.set({
            flipX: !obj.flipX,
            angle: -obj.angle,
            _isMirror: true,
            _layerId: obj._layerId,
            evented: false
        });
        
        clon.setPositionByOrigin(new fabric.Point(mirrorX, center.y), 'center', 'center');
        fcanvas.add(clon);
        clon.moveTo(obj.depth || 0);
        fcanvas.renderAll();
        bloqueado = oldBloqueado;
        guardarEstado();
    });
}
window.setBrush = function(tipo, btn) {
    if (tipo !== 'pencil' && !requierePremium()) return;
    brushType = tipo;
    document.querySelectorAll('.brush-option').forEach(function(b) { b.classList.remove('activo'); });
    document.querySelectorAll('.brush-card').forEach(function(b) { b.classList.remove('activo'); });
    if (btn) btn.classList.add('activo');
    if (herramienta === 'lapiz' || herramienta === 'estabilizador') {
        seleccionarHerramienta(herramienta, document.querySelector('.btn-tool.activo'));
    }
};
let stabilizerPreviewPath = null;

function smoothPoints(raw, windowSize) {
    if (raw.length < 2) return raw;
    var result = [];
    for (var i = 0; i < raw.length; i++) {
        var start = Math.max(0, i - Math.floor(windowSize / 2));
        var end = Math.min(raw.length - 1, i + Math.floor(windowSize / 2));
        var cnt = end - start + 1;
        var sx = 0, sy = 0;
        for (var j = start; j <= end; j++) {
            sx += raw[j].x;
            sy += raw[j].y;
        }
        result.push({ x: sx / cnt, y: sy / cnt });
    }
    return result;
}

function pointsToPath(points) {
    if (points.length < 2) return null;
    var d = 'M ' + points[0].x.toFixed(1) + ' ' + points[0].y.toFixed(1);
    for (var i = 1; i < points.length - 1; i++) {
        var mx = (points[i].x + points[i + 1].x) / 2;
        var my = (points[i].y + points[i + 1].y) / 2;
        d += ' Q ' + points[i].x.toFixed(1) + ' ' + points[i].y.toFixed(1) +
             ' ' + mx.toFixed(1) + ' ' + my.toFixed(1);
    }
    var last = points[points.length - 1];
    d += ' L ' + last.x.toFixed(1) + ' ' + last.y.toFixed(1);
    return d;
}

function createSmoothPath(points) {
    var pathData = pointsToPath(points);
    if (!pathData) return null;
    return new fabric.Path(pathData, {
        stroke: colorActual(),
        strokeWidth: grosorActual(),
        fill: 'transparent',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        _layerId: getActiveLayer().id
    });
}

// ── Lógica de Zoom Dinámico ──
function getClampZoom(z, maxZ) {
    let minZ = Math.min(0.5, Math.max(300 / lienzW, 300 / lienzH));
    if (maxZ === undefined) {
        maxZ = Math.max(1, Math.min(5000 / lienzW, 5000 / lienzH));
    }
    return Math.max(Math.min(z, maxZ, 2), minZ, 0.1);
}

function zoomToFit() {
    var outer = document.getElementById('canvasOuter');
    if (!outer) return 1;
    var wrap = document.getElementById('canvasWrap');
    if (!wrap) return 1;
    var cs = window.getComputedStyle(wrap);
    var baseM = parseFloat(cs.getPropertyValue('--canvas-mg')) || 100;
    var mx = baseM * 2;
    var my = baseM * 2;
    var outerCs = window.getComputedStyle(outer);
    var padL = parseFloat(outerCs.paddingLeft) || 0;
    var padR = parseFloat(outerCs.paddingRight) || 0;
    var padT = parseFloat(outerCs.paddingTop) || 0;
    var padB = parseFloat(outerCs.paddingBottom) || 0;
    var availW = outer.clientWidth - mx - padL - padR - 1;
    var availH = outer.clientHeight - my - padT - padB - 1;
    if (availW < 50 || availH < 50) return 1;
    var zoomW = availW / lienzW;
    var zoomH = availH / lienzH;
    return Math.min(zoomW, zoomH);
}

document.getElementById('btnZoomIn').addEventListener('click', () => {
    zoomActual = getClampZoom(zoomActual + 0.1);
    ajustarCanvas();
    document.getElementById('zoomLabel').textContent = Math.round(zoomActual * 100) + '%';
});
document.getElementById('btnZoomOut').addEventListener('click', () => {
    zoomActual = getClampZoom(zoomActual - 0.1);
    ajustarCanvas();
    document.getElementById('zoomLabel').textContent = Math.round(zoomActual * 100) + '%';
});
document.getElementById('btnZoomReset').addEventListener('click', () => {
    zoomActual = getClampZoom(1);
    ajustarCanvas();
    document.getElementById('zoomLabel').textContent = Math.round(zoomActual * 100) + '%';
});

// Zoom con rueda del ratón (Ctrl + scroll) — hacia el cursor, igual que el pinch
document.getElementById('canvasOuter').addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const pointer = fcanvas.getPointer(e);
    const logicalX = pointer.x, logicalY = pointer.y;

    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    zoomActual = getClampZoom(zoomActual + delta);
    ajustarCanvas();

    const outer = document.getElementById('canvasOuter');
    const canvasRect = fcanvas.upperCanvasEl.getBoundingClientRect();
    outer.scrollLeft += canvasRect.left + logicalX * zoomActual - e.clientX;
    outer.scrollTop += canvasRect.top + logicalY * zoomActual - e.clientY;

    document.getElementById('zoomLabel').textContent = Math.round(zoomActual * 100) + '%';
}, { passive: false });

// Pinch-to-zoom táctil (dos dedos) — zoom hacia el centro del pellizco
let lastTouchDist = 0;
document.getElementById('canvasOuter').addEventListener('touchstart', () => {
    _pinchActive = false;
}, { passive: true });
document.getElementById('canvasOuter').addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0], t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (lastTouchDist > 0) {
            const centerX = (t1.clientX + t2.clientX) / 2;
            const centerY = (t1.clientY + t2.clientY) / 2;
            // Punto lógico del canvas bajo el centro del pellizco (getPointer
            // ya considera posición del canvas, márgenes, scroll, etc.)
            const pointer = fcanvas.getPointer({ clientX: centerX, clientY: centerY });
            const logicalX = pointer.x;
            const logicalY = pointer.y;

            _pinchActive = true;
            const delta = (dist - lastTouchDist) * 0.01;
            zoomActual = getClampZoom(zoomActual + delta);
            ajustarCanvas();

            // Tras ajustarCanvas, medir dónde quedó el canvas y corregir scroll
            // para que el punto lógico aparezca en la misma posición de pantalla
            const outer = document.getElementById('canvasOuter');
            const canvasRect = fcanvas.upperCanvasEl.getBoundingClientRect();
            const canvasPixelX = logicalX * zoomActual;
            const canvasPixelY = logicalY * zoomActual;
            outer.scrollLeft += canvasRect.left + canvasPixelX - centerX;
            outer.scrollTop += canvasRect.top + canvasPixelY - centerY;

            document.getElementById('zoomLabel').textContent = Math.round(zoomActual * 100) + '%';
        }
        lastTouchDist = dist;
    }
}, { passive: false });
document.getElementById('canvasOuter').addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
        lastTouchDist = 0;
        _pinchActive = false;
    }
});


// ── Expandir Lienzo por Lados ──
document.querySelectorAll('.canvas-expander').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const dir = btn.classList.contains('expander-right') ? 'right' :
                    btn.classList.contains('expander-bottom') ? 'bottom' :
                    btn.classList.contains('expander-left') ? 'left' : 'top';
        const step = 200; // píxeles a añadir
        let newW = lienzW;
        let newH = lienzH;
        let offsetX = 0;
        let offsetY = 0;

        if (dir === 'right') {
            if (lienzW + step > maxW) return mostrarToast('Límite de ancho para tu plan alcanzado');
            newW += step;
        } else if (dir === 'left') {
            if (lienzW + step > maxW) return mostrarToast('Límite de ancho para tu plan alcanzado');
            newW += step;
            offsetX = step;
        } else if (dir === 'bottom') {
            if (lienzH + step > maxH) return mostrarToast('Límite de altura para tu plan alcanzado');
            newH += step;
        } else if (dir === 'top') {
            if (lienzH + step > maxH) return mostrarToast('Límite de altura para tu plan alcanzado');
            newH += step;
            offsetY = step;
        }

        lienzW = newW;
        lienzH = newH;
        
        // Mover objetos si crecemos hacia la izq o arriba
        if (offsetX !== 0 || offsetY !== 0) {
            fcanvas.getObjects().forEach(obj => {
                obj.set({ left: obj.left + offsetX, top: obj.top + offsetY });
                obj.setCoords();
            });
            if (fcanvas.backgroundImage) {
                fcanvas.backgroundImage.offsetX = (fcanvas.backgroundImage.offsetX || 0) + offsetX;
                fcanvas.backgroundImage.offsetY = (fcanvas.backgroundImage.offsetY || 0) + offsetY;
            }
        }
        
        ajustarCanvas();
        mostrarToast(`Lienzo expandido a ${lienzW}×${lienzH}px`);
    });
});

// Configuración de pincel por defecto
fcanvas.freeDrawingBrush = new fabric.PencilBrush(fcanvas);
fcanvas.freeDrawingBrush.color = colorPicker.value;
fcanvas.freeDrawingBrush.width = parseInt(grosorInput.value);
fcanvas.freeDrawingBrush.decimate = 2;

let lienzoPristino = true;
let notaGuardada   = false;
let herramienta    = 'lapiz';
let _draggingShape = false; // evita espejado prematuro en figuras arrastrables

/* ──────────────────────────────────────────
   RESTAURACIÓN DE DIBUJO (Edición)
────────────────────────────────────────── */
async function cargarDibujoExistente() {
    const url = document.getElementById('editImagenUrl')?.value;
    if (!url) return;

    fabric.Image.fromURL((url.startsWith('http') || url.startsWith('https')) ? url : '/static/' + url, function(img) {
        // Restaurar el tamaño original del lienzo (recordando que se guardó a 2x de resolución)
        const origW = img.width / 2;
        const origH = img.height / 2;
        
        if (origW >= 900 && origW <= maxW) lienzW = origW;
        if (origH >= 520 && origH <= maxH) lienzH = origH;
        ajustarCanvas();

        fcanvas.setBackgroundImage(img, fcanvas.renderAll.bind(fcanvas), {
            scaleX: 0.5,
            scaleY: 0.5
        });
        actualizarHint();
        guardarEstado();
    }, { crossOrigin: 'Anonymous' });
}

setTimeout(cargarDibujoExistente, 100);

/* ──────────────────────────────────────────
   ESTADO E HISTORIAL (Undo/Redo)
────────────────────────────────────────── */
let historial = [];
let pasoActual = -1;
let bloqueado = false;

function actualizarHint() {
    const hayAlgo = fcanvas.getObjects().length > 0 || !!fcanvas.backgroundImage || fcanvas.backgroundColor !== '#ffffff';
    lienzoPristino = !hayAlgo;
    canvasHint.style.opacity = hayAlgo ? '0' : '1';
}

function guardarEstado() {
    if (bloqueado) return;
    const json = JSON.stringify(fcanvas.toJSON(['_layerId', '_isEraser']));
    const layerState = JSON.stringify(layers);
    if (pasoActual < historial.length - 1) {
        historial = historial.slice(0, pasoActual + 1);
    }
    historial.push({ canvas: json, layers: layerState });
    if (historial.length > 30) historial.shift();
    else pasoActual++;
    
    actualizarHint();
    if (!lienzoPristino) notaGuardada = false;
}

// Guardar estado inicial vacío
guardarEstado();

fcanvas.on('object:added', function(e) {
    if (!bloqueado) {
        guardarEstado();
        if (simetriaActiva && !_draggingShape && e && e.target && !e.target._isMirror && e.target !== simetriaEje && !e.target._isEraser) {
            espejarObjeto(e.target);
        }
    }
});
fcanvas.on('object:modified', () => { if(!bloqueado) guardarEstado(); });
fcanvas.on('object:removed', () => { if(!bloqueado) guardarEstado(); });

// Marcar trazos con capa activa; los del borrador como no seleccionables
fcanvas.on('path:created', function(e) {
    if (!e.path) return;
    var activeId = getActiveLayer().id;
    const opacidad = parseFloat(document.getElementById('opacidadInput').value) || 1;
    
    if (herramienta === 'borrador') {
        e.path.set({ selectable: false, evented: false, _isEraser: true, _layerId: activeId, opacity: opacidad });
        e.path.bringToFront();
    } else {
        e.path.set({ 
            _layerId: activeId, 
            stroke: colorActual(),
            opacity: opacidad 
        });
        if (brushType === 'watercolor') {
            e.path.set({
                shadow: new fabric.Shadow({
                    color: e.path.stroke,
                    blur: 10,
                    opacity: 0.25
                }),
                opacity: 0.85
            });
        }
    }
});

function deshacer() {
    if (pasoActual > 0) {
        bloqueado = true;
        pasoActual--;
        var entry = historial[pasoActual];
        // Compatibilidad: historial antiguo (solo string)
        if (typeof entry === 'string') {
            fcanvas.loadFromJSON(entry, function() {
                fcanvas.renderAll();
                const hayObjetos = fcanvas.getObjects().length > 0 || !!fcanvas.backgroundImage;
                lienzoPristino = !hayObjetos;
                canvasHint.style.opacity = hayObjetos ? '0' : '1';
                bloqueado = false;
            });
        } else {
            layers = JSON.parse(entry.layers);
            fcanvas.loadFromJSON(entry.canvas, function() {
                fcanvas.renderAll();
                updateCanvasFromLayers();
                renderLayerPanel();
                const hayObjetos = fcanvas.getObjects().length > 0 || !!fcanvas.backgroundImage;
                lienzoPristino = !hayObjetos;
                canvasHint.style.opacity = hayObjetos ? '0' : '1';
                bloqueado = false;
            });
        }
    } else {
        mostrarToast('No hay más pasos para deshacer');
    }
}

document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const editing = fcanvas.getActiveObject();
    if (editing && editing.isEditing) return;

    // Ctrl+Z: deshacer
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        deshacer();
        return;
    }

    // Ctrl+C: copiar selección
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        var activos = fcanvas.getActiveObjects();
        if (activos.length === 0) return;
        window._clipboard = [];
        activos.forEach(function(obj) {
            obj.clone(function(cloned) {
                cloned.set({ evented: true, selectable: true });
                window._clipboard.push(cloned);
            });
        });
        return;
    }

    // Ctrl+X: cortar (copiar + eliminar)
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        var activos = fcanvas.getActiveObjects();
        if (activos.length === 0) return;
        window._clipboard = [];
        activos.forEach(function(obj) {
            obj.clone(function(cloned) {
                cloned.set({ evented: true, selectable: true });
                window._clipboard.push(cloned);
            });
            fcanvas.remove(obj);
        });
        fcanvas.discardActiveObject();
        fcanvas.requestRenderAll();
        guardarEstado();
        return;
    }

    // Ctrl+V: pegar
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (!window._clipboard || window._clipboard.length === 0) return;
        var pasteOffset = 20;
        var pasted = [];
        window._clipboard.forEach(function(obj) {
            obj.clone(function(cloned) {
                cloned.set({
                    left: cloned.left + pasteOffset,
                    top: cloned.top + pasteOffset,
                    evented: true,
                    selectable: true,
                    _layerId: getActiveLayer().id
                });
                fcanvas.add(cloned);
                pasted.push(cloned);
            });
        });
        if (pasted.length) {
            var sel = new fabric.ActiveSelection(pasted, { canvas: fcanvas });
            fcanvas.setActiveObject(sel);
            fcanvas.requestRenderAll();
            guardarEstado();
        }
        return;
    }

    // Delete / Backspace: eliminar
    if (e.key === 'Delete' || e.key === 'Backspace') {
        var activos = fcanvas.getActiveObjects();
        if (activos.length > 0) {
            e.preventDefault();
            activos.forEach(function(obj) { fcanvas.remove(obj); });
            fcanvas.discardActiveObject();
            fcanvas.renderAll();
            guardarEstado();
        }
    }
});

/* ──────────────────────────────────────────
   MODAL SALIDA SIN GUARDAR
────────────────────────────────────────── */

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
        notaGuardada = true;
        ocultarModal();
        window.location.href = urlDestino || '/notas';
    }
    if (e.target.id === 'modalSalida') ocultarModal();
    if (e.target.id === 'orientacionModal') {
        document.getElementById('orientacionModal').classList.remove('visible');
    }
});

window.addEventListener('beforeunload', function(e) {
    if (!lienzoPristino && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

document.getElementById('btnVolver').addEventListener('click', function(e) {
    if (!lienzoPristino && !notaGuardada) {
        e.preventDefault();
        mostrarModal(this.getAttribute('href') || '/notas');
    }
});

/* ──────────────────────────────────────────
   HERRAMIENTAS DE FORMAS (Círculo, Rect, Línea, Texto)
────────────────────────────────────────── */
let isDown = false;
let shape = null;
let origX, origY;

/* ──────────────────────────────────────────
   BALDE DE PINTURA – FLOOD FILL DE ALTA CALIDAD
────────────────────────────────────────── */
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r, g, b, 255];
}

function colorDist(d, i, t) {
    return Math.sqrt(
        (d[i]-t[0])**2 + (d[i+1]-t[1])**2 +
        (d[i+2]-t[2])**2 + (d[i+3]-t[3])**2
    );
}

function floodFillOverlay(imgData, W, H, startX, startY, fillHex) {
    const d = imgData.data;
    const fillRgb = hexToRgb(fillHex);
    const si = (startY * W + startX) * 4;
    const target = [d[si], d[si+1], d[si+2], d[si+3]];

    if (colorDist(d, si, fillRgb) < 2) return null;

    const TOL = 160; // Increased tolerance significantly to cover full antialiased gradient
    const filled = new Uint8Array(W * H);
    const stack = [[startX, startY]];
    
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = W;
    overlayCanvas.height = H;
    const overlayCtx = overlayCanvas.getContext('2d');
    const overlayData = overlayCtx.createImageData(W, H);
    const od = overlayData.data;

    let painted = false;

    while (stack.length) {
        const [x, y] = stack.pop();
        let left = x;
        while (left > 0 && colorDist(d, (y * W + left - 1) * 4, target) <= TOL && !filled[y * W + left - 1])
            left--;

        let right = x;
        while (right < W && colorDist(d, (y * W + right) * 4, target) <= TOL && !filled[y * W + right])
            right++;

        for (let cx = left; cx < right; cx++) {
            const idx = (y * W + cx) * 4;
            filled[y * W + cx] = 1;
            
            d[idx] = fillRgb[0];
            d[idx+1] = fillRgb[1];
            d[idx+2] = fillRgb[2];
            
            od[idx] = fillRgb[0];
            od[idx+1] = fillRgb[1];
            od[idx+2] = fillRgb[2];
            od[idx+3] = 255;
            painted = true;
        }

        if (y > 0) {
            let span = false;
            for (let cx = left; cx < right; cx++) {
                const up = colorDist(d, ((y - 1) * W + cx) * 4, target);
                if (up <= TOL && !filled[(y - 1) * W + cx]) {
                    if (!span) { stack.push([cx, y - 1]); span = true; }
                } else { span = false; }
            }
        }
        if (y < H - 1) {
            let span = false;
            for (let cx = left; cx < right; cx++) {
                const dn = colorDist(d, ((y + 1) * W + cx) * 4, target);
                if (dn <= TOL && !filled[(y + 1) * W + cx]) {
                    if (!span) { stack.push([cx, y + 1]); span = true; }
                } else { span = false; }
            }
        }
    }
    
    if (!painted) return null;
    overlayCtx.putImageData(overlayData, 0, 0);

    // Dilation pass: expand the fill by ~2 physical pixels (0.5 logical pixels)
    // This perfectly covers the white antialiasing halos without swallowing the stroke.
    const tmpCopy = document.createElement('canvas');
    tmpCopy.width = W;
    tmpCopy.height = H;
    tmpCopy.getContext('2d').drawImage(overlayCanvas, 0, 0);
    
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (dx*dx + dy*dy <= 4 && (dx !== 0 || dy !== 0)) {
                overlayCtx.drawImage(tmpCopy, dx, dy);
            }
        }
    }

    return overlayCanvas.toDataURL('image/png');
}

// ── Cuentagotas con preview en vivo ──
var cuentagotasPreview = null;
var cuentagotasCrosshair = null;

function crearPreviewCuentagotas() {
    if (cuentagotasPreview) return;
    cuentagotasPreview = document.createElement('div');
    cuentagotasPreview.id = 'cuentagotasPreview';
    cuentagotasPreview.innerHTML =
        '<div class="cp-swatch" id="cpSwatch"></div>' +
        '<div class="cp-hex" id="cpHex">#000000</div>';
    document.body.appendChild(cuentagotasPreview);

    // Cruzeta de precisión sobre el canvas
    if (!cuentagotasCrosshair) {
        cuentagotasCrosshair = document.createElement('div');
        cuentagotasCrosshair.id = 'cuentagotasCrosshair';
        cuentagotasCrosshair.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 0 1px #000)">
                <line x1="11" y1="0" x2="11" y2="8" stroke="white" stroke-width="2"/>
                <line x1="11" y1="14" x2="11" y2="22" stroke="white" stroke-width="2"/>
                <line x1="0" y1="11" x2="8" y2="11" stroke="white" stroke-width="2"/>
                <line x1="14" y1="11" x2="22" y2="11" stroke="white" stroke-width="2"/>
                <circle cx="11" cy="11" r="3" stroke="white" stroke-width="1.5"/>
                <line x1="11" y1="1" x2="11" y2="8" stroke="black" stroke-width="1"/>
                <line x1="11" y1="14" x2="11" y2="21" stroke="black" stroke-width="1"/>
                <line x1="1" y1="11" x2="8" y2="11" stroke="black" stroke-width="1"/>
                <line x1="14" y1="11" x2="21" y2="11" stroke="black" stroke-width="1"/>
            </svg>`;
        cuentagotasCrosshair.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;display:none;transform:translate(-50%,-50%);';
        document.body.appendChild(cuentagotasCrosshair);
    }
}

function capturarPixelHex(e) {
    // pLogico: coordenadas en el espacio lógico del lienzo (con zoom/pan) → para containsPoint
    var pLogico = fcanvas.getPointer(e, false);
    // pAbs: coordenadas absolutas sobre el elemento canvas → para getImageData
    var pAbs = fcanvas.getPointer(e, true);
    var px = Math.round(pAbs.x);
    var py = Math.round(pAbs.y);

    // Buscar el objeto más superior exactamente bajo la cruzeta
    var objetos = fcanvas.getObjects();
    var encontrado = null;
    var pFabric = new fabric.Point(pLogico.x, pLogico.y);
    for (var i = objetos.length - 1; i >= 0; i--) {
        var obj = objetos[i];
        if (obj === simetriaEje) continue;
        // containsPoint necesita coordenadas lógicas (espacio del lienzo)
        if (obj.containsPoint(pFabric)) {
            encontrado = obj;
            break;
        }
    }

    if (encontrado) {
        var rawColor = encontrado.stroke || encontrado.fill || null;
        if (rawColor && rawColor !== 'transparent') {
            var op = encontrado.opacity !== undefined ? encontrado.opacity : 1;
            window._cuentagotasOpacity = op;
            // Convertir rgba a hex si es necesario
            if (rawColor.startsWith('rgba') || rawColor.startsWith('rgb')) {
                var m = rawColor.match(/[\d.]+/g);
                if (m && m.length >= 3) {
                    var r2 = parseInt(m[0]).toString(16).padStart(2,'0');
                    var g2 = parseInt(m[1]).toString(16).padStart(2,'0');
                    var b2 = parseInt(m[2]).toString(16).padStart(2,'0');
                    if (m[3] !== undefined) window._cuentagotasOpacity = parseFloat(m[3]);
                    return '#' + r2 + g2 + b2;
                }
            }
            if (rawColor.startsWith('#')) {
                return rawColor.slice(0, 7);
            }
        }
    }

    // Fallback: leer pixel compuesto del canvas con coordenadas absolutas correctas
    window._cuentagotasOpacity = null;
    var ctx = fcanvas.getContext();
    var pixel = ctx.getImageData(px, py, 1, 1).data;
    return '#' + [pixel[0], pixel[1], pixel[2]].map(function(v) {
        return ('0' + v.toString(16)).slice(-2);
    }).join('');
}

function aplicarColorCuentagotas(hex) {
    document.getElementById('colorPicker').value = hex;
    // Restaurar la opacidad del objeto capturado si la tenemos
    if (window._cuentagotasOpacity !== null && window._cuentagotasOpacity !== undefined) {
        var opEl = document.getElementById('opacidadInput');
        if (opEl) {
            opEl.value = window._cuentagotasOpacity;
            if (fcanvas.freeDrawingBrush) {
                fcanvas.freeDrawingBrush.color = colorPincelVivo();
            }
        }
        window._cuentagotasOpacity = null;
    }
    document.querySelectorAll('.color-rapido').forEach(function(el) {
        el.classList.remove('seleccionado');
        if (el.dataset.color === hex) el.classList.add('seleccionado');
    });
    mostrarToast('Color capturado: ' + hex);
}

fcanvas.on('mouse:down', function(o){
    _draggingShape = false;
    if (herramienta === 'cuentagotas') {
        isDown = true;
        crearPreviewCuentagotas();
        var hex = capturarPixelHex(o.e);
        var e = o.e;
        var cx = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        var cy = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        cuentagotasPreview.style.display = 'block';
        cuentagotasPreview.style.left = (cx + 18) + 'px';
        cuentagotasPreview.style.top = (cy - 50) + 'px';
        document.getElementById('cpSwatch').style.background = hex;
        document.getElementById('cpHex').textContent = hex;
        return;
    }

    if (herramienta === 'estabilizador') {
        isDown = true;
        stabilizerPoints = [];
        var p = fcanvas.getPointer(o.e);
        stabilizerPoints.push({ x: p.x, y: p.y });
        return;
    }

    if (herramienta === 'seleccion' || herramienta === 'lapiz' || herramienta === 'sticker' || herramienta === 'mano') return;

    if (herramienta === 'borrador') {
        isDown = true;
        eraserPoints = [];
        eraseEnProgreso = false;
        const pointer = fcanvas.getPointer(o.e);
        eraserPoints.push({ x: pointer.x, y: pointer.y });
        inicializarCacheBorrador();
        return;
    }

    if (herramienta === 'balde') {
        const pointer = fcanvas.getPointer(o.e);
        const px = Math.round(pointer.x);
        const py = Math.round(pointer.y);

        if (px < 0 || py < 0 || px >= lienzW || py >= lienzH) return;

        mostrarToast('Rellenando…');

        // Guardar estado actual del canvas (zoom, paneo, dimensiones visuales)
        const prevVpt = fcanvas.viewportTransform.slice();
        const prevWidth = fcanvas.width;
        const prevHeight = fcanvas.height;

        // Restaurar a 1:1 lógico para exportar la imagen sin distorsiones
        fcanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        fcanvas.setDimensions({ width: lienzW, height: lienzH });
        fcanvas.renderAll();

        const exportMultiplier = Math.max(4, window.devicePixelRatio || 1); // 4x supersampling
        const dataURLFlat = fcanvas.toDataURL({ 
            format: 'png', 
            multiplier: exportMultiplier,
            left: 0, top: 0, width: lienzW, height: lienzH 
        });

        // Devolver el canvas a su estado visual inmediatamente (no hay parpadeo porque es sincrónico)
        fcanvas.setViewportTransform(prevVpt);
        fcanvas.setDimensions({ width: prevWidth, height: prevHeight });
        fcanvas.renderAll();

        const imgEl = new Image();
        imgEl.onload = function() {
            const actualW = imgEl.width;
            const actualH = imgEl.height;
            const scaleX = actualW / lienzW;
            const scaleY = actualH / lienzH;

            const targetX = Math.round(px * scaleX);
            const targetY = Math.round(py * scaleY);

            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width  = actualW;
            tmpCanvas.height = actualH;
            const tmpCtx = tmpCanvas.getContext('2d');

            tmpCtx.fillStyle = fcanvas.backgroundColor || '#ffffff';
            tmpCtx.fillRect(0, 0, actualW, actualH);
            tmpCtx.drawImage(imgEl, 0, 0);

            const imgData = tmpCtx.getImageData(0, 0, actualW, actualH);
            const overlayURL = floodFillOverlay(imgData, actualW, actualH, targetX, targetY, colorActual());
            
            if (overlayURL) {
                fabric.Image.fromURL(overlayURL, function(img) {
                    const opacidad = parseFloat(document.getElementById('opacidadInput').value) || 1;
                    img.set({ 
                        left: 0, top: 0, 
                        originX: 'left', originY: 'top', 
                        selectable: false, evented: false,
                        scaleX: 1 / scaleX,
                        scaleY: 1 / scaleY,
                        opacity: opacidad,
                        _layerId: getActiveLayer().id
                    });
                    
                    fcanvas.add(img);
                    fcanvas.renderAll();
                    guardarEstado();
                    mostrarToast('✅ Relleno aplicado');
                });
            } else {
                mostrarToast('Área ya rellenada o color similar');
            }
        };
        imgEl.src = dataURLFlat;
        return;
    }


    if (herramienta === 'estrella') {
        const pointer = fcanvas.getPointer(o.e);
        const starPoints = [
            {x: 0, y: -50}, {x: 14, y: -20}, {x: 47, y: -15},
            {x: 23, y: 7}, {x: 29, y: 40}, {x: 0, y: 25},
            {x: -29, y: 40}, {x: -23, y: 7}, {x: -47, y: -15}, {x: -14, y: -20}
        ];
        const activeId = getActiveLayer().id;
        const star = new fabric.Polygon(starPoints, {
            left: pointer.x,
            top: pointer.y,
            fill: 'transparent',
            stroke: colorActual(),
            strokeWidth: grosorActual(),
            _layerId: activeId
        });
        fcanvas.add(star);
        fcanvas.setActiveObject(star);
        seleccionarHerramienta('seleccion', document.getElementById('btnSeleccion'));
        return;
    }

    isDown = true;
    const pointer = fcanvas.getPointer(o.e);
    origX = pointer.x;
    origY = pointer.y;

    const opacidad = parseFloat(document.getElementById('opacidadInput').value) || 1;
    const activeId = getActiveLayer().id;
    const props = {
        left: origX,
        top: origY,
        originX: 'left',
        originY: 'top',
        stroke: colorActual(),
        strokeWidth: grosorActual(),
        fill: 'transparent',
        transparentCorners: false,
        strokeUniform: true,
        strokeDashArray: null,
        opacity: opacidad,
        _layerId: activeId
    };

    if (herramienta === 'rectangulo' || herramienta === 'circulo' || herramienta === 'linea' || herramienta === 'triangulo') {
        _draggingShape = true;
    }
    if (herramienta === 'rectangulo') {
        shape = new fabric.Rect({ ...props, width: pointer.x-origX, height: pointer.y-origY });
    } else if (herramienta === 'circulo') {
        shape = new fabric.Ellipse({ ...props, rx: 0, ry: 0 });
    } else if (herramienta === 'linea') {
        shape = new fabric.Line([origX, origY, pointer.x, pointer.y], {
            stroke: colorActual(),
            strokeWidth: grosorActual(),
            opacity: opacidad,
            _layerId: activeId
        });
    } else if (herramienta === 'triangulo') {
        shape = new fabric.Triangle({ ...props, width: pointer.x-origX, height: pointer.y-origY });
    }
    if(shape) fcanvas.add(shape);
});

fcanvas.on('mouse:move', function(o){
    if (!isDown) return;
    const pointer = fcanvas.getPointer(o.e);
    const absPos = o.e;

    if (herramienta === 'estabilizador') {
        var p = fcanvas.getPointer(o.e);
        stabilizerPoints.push({ x: p.x, y: p.y });
        return;
    }

    if (herramienta === 'cuentagotas') {
        var hex = capturarPixelHex(o.e);
        var e = o.e;
        var cx = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        var cy = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        if (cuentagotasPreview) {
            cuentagotasPreview.style.display = 'block';
            cuentagotasPreview.style.left = (cx + 28) + 'px';
            cuentagotasPreview.style.top = (cy - 60) + 'px';
            document.getElementById('cpSwatch').style.background = hex;
            document.getElementById('cpHex').textContent = hex;
        }
        // Mostrar cruzeta de precisión
        if (cuentagotasCrosshair) {
            cuentagotasCrosshair.style.display = 'block';
            cuentagotasCrosshair.style.left = cx + 'px';
            cuentagotasCrosshair.style.top = cy + 'px';
        }
        return;
    }

    if (herramienta === 'borrador') {
        eraserPoints.push({ x: pointer.x, y: pointer.y });
        if (absPos) {
            const clientX = absPos.clientX || (absPos.touches ? absPos.touches[0].clientX : 0);
            const clientY = absPos.clientY || (absPos.touches ? absPos.touches[0].clientY : 0);
            mostrarCursorBorrador(clientX, clientY);
        }
        // Procesar en vivo cada ~60ms
        const ahora = Date.now();
        if (eraserCacheReady && ahora - eraserUltimoCommit > 50) {
            eraserUltimoCommit = ahora;
            procesarBorradorEnVivo(eraserPoints, grosorActual() * 2);
            eraseEnProgreso = true;
        }
        return;
    }

    if (herramienta === 'rectangulo') {
        if(origX > pointer.x){
            shape.set({ left: Math.abs(pointer.x) });
        }
        if(origY > pointer.y){
            shape.set({ top: Math.abs(pointer.y) });
        }
        shape.set({ width: Math.abs(origX - pointer.x) });
        shape.set({ height: Math.abs(origY - pointer.y) });
    } else if (herramienta === 'circulo') {
        shape.set({ rx: Math.abs(origX - pointer.x)/2, ry: Math.abs(origY - pointer.y)/2 });
        shape.set({ top: Math.min(origY, pointer.y), left: Math.min(origX, pointer.x) });
    } else if (herramienta === 'linea') {
        shape.set({ x2: pointer.x, y2: pointer.y });
    } else if (herramienta === 'triangulo') {
        shape.set({ width: Math.abs(origX - pointer.x), height: Math.abs(origY - pointer.y) });
        shape.set({ left: Math.min(origX, pointer.x), top: Math.min(origY, pointer.y) });
    }
    fcanvas.renderAll();
});

fcanvas.on('mouse:up', function(o){
    if (herramienta === 'estabilizador' && isDown) {
        isDown = false;
        if (stabilizerPoints.length >= 2) {
            var fuerza = parseInt(document.getElementById('estabilizadorFuerza').value) || 8;
            var smoothed = smoothPoints(stabilizerPoints, fuerza);
            var path = createSmoothPath(smoothed);
            if (path) {
                fcanvas.add(path);
                guardarEstado();
            }
        }
        stabilizerPoints = [];
        return;
    }

    if (herramienta === 'borrador' && isDown) {
        if (eraseEnProgreso || eraserPoints.length > 1) {
            // Commit final con todos los puntos
            if (eraserPoints.length > 1) procesarBorradorEnVivo(eraserPoints, grosorActual() * 2);
            finalizarBorrador();
        } else {
            ocultarCursorBorrador();
            eraserCacheCanvas = null;
            eraserCacheReady = false;
            eraserPoints = [];
        }
        isDown = false;
        return;
    }
    if (herramienta === 'cuentagotas' && isDown) {
        isDown = false;
        if (cuentagotasPreview) cuentagotasPreview.style.display = 'none';
        if (cuentagotasCrosshair) cuentagotasCrosshair.style.display = 'none';
        var hex = capturarPixelHex(o.e);
        aplicarColorCuentagotas(hex);
        var btnLapiz = document.getElementById('btnLapiz');
        if (btnLapiz) seleccionarHerramienta('lapiz', btnLapiz);
        return;
    }
    isDown = false;
    if(shape) {
        shape.setCoords();
        if (simetriaActiva && _draggingShape) {
            espejarObjeto(shape);
        }
        shape = null;
    }
    _draggingShape = false;
});

/* ──────────────────────────────────────────
   UTILIDADES
────────────────────────────────────────── */
function colorActual() { 
    return colorPicker.value;
}

function colorPincelVivo() {
    const hex = colorPicker.value;
    const op = parseFloat(document.getElementById('opacidadInput').value);
    if (isNaN(op) || op >= 1) return hex;
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r}, ${g}, ${b}, ${op})`;
}

function grosorActual() { return parseInt(grosorInput.value); }

function aplicarConfiguracion() {
    fcanvas.freeDrawingBrush.color = colorPincelVivo();
    fcanvas.freeDrawingBrush.width = grosorActual();
    
    // Si hay objetos seleccionados, aplicarles color
    const activos = fcanvas.getActiveObjects();
    if(activos.length) {
        activos.forEach(obj => {
            if (obj._isEraser) return;
            if (obj.type === 'i-text' || obj.type === 'text') {
                obj.set('fill', colorActual());
            } else if (obj.type === 'path' && herramienta !== 'borrador') {
                obj.set('stroke', colorActual());
            } else if (obj.stroke) {
                obj.set('stroke', colorActual());
            }
        });
        fcanvas.renderAll();
        guardarEstado();
    }
}

/* ──────────────────────────────────────────
   SELECCIONAR HERRAMIENTA
────────────────────────────────────────── */
let panPosInicial = { x: 0, y: 0 };
let panScrollInicial = { x: 0, y: 0 };

// ── Borrador tipo Paint (en vivo) ──
let eraserPoints = [];
let eraserCursor = null;
let eraserCacheCanvas = null;
let eraserCacheReady = false;
let eraserUltimoCommit = 0;
let eraseEnProgreso = false;
let eraserMode = 'normal'; // 'normal' | 'block' | 'soft'

window.setEraserMode = function(mode, btn) {
    if (mode !== 'normal' && !requierePremium()) return;
    eraserMode = mode;
    document.querySelectorAll('.eraser-option').forEach(function(b) { b.classList.remove('activo'); });
    if (btn) btn.classList.add('activo');
    // Actualizar cursor
    ocultarCursorBorrador();
    if (herramienta === 'borrador') {
        crearCursorBorrador();
        if (eraserCursor) {
            if (mode === 'block') {
                eraserCursor.style.borderRadius = '0';
            } else {
                eraserCursor.style.borderRadius = '50%';
            }
            if (mode === 'soft') {
                eraserCursor.style.boxShadow = '0 0 8px 4px rgba(180,180,180,0.3)';
                eraserCursor.style.background = 'rgba(180,180,180,0.15)';
            } else {
                eraserCursor.style.boxShadow = 'none';
                eraserCursor.style.background = 'rgba(180,180,180,0.25)';
            }
        }
    }
};

function crearCursorBorrador() {
    if (eraserCursor) return;
    eraserCursor = document.createElement('div');
    eraserCursor.id = 'eraserCursor';
    eraserCursor.style.cssText = 'position:fixed;pointer-events:none;border-radius:50%;border:2px solid rgba(0,0,0,0.5);background:rgba(180,180,180,0.25);z-index:9999;display:none;transform:translate(-50%,-50%);';
    document.body.appendChild(eraserCursor);
}

function mostrarCursorBorrador(x, y) {
    if (!eraserCursor) crearCursorBorrador();
    const size = grosorActual() * 2;
    eraserCursor.style.width = size + 'px';
    eraserCursor.style.height = size + 'px';
    eraserCursor.style.left = x + 'px';
    eraserCursor.style.top = y + 'px';
    eraserCursor.style.display = 'block';
}

function ocultarCursorBorrador() {
    if (eraserCursor) eraserCursor.style.display = 'none';
}

function inicializarCacheBorrador() {
    const W = lienzW;
    const H = lienzH;

    eraserCacheCanvas = document.createElement('canvas');
    eraserCacheCanvas.width = W;
    eraserCacheCanvas.height = H;
    eraserCacheReady = false;

    const origBg = fcanvas.backgroundColor;
    fcanvas.backgroundColor = 'transparent';

    const prevVpt = fcanvas.viewportTransform.slice();
    const prevWidth = fcanvas.width;
    const prevHeight = fcanvas.height;

    fcanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fcanvas.setDimensions({ width: W, height: H });
    fcanvas.renderAll();

    const dataURL = fcanvas.toDataURL({ 
        format: 'png', 
        multiplier: 1,
        left: 0, top: 0, width: W, height: H 
    });

    fcanvas.setViewportTransform(prevVpt);
    fcanvas.setDimensions({ width: prevWidth, height: prevHeight });
    fcanvas.backgroundColor = origBg;
    fcanvas.renderAll();

    const img = new Image();
    img.onload = function () {
        const ctx = eraserCacheCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        eraserCacheReady = true;
        commitCacheBorrador();
    };
    img.src = dataURL;
}

function commitCacheBorrador() {
    if (!eraserCacheReady || !eraserCacheCanvas) return;
    const bgColor = fcanvas.backgroundColor || '#ffffff';

    const fabricImg = new fabric.Image(eraserCacheCanvas, {
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        width: lienzW,
        height: lienzH
    });

    fcanvas.backgroundImage = fabricImg;
    fcanvas.backgroundColor = bgColor;
    fcanvas.discardActiveObject();
    if (fcanvas._objects.length > 0) {
        bloqueado = true;
        fcanvas._objects.slice().forEach(function(obj) { fcanvas.remove(obj); });
        bloqueado = false;
    }
    fcanvas.renderAll();
}

function procesarBorradorEnVivo(points, brushWidth) {
    if (!eraserCacheReady || !eraserCacheCanvas) return;

    const ctx = eraserCacheCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';

    if (eraserMode === 'block') {
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.lineWidth = brushWidth;
        ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    } else if (eraserMode === 'soft') {
        ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowBlur = brushWidth * 0.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushWidth * 0.6;
        ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    } else {
        // normal
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushWidth;
        ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    commitCacheBorrador();
}

function finalizarBorrador() {
    if (eraserCacheCanvas && eraserCacheReady) {
        guardarEstado();
    }
    eraserCacheCanvas = null;
    eraserCacheReady = false;
    eraserPoints = [];
    ocultarCursorBorrador();
}

window.seleccionarHerramienta = function(nombre, btn) {
    // Restringir herramientas premium
    if ((nombre === 'estabilizador' || nombre === 'cuentagotas') && !esPremium()) {
        mostrarToast('🔒 Funciones premium. Mejora tu plan para acceder.');
        if (btn) btn.classList.remove('activo');
        return;
    }
    herramienta = nombre;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('activo'));
    if(btn) btn.classList.add('activo');

    // Ocultar grupos contextuales
    var stabGroup = document.getElementById('estabilizadorGroup');
    if (stabGroup) stabGroup.style.display = 'none';
    var eraserGroup = document.getElementById('eraserGroup');
    if (eraserGroup) eraserGroup.style.display = 'none';

    fcanvas.isDrawingMode = false;
    fcanvas.selection = false;
    
    // Actualizar visibilidad según capas, luego inhabilitar selección por defecto
    updateCanvasFromLayers();
    fcanvas.forEachObject(obj => { obj.selectable = false; obj.evented = false; });

    const canvasWrapper = document.querySelector('.canvas-container');
    const stickerPanel  = document.getElementById('stickerPanel');
    
    // Siempre ocultar panel de stickers al cambiar de herramienta, salvo si es 'sticker'
    if (nombre !== 'sticker' && stickerPanel) stickerPanel.classList.remove('visible');

    // Ocultar cursor del borrador al cambiar de herramienta
    if (nombre !== 'borrador') {
        ocultarCursorBorrador();
        eraserCacheCanvas = null;
        eraserCacheReady = false;
        eraserPoints = [];
    }
    if (nombre !== 'cuentagotas' && cuentagotasPreview) {
        cuentagotasPreview.style.display = 'none';
        if (cuentagotasCrosshair) cuentagotasCrosshair.style.display = 'none';
    }

    if (nombre === 'lapiz') {
        fcanvas.isDrawingMode = true;
        if (brushType === 'circle') {
            fcanvas.freeDrawingBrush = new fabric.CircleBrush(fcanvas);
        } else if (brushType === 'spray') {
            fcanvas.freeDrawingBrush = new fabric.SprayBrush(fcanvas);
        } else if (brushType === 'watercolor') {
            fcanvas.freeDrawingBrush = new fabric.PencilBrush(fcanvas);
            fcanvas.freeDrawingBrush.decimate = 1;
        } else if (brushType === 'puntillismo') {
            fcanvas.freeDrawingBrush = new fabric.SprayBrush(fcanvas);
            fcanvas.freeDrawingBrush.density = 50;
            fcanvas.freeDrawingBrush.dotWidth = 1;
            fcanvas.freeDrawingBrush.dotWidthVariance = 0;
        } else {
            fcanvas.freeDrawingBrush = new fabric.PencilBrush(fcanvas);
            fcanvas.freeDrawingBrush.decimate = 2;
        }
        aplicarConfiguracion();
        if(canvasWrapper) canvasWrapper.style.cursor = 'crosshair';
    } else if (nombre === 'borrador') {
        var eraserGroup = document.getElementById('eraserGroup');
        if (eraserGroup) eraserGroup.style.display = 'flex';
        crearCursorBorrador();
        eraserPoints = [];
        if(canvasWrapper) canvasWrapper.style.cursor = 'none';
    } else if (nombre === 'seleccion') {
        fcanvas.selection = true;
        fcanvas.forEachObject(obj => {
            if (obj._isEraser) return;
            var layerIdx = getLayerIndexById(obj._layerId);
            var layer = layers[layerIdx];
            obj.selectable = layer && layer.visible && !layer.locked;
            obj.evented = layer && layer.visible && !layer.locked;
        });
        if(canvasWrapper) canvasWrapper.style.cursor = 'default';
    } else if (nombre === 'estabilizador') {
        var stabGroup = document.getElementById('estabilizadorGroup');
        if (stabGroup) stabGroup.style.display = 'flex';
        fcanvas.freeDrawingBrush = new fabric.PencilBrush(fcanvas);
        fcanvas.freeDrawingBrush.decimate = 1;
        aplicarConfiguracion();
        if(canvasWrapper) canvasWrapper.style.cursor = 'crosshair';
    } else if (nombre === 'cuentagotas') {
        // Ocultar cursor del sistema y mostrar solo la cruzeta
        if(canvasWrapper) canvasWrapper.style.cursor = 'none';
        crearPreviewCuentagotas();
        if (cuentagotasCrosshair) cuentagotasCrosshair.style.display = 'block';
    } else if (nombre === 'balde') {
        if(canvasWrapper) canvasWrapper.style.cursor = 'crosshair';
    } else if (nombre === 'mano') {
        document.getElementById('canvasOuter').style.cursor = 'grab';
        if(canvasWrapper) canvasWrapper.style.cursor = 'grab';
    } else {
        // Formas (rectangulo, circulo, linea, triangulo, estrella)
        if(canvasWrapper) canvasWrapper.style.cursor = 'crosshair';
    }
}

// ── Seguimiento del cursor del borrador ──
document.addEventListener('mousemove', (e) => {
    if (herramienta === 'borrador' && eraserCursor) {
        mostrarCursorBorrador(e.clientX, e.clientY);
    }
});
document.addEventListener('touchmove', (e) => {
    if (herramienta === 'borrador' && eraserCursor && e.touches.length > 0) {
        mostrarCursorBorrador(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

// ── Pan con herramienta mano (arrastrar el canvas-outer) ──
const canvasOuter = document.getElementById('canvasOuter');
canvasOuter.addEventListener('mousedown', (e) => {
    if (herramienta !== 'mano') return;
    e.preventDefault();
    panPosInicial = { x: e.clientX, y: e.clientY };
    panScrollInicial = { x: canvasOuter.scrollLeft, y: canvasOuter.scrollTop };
    canvasOuter.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onPanMove);
    document.addEventListener('mouseup', onPanEnd);
});
canvasOuter.addEventListener('touchstart', (e) => {
    if (herramienta !== 'mano' || e.touches.length !== 1) return;
    const t = e.touches[0];
    panPosInicial = { x: t.clientX, y: t.clientY };
    panScrollInicial = { x: canvasOuter.scrollLeft, y: canvasOuter.scrollTop };
    canvasOuter.style.cursor = 'grabbing';
    document.addEventListener('touchmove', onPanMoveTouch, { passive: false });
    document.addEventListener('touchend', onPanEndTouch);
}, { passive: true });

function onPanMove(e) {
    e.preventDefault();
    const dx = e.clientX - panPosInicial.x;
    const dy = e.clientY - panPosInicial.y;
    canvasOuter.scrollLeft = panScrollInicial.x - dx;
    canvasOuter.scrollTop  = panScrollInicial.y - dy;
}
function onPanMoveTouch(e) {
    if (e.touches.length !== 1) return; // dejar que el pinch-zoom maneje 2 dedos
    e.preventDefault();
    const t = e.touches[0];
    // Delta relativo: así funciona aunque el scroll haya cambiado por un zoom entremedio
    canvasOuter.scrollLeft -= t.clientX - panPosInicial.x;
    canvasOuter.scrollTop  -= t.clientY - panPosInicial.y;
    panPosInicial.x = t.clientX;
    panPosInicial.y = t.clientY;
}
function onPanEnd() {
    document.removeEventListener('mousemove', onPanMove);
    document.removeEventListener('mouseup', onPanEnd);
    canvasOuter.style.cursor = 'grab';
}
function onPanEndTouch(e) {
    if (e && e.touches && e.touches.length > 0) return; // aún quedan dedos en pantalla
    document.removeEventListener('touchmove', onPanMoveTouch);
    document.removeEventListener('touchend', onPanEndTouch);
    canvasOuter.style.cursor = 'grab';
}

// Marcar botones premium para usuarios gratis
if (!esPremium()) {
    document.querySelectorAll('.btn-premium').forEach(function(b) {
        b.classList.add('locked');
        b.title = (b.title || '') + ' (Premium)';
    });
}

// Iniciar con lápiz
seleccionarHerramienta('lapiz', document.getElementById('btnLapiz'));

/* ──────────────────────────────────────────
   PALETA RÁPIDA
────────────────────────────────────────── */
document.getElementById('paleta').addEventListener('click', e => {
    const el = e.target.closest('.color-rapido');
    if (!el) return;
    colorPicker.value = el.dataset.color;
    document.getElementById('hexInput').value = colorPicker.value.toUpperCase();
    document.querySelectorAll('.color-rapido').forEach(c => c.classList.remove('seleccionado'));
    el.classList.add('seleccionado');
    aplicarConfiguracion();
    
    if (herramienta === 'borrador') {
        seleccionarHerramienta('lapiz', document.getElementById('btnLapiz'));
    }
});

colorPicker.addEventListener('input', () => {
    document.querySelectorAll('.color-rapido').forEach(c => c.classList.remove('seleccionado'));
    document.getElementById('hexInput').value = colorPicker.value.toUpperCase();
    aplicarConfiguracion();
});

// Hex input manual — cambia el color mientras escribes
document.getElementById('hexInput').addEventListener('input', function() {
    var val = this.value.trim().toUpperCase();
    // Si falta #, agregarlo
    if (val.length > 0 && val[0] !== '#') {
        val = '#' + val;
        this.value = val;
    }
    if (/^#[0-9A-F]{6}$/.test(val)) {
        colorPicker.value = val.toLowerCase();
        document.querySelectorAll('.color-rapido').forEach(function(c) { c.classList.remove('seleccionado'); });
        aplicarConfiguracion();
    }
});
document.getElementById('hexInput').addEventListener('focus', function() { this.select(); });

/* ──────────────────────────────────────────
   PALETA DE COLORES EXTENDIDA
────────────────────────────────────────── */
var PALETTE_COLORS = [
    '#000000','#434343','#555555','#777777','#999999','#AAAAAA','#BBBBBB','#CCCCCC','#DDDDDD','#EEEEEE',
    '#980000','#FF0000','#FF4500','#FF8C00','#FFA500','#FFD700','#FFFF00','#ADFF2F','#7FFF00','#00FF00',
    '#00FF7F','#00FFFF','#00BFFF','#1E90FF','#4A86E8','#0000FF','#6A5ACD','#8A2BE2','#9932CC','#FF00FF',
    '#DC143C','#E06666','#F6B26B','#FFD966','#93C47D','#76A5AF','#6D9EEB','#6FA8DC','#8E7CC3','#C27BA0',
    '#CC4125','#E69138','#F1C232','#6AA84F','#45818E','#3C78D8','#3D85C6','#674EA7','#A64D79','#B45F06',
    '#5B0F00','#660000','#783F04','#7F6000','#274E13','#0C343D','#1C4587','#073763','#20124D','#4C1130'
];

var paletteDragging = false;
var paletteLastHex = null;
var palettePreviewEl = null;

function crearPalettePreview() {
    if (palettePreviewEl) return;
    palettePreviewEl = document.createElement('div');
    palettePreviewEl.id = 'palettePreview';
    palettePreviewEl.style.cssText = 'position:fixed;pointer-events:none;z-index:10002;background:rgba(30,10,60,0.92);border-radius:8px;padding:4px 7px;display:none;align-items:center;gap:5px;box-shadow:0 4px 14px rgba(0,0,0,0.35);';
    palettePreviewEl.innerHTML = '<div class="pp-swatch" style="width:16px;height:16px;border-radius:3px;border:1px solid rgba(255,255,255,0.5);flex-shrink:0;"></div><span class="pp-hex" style="font-family:Courier New,monospace;font-size:0.7rem;font-weight:700;color:#fff;"></span>';
    document.body.appendChild(palettePreviewEl);
}

function mostrarPalettePreview(hex, x, y) {
    crearPalettePreview();
    palettePreviewEl.style.display = 'flex';
    palettePreviewEl.style.left = (x + 15) + 'px';
    palettePreviewEl.style.top = (y - 35) + 'px';
    palettePreviewEl.querySelector('.pp-swatch').style.background = hex;
    palettePreviewEl.querySelector('.pp-hex').textContent = hex;
}

function ocultarPalettePreview() {
    if (palettePreviewEl) palettePreviewEl.style.display = 'none';
}

function aplicarColorSeleccion(hex) {
    colorPicker.value = hex;
    document.getElementById('hexInput').value = hex.toUpperCase();
    document.querySelectorAll('.color-rapido').forEach(function(c) { c.classList.remove('seleccionado'); });
    aplicarConfiguracion();
    // Actualizar panel
    document.getElementById('paletteCurrentSwatch').style.background = hex;
    document.getElementById('paletteHexInput').value = hex.toUpperCase();
    document.getElementById('paletteHexLabel').textContent = hex.toUpperCase();
    generarTonosEnPanel(hex);
    // Marcar activo en grilla
    document.querySelectorAll('.palette-swatch').forEach(function(s) {
        s.classList.toggle('activo', s.dataset.color === hex);
    });
}

function generarTonosEnPanel(hex) {
    var r = parseInt(hex.slice(1,3), 16);
    var g = parseInt(hex.slice(3,5), 16);
    var b = parseInt(hex.slice(5,7), 16);
    var shades = document.getElementById('paletteShades');
    if (!shades) return;
    shades.innerHTML = '';
    // 4 tintes (hacia blanco) + color base + 5 sombras (hacia negro)
    var steps = [];
    for (var i = 4; i >= 0; i--) {
        var t = i / 4;
        steps.push('#' + [r,g,b].map(function(c) {
            return ('0' + Math.round(c * t + 255 * (1 - t)).toString(16)).slice(-2);
        }).join(''));
    }
    steps.push(hex);
    for (var i = 1; i <= 5; i++) {
        var t = i / 5;
        steps.push('#' + [r,g,b].map(function(c) {
            return ('0' + Math.round(c * (1 - t)).toString(16)).slice(-2);
        }).join(''));
    }
    steps.forEach(function(h) {
        var el = document.createElement('div');
        el.className = 'palette-shade-swatch' + (h === hex ? ' activo' : '');
        el.style.background = h;
        el.title = h;
        el.addEventListener('mousedown', function() { paletteDragging = true; paletteLastHex = h; mostrarPalettePreview(h, 0, 0); });
        el.addEventListener('mouseenter', function(e) {
            if (!paletteDragging) return;
            paletteLastHex = h;
            mostrarPalettePreview(h, e.clientX, e.clientY);
        });
        el.addEventListener('click', function() {
            aplicarColorSeleccion(h);
            paletteDragging = false;
            ocultarPalettePreview();
        });
        shades.appendChild(el);
    });
}

window.toggleColorPalette = function() {
    var panel = document.getElementById('colorPalettePanel');
    if (!panel) return;
    if (panel.classList.contains('visible')) {
        panel.classList.remove('visible');
        ocultarPalettePreview();
        paletteDragging = false;
        return;
    }
    var grid = document.getElementById('paletteGrid');
    if (!grid) return;
    if (grid.children.length === 0) {
        PALETTE_COLORS.forEach(function(hex) {
            var el = document.createElement('div');
            el.className = 'palette-swatch' + (hex === colorPicker.value ? ' activo' : '');
            el.style.background = hex;
            el.dataset.color = hex;
            el.title = hex;
            el.addEventListener('mousedown', function(e) {
                e.preventDefault();
                paletteDragging = true;
                paletteLastHex = hex;
                mostrarPalettePreview(hex, e.clientX, e.clientY);
                document.querySelectorAll('.palette-swatch').forEach(function(s) { s.classList.remove('activo'); });
                el.classList.add('activo');
            });
            el.addEventListener('mouseenter', function(e) {
                if (!paletteDragging) return;
                paletteLastHex = hex;
                mostrarPalettePreview(hex, e.clientX, e.clientY);
                document.querySelectorAll('.palette-swatch').forEach(function(s) { s.classList.remove('activo'); });
                el.classList.add('activo');
            });
            el.addEventListener('click', function() {
                aplicarColorSeleccion(hex);
                paletteDragging = false;
                ocultarPalettePreview();
            });
            grid.appendChild(el);
        });
    } else {
        // Actualizar activo
        grid.querySelectorAll('.palette-swatch').forEach(function(s) {
            s.classList.toggle('activo', s.dataset.color === colorPicker.value);
        });
    }
    // Sincronizar estado actual
    document.getElementById('paletteCurrentSwatch').style.background = colorPicker.value;
    document.getElementById('paletteHexInput').value = colorPicker.value.toUpperCase();
    document.getElementById('paletteHexLabel').textContent = colorPicker.value.toUpperCase();
    generarTonosEnPanel(colorPicker.value);
    panel.classList.add('visible');
};

// Hex input dentro del panel — cambia color mientras escribes
document.addEventListener('input', function(e) {
    if (e.target && e.target.id === 'paletteHexInput') {
        var val = e.target.value.trim().toUpperCase();
        if (val.length > 0 && val[0] !== '#') {
            val = '#' + val;
            e.target.value = val;
        }
        if (/^#[0-9A-F]{6}$/.test(val)) {
            aplicarColorSeleccion(val.toLowerCase());
        }
    }
});
document.addEventListener('focus', function(e) {
    if (e.target && e.target.id === 'paletteHexInput') e.target.select();
}, true);

// Cerrar preview al soltar ratón en cualquier lado
document.addEventListener('mouseup', function() {
    if (paletteDragging && paletteLastHex) {
        aplicarColorSeleccion(paletteLastHex);
        paletteLastHex = null;
    }
    paletteDragging = false;
    ocultarPalettePreview();
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
    aplicarConfiguracion();
});
colorPicker.addEventListener('input', () => {
    grosorPunto.style.background = colorPicker.value;
});

/* ──────────────────────────────────────────
   LIMPIAR
────────────────────────────────────────── */
document.getElementById('btnLimpiar').addEventListener('click', () => {
    if (fcanvas.getObjects().length === 0 && !fcanvas.backgroundImage) return;
    bloqueado = true;
    fcanvas.clear();
    bloqueado = false;
    fcanvas.backgroundColor = '#ffffff';
    guardarEstado();
    actualizarHint();
    mostrarToast('Lienzo limpiado');
});

/* ──────────────────────────────────────────
   GUARDAR NOTA
────────────────────────────────────────── */
async function guardarNota() {
    const titulo      = document.getElementById('inputTitulo').value.trim()      || 'Dibujo sin título';
    const descripcion = document.getElementById('inputDescripcion').value.trim() || '';
    const etiquetas   = document.getElementById('inputEtiquetas').value.trim();

    if (fcanvas.getObjects().length === 0 && !fcanvas.backgroundImage && lienzoPristino) {
        mostrarToast('El lienzo está vacío. Dibuja algo primero.');
        return;
    }

    const btns = [document.getElementById('btnGuardar'), document.getElementById('btnGuardar2')];
    btns.forEach(b => { 
        if (b) {
            b.disabled = true; 
            b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Guardando...</span>'; 
        }
    });

    try {
        // Deseleccionar antes de guardar
        fcanvas.discardActiveObject();
        fcanvas.renderAll();

        const dataURL = fcanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2 // Exportar a doble resolución para máxima calidad
        });
        
        // Convert DataURL to Blob manualmente
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], {type:mime});

        const editId   = document.getElementById('editNotaId')?.value;
        const url      = editId ? `/actualizar-nota-dibujo/${editId}` : '/guardar-nota-dibujo';

        const formData = new FormData();
        formData.append('titulo',      titulo);
        formData.append('descripcion', descripcion);
        formData.append('etiquetas',   etiquetas);
        formData.append('imagen',      blob, `${titulo.replace(/\s+/g,'_')}.png`);

        const resp = await fetch(url, { method: 'POST', body: formData });
        const data = await resp.json();

        if (data.success) {
            notaGuardada = true;
            mostrarToast(data.mensaje || 'Nota guardada correctamente');
            const est = document.getElementById('estadoGuardado');
            if (est) {
                est.classList.add('visible');
                setTimeout(() => est.classList.remove('visible'), 3000);
            }
        } else {
            mostrarToast(data.error || 'Error al guardar');
        }
    } catch (err) {
        console.error(err);
        mostrarToast('Error de conexión o guardado');
    } finally {
        btns.forEach(b => { 
            if (b) {
                b.disabled = false; 
                const isUpdate = !!document.getElementById('editNotaId')?.value;
                b.innerHTML = '<i class="fas fa-save"></i> <span>' + (isUpdate ? 'Actualizar nota' : 'Guardar nota') + '</span>'; 
            }
        });
    }
}

document.getElementById('btnGuardar').addEventListener('click',  guardarNota);
document.getElementById('btnGuardar2').addEventListener('click', guardarNota);


/* ──────────────────────────────────────────
   TOAST
────────────────────────────────────────── */
let toastTimer = null;
window.mostrarToast = function(msg) {
    const t = document.getElementById('toastDibujo');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 3000);
}

/* ──────────────────────────────────────────
   MENÚ CONTEXTUAL (CLICK DERECHO)
────────────────────────────────────────── */
;(function inyectarContextMenu() {
    const ctxMenu = document.createElement('div');
    ctxMenu.className = 'context-menu';
    ctxMenu.id = 'ctxMenu';
    ctxMenu.innerHTML = `
        <div class="context-item" id="ctxCambiarColor"><i class="fas fa-palette"></i> Cambiar Color</div>
        <div class="context-item" id="ctxMasGrosor"><i class="fas fa-plus"></i> Más Grosor</div>
        <div class="context-item" id="ctxMenosGrosor"><i class="fas fa-minus"></i> Menos Grosor</div>
        <div class="context-item" id="ctxSombra"><i class="fas fa-moon"></i> Activar/Quitar Sombra</div>
        <div style="height:1px; background:#ede7f6; margin:4px 0;"></div>
        <div class="context-item" id="ctxDuplicar"><i class="fas fa-copy"></i> Duplicar</div>
        <div class="context-item" id="ctxFrente"><i class="fas fa-arrow-up"></i> Traer al frente</div>
        <div class="context-item" id="ctxFondo"><i class="fas fa-arrow-down"></i> Enviar al fondo</div>
        <div style="height:1px; background:#ede7f6; margin:4px 0;"></div>
        <div class="context-item danger" id="ctxBorrar"><i class="fas fa-trash-alt"></i> Eliminar</div>
        <div class="context-item" id="ctxAgrupar" style="display:none;"><i class="fas fa-object-group"></i> Agrupar</div>
        <div class="context-item" id="ctxDesagrupar" style="display:none;"><i class="fas fa-object-ungroup"></i> Desagrupar</div>
    `;
    document.body.appendChild(ctxMenu);

    let targetObject = null;

    // Usar evento nativo contextmenu para 100% de compatibilidad
    fcanvas.upperCanvasEl.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        
        // Encontrar objeto bajo el ratón
        const target = fcanvas.findTarget(e, false);
        
        if (target) {
            targetObject = target;
            fcanvas.setActiveObject(target);
            fcanvas.requestRenderAll();
            
            document.getElementById('ctxAgrupar').style.display = target.type === 'activeSelection' ? 'flex' : 'none';
            document.getElementById('ctxDesagrupar').style.display = target.type === 'group' ? 'flex' : 'none';

            ctxMenu.style.left = e.pageX + 'px';
            ctxMenu.style.top  = e.pageY + 'px';
            ctxMenu.classList.add('visible');
        } else {
            ctxMenu.classList.remove('visible');
        }
    });

    // Ocultar menú en scroll o click normal fuera del canvas
    window.addEventListener('click', (e) => {
        if (!e.target.closest('#ctxMenu')) {
            ctxMenu.classList.remove('visible');
        }
    });
    window.addEventListener('scroll', () => ctxMenu.classList.remove('visible'));

    // Long-press táctil para abrir menú contextual en móvil
    let longPressTimer = null;
    let longPressTriggered = false;
    fcanvas.upperCanvasEl.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        longPressTriggered = false;
        const touch = e.touches[0];
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            const target = fcanvas.findTarget({ clientX: touch.clientX, clientY: touch.clientY }, false);
            if (target) {
                targetObject = target;
                fcanvas.setActiveObject(target);
                fcanvas.requestRenderAll();
                document.getElementById('ctxAgrupar').style.display = target.type === 'activeSelection' ? 'flex' : 'none';
                document.getElementById('ctxDesagrupar').style.display = target.type === 'group' ? 'flex' : 'none';
                ctxMenu.style.left = touch.clientX + 'px';
                ctxMenu.style.top = touch.clientY + 'px';
                ctxMenu.classList.add('visible');
            }
        }, 500);
    }, { passive: true });
    fcanvas.upperCanvasEl.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
    }, { passive: true });
    fcanvas.upperCanvasEl.addEventListener('touchend', (e) => {
        clearTimeout(longPressTimer);
        // Si fue un toque corto y no long-press, cerrar menú
        if (!longPressTriggered) {
            ctxMenu.classList.remove('visible');
        }
    }, { passive: true });

    // ── ACCIONES DEL MENÚ ──

    document.getElementById('ctxCambiarColor').addEventListener('click', () => {
        if (targetObject) {
            const input = document.createElement('input');
            input.type = 'color';
            input.value = targetObject.fill || targetObject.stroke || '#7c4dff';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.click();
            input.addEventListener('input', () => {
                if (targetObject.type === 'i-text' || targetObject.type === 'text') {
                    targetObject.set('fill', input.value);
                } else {
                    targetObject.set('stroke', input.value);
                }
                fcanvas.requestRenderAll();
                guardarEstado();
            });
            input.addEventListener('change', () => input.remove());
        }
        ctxMenu.classList.remove('visible');
    });

    document.getElementById('ctxMasGrosor').addEventListener('click', () => {
        if (targetObject) {
            let bw = targetObject.strokeWidth || 1;
            targetObject.set('strokeWidth', bw + 2);
            if(targetObject.type === 'i-text') targetObject.set('fontSize', targetObject.fontSize + 4);
            fcanvas.requestRenderAll();
            guardarEstado();
        }
        ctxMenu.classList.remove('visible');
    });

    document.getElementById('ctxMenosGrosor').addEventListener('click', () => {
        if (targetObject) {
            let bw = targetObject.strokeWidth || 1;
            targetObject.set('strokeWidth', Math.max(1, bw - 2));
            if(targetObject.type === 'i-text') targetObject.set('fontSize', Math.max(10, targetObject.fontSize - 4));
            fcanvas.requestRenderAll();
            guardarEstado();
        }
        ctxMenu.classList.remove('visible');
    });

    document.getElementById('ctxSombra').addEventListener('click', () => {
        if (targetObject) {
            if (targetObject.shadow) {
                targetObject.set('shadow', null);
            } else {
                targetObject.set('shadow', new fabric.Shadow({
                    color: 'rgba(0,0,0,0.3)',
                    blur: 10,
                    offsetX: 5,
                    offsetY: 5
                }));
            }
            fcanvas.requestRenderAll();
            guardarEstado();
        }
        ctxMenu.classList.remove('visible');
    });

    document.getElementById('ctxDuplicar').addEventListener('click', () => {
        if (targetObject) {
            targetObject.clone(function(cloned) {
                cloned.set({
                    left: targetObject.left + 20,
                    top: targetObject.top + 20,
                    evented: true,
                    _layerId: getActiveLayer().id
                });
                if (cloned.type === 'activeSelection') {
                    cloned.canvas = fcanvas;
                    cloned.forEachObject(function(obj) { fcanvas.add(obj); obj._layerId = getActiveLayer().id; });
                    cloned.setCoords();
                } else {
                    fcanvas.add(cloned);
                }
                fcanvas.setActiveObject(cloned);
                fcanvas.requestRenderAll();
                guardarEstado();
            });
        }
        ctxMenu.classList.remove('visible');
    });

    document.getElementById('ctxFrente').addEventListener('click', () => {
        if (targetObject) { targetObject.bringToFront(); fcanvas.requestRenderAll(); guardarEstado(); }
        ctxMenu.classList.remove('visible');
    });

    document.getElementById('ctxFondo').addEventListener('click', () => {
        if (targetObject) { targetObject.sendToBack(); fcanvas.requestRenderAll(); guardarEstado(); }
        ctxMenu.classList.remove('visible');
    });

    document.getElementById('ctxBorrar').addEventListener('click', () => {
        if (targetObject) { fcanvas.remove(targetObject); fcanvas.discardActiveObject(); fcanvas.requestRenderAll(); guardarEstado(); }
        ctxMenu.classList.remove('visible');
    });

    document.getElementById('ctxAgrupar').addEventListener('click', () => {
        if (targetObject && targetObject.type === 'activeSelection') {
            targetObject.toGroup();
            fcanvas.requestRenderAll();
            guardarEstado();
        }
        ctxMenu.classList.remove('visible');
    });

    document.getElementById('ctxDesagrupar').addEventListener('click', () => {
        if (targetObject && targetObject.type === 'group') {
            targetObject.toActiveSelection();
            fcanvas.requestRenderAll();
            guardarEstado();
        }
        ctxMenu.classList.remove('visible');
    });
})();

/* ──────────────────────────────────────────
   CONTROLES AVANZADOS (CANVA)
────────────────────────────────────────── */
// Opacidad
document.getElementById('opacidadInput').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    
    // Update live brush immediately so next stroke uses it
    if (fcanvas.freeDrawingBrush) {
        fcanvas.freeDrawingBrush.color = colorPincelVivo();
    }
    
    const obj = fcanvas.getActiveObject();
    if (obj) {
        obj.set('opacity', val);
        fcanvas.requestRenderAll();
    }
});
fcanvas.on('selection:created', (e) => {
    document.getElementById('opacidadInput').value = e.selected[0].opacity || 1;
});
fcanvas.on('selection:updated', (e) => {
    document.getElementById('opacidadInput').value = e.selected[0].opacity || 1;
});

// Color de Fondo
document.getElementById('bgColorPicker').addEventListener('input', (e) => {
    fcanvas.backgroundColor = e.target.value;
    fcanvas.requestRenderAll();
    actualizarHint();
    guardarEstado();
});




/* ──────────────────────────────────────────
   PANEL DE PINCELES CON PREVISUALIZACIÓN
────────────────────────────────────────── */
var brushDefs = [
    { tipo: 'pencil',      nombre: 'Lápiz',       premium: false, desc: 'Trazo sólido' },
    { tipo: 'circle',      nombre: 'Marcador',    premium: true,  desc: 'Círculos' },
    { tipo: 'spray',       nombre: 'Spray',       premium: true,  desc: 'Aerosol' },
    { tipo: 'watercolor',  nombre: 'Acuarela',    premium: true,  desc: 'Suave y difuso' },
    { tipo: 'puntillismo', nombre: 'Puntillismo', premium: true,  desc: 'Puntos finos' }
];


function generarPreviewsPinceles() {
    brushDefs.forEach(function(bd) {
        var c = document.createElement('canvas');
        c.width = 200;
        c.height = 80;
        c.style.width = '100px';
        c.style.height = '40px';
        var ctx = c.getContext('2d');
        ctx.strokeStyle = '#333';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (bd.tipo === 'pencil') {
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(10, 60);
            for (var x = 10; x <= 190; x++) {
                var y = 60 - Math.sin((x - 10) * 0.12) * 18;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (bd.tipo === 'circle') {
            ctx.fillStyle = '#333';
            for (var x = 10; x <= 190; x += 6) {
                var y = 60 - Math.sin((x - 10) * 0.12) * 18;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (bd.tipo === 'spray') {
            for (var i = 0; i < 120; i++) {
                var t = 10 + Math.random() * 180;
                var baseY = 60 - Math.sin((t - 10) * 0.12) * 18;
                var ox = (Math.random() - 0.5) * 12;
                var oy = (Math.random() - 0.5) * 12;
                ctx.fillStyle = 'rgba(50,50,50,' + (0.3 + Math.random() * 0.7) + ')';
                ctx.beginPath();
                ctx.arc(t + ox, baseY + oy, 1 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (bd.tipo === 'watercolor') {
            ctx.shadowColor = 'rgba(50,50,50,0.3)';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 6;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(10, 60);
            for (var x = 10; x <= 190; x++) {
                var y = 60 - Math.sin((x - 10) * 0.12) * 18 + (Math.random() - 0.5) * 3;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            // Second overlapping stroke
            ctx.shadowColor = 'rgba(50,50,50,0.2)';
            ctx.shadowBlur = 6;
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(10, 58);
            for (var x = 10; x <= 190; x++) {
                var y = 60 - Math.sin((x - 10) * 0.12) * 18 + (Math.random() - 0.5) * 5;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (bd.tipo === 'puntillismo') {
            ctx.fillStyle = '#333';
            for (var i = 0; i < 200; i++) {
                var t = 10 + Math.random() * 180;
                var baseY = 60 - Math.sin((t - 10) * 0.12) * 18;
                var ox = (Math.random() - 0.5) * 4;
                var oy = (Math.random() - 0.5) * 4;
                ctx.beginPath();
                ctx.arc(t + ox, baseY + oy, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        bd.previewCanvas = c;
    });
}

function toggleBrushPanel() {
    var panel = document.getElementById('brushPanel');
    if (!panel) return;
    if (panel.classList.contains('visible')) {
        panel.classList.remove('visible');
        return;
    }
    var grid = document.getElementById('brushGrid');
    if (!grid) return;
    if (grid.children.length === 0) {
        generarPreviewsPinceles();
        brushDefs.forEach(function(bd) {
            var card = document.createElement('div');
            card.className = 'brush-card' + (bd.tipo === brushType ? ' activo' : '');
            card.dataset.tipo = bd.tipo;
            if (bd.premium && !esPremium()) {
                card.classList.add('locked');
                card.title = bd.nombre + ' (Premium)';
            }
            var preview = bd.previewCanvas;
            preview.style.width = '100px';
            preview.style.height = '40px';
            var nombreEl = document.createElement('span');
            nombreEl.className = 'brush-nombre';
            nombreEl.textContent = bd.nombre;
            card.appendChild(preview);
            card.appendChild(nombreEl);
            if (bd.premium) {
                var badge = document.createElement('span');
                badge.className = 'brush-premium-badge';
                badge.textContent = 'Premium';
                card.appendChild(badge);
            }
            if (!bd.premium || esPremium()) {
                card.addEventListener('click', function() {
                    setBrush(bd.tipo, card);
                    document.getElementById('brushPanel').classList.remove('visible');
                });
            }
            grid.appendChild(card);
        });
    } else {
        grid.querySelectorAll('.brush-card').forEach(function(c) {
            c.classList.toggle('activo', c.dataset.tipo === brushType);
        });
    }
    panel.classList.add('visible');
}

/* ──────────────────────────────────────────
   PANEL STICKERS – EMOJI PICKER CON BÚSQUEDA
────────────────────────────────────────── */
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
            if (filter && !e.toLowerCase().includes(filter) && !descripcionEmoji(e).includes(filter)) return;
            var el = document.createElement('div');
            el.className = 'emoji-item';
            el.textContent = e;
            el.title = descripcionEmoji(e);
            el.addEventListener('click', function() {
                var cx = lienzW / 2 + (Math.random() - 0.5) * 80;
                var cy = lienzH / 2 + (Math.random() - 0.5) * 80;
                var sticker = new fabric.Text(e, {
                    left: cx - 20,
                    top: cy - 20,
                    fontSize: Math.max(grosorActual() * 8, 40),
                    selectable: true,
                    _layerId: getActiveLayer().id
                });
                fcanvas.add(sticker);
                fcanvas.setActiveObject(sticker);
                guardarEstado();
                // Cambiar a selección automáticamente
                var btnSel = document.getElementById('btnSeleccion');
                if (btnSel) seleccionarHerramienta('seleccion', btnSel);
                mostrarToast('Emoji colocado en el centro');
            });
            grid.appendChild(el);
        });
        if (grid.children.length === 0) {
            grid.innerHTML = '<div style="padding:20px;color:#b39ddb;text-align:center;">Sin resultados</div>';
        }
    }

    function descripcionEmoji(e) {
        var map = {
            '😀':'sonrisa','😂':'risa','❤️':'corazon','👍':'pulgar','🎉':'celebracion',
            '🔥':'fuego','⭐':'estrella','💀':'calavera','👽':'alien','🤖':'robot',
            '🐶':'perro','🐱':'gato','🌸':'flor','🍕':'pizza','🚀':'cohete',
            '🇨🇴':'colombia','🇺🇸':'usa','💻':'laptop','📱':'celular','💡':'idea',
            '🎨':'arte','🎵':'musica','💰':'dinero','💎':'diamante','👑':'corona'
        };
        return map[e] || 'emoji';
    }

    renderEmojis('');
    if (search) {
        search.addEventListener('input', function() { renderEmojis(search.value); });
    }
})();