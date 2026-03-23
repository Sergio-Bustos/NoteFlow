// ========== APLICAR TEMA AL CARGAR ==========
function _aplicarTema(esOscuro) {
    document.body.classList.toggle('tema-oscuro', esOscuro);
    document.body.classList.toggle('tema-claro',  !esOscuro);
}

document.addEventListener('DOMContentLoaded', function() {
    // COLOR_PRINCIPAL viene del HTML: <script>window.COLOR_PRINCIPAL = "{{ usuario.Color_principal }}";</script>
    _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');
});

// Cuando Chrome restaura desde cache (boton atras/adelante)
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        const cookie = document.cookie.split(';')
            .find(c => c.trim().startsWith('tema='));
        if (cookie) {
            const val = cookie.split('=')[1].trim();
            _aplicarTema(val === 'Negro');
        } else {
            _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');
        }
    }
});
// Boton de hamburguesa funcion
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('visible');
    document.getElementById('hamburger-btn').classList.toggle('hidden');
}


// ========== MODAL ELEGIR FORMATO ==========
function abrirFormato() {
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
