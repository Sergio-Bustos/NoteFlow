
        function mostrarToast(mensaje, tipo = 'info') {
            const toastContainer = document.querySelector('.toast-container-custom');
            const config = {
                success: { icon: '✔', title: 'Éxito',  bgClass: 'toast-success' },
                error:   { icon: '✕', title: 'Error',   bgClass: 'toast-error'   },
                info:    { icon: 'ℹ', title: 'Info',    bgClass: 'toast-info'    }
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
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Cerrar"></button>
                </div>
                <div class="toast-body">${mensaje}</div>
            `;
            toastContainer.appendChild(toastEl);
            const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 4000 });
            toast.show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        }

        // ── Indicador de fortaleza de contraseña ────────────────────────
        function evaluarFortaleza(password) {
            let puntos = 0;
            if (password.length >= 8)                         puntos++;
            if (password.length >= 12)                        puntos++;
            if (/[A-Z]/.test(password) && /[a-z]/.test(password)) puntos++;
            if (/[0-9]/.test(password))                       puntos++;
            if (/[^A-Za-z0-9]/.test(password))               puntos++;
            // Normalizar a 1-4
            return Math.min(4, Math.max(1, Math.ceil(puntos * 4 / 5)));
        }

        document.addEventListener('DOMContentLoaded', function () {
            
            // ── Input de Teléfono con Código de País ─────────────────────
            const phoneInputField = document.getElementById('reg-telefono');
            let phoneInput = null;
            if (phoneInputField) {
                phoneInput = window.intlTelInput(phoneInputField, {
                    initialCountry: "co",
                    preferredCountries: ["co", "mx", "ar", "es", "us"],
                    separateDialCode: true,
                    utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
                });
            }

            // ── Barra de fortaleza ───────────────────────────────────────
            const pwdInput   = document.getElementById('reg-password');
            const wrapper    = document.getElementById('password-strength-wrapper');
            const strengthLbl = document.getElementById('strength-label');
            const bars       = [
                document.getElementById('sb1'),
                document.getElementById('sb2'),
                document.getElementById('sb3'),
                document.getElementById('sb4'),
            ];
            const colores = ['#ef4444', '#f97316', '#facc15', '#22c55e'];
            const etiquetas = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte'];

            if (pwdInput) {
                pwdInput.addEventListener('input', function() {
                    const val = this.value;
                    if (!val) { wrapper.style.display = 'none'; return; }
                    wrapper.style.display = 'block';
                    const nivel = evaluarFortaleza(val);
                    bars.forEach((b, i) => {
                        b.style.background = i < nivel ? colores[nivel - 1] : '#e5e7eb';
                    });
                    strengthLbl.textContent = etiquetas[nivel - 1];
                    strengthLbl.style.color = colores[nivel - 1];
                });
            }

            // ── Validación de confirmación de contraseña ─────────────────
            const confirmInput = document.getElementById('reg-password-confirm');
            const confirmHint  = document.getElementById('confirm-hint');

            if (confirmInput) {
                confirmInput.addEventListener('input', function() {
                    const match = this.value === pwdInput.value;
                    confirmHint.style.display = (!match && this.value) ? 'block' : 'none';
                    this.style.borderColor = (!match && this.value) ? '#ef4444' : '';
                });
            }

            // ── Envío del formulario con Tratamiento de Datos ────────────
            const formRegistro = document.querySelector('form[action="/procesar-registro"]');
            let privacyAccepted = false;

            if (formRegistro) {
                formRegistro.addEventListener('submit', async function (e) {
                    e.preventDefault();

                    // Validar que las contraseñas coincidan antes de enviar
                    if (pwdInput && confirmInput && pwdInput.value !== confirmInput.value) {
                        mostrarToast('Las contraseñas no coinciden.', 'error');
                        return;
                    }

                    // Interceptar para la política de privacidad
                    if (!privacyAccepted) {
                        const privacyModal = new bootstrap.Modal(document.getElementById('privacyModal'));
                        privacyModal.show();
                        return;
                    }

                    const formData  = new FormData(this);
                    
                    // Asegurar que enviamos el número completo con el indicativo (ej. +57...)
                    if (phoneInput && phoneInput.isValidNumber()) {
                        formData.set('telefono', phoneInput.getNumber());
                    } else if (phoneInput) {
                        // Si no es "válido" estrictamente, igual mandamos lo que haya con su código de país
                        const number = phoneInput.getNumber();
                        if (number) formData.set('telefono', number);
                    }

                    const submitBtn = this.querySelector('button[type="submit"]');
                    const btnText   = submitBtn.textContent;
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Registrando...';

                    try {
                        const response = await fetch('/procesar-registro', {
                            method: 'POST',
                            body: formData
                        });
                        const data = await response.json();

                        if (data.success) {
                            mostrarToast('Código enviado a tu correo 👍 Redirigiendo...', 'success');
                            setTimeout(() => {
                                window.location.href = data.redirect;
                            }, 1500);
                        } else {
                            mostrarToast(data.error || 'Error al registrar usuario', 'error');
                            submitBtn.disabled = false;
                            submitBtn.textContent = btnText;
                        }

                    } catch (error) {
                        console.error('Error:', error);
                        mostrarToast('Error de conexión. Por favor, intenta de nuevo.', 'error');
                        submitBtn.disabled = false;
                        submitBtn.textContent = btnText;
                    }
                });

                // Manejo de los botones del modal de privacidad
                const btnAcceptPrivacy = document.getElementById('btn-accept-privacy');
                if (btnAcceptPrivacy) {
                    btnAcceptPrivacy.addEventListener('click', function() {
                        privacyAccepted = true;
                        const privacyModalEl = document.getElementById('privacyModal');
                        const privacyModal = bootstrap.Modal.getInstance(privacyModalEl);
                        if(privacyModal) privacyModal.hide();
                        
                        // Enviar el formulario ahora que se aceptó la política
                        formRegistro.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    });
                }
                
                const btnRejectPrivacy = document.getElementById('btn-reject-privacy');
                if (btnRejectPrivacy) {
                    btnRejectPrivacy.addEventListener('click', function() {
                        mostrarToast('Debe aceptar el tratamiento de datos para continuar con el registro.', 'error');
                    });
                }
            }
        });