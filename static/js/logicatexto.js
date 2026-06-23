// ========== LÍMITES POR PLAN ==========
const LIMITES = {
    'gratis': 5000,
    'quincenal': 15000,
    'mensual': 50000,
    'anual': 250000
};

const PLAN_ACTUAL = window.USER_PLAN || 'gratis';
const LIMITE_CARACTERES = LIMITES[PLAN_ACTUAL] || LIMITES['gratis'];

// ========== ESTADO ==========
let notaGuardada = false;
let urlDestino   = null;

// ========== TEMA ==========
(function aplicarTema() {
    const match = document.cookie.split(';').find(c => c.trim().startsWith('tema='));
    if (!match) return;
    const valor   = match.split('=')[1]?.trim();
    const esOscuro = valor === 'Negro';
    document.body.classList.toggle('tema-oscuro', esOscuro);
    document.body.classList.toggle('tema-claro',  !esOscuro);
})();

window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
        const match = document.cookie.split(';').find(c => c.trim().startsWith('tema='));
        if (!match) return;
        const esOscuro = match.split('=')[1]?.trim() === 'Negro';
        document.body.classList.toggle('tema-oscuro', esOscuro);
        document.body.classList.toggle('tema-claro',  !esOscuro);
    }
});

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('cuerpo-nota');
    const limitDisplay = document.getElementById('char-limit');
    
    if (limitDisplay) limitDisplay.textContent = LIMITE_CARACTERES.toLocaleString();
    
    actualizarContador();

    // Eventos para el contador y límite
    if (editor) {
        editor.addEventListener('input', () => {
            actualizarContador();
            verificarLimite();
        });

        // Manejo de pegado (Paste) para quitar fondo negro y estilos extraños
        editor.addEventListener('paste', (e) => {
            e.preventDefault();
            const html = e.clipboardData.getData('text/html');
            const text = e.clipboardData.getData('text/plain');

            if (html) {
                // Limpiar el HTML: remover estilos de fondo y colores que vienen de Google/etc
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Remover todos los estilos de fondo y forzar herencia o limpieza
                const allElements = doc.querySelectorAll('*');
                allElements.forEach(el => {
                    el.style.backgroundColor = '';
                    // Si el color es negro puro y estamos en tema oscuro, quizás queramos dejarlo, 
                    // pero lo mejor es limpiar el color de fondo totalmente.
                    if (el.style.color === 'rgb(0, 0, 0)' || el.style.color === '#000000') {
                        el.style.color = ''; 
                    }
                });

                document.execCommand('insertHTML', false, doc.body.innerHTML);
            } else {
                document.execCommand('insertText', false, text);
            }
            actualizarContador();
        });
    }
});

function actualizarContador() {
    const editor = document.getElementById('cuerpo-nota');
    const contador = document.getElementById('char-count');
    if (!editor || !contador) return;

    const longitud = editor.innerText.length;
    contador.textContent = longitud.toLocaleString();

    if (longitud > LIMITE_CARACTERES) {
        contador.style.color = 'var(--rojo)';
    } else {
        contador.style.color = 'var(--morado-medio)';
    }
}

function verificarLimite() {
    const editor = document.getElementById('cuerpo-nota');
    if (!editor) return;

    if (editor.innerText.length > LIMITE_CARACTERES) {
        mostrarToast(`Has superado el límite de ${LIMITE_CARACTERES} caracteres para tu plan ${PLAN_ACTUAL}.`);
    }
}

// ========== MODAL SALIDA SIN GUARDAR ==========

// El HTML del editor ya trae #modalSalida; si no existiera lo inyectamos.
(function inyectarModalSiNoExiste() {
    if (document.getElementById('modalSalida')) return;
    const overlay = document.createElement('div');
    overlay.id        = 'modalSalida';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-icono"><i class="fas fa-exclamation-triangle"></i></div>
            <h3>¿Salir sin guardar?</h3>
            <p>Tienes cambios sin guardar. Si sales ahora, <strong>se perderán.</strong></p>
            <div class="modal-btns">
                <button class="btn-modal-cancelar" id="btnModalCancelar">Quedarse</button>
                <button class="btn-modal-salir"    id="btnModalSalir">Salir igual</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
})();

// Si el HTML original usa clases distintas, actualizamos el modal existente para que
// use las clases del sistema unificado.
(function normalizarModalHTML() {
    const overlay = document.getElementById('modalSalida');
    if (!overlay) return;
    const box = overlay.querySelector('.modal-box');
    if (!box) return;

    // Aseguramos que tenga el icono
    if (!box.querySelector('.modal-icono')) {
        const icono = document.createElement('div');
        icono.className = 'modal-icono';
        icono.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        box.insertBefore(icono, box.firstChild);
    }

    // Normalizar botones a las clases unificadas
    const btnCancelar = box.querySelector('.btn-cancelar-modal, #btnModalCancelar');
    const btnSalir    = box.querySelector('.btn-salir-modal, #btnModalSalir');
    if (btnCancelar) { btnCancelar.className = 'btn-modal-cancelar'; btnCancelar.id = 'btnModalCancelar'; }
    if (btnSalir)    { btnSalir.className    = 'btn-modal-salir';    btnSalir.id    = 'btnModalSalir';    }
})();

function mostrarModal() {
    document.getElementById('modalSalida').classList.add('visible');
}
function ocultarModal() {
    document.getElementById('modalSalida').classList.remove('visible');
    urlDestino = null;
}

document.addEventListener('click', function(e) {
    if (e.target.id === 'btnModalCancelar') ocultarModal();
    if (e.target.id === 'btnModalSalir') {
        notaGuardada = true;            // desactiva beforeunload
        ocultarModal();
        window.location.href = urlDestino || '/notas';
    }
    if (e.target.id === 'modalSalida') ocultarModal();
});

// ========== TOOLBAR ==========
function fmt(comando, e) {
    if (e) e.preventDefault();
    document.execCommand(comando, false, null);
    const editor = document.getElementById('cuerpo-nota');
    if (editor) editor.focus();
    actualizarContador();
}

function cambiarTamano(valor) {
    if (!valor) return;
    document.execCommand('fontSize', false, valor);
    const editor = document.getElementById('cuerpo-nota');
    if (editor) editor.focus();
}

function cambiarColor(color) {
    document.execCommand('foreColor', false, color);
    const visual = document.getElementById('colorMuestra');
    if (visual) visual.style.backgroundColor = color;
    const editor = document.getElementById('cuerpo-nota');
    if (editor) editor.focus();
}

// ========== GUARDAR NOTA ==========
async function guardarNota() {
    const titulo      = document.getElementById('inputTitulo').value.trim();
    const descripcion = document.getElementById('inputDescripcion').value.trim();
    const etiquetas   = document.getElementById('inputEtiquetas').value.trim();
    const cuerpo      = document.getElementById('cuerpo-nota');
    if (!cuerpo) return;
    
    const contenido   = cuerpo.innerHTML;
    const textoPlano  = cuerpo.innerText.trim();

    if (!textoPlano) {
        mostrarToast('La nota está vacía');
        cuerpo.focus();
        return;
    }

    // Verificar límite antes de guardar
    if (cuerpo.innerText.length > LIMITE_CARACTERES) {
        mostrarToast(`No puedes guardar la nota porque excede el límite de ${LIMITE_CARACTERES} caracteres de tu plan.`);
        return;
    }

    const formData = new FormData();
    formData.append('titulo',      titulo);
    formData.append('descripcion', descripcion || `Nota de texto: ${titulo}`);
    formData.append('contenido',   contenido);
    formData.append('etiquetas',   etiquetas);

    const editId = document.getElementById('editNotaId')?.value;
    const url    = editId ? `/actualizar-nota-texto/${editId}` : '/guardar-nota-texto';

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

    try {
        const res  = await fetch(url, { method: 'POST', headers: { 'X-CSRFToken': csrfToken }, body: formData });
        const data = await res.json();

        if (data.success) {
            notaGuardada = true;
            mostrarToast(data.mensaje || 'Nota guardada correctamente');
            setTimeout(() => {
                window.location.href = data.redirect || '/notas';
            }, 1200);
        } else {
            mostrarToast(data.error || 'Error al guardar');
        }
    } catch (err) {
        console.error('Error en fetch:', err);
        mostrarToast('Error de conexión al servidor');
    }
}


// ========== BOTÓN VOLVER ==========
const btnVolver = document.getElementById('btnVolver');
if (btnVolver) {
    btnVolver.addEventListener('click', function(e) {
        e.preventDefault();
        const editor = document.getElementById('cuerpo-nota');
        const textoPlano = editor ? editor.innerText.trim() : '';
        if (textoPlano && !notaGuardada) {
            urlDestino = '/notas';
            mostrarModal();
        } else {
            notaGuardada = true;
            window.location.href = '/notas';
        }
    });
}

// ========== ADVERTENCIA AL CERRAR PESTAÑA ==========
window.addEventListener('beforeunload', function(e) {
    const editor = document.getElementById('cuerpo-nota');
    const textoPlano = editor ? editor.innerText.trim() : '';
    if (textoPlano && !notaGuardada) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ========== TOAST ==========
function mostrarToast(mensaje) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = mensaje;
    t.className   = 'toast';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

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
            <h3>Nuevo ítem de checklist</h3>
            <input type="text" id="inputChecklistText" placeholder="Escribe el texto del ítem..."
                   style="width:100%;padding:10px 14px;border:1.5px solid #d1c4e9;border-radius:10px;
                          font-family:'Nunito',sans-serif;font-size:14px;color:var(--morado-oscuro);
                          outline:none;margin-bottom:16px;box-sizing:border-box;">
            <div class="modal-btns">
                <button class="btn-modal-cancelar" id="btnChkCancel">Cancelar</button>
                <button class="btn-modal-salir" id="btnChkConfirm" style="background:var(--verde-acento);box-shadow:none;">Añadir</button>
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
    actualizarContador();
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

// Doble clic en texto de checklist para editar
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

// Salir de edición al hacer clic fuera o presionar Enter
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

// ========== SELECTOR DE FUENTES (200 FUENTES) ==========

// 200 fuentes populares de Google Fonts
const TODAS_LAS_FUENTES = [
    "Roboto", "Open Sans", "Montserrat", "Lato", "Poppins", 
    "Noto Sans JP", "Inter", "Roboto Condensed", "Oswald", "Noto Sans", 
    "Raleway", "Nunito Sans", "Ubuntu", "Nunito", "Playfair Display", "Rubik", "Merriweather", "PT Sans", "Kanit", "Work Sans", 
    "Lora", "Fira Sans", "Quicksand", "Barlow", "Mulish", "Inconsolata", "Titillium Web", "PT Serif", "Heebo", "Josefin Sans", 
    "Libre Franklin", "Karla", "Space Grotesk", "Arimo", "DM Sans", "Teko", "Abel", "Bebas Neue", "Anton", "Hind", 
    "Cairo", "Dosis", "Cabin", "Bitter", "Prompt", "Fjalla One", "Oxygen", "Manrope", "Archivo", "Crimson Text", 
    "Signika Negative", "Righteous", "Varela Round", "Cormorant Garamond", "Zilla Slab", "Caveat", "Exo 2", "Asap", "Merriweather Sans", "Pacifico", 
    "Play", "Questrial", "Overpass", "Sora", "Amatic SC", "EB Garamond", "Signika", "Lobster", "Abril Fatface", "Chakra Petch", 
    "Monda", "Rokkitt", "Domine", "Cormorant", "Lexend", "Cinzel", "Yanone Kaffeesatz", "Comfortaa", "Vollkorn", "Gelasio", 
    "Crete Round", "Sarabun", "Space Mono", "Russo One", "Gothic A1", "Prata", "Patua One", "M PLUS Rounded 1c", "Acme", "Mina", 
    "Sen", "Sawarabi Mincho", "Volkhov", "Bree Serif", "Lexend Deca", "Alata", "Ruda", "Outfit", "Martel", "Courgette", 
    "Jost", "M PLUS 1p", "Philosopher", "Tinos", "Krub", "Asap Condensed", "Alfa Slab One", "Oleo Script", "Fira Sans Condensed", "Archivo Narrow", 
    "Chivo", "Blinker", "Cantarell", "Pathway Gothic One", "Fira Sans Extra Condensed", "Marmelad", "Francois One", "Yantramanav", "Sintony", "Noticia Text", 
    "Gudea", "Kumbh Sans", "Alice", "Alegreya", "Alegreya Sans", "Sanchez", "Playfair Display SC", "Palanquin", "Taviraj", "Pridi", 
    "Itim", "Lalezar", "Karma", "Kreon", "Maitree", "Chonburi", "Concert One", "Kalam", "Carter One", "Trirong", 
    "Mitr", "Pattaya", "Knewave", "Sriracha", "Markazi Text", "Mali", "Suez One", "Miriam Libre", "Secular One", "Amita", 
    "Baloo 2", "Viga", "Bangers", "Creepster", "Press Start 2P", "Special Elite", "Black Ops One", "Monoton", "Audiowide", "Syncopate", 
    "Quantico", "Orbitron", "Allerta Stencil", "Krona One", "Megrim", "Unica One", "Michroma", "Baumans", "Bungee", "Fredoka One", 
    "Shrikhand", "Modak", "Lilita One", "Sigmar One", "Titan One", "Fugaz One", "Racing Sans One", "Rampart One", "Chewy", 
    "Gochi Hand", "Shadows Into Light", "Handlee", "Patrick Hand", "Indie Flower", "Just Another Hand", "Nothing You Could Do", "Reenie Beanie", "Covered By Your Grace", 
    "Shadows Into Light Two", "Rock Salt", "Homemade Apple", "Over the Rainbow", "Neucha", "Zeyada", "Schoolbell", "Walter Turncoat", "The Girl Next Door"
];

// Inyectar modal de fuentes
(function inyectarModalFuentes() {
    if (document.getElementById('modalFuentes')) return;
    const overlay = document.createElement('div');
    overlay.id = 'modalFuentes';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="fuentes-header">
                <h3>Elige una fuente</h3>
                <button id="btnCerrarFuentes" style="background:none;border:none;font-size:1.5rem;color:#888;cursor:pointer;">&times;</button>
            </div>
            <input type="text" id="inputBuscarFuentes" class="fuentes-buscador" placeholder="Buscar fuente...">
            <div class="fuentes-grid" id="fuentesGrid"></div>
        </div>`;
    document.body.appendChild(overlay);
})();

let observadorFuentes = null;
window._fontSelectionRange = null;

function abrirModalFuentes(e) {
    if (e) e.preventDefault();
    
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        window._fontSelectionRange = sel.getRangeAt(0);
    } else {
        window._fontSelectionRange = null;
    }
    
    renderizarFuentes();
    document.getElementById('modalFuentes').classList.add('visible');
    const input = document.getElementById('inputBuscarFuentes');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
    }
}

function cerrarModalFuentes() {
    document.getElementById('modalFuentes').classList.remove('visible');
    const editor = document.getElementById('cuerpo-nota');
    if (editor) editor.focus();
}

function aplicarFuente(fontName, isPremium) {
    if (isPremium && PLAN_ACTUAL === 'gratis') {
        mostrarToast('Esta fuente es exclusiva para planes premium. ¡Mejora tu plan para usarla!');
        return;
    }
    
    const fontIdFull = 'font-full-' + fontName.replace(/\s+/g, '-');
    if (!document.getElementById(fontIdFull)) {
        const link = document.createElement('link');
        link.id = fontIdFull;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' + fontName.replace(/\s+/g, '+') + '&display=swap';
        document.head.appendChild(link);
    }

    cerrarModalFuentes();

    const editor = document.getElementById('cuerpo-nota');
    if (editor) editor.focus();
    const sel = window.getSelection();
    if (window._fontSelectionRange) {
        sel.removeAllRanges();
        sel.addRange(window._fontSelectionRange);
    }

    document.execCommand('fontName', false, fontName);
    actualizarContador();
}

function cargarFuenteGoogle(fontName) {
    const fontId = 'font-' + fontName.replace(/\s+/g, '-');
    if (document.getElementById(fontId)) return;
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + fontName.replace(/\s+/g, '+') + '&display=swap&text=' + encodeURIComponent(fontName);
    document.head.appendChild(link);
}

function renderizarFuentes(filtro = '') {
    const grid = document.getElementById('fuentesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!observadorFuentes) {
        observadorFuentes = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const fontName = entry.target.dataset.font;
                    if (fontName) {
                        cargarFuenteGoogle(fontName);
                        entry.target.style.fontFamily = `"${fontName}", sans-serif`;
                        observadorFuentes.unobserve(entry.target);
                    }
                }
            });
        }, { root: grid, rootMargin: '100px' });
    }

    const fuentesFiltradas = TODAS_LAS_FUENTES.filter(f => f.toLowerCase().includes(filtro.toLowerCase()));

    fuentesFiltradas.forEach((fontName) => {
        const originalIndex = TODAS_LAS_FUENTES.indexOf(fontName);
        const isPremium = originalIndex >= 5; // Solo las primeras 5 son gratis
        const bloqueada = isPremium && PLAN_ACTUAL === 'gratis';

        const card = document.createElement('div');
        card.className = 'fuente-card' + (bloqueada ? ' bloqueada' : '');
        card.dataset.font = fontName;
        card.innerHTML = `<div class="fuente-nombre">${fontName}</div>`;

        if (isPremium) {
            const badge = document.createElement('div');
            badge.className = 'fuente-premium-badge';
            badge.innerHTML = '<i class="fas fa-crown"></i> PRO';
            card.appendChild(badge);
        }

        card.addEventListener('mousedown', (e) => {
            e.preventDefault();
            aplicarFuente(fontName, isPremium);
        });

        grid.appendChild(card);
        observadorFuentes.observe(card);
    });
}

document.addEventListener('click', function(e) {
    if (e.target.id === 'btnCerrarFuentes' || e.target.id === 'modalFuentes') {
        cerrarModalFuentes();
    }
});

document.addEventListener('input', (e) => {
    if (e.target.id === 'inputBuscarFuentes') {
        renderizarFuentes(e.target.value);
    }
});