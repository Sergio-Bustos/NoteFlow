// ══════════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════
let audioCtx        = null;
let audioBuffer     = null;
let archivoOriginal = null;
let sourceNode      = null;
let gainNode        = null;

let reproduciendo   = false;
let tiempoOffset    = 0;
let tiempoArranque  = 0;

let historial       = [];
let historialRedo   = [];

let notaGuardada    = false;
let hayAudio        = false;

// Grabación
let mediaRecorder   = null;
let trozosGrabacion = [];
let intervalTimer   = null;
let segundosGrab    = 0;

// ══════════════════════════════════════════════════════════════════
//  REFERENCIAS DOM
// ══════════════════════════════════════════════════════════════════
const btnPlay          = document.getElementById('btnPlay');
const btnDetener       = document.getElementById('btnDetener');
const btnGrabar        = document.getElementById('btnGrabar');
const btnRetroceder    = document.getElementById('btnRetroceder');
const btnIrInicio      = document.getElementById('btnIrInicio');
const btnIrFin         = document.getElementById('btnIrFin');
const btnDeshacer      = document.getElementById('btnDeshacer');
const btnRehacer       = document.getElementById('btnRehacer');
const btnGuardarTop    = document.getElementById('btnGuardarTop');
const btnGuardarBottom = document.getElementById('btnGuardarBottom');
const iconPlay         = document.getElementById('iconPlay');
const iconGrabar       = document.getElementById('iconGrabar');
const ondaPlaceholder  = document.getElementById('ondaPlaceholder');
const waveformWrap     = document.getElementById('waveformWrap');
const waveCanvas       = document.getElementById('waveCanvas');
const reglaCanvas      = document.getElementById('reglaCanvas');
const playheadEl       = document.getElementById('playhead');
const trackLabelEl     = document.getElementById('trackLabel');
const infoDatos        = document.getElementById('infoDatos');
const infoNada         = document.getElementById('infoNada');
const datoDuracion     = document.getElementById('datoDuracion');
const datoPeso         = document.getElementById('datoPeso');
const datoFormato      = document.getElementById('datoFormato');
const datoTiempoActual = document.getElementById('datoTiempoActual');
const inputAudio       = document.getElementById('inputAudio');
const btnEmpezarGrabar = document.getElementById('btnEmpezarGrabar');
const barraGrabacion   = document.getElementById('barraGrabacion');
const btnDetenerGrab   = document.getElementById('btnDetenerGrabacion');
const timerGrabEl      = document.getElementById('timerGrabacion');
const sliderVolumen    = document.getElementById('sliderVolumen');
const valVolumen       = document.getElementById('valVolumen');
const iconVolumen      = document.getElementById('iconVolumen');

let animFrameId = null;

// ══════════════════════════════════════════════════════════════════
//  AUDIO CONTEXT
// ══════════════════════════════════════════════════════════════════
function getAudioCtx() {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        gainNode.gain.value = parseInt(sliderVolumen.value) / 100;
        gainNode.connect(audioCtx.destination);
    }
    return audioCtx;
}

// ══════════════════════════════════════════════════════════════════
//  SLIDER DE VOLUMEN
// ══════════════════════════════════════════════════════════════════
function actualizarVolumen() {
    const val = parseInt(sliderVolumen.value);

    // Etiqueta
    valVolumen.textContent = val + '%';

    // Icono dinámico
    if (val === 0) {
        iconVolumen.className = 'fas fa-volume-xmark';
    } else if (val < 40) {
        iconVolumen.className = 'fas fa-volume-low';
    } else {
        iconVolumen.className = 'fas fa-volume-high';
    }

    // Relleno de la barra (morado progresivo)
    sliderVolumen.style.background =
        `linear-gradient(to right, #7c4dff ${val}%, #d1c4e9 ${val}%)`;

    // Aplicar al GainNode si existe
    if (gainNode) gainNode.gain.value = val / 100;
}

sliderVolumen.addEventListener('input', actualizarVolumen);

// Inicializar visual
actualizarVolumen();

// ══════════════════════════════════════════════════════════════════
//  CARGA DE ARCHIVO
// ══════════════════════════════════════════════════════════════════
inputAudio.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    cargarArchivo(file);
});

function cargarArchivo(file) {
    const tiposPermitidos = [
        'audio/mpeg','audio/mp3','audio/aac','audio/ogg','audio/wav',
        'audio/flac','audio/x-flac','audio/wma','audio/x-ms-wma',
        'audio/mp4','audio/x-m4a','audio/webm','video/webm'
    ];
    const extPermitidas = ['.mp3','.aac','.ogg','.wav','.flac','.wma','.m4a','.webm'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!tiposPermitidos.includes(file.type) && !extPermitidas.includes(ext)) {
        mostrarToast('Formato no permitido. Usa: MP3, AAC, OGG, WAV, FLAC, WMA, M4A');
        return;
    }

    if (file.size > 200 * 1024 * 1024) {
        mostrarToast('El archivo supera el límite de 200 MB');
        return;
    }

    archivoOriginal = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const ctx = getAudioCtx();
        ctx.decodeAudioData(ev.target.result.slice(0)).then(buffer => {
            guardarHistorial();
            audioBuffer  = buffer;
            tiempoOffset = 0;
            hayAudio     = true;
            notaGuardada = false;

            mostrarInterfazAudio(file);
            dibujarOnda();
            dibujarRegla();
            actualizarInfoArchivo(file);
            habilitarControles();
            mostrarToast('Audio cargado correctamente');
        }).catch(() => {
            mostrarToast('No se pudo decodificar el audio');
        });
    };
    reader.readAsArrayBuffer(file);
}

// ══════════════════════════════════════════════════════════════════
//  MOSTRAR INTERFAZ TRAS CARGAR AUDIO
// ══════════════════════════════════════════════════════════════════
function mostrarInterfazAudio(file) {
    ondaPlaceholder.style.display = 'none';
    reglaCanvas.style.display     = 'block';
    waveformWrap.style.display    = 'block';
    trackLabelEl.textContent      = file.name.replace(/\.[^.]+$/, '');

    waveCanvas.width  = waveformWrap.clientWidth  || 900;
    waveCanvas.height = waveformWrap.clientHeight || 200;
    reglaCanvas.width = waveCanvas.width;
}

function habilitarControles() {
    btnPlay.disabled    = false;
    btnDetener.disabled = false;
}

// ══════════════════════════════════════════════════════════════════
//  DIBUJAR FORMA DE ONDA
// ══════════════════════════════════════════════════════════════════
function dibujarOnda() {
    if (!audioBuffer) return;
    const W   = waveCanvas.width;
    const H   = waveCanvas.height;
    const ctx = waveCanvas.getContext('2d');

    ctx.clearRect(0, 0, W, H);

    // Fondo
    ctx.fillStyle = '#f0ecff';
    ctx.fillRect(0, 0, W, H);

    // Cuadrícula sutil
    ctx.strokeStyle = 'rgba(180,160,230,0.25)';
    ctx.lineWidth   = 1;
    for (let y = 0; y <= H; y += H / 4) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const nCanales    = Math.min(audioBuffer.numberOfChannels, 2);
    const alturaCanal = H / nCanales;

    for (let c = 0; c < nCanales; c++) {
        const datos  = audioBuffer.getChannelData(c);
        const paso   = Math.floor(datos.length / W);
        const yBase  = c * alturaCanal + alturaCanal / 2;
        const escala = alturaCanal * 0.46;

        const grad = ctx.createLinearGradient(0, c * alturaCanal, 0, (c + 1) * alturaCanal);
        grad.addColorStop(0,   '#a78bfa');
        grad.addColorStop(0.5, '#7c4dff');
        grad.addColorStop(1,   '#5c3ca6');

        ctx.beginPath();
        ctx.moveTo(0, yBase);

        for (let x = 0; x < W; x++) {
            let max = 0;
            const ini = x * paso;
            for (let i = ini; i < ini + paso && i < datos.length; i++) {
                if (Math.abs(datos[i]) > max) max = Math.abs(datos[i]);
            }
            ctx.lineTo(x, yBase - max * escala);
        }
        for (let x = W - 1; x >= 0; x--) {
            let max = 0;
            const ini = x * paso;
            for (let i = ini; i < ini + paso && i < datos.length; i++) {
                if (Math.abs(datos[i]) > max) max = Math.abs(datos[i]);
            }
            ctx.lineTo(x, yBase + max * escala);
        }

        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        if (nCanales > 1 && c < nCanales - 1) {
            ctx.strokeStyle = 'rgba(180,160,230,0.4)';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(0, (c + 1) * alturaCanal);
            ctx.lineTo(W, (c + 1) * alturaCanal);
            ctx.stroke();
        }
    }
}

// ══════════════════════════════════════════════════════════════════
//  DIBUJAR REGLA DE TIEMPO
// ══════════════════════════════════════════════════════════════════
function dibujarRegla() {
    if (!audioBuffer) return;
    const W   = reglaCanvas.width;
    const H   = 28;
    const ctx = reglaCanvas.getContext('2d');
    const dur = audioBuffer.duration;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ede7f6';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle    = '#5c3ca6';
    ctx.font         = '700 10px Nunito, sans-serif';
    ctx.textBaseline = 'top';

    const paso = calcularPasoRegla(dur, W);
    for (let t = 0; t <= dur; t += paso) {
        const x = (t / dur) * W;
        ctx.fillStyle = '#b39ddb';
        ctx.fillRect(x, H - 8, 1, 8);
        if (x > 4) {
            ctx.fillStyle = '#5c3ca6';
            ctx.fillText(formatTiempo(t), x + 2, 2);
        }
    }
}

function calcularPasoRegla(dur, W) {
    const pixPorSeg = W / dur;
    const pasos = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    for (const p of pasos) {
        if (pixPorSeg * p >= 60) return p;
    }
    return 300;
}

// ══════════════════════════════════════════════════════════════════
//  PLAYHEAD ANIMACIÓN
// ══════════════════════════════════════════════════════════════════
function animarPlayhead() {
    if (!reproduciendo || !audioBuffer) return;

    const elapsed      = audioCtx.currentTime - tiempoArranque;
    const tiempoActual = tiempoOffset + elapsed;

    if (tiempoActual >= audioBuffer.duration) {
        detener();
        return;
    }

    const pct = tiempoActual / audioBuffer.duration;
    playheadEl.style.left = (pct * waveCanvas.width) + 'px';
    datoTiempoActual.textContent = formatTiempo(tiempoActual);
    animFrameId = requestAnimationFrame(animarPlayhead);
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLES DE REPRODUCCIÓN
// ══════════════════════════════════════════════════════════════════
btnPlay.addEventListener('click', () => {
    if (!audioBuffer) return;
    if (reproduciendo) pausar();
    else               play();
});

function play() {
    if (!audioBuffer) return;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    const ctx  = getAudioCtx();
    sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(gainNode);
    sourceNode.start(0, tiempoOffset);

    tiempoArranque     = ctx.currentTime;
    reproduciendo      = true;
    iconPlay.className = 'fas fa-pause';
    btnPlay.classList.add('playing');

    animarPlayhead();

    sourceNode.onended = () => {
        if (reproduciendo) detener();
    };
}

function pausar() {
    if (!reproduciendo) return;
    tiempoOffset += audioCtx.currentTime - tiempoArranque;
    sourceNode?.stop();
    reproduciendo      = false;
    cancelAnimationFrame(animFrameId);
    iconPlay.className = 'fas fa-play';
    btnPlay.classList.remove('playing');
}

function detener() {
    pausar();
    tiempoOffset = 0;
    playheadEl.style.left        = '0px';
    datoTiempoActual.textContent = formatTiempo(0);
    iconPlay.className           = 'fas fa-play';
    btnPlay.classList.remove('playing');
}

btnDetener.addEventListener('click', detener);

btnRetroceder.addEventListener('click', () => {
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = Math.max(0, tiempoOffset - 5);
    const pct    = audioBuffer ? tiempoOffset / audioBuffer.duration : 0;
    playheadEl.style.left        = (pct * waveCanvas.width) + 'px';
    datoTiempoActual.textContent = formatTiempo(tiempoOffset);
    if (estaba) play();
});

btnIrInicio.addEventListener('click', () => {
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = 0;
    playheadEl.style.left        = '0px';
    datoTiempoActual.textContent = formatTiempo(0);
    if (estaba) play();
});

btnIrFin.addEventListener('click', () => {
    if (!audioBuffer) return;
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = audioBuffer.duration;
    playheadEl.style.left        = waveCanvas.width + 'px';
    datoTiempoActual.textContent = formatTiempo(tiempoOffset);
});

// Clic en la onda para posicionar el playhead
waveCanvas.addEventListener('click', (e) => {
    if (!audioBuffer) return;
    const rect   = waveCanvas.getBoundingClientRect();
    const x      = e.clientX - rect.left;
    const pct    = x / waveCanvas.width;
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = pct * audioBuffer.duration;
    playheadEl.style.left        = x + 'px';
    datoTiempoActual.textContent = formatTiempo(tiempoOffset);
    if (estaba) play();
});

// ══════════════════════════════════════════════════════════════════
//  GRABACIÓN DESDE MICRÓFONO
// ══════════════════════════════════════════════════════════════════
btnGrabar.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        pararGrabacion();
    } else {
        iniciarGrabacion();
    }
});

btnEmpezarGrabar.addEventListener('click', iniciarGrabacion);
btnDetenerGrab.addEventListener('click',   pararGrabacion);

async function iniciarGrabacion() {
    try {
        const stream    = await navigator.mediaDevices.getUserMedia({ audio: true });
        trozosGrabacion = [];
        mediaRecorder   = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) trozosGrabacion.push(e.data);
        };

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(trozosGrabacion, { type: 'audio/webm' });
            if (blob.size > 200 * 1024 * 1024) {
                mostrarToast('La grabación supera el límite de 200 MB');
                return;
            }
            const file = new File([blob], `grabacion_${Date.now()}.webm`, { type: 'audio/webm' });
            cargarArchivo(file);
            archivoOriginal = file;
        };

        mediaRecorder.start(100);
        segundosGrab              = 0;
        barraGrabacion.style.display = 'flex';
        btnGrabar.classList.add('grabando');
        iconGrabar.className = 'fas fa-square';

        intervalTimer = setInterval(() => {
            segundosGrab++;
            timerGrabEl.textContent = formatTiempo(segundosGrab);
            if (segundosGrab >= 10800) pararGrabacion();
        }, 1000);

        mostrarToast('Grabación iniciada');
    } catch (err) {
        mostrarToast('No se pudo acceder al micrófono');
        console.error(err);
    }
}

function pararGrabacion() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    mediaRecorder.stop();
    clearInterval(intervalTimer);
    barraGrabacion.style.display = 'none';
    btnGrabar.classList.remove('grabando');
    iconGrabar.className = 'fas fa-circle';
    mostrarToast('Grabación finalizada');
}

// ══════════════════════════════════════════════════════════════════
//  INFO DEL ARCHIVO
// ══════════════════════════════════════════════════════════════════
function actualizarInfoArchivo(file) {
    infoNada.style.display  = 'none';
    infoDatos.style.display = 'flex';
    datoDuracion.textContent = formatTiempo(audioBuffer.duration);
    datoPeso.textContent     = formatBytes(file.size);
    datoFormato.textContent  = file.name.split('.').pop().toUpperCase();
}

// ══════════════════════════════════════════════════════════════════
//  DESHACER / REHACER
// ══════════════════════════════════════════════════════════════════
function guardarHistorial() {
    if (!audioBuffer) return;
    if (historial.length >= 20) historial.shift();
    historial.push({ buffer: audioBuffer, offset: tiempoOffset });
    historialRedo        = [];
    btnDeshacer.disabled = false;
    btnRehacer.disabled  = true;
}

btnDeshacer.addEventListener('click', () => {
    if (historial.length === 0) return;
    historialRedo.push({ buffer: audioBuffer, offset: tiempoOffset });
    const estado  = historial.pop();
    audioBuffer   = estado.buffer;
    tiempoOffset  = estado.offset;
    dibujarOnda();
    dibujarRegla();
    btnRehacer.disabled  = historialRedo.length === 0;
    btnDeshacer.disabled = historial.length === 0;
    mostrarToast('Deshacer aplicado');
});

btnRehacer.addEventListener('click', () => {
    if (historialRedo.length === 0) return;
    historial.push({ buffer: audioBuffer, offset: tiempoOffset });
    const estado  = historialRedo.pop();
    audioBuffer   = estado.buffer;
    tiempoOffset  = estado.offset;
    dibujarOnda();
    dibujarRegla();
    btnDeshacer.disabled = historial.length === 0;
    btnRehacer.disabled  = historialRedo.length === 0;
    mostrarToast('Rehacer aplicado');
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); btnDeshacer.click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); btnRehacer.click(); }

    // Espacio solo reproduce/pausa si el foco NO está en un campo de texto
    const tag = document.activeElement?.tagName;
    const esInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
                    || document.activeElement?.isContentEditable;
    if (e.key === ' ' && hayAudio && !esInput) {
        e.preventDefault();
        btnPlay.click();
    }
});

// ══════════════════════════════════════════════════════════════════
//  MODAL SALIDA SIN GUARDAR
// ══════════════════════════════════════════════════════════════════
let urlDestino = null;

document.getElementById('btnVolver').addEventListener('click', (e) => {
    if (hayAudio && !notaGuardada) {
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
    if (hayAudio && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ══════════════════════════════════════════════════════════════════
//  GUARDAR NOTA EN BACKEND
// ══════════════════════════════════════════════════════════════════
async function guardarNota() {
    if (!hayAudio || !archivoOriginal) {
        mostrarToast('Carga o graba un audio primero');
        return;
    }

    const titulo      = document.getElementById('inputTitulo').value.trim()      || 'Audio sin título';
    const descripcion = document.getElementById('inputDescripcion').value.trim() || '';
    const etiquetas   = document.getElementById('inputEtiquetas').value.trim();

    const btns = [btnGuardarTop, btnGuardarBottom];
    btns.forEach(b => {
        b.disabled  = true;
        b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    });

    const formData = new FormData();
    formData.append('titulo',      titulo);
    formData.append('descripcion', descripcion);
    formData.append('etiquetas',   etiquetas);
    formData.append('audio',       archivoOriginal, archivoOriginal.name);

    try {
        const resp = await fetch('/guardar-nota-audio', { method: 'POST', body: formData });
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
        btns.forEach(b => {
            b.disabled  = false;
            b.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar nota';
        });
    }
}

btnGuardarTop.addEventListener('click',    guardarNota);
btnGuardarBottom.addEventListener('click', guardarNota);

// ══════════════════════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════════════════════
function formatTiempo(seg) {
    const m = Math.floor(seg / 60);
    const s = Math.floor(seg % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

let toastTimer = null;
function mostrarToast(msg) {
    const t = document.getElementById('toastAudio');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 3000);
}

// ══════════════════════════════════════════════════════════════════
//  REDIMENSIÓN
// ══════════════════════════════════════════════════════════════════
window.addEventListener('resize', () => {
    if (!audioBuffer) return;
    waveCanvas.width  = waveformWrap.clientWidth;
    waveCanvas.height = waveformWrap.clientHeight;
    reglaCanvas.width = waveCanvas.width;
    dibujarOnda();
    dibujarRegla();
});