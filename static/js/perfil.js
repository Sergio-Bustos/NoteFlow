/* ══════════════════════════════════════════
       CONFIGURACIÓN Y UTILS
    ══════════════════════════════════════════ */
    function mostrarToast(mensaje, tipo = 'info') {
        const container = document.querySelector('.toast-container-custom');
        if (!container) return;

        const iconos  = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        const titulos = { success: 'Éxito', error: 'Error', warning: 'Advertencia', info: 'Información' };
        const colores = { success: 'bg-success', error: 'bg-danger', warning: 'bg-warning', info: 'bg-info' };

        const toastEl = document.createElement('div');
        toastEl.className = `toast toast-${tipo} align-items-center text-white ${colores[tipo]} border-0`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <strong>${iconos[tipo]} ${titulos[tipo]}:</strong> ${mensaje}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>`;
        container.appendChild(toastEl);
        const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 4000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }

    function aplicarTemaVisual(tema) {
        const body  = document.body;
        const icon  = document.getElementById('tema-icon');
        const texto = document.getElementById('tema-texto');

        if (tema === 'oscuro') {
            body.classList.add('tema-oscuro');
            body.classList.remove('tema-claro');
            if (icon) icon.className = 'fas fa-moon';
            if (texto) texto.textContent = 'Tema Oscuro Activo';
        } else {
            body.classList.add('tema-claro');
            body.classList.remove('tema-oscuro');
            if (icon) icon.className = 'fas fa-sun';
            if (texto) texto.textContent = 'Tema Claro Activo';
        }
    }

/* ══════════════════════════════════════════
   INICIALIZACIÓN (DOM READY)
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
    
    // 1. Aplicar tema inicial
    aplicarTemaVisual(window.COLOR_PRINCIPAL === 'Negro' ? 'oscuro' : 'claro');

    // 2. Vista previa de foto
    const inputFoto = document.getElementById('input-foto');
    if (inputFoto) {
        inputFoto.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                mostrarToast('La imagen no debe superar 5MB', 'warning');
                this.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function (ev) {
                const previewImg = document.getElementById('preview-img');
                const previewDiv = document.getElementById('preview-foto');
                if (previewImg) previewImg.src = ev.target.result;
                if (previewDiv) previewDiv.style.display = 'block';
            };
            reader.readAsDataURL(file);
        });
    }

    // 3. Subir foto
    const formFoto = document.getElementById('form-foto');
    if (formFoto) {
        formFoto.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';

            try {
                const resp = await fetch('/perfil/subir-foto', { method: 'POST', body: formData });
                const data = await resp.json();
                if (data.success) {
                    mostrarToast(data.mensaje, 'success');
                    document.getElementById('foto-perfil').src = data.nueva_foto;
                    document.getElementById('preview-foto').style.display = 'none';
                    const btnEliminar = document.getElementById('btn-eliminar-foto');
                    if (btnEliminar) {
                        btnEliminar.style.display = 'inline-flex';
                        btnEliminar.disabled = false;
                    }
                    this.reset();
                } else {
                    mostrarToast(data.error || 'Error al subir la foto', 'error');
                }
            } catch (err) {
                mostrarToast('Error de conexión', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-upload"></i> Cargar nueva imagen';
            }
        });
    }

    // 4. Confirmar Eliminar Foto (Listener del botón dentro del modal)
    const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminar-foto');
    if (btnConfirmarEliminar) {
        btnConfirmarEliminar.addEventListener('click', async function() {
            // Cerrar modal programáticamente
            const modalEl = document.getElementById('modalEliminarFoto');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            
            await ejecutarEliminarFoto();
        });
    }

    // 5. Cambiar Tema
    const formTema = document.getElementById('form-tema');
    if (formTema) {
        formTema.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const temaNuevo = formData.get('tema');
            const btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aplicando...';

            try {
                const resp = await fetch('/perfil/cambiar-tema', { method: 'POST', body: formData });
                const data = await resp.json();
                if (data.success) {
                    aplicarTemaVisual(temaNuevo);
                    mostrarToast(data.mensaje, 'success');
                    document.cookie = `tema=${data.tema_db};path=/;max-age=31536000`;
                } else {
                    mostrarToast(data.error || 'Error al cambiar tema', 'error');
                }
            } catch (err) {
                mostrarToast('Error de conexión', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Aplicar Tema';
            }
        });
    }

    // 6. Cambiar Password
    const formPass = document.getElementById('form-password');
    if (formPass) {
        formPass.addEventListener('submit', async function (e) {
            e.preventDefault();
            const nueva = document.getElementById('password_nueva').value;
            const confirma = document.getElementById('password_confirmacion').value;

            if (nueva !== confirma) {
                mostrarToast('Las contraseñas no coinciden', 'warning');
                return;
            }
            if (nueva.length < 6) {
                mostrarToast('Mínimo 6 caracteres', 'warning');
                return;
            }

            const btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            try {
                const resp = await fetch('/perfil/cambiar-password', { method: 'POST', body: new FormData(this) });
                const data = await resp.json();
                if (data.success) {
                    mostrarToast(data.mensaje, 'success');
                    this.reset();
                } else {
                    mostrarToast(data.error, 'error');
                }
            } catch (err) {
                mostrarToast('Error de conexión', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Contraseña';
            }
        });
    }
});

/* ══════════════════════════════════════════
   FUNCIONES GLOBALES
══════════════════════════════════════════ */

async function ejecutarEliminarFoto() {
    const btn = document.getElementById('btn-eliminar-foto');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
    }

    try {
        const resp = await fetch('/perfil/eliminar-foto', { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
            document.getElementById('foto-perfil').src = data.foto_default;
            if (btn) btn.style.display = 'none';
            mostrarToast(data.mensaje, 'success');
        } else {
            mostrarToast(data.error || 'Error', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    } finally {
        if (btn && btn.style.display !== 'none') {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-trash-alt"></i> Eliminar foto de perfil';
        }
    }
}

// ── SELECTOR DE AVATAR PREMIUM ──
const COLORES_PLAN = { quincenal: '#a78bfa', mensual: '#fbbf24', anual: '#00d2d3' };

window.abrirModalAvatar = function() {
    const modal = document.getElementById('modalAvatar');
    if (!modal) return;
    const inner = modal.querySelector('.modal-avatar-inner');
    modal.style.display = 'flex';
    if (inner) {
        inner.style.animation = 'none';
        inner.offsetHeight;
        inner.style.animation = 'modalSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both';
    }
};

window.cerrarModalAvatar = function() {
    const modal = document.getElementById('modalAvatar');
    if (!modal) return;
    const inner = modal.querySelector('.modal-avatar-inner');
    if (inner) {
        inner.style.animation = 'modalSlideOut 0.22s ease-in both';
        setTimeout(() => { modal.style.display = 'none'; }, 220);
    } else {
        modal.style.display = 'none';
    }
};

// Cerrar al hacer clic fuera del modal premium
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modalAvatar');
    if (modal && e.target === modal) cerrarModalAvatar();
});

window.seleccionarAvatar = function(plan) {
    document.querySelectorAll('.avatar-card').forEach(el => {
        el.style.borderColor = 'transparent';
        el.style.boxShadow = 'none';
    });
    
    const opt = document.getElementById('opt-' + plan);
    if (opt) {
        const color = COLORES_PLAN[plan] || '#94a3b8';
        opt.style.borderColor = color;
        opt.style.boxShadow = `0 0 18px -4px ${color}80`;
    }

    fetch('/perfil/cambiar-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_plan: plan })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            const frame = document.getElementById('avatar-frame-actual');
            if (frame) {
                frame.style.opacity = '0';
                setTimeout(() => {
                    if (plan === 'ninguno') {
                        frame.classList.add('frame-hidden');
                    } else {
                        frame.src = `/static/avatar_${plan}_animated.svg?v=${Date.now()}`;
                        frame.classList.remove('frame-hidden');
                        setTimeout(() => frame.style.opacity = '1', 50);
                    }
                }, 300);
            }
            cerrarModalAvatar();
            mostrarToast('¡Marco actualizado!', 'success');
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(err => console.error("Error:", err));
};