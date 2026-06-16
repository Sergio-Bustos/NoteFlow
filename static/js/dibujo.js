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

// ── Límites según Plan ──
const limitW = { 'gratis': 1100, 'quincenal': 1400, 'mensual': 2400, 'anual': 3600 };
const limitH = { 'gratis': 640,  'quincenal': 900,  'mensual': 1400, 'anual': 2000 };
const userPlan = document.getElementById('userPlanPremium')?.value || 'gratis';
const maxW = limitW[userPlan] || limitW['gratis'];
const maxH = limitH[userPlan] || limitH['gratis'];

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
    fabric.devicePixelRatio = window.devicePixelRatio || 1;
    // La dimensión de la "parte de adentro" (píxeles reales) SIEMPRE se mantiene igual al tamaño establecido
    fcanvas.setDimensions({ width: lienzW, height: lienzH });
    fcanvas.setZoom(1); // El zoom interno siempre es 1
    
    // El zoom visual se aplica solo por CSS a la "parte de afuera"
    const wrap = document.getElementById('canvasWrap');
    if (wrap) {
        wrap.style.transform = `scale(${zoomActual})`;
        wrap.style.transformOrigin = 'top left';
        // Para que el scroll del contenedor funcione con transform, forzamos un margen
        wrap.style.marginBottom = `${(lienzH * zoomActual) - lienzH}px`;
        wrap.style.marginRight = `${(lienzW * zoomActual) - lienzW}px`;
    }

    fcanvas.calcOffset();
    fcanvas.renderAll();
    actualizarInfoTamaño();
}
ajustarCanvas();
window.addEventListener('resize', () => { fcanvas.calcOffset(); });

// ── Lógica de Zoom Dinámico ──
function getClampZoom(z) {
    // Evitar demasiado espacio vacío (hoja muy pequeña) o hoja absurdamente grande
    const minVisualW = 450;
    const maxVisualW = 5000;
    
    let minZ = Math.min(1, Math.max(minVisualW / lienzW, minVisualW / lienzH));
    let maxZ = Math.max(1, Math.min(maxVisualW / lienzW, maxVisualW / lienzH));

    return Math.max(Math.min(z, maxZ, 5), minZ, 0.1);
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

// Zoom con rueda del ratón (Ctrl + scroll)
document.getElementById('canvasOuter').addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    zoomActual = getClampZoom(zoomActual + delta);
    ajustarCanvas();
    document.getElementById('zoomLabel').textContent = Math.round(zoomActual * 100) + '%';
}, { passive: false });


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
        lienzoPristino = false;
        canvasHint.style.opacity = '0';
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

function guardarEstado() {
    if (bloqueado) return;
    const json = JSON.stringify(fcanvas.toJSON());
    if (pasoActual < historial.length - 1) {
        historial = historial.slice(0, pasoActual + 1);
    }
    historial.push(json);
    if (historial.length > 30) historial.shift(); // Limitar a 30 pasos
    else pasoActual++;
    
    if (lienzoPristino && fcanvas.getObjects().length > 0) {
        lienzoPristino = false;
        notaGuardada = false;
        canvasHint.style.opacity = '0';
    }
}

// Guardar estado inicial vacío
guardarEstado();

fcanvas.on('object:added', () => { if(!bloqueado) guardarEstado(); });
fcanvas.on('object:modified', () => { if(!bloqueado) guardarEstado(); });
fcanvas.on('object:removed', () => { if(!bloqueado) guardarEstado(); });

function deshacer() {
    if (pasoActual > 0) {
        bloqueado = true;
        pasoActual--;
        fcanvas.loadFromJSON(historial[pasoActual], function() {
            fcanvas.renderAll();
            bloqueado = false;
        });
    } else {
        mostrarToast('No hay más pasos para deshacer');
    }
}

document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        deshacer();
    }
    // Delete object
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (herramienta === 'seleccion') {
            const activos = fcanvas.getActiveObjects();
            if (activos.length) {
                activos.forEach(obj => fcanvas.remove(obj));
                fcanvas.discardActiveObject();
                fcanvas.requestRenderAll();
            }
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

// Mantener el cuadro de texto aunque esté vacío: reemplazar texto vacío por un espacio
// y re-entrar en modo edición para que el cursor siga parpadeando
fcanvas.on('text:editing:exited', function(e) {
    const obj = e.target;
    if (!obj) return;
    // Si el usuario borró todo el contenido, ponemos un espacio y volvemos a editarlo
    if (obj.text === '' || obj.text.trim() === '') {
        obj.set({ text: ' ' });
        fcanvas.renderAll();
        // Solo volvemos a editar si seguimos en modo texto
        if (herramienta === 'texto') {
            setTimeout(() => {
                fcanvas.setActiveObject(obj);
                obj.enterEditing();
                obj.setCursorByClick({ x: obj.left, y: obj.top });
                fcanvas.renderAll();
            }, 0);
        }
    }
});

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

function floodFill(imgData, W, H, startX, startY, fillHex, tolerance) {
    const d = imgData.data;
    const fill = hexToRgb(fillHex);

    const si = (startY * W + startX) * 4;
    const target = [d[si], d[si+1], d[si+2], d[si+3]];

    // Si ya tiene el color de relleno, no hacer nada
    if (colorDist(d, si, fill) < 2) return;

    const FILL_TOL = 100;   // Mayor tolerancia para adentrarse en los bordes suaves
    const BLUR_TOL = 250;  // Para suavizar el contacto con el borde real

    const filled = new Uint8Array(W * H);

    // ── Pasada 1: Scanline fill estricto (no se filtra por bordes) ──
    const stack = [[startX, startY]];

    while (stack.length > 0) {
        let [x, y] = stack.pop();

        // Buscar el borde izquierdo de la línea
        while (x > 0 && colorDist(d, (y*W + x-1)*4, target) <= FILL_TOL && !filled[y*W+x-1]) x--;

        let spanUp = false, spanDown = false;

        while (x < W) {
            const idx = (y * W + x) * 4;
            const dist = colorDist(d, idx, target);
            if (dist > FILL_TOL || filled[y * W + x]) break;

            filled[y * W + x] = 1;

            // Rellenar el pixel completamente
            d[idx]   = fill[0];
            d[idx+1] = fill[1];
            d[idx+2] = fill[2];
            d[idx+3] = 255;

            if (y > 0) {
                const up = colorDist(d, ((y-1)*W+x)*4, target);
                if (!spanUp && up <= FILL_TOL && !filled[(y-1)*W+x]) {
                    stack.push([x, y-1]); spanUp = true;
                } else if (spanUp && up > FILL_TOL) spanUp = false;
            }
            if (y < H - 1) {
                const dn = colorDist(d, ((y+1)*W+x)*4, target);
                if (!spanDown && dn <= FILL_TOL && !filled[(y+1)*W+x]) {
                    stack.push([x, y+1]); spanDown = true;
                } else if (spanDown && dn > FILL_TOL) spanDown = false;
            }
            x++;
        }
    }

    // ── Pasada 2: Limpiar píxeles de borde anti-aliased ──
    // Solo afecta a vecinos inmediatos de los píxeles ya rellenados
    // No se propaga más allá de 1 pixel de distancia → no se "sale" de la figura
    const radius = 3;
    for (let py = radius; py < H - radius; py++) {
        for (let px = radius; px < W - radius; px++) {
            if (!filled[py * W + px]) continue;

            // Solo procesar si este pixel relleno toca un pixel NO relleno (es un borde)
            if (filled[py * W + (px + 1)] && filled[py * W + (px - 1)] &&
                filled[(py + 1) * W + px] && filled[(py - 1) * W + px]) {
                continue;
            }

            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = px + dx, ny = py + dy;
                    if (filled[ny * W + nx]) continue;

                    const nidx = (ny * W + nx) * 4;
                    const dToTarget = colorDist(d, nidx, target);

                    if (dToTarget <= BLUR_TOL) {
                        const blend = 1 - (dToTarget / BLUR_TOL);
                        d[nidx]   = Math.round(d[nidx]   + (fill[0] - d[nidx])   * blend);
                        d[nidx+1] = Math.round(d[nidx+1] + (fill[1] - d[nidx+1]) * blend);
                        d[nidx+2] = Math.round(d[nidx+2] + (fill[2] - d[nidx+2]) * blend);
                        d[nidx+3] = 255;
                    }
                }
            }
        }
    }
}

fcanvas.on('mouse:down', function(o){
    if (herramienta === 'seleccion' || herramienta === 'lapiz' || herramienta === 'borrador') return;

    if (herramienta === 'balde') {
        const pointer = fcanvas.getPointer(o.e);
        const dpr = window.devicePixelRatio || 1;
        // Coordenadas físicas del pixel (respetando device pixel ratio y zoom CSS)
        const px = Math.round(pointer.x * dpr);
        const py = Math.round(pointer.y * dpr);

        if (px < 0 || py < 0 || px >= lienzW * dpr || py >= lienzH * dpr) return;

        mostrarToast('Rellenando…');

        // Aplanar TODOS los objetos del canvas a un canvas temporal
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width  = lienzW * dpr;
        tmpCanvas.height = lienzH * dpr;
        const tmpCtx = tmpCanvas.getContext('2d');

        // Fondo blanco
        tmpCtx.fillStyle = fcanvas.backgroundColor || '#ffffff';
        tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);

        // Dibujar todo el contenido de fabric sobre el temporal
        const dataURLFlat = fcanvas.toDataURL({ format: 'png', multiplier: dpr });
        const imgEl = new Image();
        imgEl.onload = function() {
            tmpCtx.drawImage(imgEl, 0, 0);

            // Aplicar flood fill sobre el canvas temporal
            const imgData = tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
            floodFill(imgData, tmpCanvas.width, tmpCanvas.height, px, py, colorActual());
            tmpCtx.putImageData(imgData, 0, 0);

            // Cargar el resultado como fondo del canvas de Fabric
            const resultURL = tmpCanvas.toDataURL('image/png');
            fabric.Image.fromURL(resultURL, function(img) {
                img.scaleX = 1 / dpr;
                img.scaleY = 1 / dpr;
                img.set({ left: 0, top: 0, selectable: false, evented: false });
                // Limpiar todos los objetos y poner el resultado como fondo
                fcanvas.clear();
                fcanvas.backgroundColor = '#ffffff';
                fcanvas.setBackgroundImage(img, () => {
                    fcanvas.renderAll();
                    guardarEstado();
                    mostrarToast('✅ Relleno aplicado');
                });
            });
        };
        imgEl.src = dataURLFlat;
        return;
    }

    if (herramienta === 'texto') {
        // Si el click fue sobre un texto existente, entrar a editarlo directamente
        if (o.target && o.target.type === 'i-text') {
            fcanvas.setActiveObject(o.target);
            o.target.enterEditing();
            fcanvas.renderAll();
            return;
        }
        const pointer = fcanvas.getPointer(o.e);
        const text = new fabric.IText(' ', {  // Espacio en vez de placeholder para que comience vacío
            left: pointer.x,
            top: pointer.y,
            fontFamily: 'Nunito',
            fill: colorActual(),
            fontSize: Math.max(grosorActual() * 5, 20),
            editable: true
        });
        fcanvas.add(text);
        fcanvas.setActiveObject(text);
        text.enterEditing();
        // NO cambiamos a selección: el usuario sigue en modo texto y puede seguir escribiendo
        fcanvas.renderAll();
        return;
    }
    if (herramienta === 'sticker') {
        // El panel de stickers se muestra en seleccionarHerramienta
        // Insertamos el emoji elegido en el punto donde se haga click
        if (!window.stickerElegido) return;
        const pointer = fcanvas.getPointer(o.e);
        const sticker = new fabric.Text(window.stickerElegido, {
            left: pointer.x,
            top: pointer.y,
            fontSize: Math.max(grosorActual() * 8, 40),
            selectable: true
        });
        fcanvas.add(sticker);
        fcanvas.setActiveObject(sticker);
        guardarEstado();
        return;
    }
    if (herramienta === 'estrella') {
        const pointer = fcanvas.getPointer(o.e);
        const starPoints = [
            {x: 0, y: -50}, {x: 14, y: -20}, {x: 47, y: -15},
            {x: 23, y: 7}, {x: 29, y: 40}, {x: 0, y: 25},
            {x: -29, y: 40}, {x: -23, y: 7}, {x: -47, y: -15}, {x: -14, y: -20}
        ];
        const star = new fabric.Polygon(starPoints, {
            left: pointer.x,
            top: pointer.y,
            fill: 'transparent',
            stroke: colorActual(),
            strokeWidth: grosorActual()
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

    const props = {
        left: origX,
        top: origY,
        originX: 'left',
        originY: 'top',
        stroke: colorActual(),
        strokeWidth: grosorActual(),
        fill: 'transparent',
        transparentCorners: false
    };

    if (herramienta === 'rectangulo') {
        shape = new fabric.Rect({ ...props, width: pointer.x-origX, height: pointer.y-origY });
    } else if (herramienta === 'circulo') {
        shape = new fabric.Ellipse({ ...props, rx: 0, ry: 0 });
    } else if (herramienta === 'linea') {
        shape = new fabric.Line([origX, origY, pointer.x, pointer.y], {
            stroke: colorActual(),
            strokeWidth: grosorActual()
        });
    } else if (herramienta === 'triangulo') {
        shape = new fabric.Triangle({ ...props, width: pointer.x-origX, height: pointer.y-origY });
    }
    if(shape) fcanvas.add(shape);
});

fcanvas.on('mouse:move', function(o){
    if (!isDown) return;
    const pointer = fcanvas.getPointer(o.e);

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
    isDown = false;
    if(shape) {
        shape.setCoords();
        shape = null;
    }
});

/* ──────────────────────────────────────────
   UTILIDADES
────────────────────────────────────────── */
function colorActual()  { return colorPicker.value; }
function grosorActual() { return parseInt(grosorInput.value); }

function aplicarConfiguracion() {
    fcanvas.freeDrawingBrush.color = colorActual();
    fcanvas.freeDrawingBrush.width = grosorActual();
    
    // Si hay objetos seleccionados, aplicarles color
    const activos = fcanvas.getActiveObjects();
    if(activos.length) {
        activos.forEach(obj => {
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
window.seleccionarHerramienta = function(nombre, btn) {
    herramienta = nombre;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('activo'));
    if(btn) btn.classList.add('activo');

    fcanvas.isDrawingMode = false;
    fcanvas.selection = false;
    fcanvas.forEachObject(obj => { obj.selectable = false; obj.evented = false; });

    const canvasWrapper = document.querySelector('.canvas-container');
    const stickerPanel  = document.getElementById('stickerPanel');
    
    // Siempre ocultar panel de stickers al cambiar de herramienta, salvo si es 'sticker'
    if (nombre !== 'sticker' && stickerPanel) stickerPanel.classList.remove('visible');

    if (nombre === 'lapiz') {
        fcanvas.isDrawingMode = true;
        fcanvas.freeDrawingBrush = new fabric.PencilBrush(fcanvas);
        fcanvas.freeDrawingBrush.decimate = 2;
        aplicarConfiguracion();
        if(canvasWrapper) canvasWrapper.style.cursor = 'crosshair';
    } else if (nombre === 'borrador') {
        fcanvas.isDrawingMode = true;
        fcanvas.freeDrawingBrush = new fabric.PencilBrush(fcanvas);
        fcanvas.freeDrawingBrush.decimate = 2;
        fcanvas.freeDrawingBrush.color = fcanvas.backgroundColor || '#ffffff';
        fcanvas.freeDrawingBrush.width = grosorActual() * 2;
        if(canvasWrapper) canvasWrapper.style.cursor = 'cell';
    } else if (nombre === 'seleccion') {
        // Multiselección con drag-rect y Shift+clic
        fcanvas.selection = true;
        fcanvas.forEachObject(obj => {
            obj.selectable = true;
            obj.evented = true;
            // Los textos se seleccionan con 1 clic y solo editan con doble clic
            if (obj.type === 'i-text') {
                obj.lockMovementX = false;
                obj.lockMovementY = false;
            }
        });
        if(canvasWrapper) canvasWrapper.style.cursor = 'default';
    } else if (nombre === 'texto') {
        // En modo texto los objetos existentes también pueden ser clickeados
        fcanvas.selection = false;
        fcanvas.forEachObject(obj => { obj.selectable = false; obj.evented = true; });
        if(canvasWrapper) canvasWrapper.style.cursor = 'text';
    } else if (nombre === 'sticker') {
        // Mostrar el panel de stickers con el primer emoji por defecto
        if (!window.stickerElegido) window.stickerElegido = '😀';
        if(stickerPanel) {
            stickerPanel.style.display = 'block';
            requestAnimationFrame(() => stickerPanel.classList.add('visible'));
        }
        if(canvasWrapper) canvasWrapper.style.cursor = 'copy';
    } else if (nombre === 'balde') {
        // Balde de pintura: cursor especial, sin selección
        if(canvasWrapper) canvasWrapper.style.cursor = 'crosshair';
    } else {
        // Formas (rectangulo, circulo, linea, triangulo, estrella)
        if(canvasWrapper) canvasWrapper.style.cursor = 'crosshair';
    }
}

// ── Doble clic: editar texto en modo selección ──
fcanvas.on('mouse:dblclick', function(o) {
    if (o.target && o.target.type === 'i-text') {
        fcanvas.setActiveObject(o.target);
        o.target.enterEditing();
        fcanvas.renderAll();
    }
});

// ── Suprimir selección múltiple con Delete / Backspace ──
document.addEventListener('keydown', function(e) {
    const tag = document.activeElement.tagName.toLowerCase();
    // No capturar si el foco está en un input, textarea o en edición de texto del canvas
    if (tag === 'input' || tag === 'textarea') return;
    const editing = fcanvas.getActiveObject();
    if (editing && editing.isEditing) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
        const activos = fcanvas.getActiveObjects();
        if (activos.length > 0) {
            e.preventDefault();
            activos.forEach(obj => fcanvas.remove(obj));
            fcanvas.discardActiveObject();
            fcanvas.renderAll();
            guardarEstado();
        }
    }
});

// Iniciar con lápiz
seleccionarHerramienta('lapiz', document.getElementById('btnLapiz'));

/* ──────────────────────────────────────────
   PALETA RÁPIDA
────────────────────────────────────────── */
document.getElementById('paleta').addEventListener('click', e => {
    const el = e.target.closest('.color-rapido');
    if (!el) return;
    colorPicker.value = el.dataset.color;
    document.querySelectorAll('.color-rapido').forEach(c => c.classList.remove('seleccionado'));
    el.classList.add('seleccionado');
    aplicarConfiguracion();
    
    if (herramienta === 'borrador') {
        seleccionarHerramienta('lapiz', document.getElementById('btnLapiz'));
    }
});

colorPicker.addEventListener('input', () => {
    document.querySelectorAll('.color-rapido').forEach(c => c.classList.remove('seleccionado'));
    aplicarConfiguracion();
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
    fcanvas.clear();
    fcanvas.backgroundColor = '#ffffff';
    lienzoPristino = true;
    canvasHint.style.opacity = '1';
    mostrarToast('Lienzo limpiado');
    guardarEstado();
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
            b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; 
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
                b.innerHTML = '<i class="fas fa-save"></i> ' + (isUpdate ? 'Actualizar nota' : 'Guardar nota'); 
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
                });
                if (cloned.type === 'activeSelection') {
                    cloned.canvas = fcanvas;
                    cloned.forEachObject(function(obj) { fcanvas.add(obj); });
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
    guardarEstado();
});




/* ──────────────────────────────────────────
   PANEL STICKERS – SELECCIÓN DE EMOJI
────────────────────────────────────────── */
// Usamos emoji-picker-element en vez de botones estáticos
document.querySelector('emoji-picker')?.addEventListener('emoji-click', event => {
    window.stickerElegido = event.detail.unicode;
    document.getElementById('stickerPanel').classList.remove('activo');
    seleccionarHerramienta('sticker', document.getElementById('btnSticker'));
    mostrarToast(`Sticker ${window.stickerElegido} listo — haz clic en el lienzo`);
});