// ══════════════════════════════════════════════════════════════════
//  mixta.js — Editor de Nota Mixta NoteFlow
//  Patrón idéntico a logicatexto.js + manejo de archivos multimedia
// ══════════════════════════════════════════════════════════════════

// ── Límites (deben coincidir con el backend) ──────────────────────
const LIMITES = {
    imagen: {
        maxBytes: 200 * 1024 * 1024,
        exts: new Set(['.jpg','.jpeg','.png','.gif','.webp','.svg','.pntg','.wmf'])
    },
    audio: {
        maxBytes: 200 * 1024 * 1024,
        exts: new Set(['.mp3','.aac','.ogg','.wav','.flac','.wma','.m4a','.webm'])
    },
    video: {
        maxBytes: 2 * 1024 * 1024 * 1024,
        exts: new Set(['.mp4','.webm','.ogg','.mkv','.wmv','.mov','.avi'])
    },
};

// ══════════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════
let notaGuardada = false;
let urlDestino   = null;
let hayContenido = false;

const archivos = { imagenes: [], audios: [], videos: [] };  // [{file, id}]

let idCounter = 0;
const nuevoId = () => ++idCounter;

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

document.getElementById('cuerpo-nota').addEventListener('input', () => {
    hayContenido = true;
    notaGuardada = false;
});

// ══════════════════════════════════════════════════════════════════
//  VALIDACIÓN GENÉRICA
// ══════════════════════════════════════════════════════════════════
function validarArchivo(file, tipo) {
    const lim = LIMITES[tipo];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!lim.exts.has(ext)) return `Formato no permitido (${ext}) para ${tipo}`;
    if (file.size > lim.maxBytes) return `"${file.name}" supera el límite de ${formatBytes(lim.maxBytes)}`;
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
    const textoHTML  = document.getElementById('cuerpo-nota').innerHTML.trim();
    const textoPlano = document.getElementById('cuerpo-nota').innerText.trim();
    const tieneTexto = textoPlano.length > 0;
    const tieneMedia = archivos.imagenes.length > 0
                    || archivos.audios.length   > 0
                    || archivos.videos.length   > 0;

    if (!tieneTexto && !tieneMedia) {
        mostrarToast('Agrega al menos un tipo de contenido antes de guardar', 'error');
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

    archivos.imagenes.forEach(({ file }) => fd.append('archivos', file, file.name));
    archivos.audios.forEach(  ({ file }) => fd.append('archivos',   file, file.name));
    archivos.videos.forEach(  ({ file }) => fd.append('archivos',   file, file.name));

    // Deshabilitar botones guardar
    const btns = ['btnGuardarTop', 'btnGuardarBottom'].map(id => document.getElementById(id)).filter(Boolean);
    btns.forEach(b => {
        b.disabled  = true;
        b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (isUpdate ? 'Actualizando...' : 'Guardando...');
    });

    try {
        const resp = await fetch(url, { method: 'POST', body: fd });

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