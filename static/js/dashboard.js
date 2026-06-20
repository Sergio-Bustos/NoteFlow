// ========== APLICAR TEMA AL CARGAR ==========
function _aplicarTema(esOscuro) {
    document.body.classList.toggle('tema-oscuro', esOscuro);
    document.body.classList.toggle('tema-claro',  !esOscuro);
}

function _setTemaCookie(valor) {
    document.cookie = `tema=${valor};path=/;max-age=31536000`;
}

document.addEventListener('DOMContentLoaded', function() {
    _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');
    _setTemaCookie(window.COLOR_PRINCIPAL);
});

// Al volver con atras/adelante (bfcache) se re-aplica el tema
window.addEventListener('pageshow', function() {
    const cookie = document.cookie.split(';')
        .find(c => c.trim().startsWith('tema='));
    if (cookie) {
        const val = cookie.split('=')[1].trim();
        _aplicarTema(val === 'Negro');
    } else if (window.COLOR_PRINCIPAL) {
        _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');
    }
});
// Boton de hamburguesa funcion
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hambBtn = document.getElementById('hamburger-btn');

    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('visible', isOpen);
    hambBtn.classList.toggle('hidden', isOpen);
}


// ========== MODAL ELEGIR FORMATO ==========
function abrirFormato() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('visible');
        document.getElementById('hamburger-btn').classList.remove('hidden');
    }
    document.getElementById('formato-modal').classList.add('visible');
    document.getElementById('formato-backdrop').classList.add('visible');
}
function cerrarFormato() {
    document.getElementById('formato-modal').classList.remove('visible');
    document.getElementById('formato-backdrop').classList.remove('visible');
}
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') cerrarFormato();
});

// ========== INTERACTIVIDAD DE TARJETAS (NUEVO) ==========
document.addEventListener('DOMContentLoaded', function() {
    // Al cargar el Dashboard, COLOR_PRINCIPAL ya deberÃ­a estar disponible
    if (window.COLOR_PRINCIPAL) _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');

    const cards = document.querySelectorAll('.recientes .nota-card');
    cards.forEach(card => {
        card.style.cursor = 'pointer';
        
        card.addEventListener('click', function(e) {
            // Evitar redirigir si se hace clic en un botÃ³n interno
            if (e.target.closest('.view-btn')) return;

            const noteId = card.getAttribute('data-note-id');
            const folderId = card.getAttribute('data-folder-id');

            if (noteId) {
                // Ir al editor de la nota
                window.location.href = '/editar-nota/' + noteId;
            } else if (folderId) {
                // Ir a la vista de notas filtrada por esa carpeta
                const folderName = card.querySelector('h4').textContent.trim();
                window.location.href = '/notas?carpeta=' + encodeURIComponent(folderName);
            }
        });
    });
});

