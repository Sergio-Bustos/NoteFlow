// ========== FUNCIÓN PARA MOSTRAR TOASTS ==========
function mostrarToast(mensaje, tipo = 'info') {
    const toastContainer = document.querySelector('.toast-container-custom');

    const config = {
        success: {
            icon: '✓',
            title: 'Éxito',
            bgClass: 'toast-success'
        },
        error: {
            icon: '✕',
            title: 'Error',
            bgClass: 'toast-error'
        },
        warning: {
            icon: '⚠',
            title: 'Advertencia',
            bgClass: 'toast-warning'
        }
    };

    const { icon, title, bgClass } = config[tipo] || config.info;

    const toastEl = document.createElement('div');
    toastEl.className = `toast ${bgClass}`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">${icon} ${title}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">${mensaje}</div>
    `;

    toastContainer.appendChild(toastEl);

    const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 4000 });
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

// ========== MANEJO DEL FORMULARIO DE RESTABLECER CONTRASEÑA ==========
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-restablecer');

    if (form) {

        // ── Mostrar/ocultar contraseña ──
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', function() {
                const targetId  = this.dataset.target;
                const inputEl   = document.getElementById(targetId);
                const iconEye    = this.querySelector('.icon-eye');
                const iconEyeOff = this.querySelector('.icon-eye-off');

                if (inputEl.type === 'password') {
                    inputEl.type    = 'text';
                    iconEye.style.display    = 'none';
                    iconEyeOff.style.display = '';
                } else {
                    inputEl.type    = 'password';
                    iconEye.style.display    = '';
                    iconEyeOff.style.display = 'none';
                }
            });
        });

        // ── Indicador de fortaleza de contraseña ──
        const nuevaInput      = document.getElementById('nueva_contrasena');
        const strengthWrapper = document.getElementById('strength-wrapper');
        const bar1            = document.getElementById('bar1');
        const bar2            = document.getElementById('bar2');
        const bar3            = document.getElementById('bar3');
        const strengthLabel   = document.getElementById('strength-label');

        if (nuevaInput) {
            nuevaInput.addEventListener('input', function() {
                const val = this.value;

                if (!val) {
                    strengthWrapper.style.display = 'none';
                    return;
                }

                strengthWrapper.style.display = 'flex';

                // Calcular nivel: débil (1), media (2), fuerte (3)
                let score = 0;
                if (val.length >= 6)  score++;
                if (val.length >= 10) score++;
                if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;

                // Resetear barras
                [bar1, bar2, bar3].forEach(b => { b.className = 'strength-bar'; });

                if (score === 1) {
                    bar1.classList.add('weak');
                    strengthLabel.textContent = 'Contraseña débil';
                    strengthLabel.className   = 'strength-label weak';
                } else if (score === 2) {
                    bar1.classList.add('medium');
                    bar2.classList.add('medium');
                    strengthLabel.textContent = 'Contraseña media';
                    strengthLabel.className   = 'strength-label medium';
                } else if (score === 3) {
                    bar1.classList.add('strong');
                    bar2.classList.add('strong');
                    bar3.classList.add('strong');
                    strengthLabel.textContent = 'Contraseña fuerte';
                    strengthLabel.className   = 'strength-label strong';
                }
            });
        }

        // ── Envío del formulario ──
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const nueva     = document.getElementById('nueva_contrasena').value;
            const confirmar = document.getElementById('confirmar_contrasena').value;

            // Validación: ¿coinciden las contraseñas?
            if (nueva !== confirmar) {
                mostrarToast('Las contraseñas no coinciden.', 'warning');
                return;
            }

            // Validación: longitud mínima
            if (nueva.length < 6) {
                mostrarToast('La contraseña debe tener al menos 6 caracteres.', 'warning');
                return;
            }

            const formData  = new FormData(this);
            const submitBtn = this.querySelector('button[type="submit"]');
            const btnText   = submitBtn.textContent;

            submitBtn.disabled    = true;
            submitBtn.textContent = 'Actualizando...';

            try {
                const response = await fetch('/procesar-restablecer-contrasena', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    mostrarToast(data.mensaje, 'success');

                    // Redirigir después de 2 segundos
                    setTimeout(() => {
                        window.location.href = data.redirect;
                    }, 2000);
                } else if (data.error) {
                    mostrarToast(data.error, 'error');
                    submitBtn.disabled    = false;
                    submitBtn.textContent = btnText;
                } else {
                    mostrarToast('Error al restablecer la contraseña.', 'error');
                    submitBtn.disabled    = false;
                    submitBtn.textContent = btnText;
                }
            } catch (error) {
                mostrarToast('Error de conexión. Intenta más tarde.', 'error');
                submitBtn.disabled    = false;
                submitBtn.textContent = btnText;
            }
        });
    }
});