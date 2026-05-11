// ══════════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════
let archivoOriginal  = null;
let hayVideo         = false;
let notaGuardada     = false;

let mediaRecorder    = null;
let trozosGrabacion  = [];
let streamCamara     = null;
let intervalTimer    = null;
let segundosGrab     = 0;

// Loop
let loopActivo = false;

// Velocidad
let velocidadActual = 1.0;

// Marcadores  [{tiempo, label}]
let marcadores = [];
let marcadorContador = 1;

// Filtros activos (CSS filter string)
const filtrosActivos = new Set();
let espejoActivo = false;

// Región de tiempo
let regionStart = null;
let regionEnd   = null;

// ══════════════════════════════════════════════════════════════════
//  REFERENCIAS DOM
// ══════════════════════════════════════════════════════════════════
const videoPlayer          = document.getElementById('videoPlayer');
const camaraPreview        = document.getElementById('camaraPreview');
const videoPlaceholder     = document.getElementById('videoPlaceholder');
const grabacionOverlay     = document.getElementById('grabacionOverlay');

// Seek bar pro
const seekProWrap          = document.getElementById('seekProWrap');
const seekProFill          = document.getElementById('seekProFill');
const seekProThumb         = document.getElementById('seekProThumb');
const seekProTrack         = document.getElementById('seekProTrack');
const seekProActual        = document.getElementById('seekProActual');
const seekProTotal         = document.getElementById('seekProTotal');

const btnPlay              = document.getElementById('btnPlay');
const btnDetener           = document.getElementById('btnDetener');
const btnRetroceder        = document.getElementById('btnRetroceder');
const btnIrInicio          = document.getElementById('btnIrInicio');
const btnIrFin             = document.getElementById('btnIrFin');
const btnGrabarCam         = document.getElementById('btnGrabarCam');
const btnFullscreen        = document.getElementById('btnFullscreen');
const btnEmpezarGrabar     = document.getElementById('btnEmpezarGrabar');
const btnDetenerGrab       = document.getElementById('btnDetenerGrabacion');
const iconPlay             = document.getElementById('iconPlay');
const iconGrabarCam        = document.getElementById('iconGrabarCam');
const timerGrabEl          = document.getElementById('timerGrabacion');
const inputVideo           = document.getElementById('inputVideo');
const sliderVolumen        = document.getElementById('sliderVolumen');
const valVolumen           = document.getElementById('valVolumen');
const iconVolumen          = document.getElementById('iconVolumen');
const infoDatos            = document.getElementById('infoDatos');
const infoNada             = document.getElementById('infoNada');
const datoDuracion         = document.getElementById('datoDuracion');
const datoPeso             = document.getElementById('datoPeso');
const datoFormato          = document.getElementById('datoFormato');
const datoResolucion       = document.getElementById('datoResolucion');
const datoTiempoActual     = document.getElementById('datoTiempoActual');
const btnGuardarTop        = document.getElementById('btnGuardarTop');
const btnGuardarBottom     = document.getElementById('btnGuardarBottom');
const btnLoop              = document.getElementById('btnLoop');
const selectVelocidad      = document.getElementById('selectVelocidad');
const selectZoom           = document.getElementById('selectZoom');
const btnMarcador          = document.getElementById('btnMarcador');
const btnToggleEfectos     = document.getElementById('btnToggleEfectos');
const efectosVideoPanel    = document.getElementById('efectosVideoPanel');
const btnCaptura           = document.getElementById('btnCaptura');
const btnExportar          = document.getElementById('btnExportar');
const capturaCanvas        = document.getElementById('capturaCanvas');
const statsExtra           = document.getElementById('statsExtra');
const statDuracion         = document.getElementById('statDuracion');
const statPeso             = document.getElementById('statPeso');
const statFormato          = document.getElementById('statFormato');
const statResolucion       = document.getElementById('statResolucion');
const statFiltrosWrap      = document.getElementById('statFiltrosWrap');
const statFiltros          = document.getElementById('statFiltros');
const statMarcsWrap        = document.getElementById('statMarcsWrap');
const statMarcs            = document.getElementById('statMarcs');
const marcadoresTimeline   = document.getElementById('marcadoresTimeline');
const marcadoresListVideo  = document.getElementById('marcadoresListVideo');
const regionVideoInfo      = document.getElementById('regionVideoInfo');
const regionVideoTexto     = document.getElementById('regionVideoTexto');

// ══════════════════════════════════════════════════════════════════
//  CARGA DE ARCHIVO
// ══════════════════════════════════════════════════════════════════
inputVideo.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    cargarVideo(file);
    e.target.value = '';
});

function cargarVideo(file) {
    const extPermitidas = ['.mp4', '.webm', '.ogg', '.mkv', '.wmv', '.mov', '.avi'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!extPermitidas.includes(ext)) {
        mostrarToast('Formato no permitido. Usa: MP4, WebM, OGG, MKV, WMV, MOV, AVI', 'error');
        return;
    }

    // Límite dinámico por plan
    const limVideo = window.PLAN_LIMITES?.video ?? (2 * 1024 * 1024 * 1024);
    const nomPlan  = window.PLAN_LIMITES?.nombre ?? 'Gratis';
    if (file.size > limVideo) {
        const limite = window.PLAN_LIMITES?.formatBytes(limVideo) ?? '2 GB';
        mostrarToast(`El archivo supera el límite de ${limite} para el plan ${nomPlan}. Mejora tu plan para subir videos más grandes.`, 'error');
        return;
    }

    archivoOriginal = file;
    hayVideo        = true;
    notaGuardada    = false;

    const url = URL.createObjectURL(file);
    videoPlayer.src = url;
    videoPlayer.load();

    mostrarInterfazVideo(file);
    mostrarToast('Video cargado correctamente 🎬');
}

// ══════════════════════════════════════════════════════════════════
//  MOSTRAR INTERFAZ TRAS CARGAR
// ══════════════════════════════════════════════════════════════════
function mostrarInterfazVideo(file) {
    videoPlaceholder.style.display = 'none';
    camaraPreview.style.display    = 'none';
    grabacionOverlay.style.display = 'none';
    videoPlayer.style.display      = 'block';

    seekProWrap.classList.add('visible');
    statsExtra.classList.add('visible');
    marcadoresTimeline.classList.remove('hidden');

    habilitarControles();
    actualizarInfoArchivo(file);
    actualizarStatsExtra(file);
}

// RESTAURACIÓN PARA EDICIÓN
async function restaurarVideoExistente() {
    const url = document.getElementById('editVideoUrl')?.value;
    if (!url) return;
    try {
        const response = await fetch('/static/' + url);
        const blob = await response.blob();
        const filename = url.split('/').pop();
        const file = new File([blob], filename, { type: blob.type });
        cargarVideo(file);
        notaGuardada = true;
    } catch (e) {
        console.error("Error al restaurar video:", e);
    }
}
setTimeout(restaurarVideoExistente, 500);

function habilitarControles() {
    btnPlay.disabled       = false;
    btnDetener.disabled    = false;
    btnIrInicio.disabled   = false;
    btnIrFin.disabled      = false;
    btnFullscreen.disabled = false;
    btnCaptura.disabled    = false;
}

// ══════════════════════════════════════════════════════════════════
//  EVENTOS DEL ELEMENTO <video>
// ══════════════════════════════════════════════════════════════════
videoPlayer.addEventListener('loadedmetadata', () => {
    const dur = videoPlayer.duration;
    seekProTotal.textContent  = formatTiempo(dur);
    datoDuracion.textContent  = formatTiempo(dur);
    datoResolucion.textContent = `${videoPlayer.videoWidth} × ${videoPlayer.videoHeight}`;
    statResolucion.textContent = `${videoPlayer.videoWidth}×${videoPlayer.videoHeight}`;
    statDuracion.textContent   = formatTiempo(dur);
});

videoPlayer.addEventListener('timeupdate', () => {
    if (!videoPlayer.duration) return;
    const pct = videoPlayer.currentTime / videoPlayer.duration;
    seekProFill.style.width  = (pct * 100) + '%';
    seekProThumb.style.left  = (pct * 100) + '%';
    seekProActual.textContent = formatTiempo(videoPlayer.currentTime);
    datoTiempoActual.textContent = formatTiempo(videoPlayer.currentTime);
});

videoPlayer.addEventListener('ended', () => {
    if (loopActivo) {
        videoPlayer.currentTime = 0;
        videoPlayer.play();
        return;
    }
    iconPlay.className = 'fas fa-play';
    btnPlay.classList.remove('playing');
});
videoPlayer.addEventListener('play', () => {
    iconPlay.className = 'fas fa-pause';
    btnPlay.classList.add('playing');
});
videoPlayer.addEventListener('pause', () => {
    iconPlay.className = 'fas fa-play';
    btnPlay.classList.remove('playing');
});

// ══════════════════════════════════════════════════════════════════
//  CONTROLES DE REPRODUCCIÓN
// ══════════════════════════════════════════════════════════════════
btnPlay.addEventListener('click', () => {
    if (!hayVideo) return;
    if (videoPlayer.paused) videoPlayer.play();
    else                    videoPlayer.pause();
});
btnDetener.addEventListener('click', () => {
    if (!hayVideo) return;
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
});
btnRetroceder.addEventListener('click', () => {
    if (!hayVideo) return;
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
});
btnIrInicio.addEventListener('click', () => {
    if (!hayVideo) return;
    videoPlayer.currentTime = 0;
});
btnIrFin.addEventListener('click', () => {
    if (!hayVideo) return;
    videoPlayer.currentTime = videoPlayer.duration;
});
btnFullscreen.addEventListener('click', () => {
    if (!hayVideo) return;
    if (videoPlayer.requestFullscreen)            videoPlayer.requestFullscreen();
    else if (videoPlayer.webkitRequestFullscreen) videoPlayer.webkitRequestFullscreen();
    else if (videoPlayer.mozRequestFullScreen)    videoPlayer.mozRequestFullScreen();
});

// ══════════════════════════════════════════════════════════════════
//  SEEK BAR PRO — clic + arrastre + región shift+clic
// ══════════════════════════════════════════════════════════════════
let arrastrando = false;
let regionShiftStart = null;

seekProTrack.addEventListener('click', (e) => {
    if (!hayVideo || !videoPlayer.duration) return;
    if (e.shiftKey) {
        // Definir región
        const rect = seekProTrack.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const tiempo = pct * videoPlayer.duration;
        if (regionStart === null) {
            regionStart = tiempo;
            regionShiftStart = pct;
            mostrarToast(`Inicio de región: ${formatTiempo(tiempo)}`);
        } else {
            regionEnd = tiempo;
            if (regionEnd < regionStart) { [regionStart, regionEnd] = [regionEnd, regionStart]; }
            actualizarRegionVisual();
            regionVideoInfo.classList.add('visible');
            regionVideoTexto.textContent = `${formatTiempo(regionStart)} → ${formatTiempo(regionEnd)}`;
            mostrarToast(`Región: ${formatTiempo(regionStart)} → ${formatTiempo(regionEnd)}`);
            regionShiftStart = null;
        }
        return;
    }
    const rect = seekProTrack.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoPlayer.currentTime = pct * videoPlayer.duration;
});

seekProTrack.addEventListener('mousedown', (e) => {
    if (!hayVideo || !videoPlayer.duration || e.shiftKey) return;
    arrastrando = true;
    moverSeekPro(e);
});
window.addEventListener('mousemove', (e) => { if (arrastrando) moverSeekPro(e); });
window.addEventListener('mouseup',   ()  => { arrastrando = false; });

function moverSeekPro(e) {
    const rect = seekProTrack.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoPlayer.currentTime = pct * videoPlayer.duration;
}

function actualizarRegionVisual() {
    // Eliminar pines anteriores de región en seekbar
    seekProTrack.querySelectorAll('.seek-marc-pin').forEach(el => el.remove());
    if (regionStart === null || regionEnd === null || !videoPlayer.duration) return;
    const dur = videoPlayer.duration;
    [regionStart, regionEnd].forEach(t => {
        const pin = document.createElement('div');
        pin.className  = 'seek-marc-pin';
        pin.style.left = ((t / dur) * 100) + '%';
        seekProTrack.appendChild(pin);
    });
}

document.getElementById('btnBorrarRegion')?.addEventListener('click', () => {
    regionStart = null;
    regionEnd   = null;
    regionVideoInfo.classList.remove('visible');
    seekProTrack.querySelectorAll('.seek-marc-pin').forEach(el => el.remove());
    mostrarToast('Región eliminada');
});

// ══════════════════════════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════════════════════════
btnLoop.addEventListener('click', () => {
    loopActivo = !loopActivo;
    btnLoop.classList.toggle('activo', loopActivo);
    videoPlayer.loop = loopActivo;
    mostrarToast(loopActivo ? 'Loop activado 🔁' : 'Loop desactivado');
});

// ══════════════════════════════════════════════════════════════════
//  VELOCIDAD DE REPRODUCCIÓN
// ══════════════════════════════════════════════════════════════════
selectVelocidad.addEventListener('change', () => {
    velocidadActual = parseFloat(selectVelocidad.value);
    videoPlayer.playbackRate = velocidadActual;
    mostrarToast(`Velocidad: ${velocidadActual}×`);
});

// ══════════════════════════════════════════════════════════════════
//  ZOOM DE VIDEO
// ══════════════════════════════════════════════════════════════════
selectZoom.addEventListener('change', () => {
    videoPlayer.style.objectFit = selectZoom.value;
    camaraPreview.style.objectFit = selectZoom.value;
    mostrarToast(`Zoom: ${selectZoom.options[selectZoom.selectedIndex].text}`);
});

// ══════════════════════════════════════════════════════════════════
//  MARCADORES
// ══════════════════════════════════════════════════════════════════
btnMarcador.addEventListener('click', () => {
    if (!hayVideo) { mostrarToast('Carga un video primero', 'error'); return; }
    const tiempo = videoPlayer.currentTime;
    const label  = `M${marcadorContador++}`;
    marcadores.push({ tiempo, label });
    renderizarMarcadores();
    renderizarListaMarcadores();
    actualizarStatsExtra();
    mostrarToast(`Marcador ${label} en ${formatTiempo(tiempo)} 🚩`);
});

function renderizarMarcadores() {
    // En timeline debajo del video
    marcadoresTimeline.innerHTML = '';
    if (!videoPlayer.duration || marcadores.length === 0) return;
    const dur = videoPlayer.duration;
    marcadores.forEach((m, idx) => {
        const pct = m.tiempo / dur;
        const pin = document.createElement('div');
        pin.className      = 'marc-pin';
        pin.style.left     = (pct * 100) + '%';
        pin.dataset.label  = m.label;
        pin.title          = `${m.label}: ${formatTiempo(m.tiempo)}`;
        pin.addEventListener('click', () => {
            videoPlayer.currentTime = m.tiempo;
            mostrarToast(`→ ${m.label}: ${formatTiempo(m.tiempo)}`);
        });
        marcadoresTimeline.appendChild(pin);
    });

    // En seek bar
    seekProTrack.querySelectorAll('.seek-marc-flag').forEach(el => el.remove());
    marcadores.forEach(m => {
        const pct = m.tiempo / dur;
        const flag = document.createElement('div');
        flag.className = 'seek-marc-flag';
        flag.style.cssText = `
            position:absolute; top:-3px;
            left:${pct * 100}%;
            width:2px; height:calc(100% + 6px);
            background:rgba(255,87,34,0.6);
            border-radius:2px; pointer-events:none;
        `;
        seekProTrack.appendChild(flag);
    });
}

function renderizarListaMarcadores() {
    if (marcadores.length === 0) {
        marcadoresListVideo.classList.remove('visible');
        return;
    }
    marcadoresListVideo.classList.add('visible');
    marcadoresListVideo.innerHTML = marcadores.map((m, i) => `
        <div class="marc-item" onclick="irAMarcador(${i})">
            <i class="fas fa-flag" style="color:#ff7043; font-size:11px;"></i>
            <strong>${m.label}</strong>
            <span style="color:#bf8c7c; font-weight:600; font-size:11px;">${formatTiempo(m.tiempo)}</span>
            <button class="btn-del-marc" onclick="event.stopPropagation(); eliminarMarcador(${i})" title="Eliminar">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function irAMarcador(idx) {
    if (!hayVideo || idx >= marcadores.length) return;
    videoPlayer.currentTime = marcadores[idx].tiempo;
    mostrarToast(`→ ${marcadores[idx].label}: ${formatTiempo(marcadores[idx].tiempo)}`);
}

function eliminarMarcador(idx) {
    marcadores.splice(idx, 1);
    renderizarMarcadores();
    renderizarListaMarcadores();
    actualizarStatsExtra();
}

// ══════════════════════════════════════════════════════════════════
//  FILTROS DE VIDEO (CSS filter)
// ══════════════════════════════════════════════════════════════════
const mapaFiltros = {
    efBN:        { css: 'grayscale(100%)', label: 'B&N' },
    efSepia:     { css: 'sepia(80%)',      label: 'Sepia' },
    efContraste: { css: 'contrast(150%)', label: 'Contraste+' },
    efBrillo:    { css: 'brightness(140%)', label: 'Brillo+' },
    efSaturar:   { css: 'saturate(200%)', label: 'Saturar' },
    efDesaturar: { css: 'saturate(30%)',  label: 'Desaturar' },
    efInvertir:  { css: 'invert(100%)',   label: 'Invertir' },
    efCalido:    { css: 'hue-rotate(-20deg) saturate(130%)', label: 'Cálido' },
    efFrio:      { css: 'hue-rotate(30deg) saturate(80%)',  label: 'Frío' },
    efBlur:      { css: 'blur(2px)',      label: 'Blur' },
    efNitidez:   { css: 'contrast(120%) brightness(105%)', label: 'Nitidez' },
};

// Espejo se maneja separado (transform)
document.getElementById('efEspejo').addEventListener('click', (e) => {
    espejoActivo = !espejoActivo;
    e.currentTarget.classList.toggle('activo', espejoActivo);
    aplicarFiltros();
    actualizarStatsExtra();
    mostrarToast(espejoActivo ? 'Espejo activado ↔' : 'Espejo desactivado');
});

Object.entries(mapaFiltros).forEach(([id, cfg]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (filtrosActivos.has(id)) {
            filtrosActivos.delete(id);
            btn.classList.remove('activo');
        } else {
            filtrosActivos.add(id);
            btn.classList.add('activo');
        }
        aplicarFiltros();
        actualizarStatsExtra();
        mostrarToast(filtrosActivos.has(id) ? `Filtro aplicado: ${cfg.label}` : `Filtro quitado: ${cfg.label}`);
    });
});

function aplicarFiltros() {
    // Construir CSS filter string
    let filterStr = [...filtrosActivos].map(id => mapaFiltros[id]?.css).filter(Boolean).join(' ');
    videoPlayer.style.filter = filterStr;
    camaraPreview.style.filter = filterStr;

    // Espejo
    const scaleX = espejoActivo ? -1 : 1;
    const filterTransform = `scaleX(${scaleX})`;
    videoPlayer.style.transform   = filterTransform;
    camaraPreview.style.transform = filterTransform;
}

// ══════════════════════════════════════════════════════════════════
//  TOGGLE PANEL FILTROS
// ══════════════════════════════════════════════════════════════════
btnToggleEfectos.addEventListener('click', () => {
    efectosVideoPanel.classList.toggle('visible');
    btnToggleEfectos.classList.toggle('activo');
});

// ══════════════════════════════════════════════════════════════════
//  CAPTURA DE FOTOGRAMA
// ══════════════════════════════════════════════════════════════════
btnCaptura.addEventListener('click', () => {
    if (!hayVideo) return;
    const w = videoPlayer.videoWidth  || 1280;
    const h = videoPlayer.videoHeight || 720;
    capturaCanvas.width  = w;
    capturaCanvas.height = h;
    const ctx = capturaCanvas.getContext('2d');

    // Aplicar espejo en canvas si está activo
    if (espejoActivo) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(videoPlayer, -w, 0, w, h);
        ctx.restore();
    } else {
        ctx.drawImage(videoPlayer, 0, 0, w, h);
    }

    // Aplicar filtros CSS como aproximación en canvas
    // (el CSS filter ya está en el elemento, la captura toma el frame real)

    capturaCanvas.toBlob(blob => {
        if (!blob) { mostrarToast('Error al capturar fotograma', 'error'); return; }
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        const titulo = document.getElementById('inputTitulo')?.value.trim() || 'frame_noteflow';
        a.href     = url;
        a.download = `${titulo}_${formatTiempoArchivo(videoPlayer.currentTime)}.png`;
        a.click();
        URL.revokeObjectURL(url);
        mostrarToast('Fotograma capturado y descargado 📷');
    }, 'image/png');
});

function formatTiempoArchivo(seg) {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = Math.floor(seg % 60);
    return `${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}m${String(s).padStart(2,'0')}s`;
}

// ══════════════════════════════════════════════════════════════════
//  EXPORTAR (descargar el archivo original)
// ══════════════════════════════════════════════════════════════════
btnExportar.addEventListener('click', exportarVideo);

function exportarVideo() {
    if (!hayVideo || !archivoOriginal) {
        mostrarToast('No hay video para exportar', 'error');
        return;
    }
    mostrarToast('Preparando descarga...');
    const url   = URL.createObjectURL(archivoOriginal);
    const a     = document.createElement('a');
    const titulo = document.getElementById('inputTitulo')?.value.trim() || 'video_noteflow';
    const ext   = archivoOriginal.name.split('.').pop();
    a.href      = url;
    a.download  = `${titulo}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast('Video exportado ✓');
}

// ══════════════════════════════════════════════════════════════════
//  STATS EXTRA
// ══════════════════════════════════════════════════════════════════
function actualizarStatsExtra(file) {
    if (file) {
        statPeso.textContent    = formatBytes(file.size);
        statFormato.textContent = file.name.split('.').pop().toUpperCase();
    }
    // Filtros
    const nFiltros = filtrosActivos.size + (espejoActivo ? 1 : 0);
    if (nFiltros > 0) {
        statFiltrosWrap.style.display = 'flex';
        statFiltros.textContent = `${nFiltros} filtro${nFiltros > 1 ? 's' : ''}`;
    } else {
        statFiltrosWrap.style.display = 'none';
    }
    // Marcadores
    if (marcadores.length > 0) {
        statMarcsWrap.style.display = 'flex';
        statMarcs.textContent = `${marcadores.length} marcador${marcadores.length > 1 ? 'es' : ''}`;
    } else {
        statMarcsWrap.style.display = 'none';
    }
}

// ══════════════════════════════════════════════════════════════════
//  INFO DEL ARCHIVO
// ══════════════════════════════════════════════════════════════════
function actualizarInfoArchivo(file) {
    infoNada.style.display  = 'none';
    infoDatos.style.display = 'flex';
    datoPeso.textContent    = formatBytes(file.size);
    datoFormato.textContent = file.name.split('.').pop().toUpperCase();
}

// ══════════════════════════════════════════════════════════════════
//  SLIDER DE VOLUMEN
// ══════════════════════════════════════════════════════════════════
function actualizarVolumen() {
    const val = parseInt(sliderVolumen.value);
    valVolumen.textContent = val + '%';
    if (val === 0)     iconVolumen.className = 'fas fa-volume-xmark';
    else if (val < 40) iconVolumen.className = 'fas fa-volume-low';
    else               iconVolumen.className = 'fas fa-volume-high';
    sliderVolumen.style.background =
        `linear-gradient(to right, #7c4dff ${val}%, #d1c4e9 ${val}%)`;
    videoPlayer.volume = val / 100;
}
sliderVolumen.addEventListener('input', actualizarVolumen);
actualizarVolumen();

// ══════════════════════════════════════════════════════════════════
//  GRABACIÓN DESDE CÁMARA
// ══════════════════════════════════════════════════════════════════
btnGrabarCam.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') pararGrabacion();
    else iniciarGrabacion();
});
btnEmpezarGrabar.addEventListener('click', iniciarGrabacion);
btnDetenerGrab.addEventListener('click', pararGrabacion);

async function iniciarGrabacion() {
    try {
        streamCamara    = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        trozosGrabacion = [];

        videoPlaceholder.style.display = 'none';
        videoPlayer.style.display      = 'none';
        camaraPreview.style.display    = 'block';
        grabacionOverlay.style.display = 'flex';
        camaraPreview.srcObject        = streamCamara;

        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4'
        ];
        let mimeType = '';
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) { mimeType = type; break; }
        }

        mediaRecorder = new MediaRecorder(streamCamara, { mimeType });
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) trozosGrabacion.push(e.data);
        };
        mediaRecorder.onstop = () => {
            streamCamara.getTracks().forEach(t => t.stop());
            camaraPreview.srcObject = null;
            const blob = new Blob(trozosGrabacion, { type: mediaRecorder.mimeType || 'video/webm' });
            if (blob.size > 2 * 1024 * 1024 * 1024) {
                mostrarToast('La grabación supera el límite de 2 GB', 'error');
                videoPlaceholder.style.display = 'flex';
                return;
            }
            const file = new File([blob], `grabacion_${Date.now()}.webm`, { type: 'video/webm' });
            cargarVideo(file);
            archivoOriginal = file;
        };

        mediaRecorder.start(1000);
        segundosGrab = 0;
        timerGrabEl.textContent = "0:00";
        btnGrabarCam.classList.add('grabando');
        iconGrabarCam.className = 'fas fa-stop';

        intervalTimer = setInterval(() => {
            segundosGrab++;
            timerGrabEl.textContent = formatTiempo(segundosGrab);
            const maxSeg = window.PLAN_LIMITES?.grabacion ?? 7200;
            if (segundosGrab >= maxSeg) {
                pararGrabacion();
                mostrarToast(`Límite de grabación alcanzado (${window.PLAN_LIMITES?.formatSeg(maxSeg) ?? '2:00:00'}) para el plan ${window.PLAN_LIMITES?.nombre ?? 'Gratis'}.`, 'error');
            }
        }, 1000);

        mostrarToast('🔴 Grabación de video iniciada');
    } catch (err) {
        mostrarToast('No se pudo acceder a la cámara/micrófono. Verifica los permisos.', 'error');
        console.error(err);
    }
}

function pararGrabacion() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    try { mediaRecorder.stop(); } catch (e) { console.error(e); }
    if (intervalTimer) clearInterval(intervalTimer);
    grabacionOverlay.style.display = 'none';
    camaraPreview.style.display    = 'none';
    btnGrabarCam.classList.remove('grabando');
    iconGrabarCam.className = 'fas fa-video';
    if (trozosGrabacion.length === 0) {
        videoPlaceholder.style.display = 'flex';
    }
}

// ══════════════════════════════════════════════════════════════════
//  ATAJOS DE TECLADO
// ══════════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
    const tag     = document.activeElement?.tagName;
    const esInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
                    || document.activeElement?.isContentEditable;

    if (e.key === ' ' && hayVideo && !esInput) {
        e.preventDefault();
        btnPlay.click();
    }
    if (e.key === 'ArrowLeft' && hayVideo && !esInput) {
        e.preventDefault();
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - (e.shiftKey ? 30 : 5));
    }
    if (e.key === 'ArrowRight' && hayVideo && !esInput) {
        e.preventDefault();
        videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + (e.shiftKey ? 30 : 5));
    }
    if (e.key === 'm' && hayVideo && !esInput) {
        e.preventDefault(); btnMarcador.click();
    }
    if (e.key === 'l' && hayVideo && !esInput) {
        e.preventDefault(); btnLoop.click();
    }
    if (e.key === 'f' && hayVideo && !esInput) {
        e.preventDefault(); btnFullscreen.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); guardarNota();
    }
    // Número 0 → ir al inicio
    if (e.key === '0' && hayVideo && !esInput) {
        videoPlayer.currentTime = 0;
    }
    // +/- para velocidad
    if (e.key === '+' && hayVideo && !esInput) {
        const vals = ['0.25','0.5','0.75','1','1.25','1.5','2'];
        const idx  = vals.indexOf(selectVelocidad.value);
        if (idx < vals.length - 1) { selectVelocidad.value = vals[idx + 1]; selectVelocidad.dispatchEvent(new Event('change')); }
    }
    if (e.key === '-' && hayVideo && !esInput) {
        const vals = ['0.25','0.5','0.75','1','1.25','1.5','2'];
        const idx  = vals.indexOf(selectVelocidad.value);
        if (idx > 0) { selectVelocidad.value = vals[idx - 1]; selectVelocidad.dispatchEvent(new Event('change')); }
    }
});

// ══════════════════════════════════════════════════════════════════
//  MODAL SALIDA SIN GUARDAR
// ══════════════════════════════════════════════════════════════════
let urlDestino = null;

document.getElementById('btnVolver').addEventListener('click', (e) => {
    if (hayVideo && !notaGuardada) {
        e.preventDefault();
        urlDestino = e.currentTarget.getAttribute('href') || '/notas';
        document.getElementById('modalSalida').classList.add('visible');
    }
});
document.getElementById('btnModalCancelar').addEventListener('click', () => {
    document.getElementById('modalSalida').classList.remove('visible');
});
document.getElementById('btnModalSalir').addEventListener('click', () => {
    notaGuardada = true;
    document.getElementById('modalSalida').classList.remove('visible');
    window.location.href = urlDestino || '/notas';
});
document.getElementById('modalSalida').addEventListener('click', (e) => {
    if (e.target.id === 'modalSalida')
        document.getElementById('modalSalida').classList.remove('visible');
});
window.addEventListener('beforeunload', (e) => {
    if (hayVideo && !notaGuardada) { e.preventDefault(); e.returnValue = ''; }
});

// ══════════════════════════════════════════════════════════════════
//  GUARDAR NOTA — sin cambios en backend
// ══════════════════════════════════════════════════════════════════
async function guardarNota() {
    if (!hayVideo || !archivoOriginal) {
        mostrarToast('Carga o graba un video primero', 'error');
        return;
    }

    const titulo      = (document.getElementById('inputTitulo')?.value.trim())      || 'Video sin título';
    const descripcion = (document.getElementById('inputDescripcion')?.value.trim()) || '';
    const etiquetas   = (document.getElementById('inputEtiquetas')?.value.trim())   || '';

    const btns = [btnGuardarTop, btnGuardarBottom].filter(Boolean);
    btns.forEach(b => {
        b.disabled  = true;
        b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    });

    const editId   = document.getElementById('editNotaId')?.value;
    const isUpdate = !!editId;
    const url      = isUpdate ? `/actualizar-nota-video/${editId}` : '/guardar-nota-video';

    const formData = new FormData();
    formData.append('titulo',      titulo);
    formData.append('descripcion', descripcion);
    formData.append('etiquetas',   etiquetas);
    formData.append('video',       archivoOriginal, archivoOriginal.name);

    try {
        const resp = await fetch(url, { method: 'POST', body: formData });
        let data;
        try { data = await resp.json(); }
        catch { throw new Error(`Respuesta inesperada del servidor (HTTP ${resp.status})`); }

        if (!resp.ok || !data.success) throw new Error(data.error || `Error HTTP ${resp.status}`);

        notaGuardada = true;
        mostrarToast(data.mensaje || '¡Nota de video guardada correctamente!', 'success');

        const est = document.getElementById('estadoGuardado');
        if (est) {
            est.classList.add('visible');
            setTimeout(() => est.classList.remove('visible'), 3000);
        }
        if (data.redirect) {
            setTimeout(() => { window.location.href = data.redirect; }, 1200);
        }
    } catch (err) {
        console.error('guardarNota video:', err);
        mostrarToast(err.message || 'Error de conexión. Inténtalo de nuevo.', 'error');
    } finally {
        btns.forEach(b => {
            if (b) {
                b.disabled  = false;
                b.innerHTML = '<i class="fas fa-floppy-disk"></i> ' + (isUpdate ? 'Actualizar nota' : 'Guardar nota');
            }
        });
    }
}

btnGuardarTop.addEventListener('click',    guardarNota);
btnGuardarBottom.addEventListener('click', guardarNota);

// ══════════════════════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════════════════════
function formatTiempo(seg) {
    if (isNaN(seg) || !isFinite(seg)) return '0:00';
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = Math.floor(seg % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m}:${s.toString().padStart(2,'0')}`;
}

function formatBytes(bytes) {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 ** 3)   return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 ** 3)).toFixed(2) + ' GB';
}

let toastTimer = null;
function mostrarToast(msg, tipo = 'info') {
    const t = document.getElementById('toastVideo');
    if (!t) return;
    t.textContent = msg;
    t.className   = 'toast-video visible';
    if (tipo === 'success') t.classList.add('success');
    if (tipo === 'error')   t.classList.add('error');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 3500);
}