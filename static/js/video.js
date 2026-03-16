// ══════════════════════════════════════════════════════════════════
//  video.js — Editor de Video NoteFlow
//  Conectado al backend /guardar-nota-video
// ══════════════════════════════════════════════════════════════════

// ── Constantes de validación (deben coincidir con el backend) ─────
const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;   // 2 GB
const VIDEO_EXTS_OK   = new Set(['.mp4', '.webm', '.ogg', '.mkv', '.wmv', '.mov', '.avi']);

// ══════════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════
let archivoVideo    = null;   // File que se enviará al backend
let hayVideo        = false;
let notaGuardada    = false;
let mediaRecorder   = null;
let trozosGrabacion = [];
let intervalTimer   = null;
let segundosGrab    = 0;
let grabando        = false;
let toastTimer      = null;
let urlDestino      = null;

// ══════════════════════════════════════════════════════════════════
//  REFERENCIAS DOM
// ══════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const videoPlayer       = $('videoPlayer');
const camaraPreview     = $('camaraPreview');
const videoPlaceholder  = $('videoPlaceholder');
const grabacionOverlay  = $('grabacionOverlay');
const progresoWrap      = $('progresoWrap');
const progresoFill      = $('progresoFill');
const progresoThumb     = $('progresoThumb');
const progresoTrack     = $('progresoTrack');
const tiempoActualEl    = $('tiempoActual');
const tiempoDuracionEl  = $('tiempoDuracion');
const iconPlay          = $('iconPlay');
const iconGrabarCam     = $('iconGrabarCam');
const infoDatos         = $('infoDatos');
const infoNada          = $('infoNada');
const datoDuracion      = $('datoDuracion');
const datoPeso          = $('datoPeso');
const datoFormato       = $('datoFormato');
const datoResolucion    = $('datoResolucion');
const sliderVolumen     = $('sliderVolumen');
const valVolumen        = $('valVolumen');
const iconVolumen       = $('iconVolumen');
const estadoGuardado    = $('estadoGuardado');
const toastEl           = $('toastVideo');
const timerGrabEl       = $('timerGrabacion');

// Botones
const btnPlay           = $('btnPlay');
const btnDetener        = $('btnDetener');
const btnRetroceder     = $('btnRetroceder');
const btnIrInicio       = $('btnIrInicio');
const btnIrFin          = $('btnIrFin');
const btnFullscreen     = $('btnFullscreen');
const btnGrabarCam      = $('btnGrabarCam');
const btnGuardarTop     = $('btnGuardarTop');
const btnGuardarBottom  = $('btnGuardarBottom');
const btnDetenerGrab    = $('btnDetenerGrabacion');
const btnEmpezarGrabar  = $('btnEmpezarGrabar');
const inputVideo        = $('inputVideo');

// ══════════════════════════════════════════════════════════════════
//  VALIDACIÓN CLIENTE
// ══════════════════════════════════════════════════════════════════
function validarVideo(file) {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!VIDEO_EXTS_OK.has(ext)) {
        return `Formato no permitido (${ext}). Usa: MP4, WebM, OGG, MKV, WMV, MOV, AVI`;
    }
    if (file.size > VIDEO_MAX_BYTES) {
        return 'El archivo supera el límite de 2 GB';
    }
    if (file.size === 0) {
        return 'El archivo está vacío';
    }
    return null;
}

// ══════════════════════════════════════════════════════════════════
//  CARGA DE ARCHIVO
// ══════════════════════════════════════════════════════════════════
inputVideo.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) cargarVideo(file);
    // Resetear input para poder cargar el mismo archivo de nuevo
    e.target.value = '';
});

function cargarVideo(file) {
    const error = validarVideo(file);
    if (error) { mostrarToast(error, 'error'); return; }

    archivoVideo = file;
    hayVideo     = true;
    notaGuardada = false;

    const url = URL.createObjectURL(file);
    videoPlayer.src = url;
    videoPlayer.style.display = 'block';
    videoPlaceholder.style.display = 'none';
    progresoWrap.style.display = 'flex';

    videoPlayer.onloadedmetadata = () => {
        tiempoDuracionEl.textContent = formatTiempo(videoPlayer.duration);
        habilitarControles();
        actualizarInfo(file);
        mostrarToast('Video cargado correctamente');
    };
}

function habilitarControles() {
    [btnPlay, btnDetener, btnIrInicio, btnIrFin, btnFullscreen].forEach(b => {
        if (b) b.disabled = false;
    });
}

// ══════════════════════════════════════════════════════════════════
//  INFO DEL ARCHIVO
// ══════════════════════════════════════════════════════════════════
function actualizarInfo(file) {
    infoNada.style.display  = 'none';
    infoDatos.style.display = 'flex';
    datoDuracion.textContent = formatTiempo(videoPlayer.duration);
    datoPeso.textContent     = formatBytes(file.size);
    datoFormato.textContent  = file.name.split('.').pop().toUpperCase();

    // Resolución — disponible después de loadedmetadata
    videoPlayer.addEventListener('loadedmetadata', () => {
        datoResolucion.textContent =
            `${videoPlayer.videoWidth}×${videoPlayer.videoHeight}`;
    }, { once: true });
}

// ══════════════════════════════════════════════════════════════════
//  VOLUMEN
// ══════════════════════════════════════════════════════════════════
function actualizarVolumen() {
    const val = parseInt(sliderVolumen.value);
    valVolumen.textContent = val + '%';

    iconVolumen.className = val === 0
        ? 'fas fa-volume-xmark'
        : val < 40 ? 'fas fa-volume-low' : 'fas fa-volume-high';

    sliderVolumen.style.background =
        `linear-gradient(to right, #7c4dff ${val}%, #d1c4e9 ${val}%)`;

    if (videoPlayer) videoPlayer.volume = val / 100;
}

sliderVolumen.addEventListener('input', actualizarVolumen);
actualizarVolumen();

// ══════════════════════════════════════════════════════════════════
//  PROGRESO
// ══════════════════════════════════════════════════════════════════
videoPlayer.addEventListener('timeupdate', () => {
    if (!videoPlayer.duration) return;
    const pct = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    progresoFill.style.width   = pct + '%';
    progresoThumb.style.left   = pct + '%';
    tiempoActualEl.textContent = formatTiempo(videoPlayer.currentTime);
});

videoPlayer.addEventListener('ended', () => {
    iconPlay.className = 'fas fa-play';
    btnPlay.classList.remove('playing');
});

// Clic en la barra de progreso para seek
progresoTrack.addEventListener('click', e => {
    if (!videoPlayer.duration) return;
    const rect = progresoTrack.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    videoPlayer.currentTime = pct * videoPlayer.duration;
});

// ══════════════════════════════════════════════════════════════════
//  CONTROLES DE REPRODUCCIÓN
// ══════════════════════════════════════════════════════════════════
btnPlay.addEventListener('click', () => {
    if (!hayVideo) return;
    if (videoPlayer.paused) {
        videoPlayer.play();
        iconPlay.className = 'fas fa-pause';
        btnPlay.classList.add('playing');
    } else {
        videoPlayer.pause();
        iconPlay.className = 'fas fa-play';
        btnPlay.classList.remove('playing');
    }
});

btnDetener.addEventListener('click', () => {
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
    iconPlay.className = 'fas fa-play';
    btnPlay.classList.remove('playing');
});

btnRetroceder.addEventListener('click', () => {
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
});

btnIrInicio.addEventListener('click', () => {
    videoPlayer.currentTime = 0;
});

btnIrFin.addEventListener('click', () => {
    if (videoPlayer.duration) videoPlayer.currentTime = videoPlayer.duration;
});

btnFullscreen.addEventListener('click', () => {
    if (videoPlayer.requestFullscreen)          videoPlayer.requestFullscreen();
    else if (videoPlayer.webkitRequestFullscreen) videoPlayer.webkitRequestFullscreen();
});

// Tecla espacio para play/pause
document.addEventListener('keydown', e => {
    const esInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
                    || document.activeElement?.isContentEditable;
    if (e.key === ' ' && hayVideo && !esInput) {
        e.preventDefault();
        btnPlay.click();
    }
});

// ══════════════════════════════════════════════════════════════════
//  GRABACIÓN DE CÁMARA
// ══════════════════════════════════════════════════════════════════
btnGrabarCam.addEventListener('click', () => {
    grabando ? pararGrabacion() : iniciarGrabacion();
});

btnEmpezarGrabar?.addEventListener('click', iniciarGrabacion);
btnDetenerGrab?.addEventListener('click',   pararGrabacion);

async function iniciarGrabacion() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        // Mostrar preview de cámara
        camaraPreview.srcObject = stream;
        camaraPreview.style.display = 'block';
        videoPlayer.style.display   = 'none';
        videoPlaceholder.style.display = 'none';
        grabacionOverlay.style.display = 'flex';

        trozosGrabacion = [];
        const mimeType  = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                          ? 'video/webm;codecs=vp9'
                          : 'video/webm';
        mediaRecorder   = new MediaRecorder(stream, { mimeType });

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) trozosGrabacion.push(e.data);
        };

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            camaraPreview.srcObject = null;
            camaraPreview.style.display = 'none';
            grabacionOverlay.style.display = 'none';

            const blob = new Blob(trozosGrabacion, { type: 'video/webm' });
            if (blob.size > VIDEO_MAX_BYTES) {
                mostrarToast('La grabación supera el límite de 2 GB', 'error');
                videoPlaceholder.style.display = 'flex';
                return;
            }
            const file = new File(
                [blob],
                `grabacion_${Date.now()}.webm`,
                { type: 'video/webm' }
            );
            cargarVideo(file);
        };

        mediaRecorder.start(100);
        grabando     = true;
        segundosGrab = 0;

        btnGrabarCam.classList.add('grabando');
        iconGrabarCam.className = 'fas fa-square';

        intervalTimer = setInterval(() => {
            segundosGrab++;
            if (timerGrabEl) timerGrabEl.textContent = formatTiempo(segundosGrab);
            // Límite 3 horas
            if (segundosGrab >= 10800) pararGrabacion();
        }, 1000);

        mostrarToast('Grabación iniciada');
    } catch (err) {
        console.error('Cámara:', err);
        mostrarToast('No se pudo acceder a la cámara/micrófono. Verifica los permisos.', 'error');
    }
}

function pararGrabacion() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    mediaRecorder.stop();
    clearInterval(intervalTimer);
    grabando = false;
    btnGrabarCam.classList.remove('grabando');
    iconGrabarCam.className = 'fas fa-video';
    mostrarToast('Grabación finalizada');
}

// ══════════════════════════════════════════════════════════════════
//  GUARDAR NOTA — fetch al backend
// ══════════════════════════════════════════════════════════════════
async function guardarNota() {
    if (!hayVideo || !archivoVideo) {
        mostrarToast('Carga o graba un video primero', 'error');
        return;
    }

    // Validación cliente antes de enviar
    const errorCliente = validarVideo(archivoVideo);
    if (errorCliente) { mostrarToast(errorCliente, 'error'); return; }

    const titulo      = ($('inputTitulo')?.value.trim())      || 'Video sin título';
    const descripcion = ($('inputDescripcion')?.value.trim()) || '';
    const etiquetas   = ($('inputEtiquetas')?.value.trim())   || '';

    // Deshabilitar botones
    const btns = [btnGuardarTop, btnGuardarBottom].filter(Boolean);
    btns.forEach(b => {
        b.disabled  = true;
        b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    });

    const formData = new FormData();
    formData.append('titulo',      titulo);
    formData.append('descripcion', descripcion);
    formData.append('etiquetas',   etiquetas);
    formData.append('video',       archivoVideo, archivoVideo.name);

    try {
        const resp = await fetch('/guardar-nota-video', {
            method: 'POST',
            body:   formData
        });

        let data;
        try {
            data = await resp.json();
        } catch {
            throw new Error(`Respuesta inesperada del servidor (HTTP ${resp.status})`);
        }

        if (!resp.ok || !data.success) {
            throw new Error(data.error || `Error HTTP ${resp.status}`);
        }

        // Éxito
        notaGuardada = true;
        mostrarToast('¡Nota de video guardada!', 'success');
        estadoGuardado.classList.add('visible');
        setTimeout(() => estadoGuardado.classList.remove('visible'), 3000);

        if (data.redirect) {
            setTimeout(() => { window.location.href = data.redirect; }, 1200);
        }

    } catch (err) {
        console.error('guardarNota video:', err);
        mostrarToast(err.message || 'Error de conexión. Inténtalo de nuevo.', 'error');
        btns.forEach(b => {
            b.disabled  = false;
            b.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar nota';
        });
    }
}

// Conectar botones guardar
btnGuardarTop?.addEventListener('click',    guardarNota);
btnGuardarBottom?.addEventListener('click', guardarNota);

// ══════════════════════════════════════════════════════════════════
//  MODAL SALIDA SIN GUARDAR
// ══════════════════════════════════════════════════════════════════
$('btnVolver')?.addEventListener('click', e => {
    if (hayVideo && !notaGuardada) {
        e.preventDefault();
        urlDestino = e.currentTarget.getAttribute('href') || '/notas';
        $('modalSalida').classList.add('visible');
    }
});

$('btnModalCancelar')?.addEventListener('click', () =>
    $('modalSalida').classList.remove('visible')
);

$('btnModalSalir')?.addEventListener('click', () => {
    notaGuardada = true;
    $('modalSalida').classList.remove('visible');
    window.location.href = urlDestino || '/notas';
});

$('modalSalida')?.addEventListener('click', e => {
    if (e.target.id === 'modalSalida')
        $('modalSalida').classList.remove('visible');
});

window.addEventListener('beforeunload', e => {
    if (hayVideo && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ══════════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════════
function mostrarToast(msg, tipo = 'info') {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className   = 'toast-video visible';
    if (tipo === 'success') toastEl.classList.add('success');
    if (tipo === 'error')   toastEl.classList.add('error');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3500);
}

// ══════════════════════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════════════════════
function formatTiempo(seg) {
    seg = Math.max(0, seg || 0);
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = Math.floor(seg % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
}

function formatBytes(bytes) {
    if (bytes < 1024)             return bytes + ' B';
    if (bytes < 1024 * 1024)      return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 ** 3)        return (bytes / 1024 ** 2).toFixed(1) + ' MB';
    return (bytes / 1024 ** 3).toFixed(2) + ' GB';
}