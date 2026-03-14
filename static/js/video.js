// ══════════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════
let archivoOriginal  = null;   // File object del video cargado
let hayVideo         = false;
let notaGuardada     = false;

// Grabación de cámara
let mediaRecorder    = null;
let trozosGrabacion  = [];
let streamCamara     = null;
let intervalTimer    = null;
let segundosGrab     = 0;

// ══════════════════════════════════════════════════════════════════
//  REFERENCIAS DOM
// ══════════════════════════════════════════════════════════════════
const videoPlayer       = document.getElementById('videoPlayer');
const camaraPreview     = document.getElementById('camaraPreview');
const videoPlaceholder  = document.getElementById('videoPlaceholder');
const grabacionOverlay  = document.getElementById('grabacionOverlay');
const progresoWrap      = document.getElementById('progresoWrap');
const progresoFill      = document.getElementById('progresoFill');
const progresoThumb     = document.getElementById('progresoThumb');
const progresoTrack     = document.getElementById('progresoTrack');
const tiempoActualEl    = document.getElementById('tiempoActual');
const tiempoDuracionEl  = document.getElementById('tiempoDuracion');
const btnPlay           = document.getElementById('btnPlay');
const btnDetener        = document.getElementById('btnDetener');
const btnRetroceder     = document.getElementById('btnRetroceder');
const btnIrInicio       = document.getElementById('btnIrInicio');
const btnIrFin          = document.getElementById('btnIrFin');
const btnGrabarCam      = document.getElementById('btnGrabarCam');
const btnFullscreen     = document.getElementById('btnFullscreen');
const btnEmpezarGrabar  = document.getElementById('btnEmpezarGrabar');
const btnDetenerGrab    = document.getElementById('btnDetenerGrabacion');
const iconPlay          = document.getElementById('iconPlay');
const iconGrabarCam     = document.getElementById('iconGrabarCam');
const timerGrabEl       = document.getElementById('timerGrabacion');
const inputVideo        = document.getElementById('inputVideo');
const sliderVolumen     = document.getElementById('sliderVolumen');
const valVolumen        = document.getElementById('valVolumen');
const iconVolumen       = document.getElementById('iconVolumen');
const infoDatos         = document.getElementById('infoDatos');
const infoNada          = document.getElementById('infoNada');
const datoDuracion      = document.getElementById('datoDuracion');
const datoPeso          = document.getElementById('datoPeso');
const datoFormato       = document.getElementById('datoFormato');
const datoResolucion    = document.getElementById('datoResolucion');
const btnGuardarTop     = document.getElementById('btnGuardarTop');
const btnGuardarBottom  = document.getElementById('btnGuardarBottom');

// ══════════════════════════════════════════════════════════════════
//  CARGA DE ARCHIVO
// ══════════════════════════════════════════════════════════════════
inputVideo.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    cargarVideo(file);
});

function cargarVideo(file) {
    // Validar extensión
    const extPermitidas = ['.mp4', '.webm', '.ogg', '.mkv', '.wmv', '.mov', '.avi'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!extPermitidas.includes(ext)) {
        mostrarToast('Formato no permitido. Usa: MP4, WebM, OGG, MKV, WMV, MOV, AVI');
        return;
    }

    // Validar tamaño (2 GB)
    const MAX_BYTES = 2 * 1024 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
        mostrarToast('El archivo supera el límite de 2 GB');
        return;
    }

    archivoOriginal = file;
    hayVideo        = true;
    notaGuardada    = false;

    const url = URL.createObjectURL(file);
    videoPlayer.src = url;
    videoPlayer.load();

    mostrarInterfazVideo(file);
    mostrarToast('Video cargado correctamente');
}

// ══════════════════════════════════════════════════════════════════
//  MOSTRAR INTERFAZ TRAS CARGAR
// ══════════════════════════════════════════════════════════════════
function mostrarInterfazVideo(file) {
    videoPlaceholder.style.display = 'none';
    camaraPreview.style.display    = 'none';
    grabacionOverlay.style.display = 'none';
    videoPlayer.style.display      = 'block';
    progresoWrap.style.display     = 'flex';

    habilitarControles();
    actualizarInfoArchivo(file);
}

function habilitarControles() {
    btnPlay.disabled      = false;
    btnDetener.disabled   = false;
    btnIrInicio.disabled  = false;
    btnIrFin.disabled     = false;
    btnFullscreen.disabled = false;
}

// ══════════════════════════════════════════════════════════════════
//  EVENTOS DEL ELEMENTO <video>
// ══════════════════════════════════════════════════════════════════
videoPlayer.addEventListener('loadedmetadata', () => {
    tiempoDuracionEl.textContent = formatTiempo(videoPlayer.duration);
    datoDuracion.textContent     = formatTiempo(videoPlayer.duration);

    // Resolución
    datoResolucion.textContent = `${videoPlayer.videoWidth} × ${videoPlayer.videoHeight}`;
});

videoPlayer.addEventListener('timeupdate', () => {
    if (!videoPlayer.duration) return;
    const pct = videoPlayer.currentTime / videoPlayer.duration;
    progresoFill.style.width   = (pct * 100) + '%';
    progresoThumb.style.left   = (pct * 100) + '%';
    tiempoActualEl.textContent = formatTiempo(videoPlayer.currentTime);
});

videoPlayer.addEventListener('ended', () => {
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

// Clic en la barra de progreso para saltar
progresoTrack.addEventListener('click', (e) => {
    if (!hayVideo || !videoPlayer.duration) return;
    const rect = progresoTrack.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoPlayer.currentTime = pct * videoPlayer.duration;
});

// Arrastrar el thumb de progreso
let arrastrando = false;
progresoTrack.addEventListener('mousedown', (e) => {
    if (!hayVideo || !videoPlayer.duration) return;
    arrastrando = true;
    moverProgreso(e);
});
window.addEventListener('mousemove', (e) => {
    if (!arrastrando) return;
    moverProgreso(e);
});
window.addEventListener('mouseup', () => { arrastrando = false; });

function moverProgreso(e) {
    const rect = progresoTrack.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoPlayer.currentTime = pct * videoPlayer.duration;
}

// ══════════════════════════════════════════════════════════════════
//  SLIDER DE VOLUMEN
// ══════════════════════════════════════════════════════════════════
function actualizarVolumen() {
    const val = parseInt(sliderVolumen.value);

    valVolumen.textContent = val + '%';

    if (val === 0)       iconVolumen.className = 'fas fa-volume-xmark';
    else if (val < 40)   iconVolumen.className = 'fas fa-volume-low';
    else                 iconVolumen.className = 'fas fa-volume-high';

    sliderVolumen.style.background =
        `linear-gradient(to right, #7c4dff ${val}%, #d1c4e9 ${val}%)`;

    videoPlayer.volume = val / 100;
}

sliderVolumen.addEventListener('input', actualizarVolumen);
actualizarVolumen(); // Inicializar

// ══════════════════════════════════════════════════════════════════
//  GRABACIÓN DESDE CÁMARA
// ══════════════════════════════════════════════════════════════════
btnGrabarCam.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        pararGrabacion();
    } else {
        iniciarGrabacion();
    }
});

btnEmpezarGrabar.addEventListener('click', iniciarGrabacion);
btnDetenerGrab.addEventListener('click', pararGrabacion);

async function iniciarGrabacion() {
    try {
        streamCamara    = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        trozosGrabacion = [];

        // Mostrar preview de la cámara
        videoPlaceholder.style.display  = 'none';
        videoPlayer.style.display       = 'none';
        camaraPreview.style.display     = 'block';
        grabacionOverlay.style.display  = 'flex';
        camaraPreview.srcObject         = streamCamara;

        // Intentar usar codec VP9 o VP8 según soporte
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                ? 'video/webm;codecs=vp8'
                : 'video/webm';

        mediaRecorder = new MediaRecorder(streamCamara, { mimeType });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) trozosGrabacion.push(e.data);
        };

        mediaRecorder.onstop = () => {
            streamCamara.getTracks().forEach(t => t.stop());
            camaraPreview.srcObject = null;

            const blob = new Blob(trozosGrabacion, { type: 'video/webm' });

            // Validar tamaño
            if (blob.size > 2 * 1024 * 1024 * 1024) {
                mostrarToast('La grabación supera el límite de 2 GB');
                return;
            }

            const file = new File([blob], `grabacion_${Date.now()}.webm`, { type: 'video/webm' });
            cargarVideo(file);
            archivoOriginal = file;
        };

        mediaRecorder.start(200);
        segundosGrab = 0;

        btnGrabarCam.classList.add('grabando');
        iconGrabarCam.className = 'fas fa-stop';

        intervalTimer = setInterval(() => {
            segundosGrab++;
            timerGrabEl.textContent = formatTiempo(segundosGrab);
            // Límite aproximado: 2 GB a ~4 Mbps ≈ ~66 min; cortamos a 120 min
            if (segundosGrab >= 7200) pararGrabacion();
        }, 1000);

        mostrarToast('Grabación de video iniciada');

    } catch (err) {
        mostrarToast('No se pudo acceder a la cámara/micrófono');
        console.error(err);
    }
}

function pararGrabacion() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    mediaRecorder.stop();
    clearInterval(intervalTimer);

    // Ocultar overlay y preview
    grabacionOverlay.style.display = 'none';
    camaraPreview.style.display    = 'none';

    btnGrabarCam.classList.remove('grabando');
    iconGrabarCam.className = 'fas fa-video';

    mostrarToast('Grabación finalizada');
}

// ══════════════════════════════════════════════════════════════════
//  INFO DEL ARCHIVO
// ══════════════════════════════════════════════════════════════════
function actualizarInfoArchivo(file) {
    infoNada.style.display  = 'none';
    infoDatos.style.display = 'flex';
    datoPeso.textContent    = formatBytes(file.size);
    datoFormato.textContent = file.name.split('.').pop().toUpperCase();
    // Duración y resolución se rellenan en loadedmetadata
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
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
    }
    if (e.key === 'ArrowRight' && hayVideo && !esInput) {
        e.preventDefault();
        videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 5);
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
    if (hayVideo && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ══════════════════════════════════════════════════════════════════
//  GUARDAR NOTA (stub — sin fetch por ahora)
// ══════════════════════════════════════════════════════════════════
function guardarNota() {
    if (!hayVideo || !archivoOriginal) {
        mostrarToast('Carga o graba un video primero');
        return;
    }
    mostrarToast('Función de guardado próximamente disponible');
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
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (bytes < 1024)             return bytes + ' B';
    if (bytes < 1024 * 1024)      return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 ** 3)        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 ** 3)).toFixed(2) + ' GB';
}

let toastTimer = null;
function mostrarToast(msg) {
    const t = document.getElementById('toastVideo');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 3000);
}