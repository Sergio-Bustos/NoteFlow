
window.eliminarCuenta = async function() {
    const btn = document.querySelector('#eliminarCuentaModal .btn-logout-confirm');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
    }

    try {
        const resp = await fetch('/eliminar-cuenta', { method: 'POST' });
        const data = await resp.json();
        
        if (data.success) {
            window.location.href = data.redirect;
        } else {
            alert(data.error || 'Error al eliminar la cuenta');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-trash-alt"></i> Sí, eliminar para siempre';
            }
        }
    } catch (err) {
        console.error("Error:", err);
        alert('Error de conexión al intentar eliminar la cuenta.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-trash-alt"></i> Sí, eliminar para siempre';
        }
    }
};
