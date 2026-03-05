        /**
         * mostrarToast
         * ─────────────────────────────────────────────────────────────
         * Crea e inserta dinámicamente una notificación flotante (Toast
         * de Bootstrap) en el contenedor .toast-container-custom.
         *
         * @param {string} mensaje  - Texto a mostrar en el cuerpo del toast.
         * @param {string} tipo     - Tipo de toast: 'success' | 'error' | 'info'
         *                           Controla el ícono, título y clase CSS de color.
         *
         * Comportamiento:
         *  - El toast se muestra durante 4 000 ms y luego se cierra automáticamente.
         *  - Al ocultarse, el elemento se elimina del DOM para evitar acumulación.
         *  - Usa roles ARIA (role="alert", aria-live="assertive") para accesibilidad.
         */
        function mostrarToast(mensaje, tipo = 'info') {
            const toastContainer = document.querySelector('.toast-container-custom');

            // Mapa de configuración según el tipo de mensaje
            const config = {
                success: { icon: '✔', title: 'Éxito',       bgClass: 'toast-success' },
                error:   { icon: '✕', title: 'Error',        bgClass: 'toast-error'   },
                info:    { icon: 'ℹ', title: 'Información',  bgClass: 'toast-info'    }
            };

            const { icon, title, bgClass } = config[tipo] || config.info;

            // Crear el elemento toast con estructura HTML de Bootstrap
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

            // Inicializar y mostrar el toast con Bootstrap (autocierre a los 4 s)
            const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 4000 });
            toast.show();

            // Limpiar el DOM cuando el toast termina su animación de salida
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        }

        /**
         * Listener principal — Envío del formulario de login
         * ─────────────────────────────────────────────────────────────
         * Se ejecuta cuando el DOM está listo. Intercepta el submit del
         * formulario de /procesar-login para manejarlo vía fetch (AJAX),
         * evitando la recarga completa de la página.
         *
         * Flujo:
         *  1. Previene el envío nativo del formulario (e.preventDefault).
         *  2. Deshabilita el botón de envío y muestra texto de carga.
         *  3. Envía los datos como FormData mediante POST a /procesar-login.
         *  4. Espera respuesta JSON del servidor:
         *       { success: true, redirect: "/dashboard" }  → muestra toast de éxito y redirige
         *       { success: false, error: "mensaje" }       → muestra toast de error y reactiva el botón
         *  5. En caso de error de red (catch), muestra toast de conexión y reactiva el botón.
         */
        document.addEventListener('DOMContentLoaded', function () {

            const formLogin = document.querySelector('form[action="/procesar-login"]');

            if (formLogin) {
                formLogin.addEventListener('submit', async function (e) {
                    e.preventDefault(); // Cancela el envío nativo del formulario

                    const formData  = new FormData(this);       // Captura todos los campos del formulario
                    const submitBtn = this.querySelector('button[type="submit"]');
                    const btnText   = submitBtn.textContent;    // Guarda el texto original del botón

                    // Estado de carga: deshabilitar botón para evitar doble envío
                    submitBtn.disabled    = true;
                    submitBtn.textContent = 'Iniciando sesión...';

                    try {
                        // Petición AJAX al endpoint de login
                        const response = await fetch('/procesar-login', { method: 'POST', body: formData });
                        const data = await response.json(); // Parsear la respuesta JSON del servidor

                        if (data.success) {
                            // Login exitoso: notificar al usuario y redirigir tras 1 s
                            mostrarToast('¡Bienvenido a NoteFlow!', 'success');
                            setTimeout(() => { window.location.href = data.redirect; }, 1000);
                        } else {
                            // Credenciales incorrectas u otro error del servidor
                            mostrarToast(data.error || 'Usuario o contraseña incorrectos', 'error');
                            submitBtn.disabled    = false;       // Reactivar botón para reintentar
                            submitBtn.textContent = btnText;
                        }

                    } catch (error) {
                        // Error de red o fallo inesperado (sin respuesta del servidor)
                        console.error('Error:', error);
                        mostrarToast('Error de conexión. Por favor, intenta de nuevo.', 'error');
                        submitBtn.disabled    = false;
                        submitBtn.textContent = btnText;
                    }
                });
            }
        });