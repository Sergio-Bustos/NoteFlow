/* ══════════════════════════════════════════
       TOASTS
    ══════════════════════════════════════════ */
    function mostrarToast(mensaje, tipo = 'info') {
        const container = document.querySelector('.toast-container-custom');

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
                <button type="button" class="btn-close btn-close-white me-2 m-auto"
                        data-bs-dismiss="toast"></button>
            </div>`;
        container.appendChild(toastEl);
        const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 4000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }


    /* ══════════════════════════════════════════
       TEMA (claro / oscuro)
    ══════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', function () {
        aplicarTemaVisual(window.COLOR_PRINCIPAL === 'Negro' ? 'oscuro' : 'claro');
    });

    function aplicarTemaVisual(tema) {
        const body  = document.body;
        const icon  = document.getElementById('tema-icon');
        const texto = document.getElementById('tema-texto');

        if (tema === 'oscuro') {
            body.classList.add('tema-oscuro');
            body.classList.remove('tema-claro');
            icon.className  = 'fas fa-moon';
            texto.textContent = 'Tema Oscuro Activo';
        } else {
            body.classList.add('tema-claro');
            body.classList.remove('tema-oscuro');
            icon.className  = 'fas fa-sun';
            texto.textContent = 'Tema Claro Activo';
        }
    }


    /* ══════════════════════════════════════════
       VISTA PREVIA DE FOTO
    ══════════════════════════════════════════ */
    document.getElementById('input-foto').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            mostrarToast('La imagen no debe superar 5MB', 'warning');
            this.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (ev) {
            document.getElementById('preview-img').src = ev.target.result;
            document.getElementById('preview-foto').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });


    /* ══════════════════════════════════════════
       SUBIR FOTO
    ══════════════════════════════════════════ */
    document.getElementById('form-foto').addEventListener('submit', async function (e) {
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
                // Mostrar botón eliminar ahora que hay foto
                document.getElementById('btn-eliminar-foto').style.display = '';
                this.reset();
            } else {
                mostrarToast(data.error || 'Error al subir la foto', 'error');
            }
        } catch (err) {
            mostrarToast('Error de conexión al subir la foto', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-upload"></i> Cargar nueva imagen';
        }
    });


    /* ══════════════════════════════════════════
       ELIMINAR FOTO DE PERFIL
    ══════════════════════════════════════════ */

    // 1. Abrir modal de confirmación
    function confirmarEliminarFoto() {
        const modal = new bootstrap.Modal(document.getElementById('modalEliminarFoto'));
        modal.show();

        // Clonar botón para evitar listeners duplicados
        const btnOld = document.getElementById('btn-confirmar-eliminar-foto');
        const btnNew = btnOld.cloneNode(true);
        btnOld.parentNode.replaceChild(btnNew, btnOld);

        btnNew.addEventListener('click', async function () {
            modal.hide();
            await ejecutarEliminarFoto();
        });
    }

    // 2. Llamar al backend y actualizar la UI
    async function ejecutarEliminarFoto() {
        const btn = document.getElementById('btn-eliminar-foto');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';

        try {
            const resp = await fetch('/perfil/eliminar-foto', { method: 'POST' });
            const data = await resp.json();

            if (data.success) {
                // Actualizar la imagen a la foto por defecto
                document.getElementById('foto-perfil').src = data.foto_default;
                // Ocultar el botón eliminar (ya no hay foto propia)
                btn.style.display = 'none';
                mostrarToast(data.mensaje, 'success');
            } else {
                mostrarToast(data.error || 'Error al eliminar la foto', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-trash-alt"></i> Eliminar foto de perfil';
            }
        } catch (err) {
            mostrarToast('Error de conexión', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-trash-alt"></i> Eliminar foto de perfil';
        }
    }


    /* ══════════════════════════════════════════
       CAMBIAR TEMA
    ══════════════════════════════════════════ */
    document.getElementById('form-tema').addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData  = new FormData(this);
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


    /* ══════════════════════════════════════════
       CAMBIAR CONTRASEÑA
    ══════════════════════════════════════════ */
    document.getElementById('form-password').addEventListener('submit', async function (e) {
        e.preventDefault();

        const nueva    = document.getElementById('password_nueva').value;
        const confirma = document.getElementById('password_confirmacion').value;

        if (nueva !== confirma) {
            mostrarToast('Las contraseñas nuevas no coinciden', 'warning');
            return;
        }
        if (nueva.length < 6 || nueva.length > 15) {
            mostrarToast('La contraseña debe tener entre 6 y 15 caracteres', 'warning');
            return;
        }

        const formData = new FormData(this);
        const btn = this.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';

        try {
            const resp = await fetch('/perfil/cambiar-password', { method: 'POST', body: formData });
            const data = await resp.json();

            if (data.success) {
                mostrarToast(data.mensaje, 'success');
                this.reset();
            } else {
                mostrarToast(data.error || 'Error al cambiar contraseña', 'error');
            }
        } catch (err) {
            mostrarToast('Error de conexión', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Contraseña';
        }
    });