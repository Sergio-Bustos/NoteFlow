// ══════════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════
let audioCtx        = null;
let audioBuffer     = null;
let archivoOriginal = null;
let sourceNode      = null;
let gainNode        = null;

// Nodos de efectos
let ecoNode         = null;
let convReverbNode  = null;
let bassFilterNode  = null;
let pitchNodes      = [];

let reproduciendo   = false;
let tiempoOffset    = 0;
let tiempoArranque  = 0;

let historial       = [];
let historialRedo   = [];

let notaGuardada    = false;
let hayAudio        = false;

// Efectos activos
const efectosActivos = new Set();

// Nodos de efectos en tiempo real
let nodoEco        = null;
let nodoEcoFeed    = null;
let nodoBass       = null;
let nodoReverb     = null;
let nodoReverbWet  = null;
let nodoReverbDry  = null;
let nodoNorm       = null;
let nodoGate       = null;
let pitchAcumulado = 0;

// Velocidad de reproducción
let velocidadActual = 1.0;

// Loop
let loopActivo = false;

// Marcadores
let marcadores = []; // [{tiempo, label}]
let marcadorContador = 1;

// Región seleccionada
let regionStart = null;
let regionEnd   = null;
let seleccionando = false;
let selXStart   = 0;

// Grabación
let mediaRecorder   = null;
let trozosGrabacion = [];
let intervalTimer   = null;
let segundosGrab    = 0;

// Visualizador en tiempo real
let analyserNode    = null;
let vizAnimId       = null;

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
const selectVelocidad  = document.getElementById('selectVelocidad');
const btnLoop          = document.getElementById('btnLoop');
const btnMarcador      = document.getElementById('btnMarcador');
const btnToggleEfectos = document.getElementById('btnToggleEfectos');
const efectosPanel     = document.getElementById('efectosPanel');
const regionInfo       = document.getElementById('regionInfo');
const regionTexto      = document.getElementById('regionTexto');
const regionSel        = document.getElementById('regionSel');
const btnRecortarRegion= document.getElementById('btnRecortarRegion');
const btnBorrarRegion  = document.getElementById('btnBorrarRegion');
const seekBarWrap      = document.getElementById('seekBarWrap');
const seekFill         = document.getElementById('seekFill');
const seekThumb        = document.getElementById('seekThumb');
const seekActual       = document.getElementById('seekActual');
const seekTotal        = document.getElementById('seekTotal');
const seekTrack        = document.getElementById('seekTrack');
const statsExtra       = document.getElementById('statsExtra');
const statCanales      = document.getElementById('statCanales');
const statDuracion     = document.getElementById('statDuracion');
const statPeso         = document.getElementById('statPeso');
const statFormato      = document.getElementById('statFormato');
const statBitrate      = document.getElementById('statBitrate');
const statEfectosActivos = document.getElementById('statEfectosActivos');
const txtEfectosActivos  = document.getElementById('txtEfectosActivos');
const marcadoresList     = document.getElementById('marcadoresList');
const btnExportar        = document.getElementById('btnExportar');
const vizCanvas          = document.getElementById('vizCanvas');
const spectroCanvas      = document.getElementById('spectroCanvas');

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

        // Analyser para visualización en tiempo real
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 512;
        gainNode.connect(analyserNode);
    }
    return audioCtx;
}

// ══════════════════════════════════════════════════════════════════
//  SLIDER DE VOLUMEN
// ══════════════════════════════════════════════════════════════════
function actualizarVolumen() {
    const val = parseInt(sliderVolumen.value);
    valVolumen.textContent = val + '%';
    if (val === 0) {
        iconVolumen.className = 'fas fa-volume-xmark';
    } else if (val < 40) {
        iconVolumen.className = 'fas fa-volume-low';
    } else {
        iconVolumen.className = 'fas fa-volume-high';
    }
    sliderVolumen.style.background =
        `linear-gradient(to right, #7c4dff ${val}%, #d1c4e9 ${val}%)`;
    if (gainNode) gainNode.gain.value = val / 100;
}
sliderVolumen.addEventListener('input', actualizarVolumen);
actualizarVolumen();

// ══════════════════════════════════════════════════════════════════
//  VELOCIDAD DE REPRODUCCIÓN
// ══════════════════════════════════════════════════════════════════
selectVelocidad.addEventListener('change', () => {
    velocidadActual = parseFloat(selectVelocidad.value);
    if (sourceNode && reproduciendo) {
        // Actualizar el rate en tiempo real sin reiniciar
        sourceNode.playbackRate.value = velocidadActual * Math.pow(2, pitchAcumulado / 12);
    }
    mostrarToast(`Velocidad: ${velocidadActual}×`);
});

// ══════════════════════════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════════════════════════
btnLoop.addEventListener('click', () => {
    loopActivo = !loopActivo;
    btnLoop.classList.toggle('activo', loopActivo);
    mostrarToast(loopActivo ? 'Loop activado 🔁' : 'Loop desactivado');
});

// ══════════════════════════════════════════════════════════════════
//  EFECTOS — panel toggle
// ══════════════════════════════════════════════════════════════════
btnToggleEfectos.addEventListener('click', () => {
    efectosPanel.classList.toggle('visible');
    btnToggleEfectos.classList.toggle('activo');
});

// ══════════════════════════════════════════════════════════════════
//  EFECTOS EN TIEMPO REAL
//  Cadena: sourceNode → cadenaEfectos[] → gainNode → destination
// ══════════════════════════════════════════════════════════════════

// Crear todos los nodos de efectos ligados al AudioContext
function crearNodosEfectos() {
    const ctx = getAudioCtx();

    // Eco — Delay con feedback
    nodoEco     = ctx.createDelay(2.0);
    nodoEco.delayTime.value = 0.3;
    nodoEcoFeed = ctx.createGain();
    nodoEcoFeed.gain.value = 0.35;
    nodoEco.connect(nodoEcoFeed);
    nodoEcoFeed.connect(nodoEco); // bucle de feedback

    // Bass Boost — filtro lowshelf
    nodoBass = ctx.createBiquadFilter();
    nodoBass.type = 'lowshelf';
    nodoBass.frequency.value = 150;
    nodoBass.gain.value = 10;

    // Reverb — convolución con IR sintético
    nodoReverb    = ctx.createConvolver();
    nodoReverbWet = ctx.createGain();
    nodoReverbDry = ctx.createGain();
    nodoReverbWet.gain.value = 0.45;
    nodoReverbDry.gain.value = 0.8;
    const sr     = ctx.sampleRate;
    const irLen  = Math.floor(sr * 2.5);
    const irBuf  = ctx.createBuffer(2, irLen, sr);
    for (let c = 0; c < 2; c++) {
        const d = irBuf.getChannelData(c);
        for (let i = 0; i < irLen; i++)
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
    }
    nodoReverb.buffer = irBuf;

    // Normalizar — GainNode que ajusta según pico máximo del buffer
    nodoNorm = ctx.createGain();
    nodoNorm.gain.value = 1.0;
    if (audioBuffer) {
        let max = 0;
        for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
            const data = audioBuffer.getChannelData(c);
            for (let i = 0; i < data.length; i++)
                if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
        }
        if (max > 0) nodoNorm.gain.value = 0.95 / max;
    }

    // Gate — DynamicsCompressor agresivo simula gate
    nodoGate = ctx.createDynamicsCompressor();
    nodoGate.threshold.value = -50;
    nodoGate.knee.value      = 0;
    nodoGate.ratio.value     = 20;
    nodoGate.attack.value    = 0.001;
    nodoGate.release.value   = 0.1;
}

// Reconectar toda la cadena de efectos al sourceNode
function reconectarCadenaEfectos() {
    if (!sourceNode || !audioBuffer) return;
    const ctx = getAudioCtx();

    // Desconectar absolutamente todo antes de reconstruir para evitar "caminos fantasmas"
    [sourceNode, nodoBass, nodoGate, nodoNorm, nodoReverbDry, nodoReverb, nodoReverbWet, nodoEco].forEach(nodo => {
        if (nodo) {
            try { nodo.disconnect(); } catch (e) {}
        }
    });

    // Ajustar pitch acumulado en el playbackRate actual
    sourceNode.playbackRate.value = velocidadActual * Math.pow(2, pitchAcumulado / 12);

    // Construir cadena de nodos activos
    let ultimo = sourceNode;

    // Bass boost
    if (efectosActivos.has('efBass') && nodoBass) {
        ultimo.connect(nodoBass);
        ultimo = nodoBass;
    }

    // Gate
    if (efectosActivos.has('efRuido') && nodoGate) {
        ultimo.connect(nodoGate);
        ultimo = nodoGate;
    }

    // Normalizar
    if (efectosActivos.has('efNormalize') && nodoNorm) {
        ultimo.connect(nodoNorm);
        ultimo = nodoNorm;
    }

    // Reverb (paralelo: dry + wet)
    if (efectosActivos.has('efReverb') && nodoReverb) {
        // dry path
        ultimo.connect(nodoReverbDry);
        nodoReverbDry.connect(gainNode);
        // wet path
        ultimo.connect(nodoReverb);
        nodoReverb.connect(nodoReverbWet);
        nodoReverbWet.connect(gainNode);
        return; // ya conectado a gainNode
    }

    // Eco (suma al señal principal)
    if (efectosActivos.has('efEco') && nodoEco) {
        ultimo.connect(nodoEco);
        nodoEco.connect(gainNode); // eco va al gain también
    }

    // Señal principal al gainNode
    ultimo.connect(gainNode);
}

function actualizarContadorEfectos() {
    const n = efectosActivos.size;
    if (n > 0) {
        statEfectosActivos.style.display = 'flex';
        txtEfectosActivos.textContent = `${n} efecto${n > 1 ? 's' : ''}`;
    } else {
        statEfectosActivos.style.display = 'none';
    }
}

function toggleEfectoActivo(id, btn) {
    if (efectosActivos.has(id)) {
        efectosActivos.delete(id);
        btn.classList.remove('activo');
    } else {
        efectosActivos.add(id);
        btn.classList.add('activo');
    }
    actualizarContadorEfectos();
    // Reconectar cadena en tiempo real si hay reproducción activa
    if (reproduciendo) reconectarCadenaEfectos();
}

// Efectos simples que van al toggle directo
const botonesEfecto = {
    efEco:       { label: 'Eco' },
    efBass:      { label: 'Bass Boost' },
    efReverb:    { label: 'Reverb' },
    efNormalize: { label: 'Normalizar' },
    efRuido:     { label: 'Gate' },
};

Object.entries(botonesEfecto).forEach(([id, cfg]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (!audioBuffer) { mostrarToast('Carga un audio primero'); return; }
        toggleEfectoActivo(id, btn);
        mostrarToast(efectosActivos.has(id) ? `${cfg.label} activado` : `${cfg.label} desactivado`);
    });
});

// Pitch acumulativo
document.getElementById('efPitch')?.addEventListener('click', () => {
    if (!audioBuffer) { mostrarToast('Carga un audio primero'); return; }
    pitchAcumulado += 2;
    if (reproduciendo) reconectarCadenaEfectos();
    efectosActivos.add('efPitch');
    document.getElementById('efPitch').classList.add('activo');
    actualizarContadorEfectos();
    mostrarToast(`Pitch: +${pitchAcumulado} semitonos`);
});

document.getElementById('efPitchDown')?.addEventListener('click', () => {
    if (!audioBuffer) { mostrarToast('Carga un audio primero'); return; }
    pitchAcumulado -= 2;
    if (pitchAcumulado === 0) {
        efectosActivos.delete('efPitch');
        document.getElementById('efPitchDown').classList.remove('activo');
        document.getElementById('efPitch').classList.remove('activo');
    } else {
        efectosActivos.add('efPitch');
    }
    if (reproduciendo) reconectarCadenaEfectos();
    actualizarContadorEfectos();
    mostrarToast(`Pitch: ${pitchAcumulado} semitonos`);
});


// ── NORMALIZAR (solo actualiza el gain del nodo, no modifica el buffer) ──
function aplicarNormalize() {
    if (!audioBuffer || !nodoNorm) return;
    let max = 0;
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const data = audioBuffer.getChannelData(c);
        for (let i = 0; i < data.length; i++)
            if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
    }
    if (max > 0) nodoNorm.gain.value = 0.95 / max;
}

// ══════════════════════════════════════════════════════════════════
//  MARCADORES
// ══════════════════════════════════════════════════════════════════
btnMarcador.addEventListener('click', () => {
    if (!audioBuffer) { mostrarToast('Carga un audio primero'); return; }
    const tiempo = tiempoOffset + (reproduciendo ? (audioCtx.currentTime - tiempoArranque) : 0);
    const label  = `M${marcadorContador++}`;
    marcadores.push({ tiempo, label });
    renderizarMarcadores();
    renderizarListaMarcadores();
    mostrarToast(`Marcador ${label} en ${formatTiempo(tiempo)}`);
});

function renderizarMarcadores() {
    // Quitar anteriores
    waveformWrap.querySelectorAll('.marcador-punto').forEach(el => el.remove());
    if (!audioBuffer) return;
    marcadores.forEach((m, idx) => {
        const pct = m.tiempo / audioBuffer.duration;
        const el  = document.createElement('div');
        el.className   = 'marcador-punto';
        el.style.left  = (pct * waveCanvas.width) + 'px';
        el.dataset.label = m.label;
        el.title       = `${m.label}: ${formatTiempo(m.tiempo)}`;
        el.addEventListener('click', () => {
            const estaba = reproduciendo;
            if (estaba) pausar();
            tiempoOffset = m.tiempo;
            actualizarPlayhead();
            if (estaba) play();
        });
        waveformWrap.appendChild(el);
    });
}

function renderizarListaMarcadores() {
    if (marcadores.length === 0) {
        marcadoresList.classList.remove('visible');
        return;
    }
    marcadoresList.classList.add('visible');
    marcadoresList.innerHTML = marcadores.map((m, i) => `
        <div class="marcador-item" onclick="irAMarcador(${i})">
            <i class="fas fa-flag" style="color:#ff7043; font-size:11px;"></i>
            <strong>${m.label}</strong>
            <span style="color:#a1887f; font-weight:600; font-size:11px;">${formatTiempo(m.tiempo)}</span>
            <button class="btn-del-marc" onclick="event.stopPropagation(); eliminarMarcador(${i})" title="Eliminar marcador">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function irAMarcador(idx) {
    if (!audioBuffer || idx >= marcadores.length) return;
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = marcadores[idx].tiempo;
    actualizarPlayhead();
    if (estaba) play();
}

function eliminarMarcador(idx) {
    marcadores.splice(idx, 1);
    renderizarMarcadores();
    renderizarListaMarcadores();
}

function actualizarPlayhead() {
    if (!audioBuffer) return;
    const pct = tiempoOffset / audioBuffer.duration;
    playheadEl.style.left        = (pct * waveCanvas.width) + 'px';
    datoTiempoActual.textContent = formatTiempo(tiempoOffset);
    actualizarSeekBar(tiempoOffset);
}

// ══════════════════════════════════════════════════════════════════
//  REGIÓN / RECORTE
// ══════════════════════════════════════════════════════════════════
waveCanvas.addEventListener('mousedown', (e) => {
    if (!audioBuffer) return;
    if (e.shiftKey) {
        seleccionando = true;
        const rect = waveCanvas.getBoundingClientRect();
        selXStart  = e.clientX - rect.left;
        regionStart = (selXStart / waveCanvas.width) * audioBuffer.duration;
        regionEnd   = regionStart;
        regionSel.style.display = 'block';
        regionSel.style.left    = selXStart + 'px';
        regionSel.style.width   = '0px';
    }
});

waveCanvas.addEventListener('mousemove', (e) => {
    if (!seleccionando || !audioBuffer) return;
    const rect   = waveCanvas.getBoundingClientRect();
    const xActual = e.clientX - rect.left;
    const x0 = Math.min(selXStart, xActual);
    const x1 = Math.max(selXStart, xActual);
    regionSel.style.left  = x0 + 'px';
    regionSel.style.width = (x1 - x0) + 'px';
    regionStart = (x0 / waveCanvas.width) * audioBuffer.duration;
    regionEnd   = (x1 / waveCanvas.width) * audioBuffer.duration;
    actualizarInfoRegion();
});

waveCanvas.addEventListener('mouseup', () => {
    if (!seleccionando) return;
    seleccionando = false;
    if (regionEnd - regionStart < 0.05) {
        limpiarRegion();
    } else {
        regionInfo.classList.add('visible');
        actualizarInfoRegion();
        mostrarToast('Región seleccionada. Puedes recortarla.');
    }
});

function actualizarInfoRegion() {
    if (regionStart == null || regionEnd == null) return;
    const dur = regionEnd - regionStart;
    regionTexto.textContent = `${formatTiempo(regionStart)} → ${formatTiempo(regionEnd)}  (${formatTiempo(dur)})`;
}

function limpiarRegion() {
    regionStart = null;
    regionEnd   = null;
    regionSel.style.display = 'none';
    regionInfo.classList.remove('visible');
}

btnBorrarRegion.addEventListener('click', limpiarRegion);

btnRecortarRegion.addEventListener('click', () => {
    if (!audioBuffer || regionStart == null || regionEnd == null) return;
    guardarHistorial();
    const sr      = audioBuffer.sampleRate;
    const ini     = Math.floor(regionStart * sr);
    const fin     = Math.floor(regionEnd   * sr);
    const newLen  = fin - ini;
    if (newLen <= 0) return;

    const offCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, newLen, sr);
    const src    = offCtx.createBufferSource();
    src.buffer   = audioBuffer;
    src.connect(offCtx.destination);
    src.start(0, regionStart, regionEnd - regionStart);
    offCtx.startRendering().then(rendered => {
        audioBuffer  = rendered;
        tiempoOffset = 0;
        limpiarRegion();
        dibujarOnda();
        dibujarRegla();
        actualizarInfoArchivo(archivoOriginal, true);
        mostrarToast('Audio recortado a la región seleccionada');
        renderizarMarcadores();
        actualizarSeekBarTotal();
    });
});

// ══════════════════════════════════════════════════════════════════
//  SEEK BAR (barra de progreso interactiva)
// ══════════════════════════════════════════════════════════════════
function actualizarSeekBar(tiempoActual) {
    if (!audioBuffer) return;
    const pct = tiempoActual / audioBuffer.duration;
    seekFill.style.width  = (pct * 100) + '%';
    seekThumb.style.left  = (pct * 100) + '%';
    seekActual.textContent = formatTiempo(tiempoActual);
}

function actualizarSeekBarTotal() {
    if (!audioBuffer) return;
    seekTotal.textContent = formatTiempo(audioBuffer.duration);
}

seekTrack.addEventListener('click', (e) => {
    if (!audioBuffer) return;
    const rect  = seekTrack.getBoundingClientRect();
    const pct   = (e.clientX - rect.left) / rect.width;
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = pct * audioBuffer.duration;
    actualizarPlayhead();
    actualizarSeekBar(tiempoOffset);
    if (estaba) play();
});

// ══════════════════════════════════════════════════════════════════
//  EXPORTAR
// ══════════════════════════════════════════════════════════════════
btnExportar.addEventListener('click', exportarAudio);

async function exportarAudio() {
    if (!audioBuffer) { mostrarToast('No hay audio para exportar'); return; }
    mostrarToast('Preparando exportación WAV...');
    try {
        const wav = audioBufferToWav(audioBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const titulo = document.getElementById('inputTitulo').value.trim() || 'audio_noteflow';
        a.href     = url;
        a.download = `${titulo}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        mostrarToast('Audio exportado como WAV ✓');
    } catch (e) {
        mostrarToast('Error al exportar el audio');
        console.error(e);
    }
}

// Convierte AudioBuffer a WAV (PCM 16-bit)
function audioBufferToWav(buffer) {
    const nCh    = buffer.numberOfChannels;
    const sr     = buffer.sampleRate;
    const len    = buffer.length;
    const result = new Int16Array(len * nCh);
    for (let ch = 0; ch < nCh; ch++) {
        const channelData = buffer.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            result[i * nCh + ch] = Math.max(-1, Math.min(1, channelData[i])) * 0x7FFF;
        }
    }
    const dataLen  = result.byteLength;
    const wavBuffer = new ArrayBuffer(44 + dataLen);
    const view     = new DataView(wavBuffer);
    const writeStr = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4,  36 + dataLen, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1,  true);
    view.setUint16(22, nCh, true);
    view.setUint32(24, sr,  true);
    view.setUint32(28, sr * nCh * 2, true);
    view.setUint16(32, nCh * 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataLen, true);
    const dataView = new Int16Array(wavBuffer, 44);
    dataView.set(result);
    return wavBuffer;
}

// ══════════════════════════════════════════════════════════════════
//  VISUALIZADOR EN TIEMPO REAL (barras animadas)
// ══════════════════════════════════════════════════════════════════
function iniciarVisualizador() {
    if (!analyserNode) return;
    vizCanvas.classList.add('visible');
    const ctx = vizCanvas.getContext('2d');
    const buf = new Uint8Array(analyserNode.frequencyBinCount);

    function drawViz() {
        vizAnimId = requestAnimationFrame(drawViz);
        analyserNode.getByteFrequencyData(buf);
        const W = vizCanvas.width  = vizCanvas.offsetWidth;
        const H = vizCanvas.height = 48;
        ctx.clearRect(0, 0, W, H);
        const barW = Math.max(2, (W / buf.length) * 2.5);
        const step  = Math.floor(buf.length / (W / (barW + 1)));
        let x = 0;
        for (let i = 0; i < buf.length; i += step) {
            const barH = (buf[i] / 255) * H;
            const hue  = 260 + (buf[i] / 255) * 40;
            ctx.fillStyle = `hsla(${hue}, 80%, 65%, 0.85)`;
            ctx.fillRect(x, H - barH, barW, barH);
            x += barW + 1;
        }
    }
    drawViz();
}

function detenerVisualizador() {
    if (vizAnimId) cancelAnimationFrame(vizAnimId);
    vizAnimId = null;
    vizCanvas.classList.remove('visible');
    const ctx = vizCanvas.getContext('2d');
    ctx.clearRect(0, 0, vizCanvas.width, vizCanvas.height);
}

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

    // Límite dinámico por plan
    const limAudio = window.PLAN_LIMITES?.audio ?? (200 * 1024 * 1024);
    const nomPlan  = window.PLAN_LIMITES?.nombre ?? 'Gratis';
    if (file.size > limAudio) {
        const limite = window.PLAN_LIMITES?.formatBytes(limAudio) ?? '200 MB';
        mostrarToast(`El archivo supera el límite de ${limite} para el plan ${nomPlan}. Mejora tu plan para subir archivos más grandes.`);
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
            efectosActivos.clear();
            pitchAcumulado = 0;
            // Nullify effect nodes so they are recreated with the new AudioContext/buffer
            nodoEco = nodoEcoFeed = nodoBass = nodoReverb = null;
            nodoReverbWet = nodoReverbDry = nodoNorm = nodoGate = null;
            actualizarContadorEfectos();
            document.querySelectorAll('.efecto-btn').forEach(b => b.classList.remove('activo'));
            marcadores = [];
            marcadorContador = 1;
            limpiarRegion();
            renderizarMarcadores();
            renderizarListaMarcadores();

            mostrarInterfazAudio(file);
            dibujarOnda();
            dibujarRegla();
            actualizarInfoArchivo(file);
            actualizarStatsExtra(file, buffer);
            habilitarControles();
            seekBarWrap.classList.add('visible');
            statsExtra.classList.add('visible');
            actualizarSeekBarTotal();
            mostrarToast('Audio cargado correctamente 🎵');
        }).catch(() => {
            mostrarToast('No se pudo decodificar el audio');
        });
    };
    reader.readAsArrayBuffer(file);
}

// RESTAURACIÓN PARA EDICIÓN
async function restaurarAudioExistente() {
    const url = document.getElementById('editAudioUrl')?.value;
    if (!url) return;
    try {
        const response = await fetch('/static/' + url);
        const blob     = await response.blob();
        const filename = url.split('/').pop();
        const file     = new File([blob], filename, { type: blob.type });
        cargarArchivo(file);
        notaGuardada = true;
    } catch (e) {
        console.error("Error al restaurar audio:", e);
    }
}
setTimeout(restaurarAudioExistente, 500);

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
    ctx.fillStyle = '#f0ecff';
    ctx.fillRect(0, 0, W, H);

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
        if (loopActivo) {
            pausar();
            tiempoOffset = 0;
            play();
            return;
        }
        detener();
        return;
    }

    const pct = tiempoActual / audioBuffer.duration;
    playheadEl.style.left        = (pct * waveCanvas.width) + 'px';
    datoTiempoActual.textContent = formatTiempo(tiempoActual);
    actualizarSeekBar(tiempoActual);
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
    sourceNode.buffer             = audioBuffer;
    sourceNode.playbackRate.value = velocidadActual * Math.pow(2, pitchAcumulado / 12);

    // Inicializar nodos de efectos si aún no existen o el contexto cambió
    if (!nodoEco || nodoEco.context !== ctx) {
        crearNodosEfectos();
    }

    // Conectar la cadena de efectos (o directo al gain si no hay efectos activos)
    reconectarCadenaEfectos();

    sourceNode.start(0, tiempoOffset);

    tiempoArranque     = ctx.currentTime;
    reproduciendo      = true;
    iconPlay.className = 'fas fa-pause';
    btnPlay.classList.add('playing');

    animarPlayhead();
    iniciarVisualizador();

    sourceNode.onended = () => {
        if (reproduciendo) detener();
    };
}

function pausar() {
    if (!reproduciendo) return;
    tiempoOffset += (audioCtx.currentTime - tiempoArranque) * velocidadActual;
    sourceNode?.stop();
    reproduciendo      = false;
    cancelAnimationFrame(animFrameId);
    iconPlay.className = 'fas fa-play';
    btnPlay.classList.remove('playing');
    detenerVisualizador();
}

function detener() {
    pausar();
    tiempoOffset = 0;
    playheadEl.style.left        = '0px';
    datoTiempoActual.textContent = formatTiempo(0);
    iconPlay.className           = 'fas fa-play';
    btnPlay.classList.remove('playing');
    actualizarSeekBar(0);
}

btnDetener.addEventListener('click', detener);

btnRetroceder.addEventListener('click', () => {
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = Math.max(0, tiempoOffset - 5);
    actualizarPlayhead();
    actualizarSeekBar(tiempoOffset);
    if (estaba) play();
});

btnIrInicio.addEventListener('click', () => {
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = 0;
    actualizarPlayhead();
    actualizarSeekBar(0);
    if (estaba) play();
});

btnIrFin.addEventListener('click', () => {
    if (!audioBuffer) return;
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = audioBuffer.duration;
    actualizarPlayhead();
    actualizarSeekBar(tiempoOffset);
});

// Clic en la onda para posicionar el playhead (sin Shift)
waveCanvas.addEventListener('click', (e) => {
    if (!audioBuffer || e.shiftKey) return;
    const rect   = waveCanvas.getBoundingClientRect();
    const x      = e.clientX - rect.left;
    const pct    = x / waveCanvas.width;
    const estaba = reproduciendo;
    if (estaba) pausar();
    tiempoOffset = pct * audioBuffer.duration;
    actualizarPlayhead();
    actualizarSeekBar(tiempoOffset);
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
        segundosGrab = 0;
        barraGrabacion.style.display = 'flex';
        btnGrabar.classList.add('grabando');
        iconGrabar.className = 'fas fa-square';

        intervalTimer = setInterval(() => {
            segundosGrab++;
            timerGrabEl.textContent = formatTiempo(segundosGrab);
            const maxSeg = window.PLAN_LIMITES?.grabacion ?? 10800;
            if (segundosGrab >= maxSeg) {
                pararGrabacion();
                mostrarToast(`Límite de grabación alcanzado (${window.PLAN_LIMITES?.formatSeg(maxSeg) ?? '3:00:00'}) para el plan ${window.PLAN_LIMITES?.nombre ?? 'Gratis'}.`);
            }
        }, 1000);
        mostrarToast('🔴 Grabación iniciada');
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
    mostrarToast('Grabación finalizada ✓');
}

// ══════════════════════════════════════════════════════════════════
//  INFO DEL ARCHIVO
// ══════════════════════════════════════════════════════════════════
function actualizarInfoArchivo(file, soloTiempo = false) {
    infoNada.style.display  = 'none';
    infoDatos.style.display = 'flex';
    if (!soloTiempo) {
        datoPeso.textContent    = formatBytes(file.size);
        datoFormato.textContent = file.name.split('.').pop().toUpperCase();
    }
    datoDuracion.textContent = formatTiempo(audioBuffer.duration);
}

function actualizarStatsExtra(file, buffer) {
    const nCh = buffer.numberOfChannels;
    statCanales.textContent  = nCh === 1 ? 'Mono' : 'Estéreo';
    statDuracion.textContent = formatTiempo(buffer.duration);
    statPeso.textContent     = formatBytes(file.size);
    statFormato.textContent  = file.name.split('.').pop().toUpperCase();
    // Bitrate estimado (kbps)
    const kbps = Math.round((file.size * 8) / buffer.duration / 1000);
    statBitrate.textContent  = kbps + ' kbps (~)';
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

// ══════════════════════════════════════════════════════════════════
//  ATAJOS DE TECLADO
// ══════════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); btnDeshacer.click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); btnRehacer.click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); guardarNota(); }

    const tag     = document.activeElement?.tagName;
    const esInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
                    || document.activeElement?.isContentEditable;

    if (e.key === ' ' && hayAudio && !esInput) {
        e.preventDefault();
        btnPlay.click();
    }
    // M = marcador
    if (e.key === 'm' && hayAudio && !esInput) {
        e.preventDefault();
        btnMarcador.click();
    }
    // L = loop
    if (e.key === 'l' && hayAudio && !esInput) {
        e.preventDefault();
        btnLoop.click();
    }
    // Flechas izquierda/derecha: retroceder/adelantar 5s
    if (e.key === 'ArrowLeft' && hayAudio && !esInput) {
        e.preventDefault();
        btnRetroceder.click();
    }
    if (e.key === 'ArrowRight' && hayAudio && !esInput) {
        e.preventDefault();
        const estaba = reproduciendo;
        if (estaba) pausar();
        tiempoOffset = Math.min(audioBuffer.duration, tiempoOffset + 5);
        actualizarPlayhead();
        actualizarSeekBar(tiempoOffset);
        if (estaba) play();
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

    const editId   = document.getElementById('editNotaId')?.value;
    const isUpdate = !!editId;
    const url      = isUpdate ? `/actualizar-nota-audio/${editId}` : '/guardar-nota-audio';

    const formData = new FormData();
    formData.append('titulo',      titulo);
    formData.append('descripcion', descripcion);
    formData.append('etiquetas',   etiquetas);
    formData.append('audio',       archivoOriginal, archivoOriginal.name);

    try {
        const resp = await fetch(url, { method: 'POST', body: formData });
        const data = await resp.json();

        if (data.success) {
            notaGuardada = true;
            mostrarToast(data.mensaje || 'Nota guardada correctamente ✓');
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
        mostrarToast('Error de conexión');
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
    seg = Math.max(0, seg);
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
    renderizarMarcadores();
});