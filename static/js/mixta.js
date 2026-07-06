// ══════════════════════════════════════════════════════════════════
//  mixta.js — Editor de Nota Mixta NoteFlow
//  Patrón idéntico a logicatexto.js + manejo de archivos multimedia
// ══════════════════════════════════════════════════════════════════

// ── Límites (dinámicos por plan, con fallback a los valores originales) ────────────────────
const LIMITES = {
    imagen: {
        maxBytes: window.PLAN_LIMITES?.imagen ?? (200 * 1024 * 1024),
        exts: new Set(['.jpg','.jpeg','.png','.gif','.webp','.svg','.pntg','.wmf'])
    },
    audio: {
        maxBytes: window.PLAN_LIMITES?.audio ?? (200 * 1024 * 1024),
        exts: new Set(['.mp3','.aac','.ogg','.wav','.flac','.wma','.m4a','.webm'])
    },
    video: {
        maxBytes: window.PLAN_LIMITES?.video ?? (2 * 1024 * 1024 * 1024),
        exts: new Set(['.mp4','.webm','.ogg','.mkv','.wmv','.mov','.avi'])
    },
};

const LIMITE_CARACTERES_TEXTO = window.PLAN_LIMITES?.texto ?? 5000;

function actualizarContadorTextoMixta() {
    const editor = document.getElementById('cuerpo-nota');
    const contador = document.getElementById('char-count');
    const limite = document.getElementById('char-limit');
    if (!editor || !contador || !limite) return;

    const longitud = editor.innerText.length;
    contador.textContent = longitud.toLocaleString();
    limite.textContent = LIMITE_CARACTERES_TEXTO.toLocaleString();

    contador.style.color = longitud > LIMITE_CARACTERES_TEXTO ? '#d64550' : '#5f40d4';
}

function verificarLimiteTextoMixta() {
    const editor = document.getElementById('cuerpo-nota');
    if (!editor) return true;

    const longitud = editor.innerText.length;
    if (longitud > LIMITE_CARACTERES_TEXTO) {
        mostrarToast(`Has superado el límite de ${LIMITE_CARACTERES_TEXTO.toLocaleString()} caracteres para tu plan ${window.PLAN_LIMITES?.nombre || 'Gratis'}.`, 'error');
        return false;
    }
    return true;
}

// ══════════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════
let notaGuardada = false;
let urlDestino   = null;
let hayContenido = false;

const archivos = { imagenes: [], audios: [], videos: [] };  // [{file, id}]

let idCounter = 0;
const nuevoId = () => ++idCounter;

// ── Total de archivos adjuntos actualmente en la nota ────────────────
function totalArchivos() {
    // Contar nuevos (en memoria) + existentes (ya guardados en BD, con preview-existente)
    const nuevos = archivos.imagenes.length + archivos.audios.length + archivos.videos.length;
    const existentes = document.querySelectorAll('.preview-existente, .archivo-item.existente').length;
    return nuevos + existentes;
}

function totalPorTipo(tipo) {
    const idx = { imagenes: 'imagenes', audios: 'audios', videos: 'videos' }[tipo];
    const nuevos = idx ? archivos[idx].length : 0;
    const containers = {
        imagenes: '#gridImagenes .preview-existente',
        audios:   '#listaAudios .archivo-item.existente',
        videos:   '#listaVideos .archivo-item.existente',
    };
    const existentes = document.querySelectorAll(containers[tipo] || '').length;
    return nuevos + existentes;
}

function limiteAdjuntos() {
    return window.PLAN_LIMITES?.maxAdjuntosMixta ?? 3;
}

function limitePorTipo(tipo) {
    const map = { imagenes: 'maxImagenesMixta', audios: 'maxAudiosMixta', videos: 'maxVideosMixta' };
    return window.PLAN_LIMITES?.[map[tipo]] ?? 3;
}

function verificarLimite(tipo, cantidadNueva = 1) {
    // Verificar límite total
    const max   = limiteAdjuntos();
    const total = totalArchivos();
    if (total + cantidadNueva > max) {
        const plan = window.PLAN_LIMITES?.nombre ?? 'Gratis';
        mostrarToast(`Límite de ${max} archivos por nota mixta alcanzado (Plan ${plan}). Elimina un archivo o mejora tu plan.`, 'error');
        return false;
    }
    // Verificar límite por tipo
    const maxTipo = limitePorTipo(tipo);
    const totalTipo = totalPorTipo(tipo);
    if (totalTipo + cantidadNueva > maxTipo) {
        const plan = window.PLAN_LIMITES?.nombre ?? 'Gratis';
        const nombres = { imagenes: 'imágenes', audios: 'audios', videos: 'videos' };
        mostrarToast(`Límite de ${maxTipo} ${nombres[tipo] || tipo} por nota mixta alcanzado (Plan ${plan}). Elimina un archivo o mejora tu plan.`, 'error');
        return false;
    }
    return true;
}

// Grabación audio
let mediaRecAudio = null, trozosAudio = [], intervalAudio = null, segsAudio = 0;

// Grabación video
let mediaRecVideo = null, trozosVideo = [], intervalVideo = null, segsVideo = 0;
let grabandoVideo = false;

let toastTimer = null;

// ══════════════════════════════════════════════════════════════════
//  TABS
// ══════════════════════════════════════════════════════════════════
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
        document.querySelectorAll('.seccion-tab').forEach(s => s.classList.remove('activo'));
        btn.classList.add('activo');
        document.getElementById(`tab-${tab}`).classList.add('activo');
    });
});

// ══════════════════════════════════════════════════════════════════
//  TEMA (igual que logicatexto.js)
// ══════════════════════════════════════════════════════════════════
(function aplicarTema() {
    const match = document.cookie.split(';').find(c => c.trim().startsWith('tema='));
    if (!match) return;
    const esOscuro = match.split('=')[1]?.trim() === 'Negro';
    document.body.classList.toggle('tema-oscuro', esOscuro);
    document.body.classList.toggle('tema-claro',  !esOscuro);
})();

window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    const match = document.cookie.split(';').find(c => c.trim().startsWith('tema='));
    if (!match) return;
    const esOscuro = match.split('=')[1]?.trim() === 'Negro';
    document.body.classList.toggle('tema-oscuro', esOscuro);
    document.body.classList.toggle('tema-claro',  !esOscuro);
});

// ══════════════════════════════════════════════════════════════════
//  TOOLBAR DE TEXTO (idéntico a logicatexto.js)
// ══════════════════════════════════════════════════════════════════
function fmt(comando, e) {
    if (e) e.preventDefault();
    document.execCommand(comando, false, null);
    document.getElementById('cuerpo-nota').focus();
}

function cambiarTamano(valor) {
    if (!valor) return;
    document.execCommand('fontSize', false, valor);
    document.getElementById('cuerpo-nota').focus();
}

function cambiarColor(color) {
    document.execCommand('foreColor', false, color);
    const visual = document.getElementById('colorMuestra');
    if (visual) visual.style.backgroundColor = color;
    document.getElementById('cuerpo-nota').focus();
}

const cuerpoNota = document.getElementById('cuerpo-nota');
if (cuerpoNota) {
    cuerpoNota.addEventListener('input', () => {
        hayContenido = true;
        notaGuardada = false;
        actualizarContadorTextoMixta();
        verificarLimiteTextoMixta();
    });

    // Inicializar contador en caso de que el contenido venga precargado
    actualizarContadorTextoMixta();
}

// ══════════════════════════════════════════════════════════════════
//  VALIDACIÓN GENÉRICA
// ══════════════════════════════════════════════════════════════════
function validarArchivo(file, tipo) {
    const lim = LIMITES[tipo];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!lim.exts.has(ext)) return `Formato no permitido (${ext}) para ${tipo}`;
    if (file.size > lim.maxBytes) {
        const nomPlan = window.PLAN_LIMITES?.nombre ?? 'Gratis';
        return `"${file.name}" supera el límite de ${formatBytes(lim.maxBytes)} para el plan ${nomPlan}`;
    }
    if (file.size === 0)          return `"${file.name}" está vacío`;
    return null;
}

// ══════════════════════════════════════════════════════════════════
//  IMÁGENES
// ══════════════════════════════════════════════════════════════════
document.getElementById('inputImagenes').addEventListener('change', e => {
    procesarImagenes([...e.target.files]);
    e.target.value = '';
});

configurarDrop('zonaDropImg', files =>
    procesarImagenes(files.filter(f =>
        LIMITES.imagen.exts.has(f.name.toLowerCase().slice(f.name.lastIndexOf('.')))
    ))
);

function procesarImagenes(files) {
    files.forEach(file => {
        if (!verificarLimite('imagenes', 1)) return;
        const err = validarArchivo(file, 'imagen');
        if (err) { mostrarToast(err, 'error'); return; }
        const id = nuevoId();
        archivos.imagenes.push({ file, id });
        hayContenido = true; notaGuardada = false;
        const reader = new FileReader();
        reader.onload = ev => agregarPreviewImagen(ev.target.result, file.name, id);
        reader.readAsDataURL(file);
    });
    actualizarChips();
}

function agregarPreviewImagen(src, nombre, id) {
    const grid = document.getElementById('gridImagenes');
    const card = document.createElement('div');
    card.className  = 'preview-card';
    card.dataset.id = id;
    card.innerHTML  = `
        <img src="${src}" alt="${nombre}">
        <button class="btn-quitar-prev" title="Quitar"><i class="fas fa-times"></i></button>
        <div class="nombre-prev">${nombre}</div>
    `;
    card.querySelector('.btn-quitar-prev').onclick = () => {
        archivos.imagenes = archivos.imagenes.filter(i => i.id !== id);
        card.remove();
        actualizarChips();
    };
    grid.appendChild(card);
}

// ══════════════════════════════════════════════════════════════════
//  AUDIOS
// ══════════════════════════════════════════════════════════════════
document.getElementById('inputAudios').addEventListener('change', e => {
    procesarAudios([...e.target.files]);
    e.target.value = '';
});

configurarDrop('zonaDropAud', files => procesarAudios(files));

function procesarAudios(files) {
    files.forEach(file => {
        if (!verificarLimite('audios', 1)) return;
        const err = validarArchivo(file, 'audio');
        if (err) { mostrarToast(err, 'error'); return; }
        const id = nuevoId();
        archivos.audios.push({ file, id });
        hayContenido = true; notaGuardada = false;
        agregarItemArchivo('listaAudios', file, id, 'fas fa-music', () => {
            archivos.audios = archivos.audios.filter(a => a.id !== id);
            actualizarChips();
        });
    });
    actualizarChips();
}

// Grabación de audio
document.getElementById('btnGrabarAudio').addEventListener('click', () =>
    mediaRecAudio?.state === 'recording' ? pararGrabacionAudio() : iniciarGrabacionAudio()
);
document.getElementById('btnStopAudio').addEventListener('click', pararGrabacionAudio);

async function iniciarGrabacionAudio() {
    try {
        const stream  = await navigator.mediaDevices.getUserMedia({ audio: true });
        trozosAudio   = [];
        const mime    = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
        mediaRecAudio = new MediaRecorder(stream, { mimeType: mime });

        mediaRecAudio.ondataavailable = e => { if (e.data.size > 0) trozosAudio.push(e.data); };
        mediaRecAudio.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(trozosAudio, { type: mime });
            if (blob.size > LIMITES.audio.maxBytes) {
                mostrarToast('La grabación supera 200 MB', 'error'); return;
            }
            const ext  = mime === 'audio/webm' ? '.webm' : '.ogg';
            const file = new File([blob], `grabacion_${Date.now()}${ext}`, { type: mime });
            procesarAudios([file]);
        };

        mediaRecAudio.start(100);
        segsAudio = 0;
        document.getElementById('barraGrabAudio').style.display = 'flex';
        document.getElementById('btnGrabarAudio').classList.add('activo');
        document.getElementById('iconMic').className = 'fas fa-square';

        intervalAudio = setInterval(() => {
            segsAudio++;
            document.getElementById('timerAudio').textContent = formatTiempo(segsAudio);
            if (segsAudio >= 10800) pararGrabacionAudio();
        }, 1000);

        mostrarToast('Grabación de audio iniciada');
    } catch {
        mostrarToast('No se pudo acceder al micrófono. Verifica los permisos.', 'error');
    }
}

function pararGrabacionAudio() {
    if (!mediaRecAudio || mediaRecAudio.state === 'inactive') return;
    mediaRecAudio.stop();
    clearInterval(intervalAudio);
    document.getElementById('barraGrabAudio').style.display = 'none';
    document.getElementById('btnGrabarAudio').classList.remove('activo');
    document.getElementById('iconMic').className = 'fas fa-microphone';
    mostrarToast('Grabación de audio finalizada');
}

// ══════════════════════════════════════════════════════════════════
//  VIDEOS
// ══════════════════════════════════════════════════════════════════
document.getElementById('inputVideos').addEventListener('change', e => {
    procesarVideos([...e.target.files]);
    e.target.value = '';
});

configurarDrop('zonaDropVid', files => procesarVideos(files));

function procesarVideos(files) {
    files.forEach(file => {
        if (!verificarLimite('videos', 1)) return;
        const err = validarArchivo(file, 'video');
        if (err) { mostrarToast(err, 'error'); return; }
        const id = nuevoId();
        archivos.videos.push({ file, id });
        hayContenido = true; notaGuardada = false;
        agregarItemArchivo('listaVideos', file, id, 'fas fa-film', () => {
            archivos.videos = archivos.videos.filter(v => v.id !== id);
            actualizarChips();
        });
    });
    actualizarChips();
}

// Grabación de video
document.getElementById('btnGrabarVideo').addEventListener('click', () =>
    grabandoVideo ? pararGrabacionVideo() : iniciarGrabacionVideo()
);
document.getElementById('btnStopVideo').addEventListener('click', pararGrabacionVideo);

async function iniciarGrabacionVideo() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        trozosVideo  = [];
        const mime   = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                       ? 'video/webm;codecs=vp9' : 'video/webm';
        mediaRecVideo = new MediaRecorder(stream, { mimeType: mime });

        mediaRecVideo.ondataavailable = e => { if (e.data.size > 0) trozosVideo.push(e.data); };
        mediaRecVideo.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const cam = document.getElementById('camaraPreview');
            cam.srcObject = null;
            document.getElementById('camWrap').style.display = 'none';

            const blob = new Blob(trozosVideo, { type: 'video/webm' });
            if (blob.size > LIMITES.video.maxBytes) {
                mostrarToast('La grabación supera 2 GB', 'error'); return;
            }
            const file = new File([blob], `grabacion_vid_${Date.now()}.webm`, { type: 'video/webm' });
            procesarVideos([file]);
        };

        mediaRecVideo.start(100);
        grabandoVideo = true;
        segsVideo     = 0;

        const cam = document.getElementById('camaraPreview');
        cam.srcObject = stream;
        document.getElementById('camWrap').style.display = 'block';
        document.getElementById('btnGrabarVideo').classList.add('activo');
        document.getElementById('iconCam').className = 'fas fa-square';

        intervalVideo = setInterval(() => {
            segsVideo++;
            document.getElementById('timerVideo').textContent = formatTiempo(segsVideo);
            if (segsVideo >= 10800) pararGrabacionVideo();
        }, 1000);

        mostrarToast('Grabación de video iniciada');
    } catch {
        mostrarToast('No se pudo acceder a la cámara/micrófono. Verifica los permisos.', 'error');
    }
}

function pararGrabacionVideo() {
    if (!mediaRecVideo || mediaRecVideo.state === 'inactive') return;
    mediaRecVideo.stop();
    clearInterval(intervalVideo);
    grabandoVideo = false;
    document.getElementById('btnGrabarVideo').classList.remove('activo');
    document.getElementById('iconCam').className = 'fas fa-video';
    mostrarToast('Grabación de video finalizada');
}

// ══════════════════════════════════════════════════════════════════
//  HELPER: agregar ítem a lista de archivos
// ══════════════════════════════════════════════════════════════════
function agregarItemArchivo(listaId, file, id, icono, onQuitar) {
    const lista = document.getElementById(listaId);
    const item  = document.createElement('div');
    item.className  = 'archivo-item';
    item.dataset.id = id;
    item.innerHTML  = `
        <div class="archivo-icono"><i class="${icono}"></i></div>
        <div class="archivo-info">
            <div class="archivo-nombre">${file.name}</div>
            <div class="archivo-meta">${formatBytes(file.size)}</div>
        </div>
        <button class="btn-quitar-arch" title="Quitar"><i class="fas fa-times"></i></button>
    `;
    item.querySelector('.btn-quitar-arch').onclick = () => {
        item.remove();
        onQuitar();
        actualizarChips();
    };
    lista.appendChild(item);
}

// ══════════════════════════════════════════════════════════════════
//  CHIPS CONTADOR
// ══════════════════════════════════════════════════════════════════
function actualizarChips() {
    [
        ['chipImg', 'cntImg', archivos.imagenes.length],
        ['chipAud', 'cntAud', archivos.audios.length],
        ['chipVid', 'cntVid', archivos.videos.length],
    ].forEach(([chipId, cntId, n]) => {
        document.getElementById(chipId).style.display = n > 0 ? 'inline-flex' : 'none';
        document.getElementById(cntId).textContent    = n;
    });
}

// ══════════════════════════════════════════════════════════════════
//  DRAG & DROP
// ══════════════════════════════════════════════════════════════════
function configurarDrop(zonaId, callback) {
    const zona = document.getElementById(zonaId);
    if (!zona) return;
    zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('drag-over'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('drag-over'));
    zona.addEventListener('drop', e => {
        e.preventDefault();
        zona.classList.remove('drag-over');
        const files = [...e.dataTransfer.files];
        if (files.length) callback(files);
    });
}

// ══════════════════════════════════════════════════════════════════
//  GUARDAR NOTA — fetch al backend
// ══════════════════════════════════════════════════════════════════
async function guardarNota() {
    const cuerpoNotas = document.getElementById('cuerpo-nota');
    const textoHTML  = cuerpoNotas?.innerHTML.trim() || '';
    const textoPlano = cuerpoNotas?.innerText.trim() || '';
    const tieneTexto = textoPlano.length > 0;
    const tieneMedia = archivos.imagenes.length > 0
                    || archivos.audios.length   > 0
                    || archivos.videos.length   > 0;

    if (!tieneTexto && !tieneMedia) {
        mostrarToast('Agrega al menos un tipo de contenido antes de guardar', 'error');
        return;
    }

    if (textoPlano.length > LIMITE_CARACTERES_TEXTO) {
        mostrarToast(`No puedes guardar la nota porque excede el límite de ${LIMITE_CARACTERES_TEXTO.toLocaleString()} caracteres de tu plan.`,'error');
        return;
    }

    const titulo      = document.getElementById('inputTitulo').value.trim();
    const descripcion = document.getElementById('inputDescripcion').value.trim();
    const etiquetas   = document.getElementById('inputEtiquetas').value.trim();

    if (!titulo) {
        mostrarToast('Escribe un título para la nota', 'error');
        document.getElementById('inputTitulo').focus();
        return;
    }

    const editId   = document.getElementById('editNotaId')?.value;
    const isUpdate = !!editId;
    const url      = isUpdate ? `/actualizar-nota-mixta/${editId}` : '/guardar-nota-mixta';

    const fd = new FormData();
    fd.append('titulo',      titulo);
    fd.append('descripcion', descripcion || `Nota mixta: ${titulo}`);
    fd.append('contenido',   tieneTexto ? textoHTML : '');
    fd.append('etiquetas',   etiquetas);

    // Cada tipo con su propia key — el backend las espera separadas
    archivos.imagenes.forEach(({ file }) => fd.append('imagenes', file, file.name));
    archivos.audios.forEach(  ({ file }) => fd.append('audios',   file, file.name));
    archivos.videos.forEach(  ({ file }) => fd.append('videos',   file, file.name));

    // Deshabilitar botones guardar
    const btns = ['btnGuardarTop', 'btnGuardarBottom'].map(id => document.getElementById(id)).filter(Boolean);
    btns.forEach(b => {
        b.disabled  = true;
        b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (isUpdate ? 'Actualizando...' : 'Guardando...');
    });

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

    try {
        const resp = await fetch(url, { method: 'POST', headers: { 'X-CSRFToken': csrfToken }, body: fd });

        let data;
        try { data = await resp.json(); }
        catch { throw new Error(`Respuesta inesperada del servidor (HTTP ${resp.status})`); }

        if (!resp.ok || !data.success) throw new Error(data.error || `Error HTTP ${resp.status}`);

        notaGuardada = true;
        mostrarToast(data.mensaje || '¡Nota mixta guardada correctamente!', 'success');
        
        if (!isUpdate && data.redirect) {
            setTimeout(() => { window.location.href = data.redirect; }, 1200);
        } else {
            // Si es update, podemos quedarnos o ir a /notas. El usuario preferira quedarse o ver el label de guardado.
            const est = document.getElementById('estadoGuardado');
            if (est) {
                est.classList.add('visible');
                setTimeout(() => est.classList.remove('visible'), 3000);
            }
        }

    } catch (err) {
        console.error('guardarNota mixta:', err);
        mostrarToast(err.message || 'Error de conexión al servidor', 'error');
    } finally {
        btns.forEach(b => {
            if (b) {
                b.disabled  = false;
                const isBottom = b.id === 'btnGuardarBottom';
                b.innerHTML = isBottom 
                    ? `<i class="fas fa-save"></i> ${isUpdate ? 'ACTUALIZAR NOTA' : 'GUARDAR NOTA'}`
                    : `<i class="fas fa-save"></i> ${isUpdate ? 'Actualizar' : 'Guardar'}`;
            }
        });
    }
}


// Conectar botones
document.getElementById('btnGuardarTop')?.addEventListener('click',    guardarNota);
document.getElementById('btnGuardarBottom')?.addEventListener('click', guardarNota);

// ══════════════════════════════════════════════════════════════════
//  MODAL SALIDA SIN GUARDAR (idéntico a logicatexto.js)
// ══════════════════════════════════════════════════════════════════
function mostrarModal() {
    document.getElementById('modalSalida').classList.add('visible');
}
function ocultarModal() {
    document.getElementById('modalSalida').classList.remove('visible');
    urlDestino = null;
}

document.addEventListener('click', e => {
    if (e.target.id === 'btnModalCancelar') ocultarModal();
    if (e.target.id === 'btnModalSalir') {
        notaGuardada = true;
        ocultarModal();
        window.location.href = urlDestino || '/notas';
    }
    if (e.target.id === 'modalSalida') ocultarModal();
});

document.getElementById('btnVolver').addEventListener('click', e => {
    e.preventDefault();
    const textoPlano = document.getElementById('cuerpo-nota').innerText.trim();
    const tieneMedia = archivos.imagenes.length > 0
                    || archivos.audios.length   > 0
                    || archivos.videos.length   > 0;

    if ((textoPlano || tieneMedia) && !notaGuardada) {
        urlDestino = '/notas';
        mostrarModal();
    } else {
        notaGuardada = true;
        window.location.href = '/notas';
    }
});

window.addEventListener('beforeunload', e => {
    const textoPlano = document.getElementById('cuerpo-nota').innerText.trim();
    const tieneMedia = archivos.imagenes.length > 0
                    || archivos.audios.length   > 0
                    || archivos.videos.length   > 0;
    if ((textoPlano || tieneMedia) && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ══════════════════════════════════════════════════════════════════
//  TOAST (idéntico a logicatexto.js)
// ══════════════════════════════════════════════════════════════════
function mostrarToast(mensaje, tipo = 'info') {
    const t = document.getElementById('toast');
    t.textContent = mensaje;
    t.className   = 'toast';
    if (tipo === 'success') t.classList.add('success');
    if (tipo === 'error')   t.classList.add('error');
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ══════════════════════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════════════════════
function formatTiempo(seg) {
    seg = Math.max(0, seg || 0);
    const m = Math.floor(seg / 60);
    const s = Math.floor(seg % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 ** 2)   return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 ** 3)   return (bytes / 1024 ** 2).toFixed(1) + ' MB';
    return (bytes / 1024 ** 3).toFixed(2) + ' GB';
}

// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════
//  CHECKLIST (como logicatexto.js)
// ══════════════════════════════════════════
window._checklistAlign = 'left';
window._checklistBlock = null;

(function inyectarModalChecklist() {
    if (document.getElementById('modalChecklist')) return;
    const overlay = document.createElement('div');
    overlay.id = 'modalChecklist';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box" style="max-width:400px;">
            <div class="modal-icono"><i class="fas fa-check-double" style="color:var(--verde-acento);"></i></div>
            <h3>Nuevo item de checklist</h3>
            <input type="text" id="inputChecklistText" placeholder="Escribe el texto del item..."
                   style="width:100%;padding:10px 14px;border:1.5px solid #d1c4e9;border-radius:10px;margin-bottom: 8px;
                          font-family:"Nunito",sans-serif;font-size:14px;color:var(--morado-oscuro);
                          outline:none;margin-bottom:16px;box-sizing:border-box;">
            <div class="modal-btns">
                <button class="btn-modal-cancelar" id="btnChkCancel">Cancelar</button>
                <button class="btn-modal-salir" id="btnChkConfirm" style="background:var(--verde-acento);box-shadow:none;">Anadir</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
})();

function alignmentFromBlock(block) {
    if (!block) return '';
    const inline = block.getAttribute('style');
    if (inline) {
        const m = inline.match(/text-align\s*:\s*(center|right)/i);
        if (m) return m[1].toLowerCase();
    }
    const attr = block.getAttribute('align');
    if (attr && (attr === 'center' || attr === 'right')) return attr;
    const cs = window.getComputedStyle(block);
    if (cs.textAlign === 'center') return 'center';
    if (cs.textAlign === 'right') return 'right';
    return '';
}

function findBlock(editor) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let n = sel.anchorNode;
    while (n && n !== editor) {
        if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'CENTER'].includes(n.nodeName)) return n;
        n = n.parentNode;
    }
    return null;
}

function detectFullAlignment(block, editor) {
    let n = block;
    while (n && n !== editor) {
        if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'CENTER'].includes(n.nodeName)) {
            const a = alignmentFromBlock(n);
            if (a) return a;
        }
        n = n.parentNode;
    }
    return '';
}

function insertChecklist(e) {
    if (e) e.preventDefault();
    const editor = document.getElementById('cuerpo-nota');
    if (!editor) return;
    const blocker = findBlock(editor);
    window._checklistBlock = blocker;
    window._checklistAlign = detectFullAlignment(blocker, editor);
    const input = document.getElementById('inputChecklistText');
    if (input) input.value = '';
    document.getElementById('modalChecklist').classList.add('visible');
    setTimeout(() => { if (input) input.focus(); }, 100);
}

function confirmChecklist() {
    const input = document.getElementById('inputChecklistText');
    const texto = input ? input.value.trim() : '';
    if (!texto) { if (input) input.focus(); return; }

    document.getElementById('modalChecklist').classList.remove('visible');
    const editor = document.getElementById('cuerpo-nota');
    if (!editor) return;
    editor.focus();

    const align = window._checklistAlign || '';

    const li = document.createElement('li');
    li.contentEditable = 'false';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    li.appendChild(cb);
    li.appendChild(document.createTextNode(' ' + texto));

    const ul = document.createElement('ul');
    ul.className = 'checklist';
    if (align === 'center') {
        ul.style.textAlign = 'center';
        ul.style.margin = '0 auto';
        li.style.justifyContent = 'center';
    } else if (align === 'right') {
        ul.style.textAlign = 'right';
        li.style.justifyContent = 'flex-end';
    }
    ul.appendChild(li);

    const block = window._checklistBlock;
    if (block && editor.contains(block)) {
        block.parentNode.insertBefore(ul, block.nextSibling);
    } else {
        editor.appendChild(ul);
    }

    if (input) input.value = '';
    actualizarContadorTextoMixta();
}

function cancelChecklist() {
    document.getElementById('modalChecklist').classList.remove('visible');
    const input = document.getElementById('inputChecklistText');
    if (input) input.value = '';
}

document.addEventListener('change', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
        const editor = document.getElementById('cuerpo-nota');
        if (editor && editor.contains(e.target)) {
            e.target.closest('li').classList.toggle('checked', e.target.checked);
            e.target.blur();
        }
    }
});

document.addEventListener('click', function(e) {
    if (e.target.id === 'btnChkConfirm') confirmChecklist();
    if (e.target.id === 'btnChkCancel') cancelChecklist();
    if (e.target.id === 'modalChecklist') cancelChecklist();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('modalChecklist')?.classList.contains('visible')) {
        const input = document.getElementById('inputChecklistText');
        if (document.activeElement === input) {
            e.preventDefault();
            confirmChecklist();
        }
    }
});

document.addEventListener('dblclick', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') return;
    const li = e.target.closest('ul.checklist li');
    if (!li) return;
    if (li.contentEditable === 'true') return;
    li.contentEditable = 'true';
    li.focus();
    const range = document.createRange();
    range.selectNodeContents(li);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
});

document.addEventListener('mousedown', function(e) {
    const editing = document.querySelector('ul.checklist li[contenteditable="true"]');
    if (editing && !editing.contains(e.target)) editing.contentEditable = 'false';
});

document.addEventListener('keydown', function(e) {
    const editing = document.querySelector('ul.checklist li[contenteditable="true"]');
    if (editing && e.key === 'Enter') {
        e.preventDefault();
        editing.contentEditable = 'false';
    }
});

//  CARGAR NOTA EN MODO EDICIÓN
// ══════════════════════════════════════════════════════════════════
(function cargarModoEdicion() {
    const editId = document.getElementById('editNotaId')?.value;
    if (!editId) return; // modo crear, no hacer nada

    // Cargar contenido de texto desde el backend
    fetch(`/api/nota-mixta/${editId}`)
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;

            // 1. Cargar texto HTML en el editor
            if (data.contenido) {
                document.getElementById('cuerpo-nota').innerHTML = data.contenido;
                actualizarContadorTextoMixta();
            }

            // 2. Cargar adjuntos existentes (imágenes, audios, videos)
            if (data.adjuntos && data.adjuntos.length > 0) {
                data.adjuntos.forEach(adj => {
                    const url  = adj.ruta.startsWith('http') ? adj.ruta : `/static/${adj.ruta}`;
                    const tipo = adj.tipo; // 'imagen', 'audio', 'video'

                    if (tipo === 'imagen') {
                        // Mostrar preview de imagen ya guardada
                        const grid = document.getElementById('gridImagenes');
                        const card = document.createElement('div');
                        card.className = 'preview-card preview-existente';
                        card.dataset.adjId = adj.id;
                        card.innerHTML = `
                            <img src="${url}" alt="${adj.nombre}">
                            <div class="nombre-prev">${adj.nombre}</div>
                            <span class="badge-guardado"><i class="fas fa-check"></i> Guardado</span>
                        `;
                        grid.appendChild(card);

                    } else if (tipo === 'audio') {
                        // Mostrar item de audio ya guardado
                        const lista = document.getElementById('listaAudios');
                        const item  = document.createElement('div');
                        item.className = 'archivo-item existente';
                        item.dataset.adjId = adj.id;
                        item.innerHTML = `
                            <i class="fas fa-music"></i>
                            <span class="nombre-arch">${adj.nombre}</span>
                            <audio controls src="${url}" style="flex:1;min-width:0;"></audio>
                            <span class="badge-guardado"><i class="fas fa-check"></i> Guardado</span>
                        `;
                        lista.appendChild(item);

                    } else if (tipo === 'video') {
                        // Mostrar item de video ya guardado
                        const lista = document.getElementById('listaVideos');
                        const item  = document.createElement('div');
                        item.className = 'archivo-item existente';
                        item.dataset.adjId = adj.id;
                        item.innerHTML = `
                            <i class="fas fa-video"></i>
                            <span class="nombre-arch">${adj.nombre}</span>
                            <video controls src="${url}" style="max-width:100%;max-height:200px;"></video>
                            <span class="badge-guardado"><i class="fas fa-check"></i> Guardado</span>
                        `;
                        lista.appendChild(item);
                    }
                });
                actualizarChips();
            }
        })
        .catch(err => console.error('Error cargando nota mixta:', err));
})();