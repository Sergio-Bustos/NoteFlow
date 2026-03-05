// ========== APLICAR TEMA AL CARGAR ==========
document.addEventListener('DOMContentLoaded', function() {
    const colorPrincipal = "{{ usuario.color_principal if usuario else 'Blanco' }}";
    if (colorPrincipal === "Negro") {
        document.body.classList.add('tema-oscuro');
        document.body.classList.remove('tema-claro');
    } else {
        document.body.classList.add('tema-claro');
        document.body.classList.remove('tema-oscuro');
    }
});

//  FUERA del DOMContentLoaded
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        const tema = document.cookie.split(';')
            .find(c => c.trim().startsWith('tema='))
            ?.split('=')[1]?.trim();
        
        if (tema === 'Negro') {
            document.body.classList.add('tema-oscuro');
            document.body.classList.remove('tema-claro');
        } else {
            document.body.classList.add('tema-claro');
            document.body.classList.remove('tema-oscuro');
        }
    }
});
    

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