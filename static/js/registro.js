
        function mostrarToast(mensaje, tipo = 'info') {
        // Función para mostrar notificaciones

            const toastContainer = document.querySelector('.toast-container-custom');
            // Selecciona contenedor

            const config = {
                success: { icon: '✔', title: 'Éxito',  bgClass: 'toast-success' },
                error:   { icon: '✕', title: 'Error',   bgClass: 'toast-error'   },
                info:    { icon: 'ℹ', title: 'Info',    bgClass: 'toast-info'    }
            };

            const { icon, title, bgClass } = config[tipo] || config.info;
            // Extrae valores

            const toastEl = document.createElement('div');
            // Crea div

            toastEl.className = `toast ${bgClass}`;
            // Asigna clases

            toastEl.setAttribute('role', 'alert');
            toastEl.setAttribute('aria-live', 'assertive');
            toastEl.setAttribute('aria-atomic', 'true');
            // Accesibilidad

            toastEl.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">${icon} ${title}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Cerrar"></button>
                </div>
                <div class="toast-body">${mensaje}</div>
            `;
            // Inserta estructura interna

            toastContainer.appendChild(toastEl);
            // Lo agrega al DOM

            const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 4000 });
            // Inicializa Toast de Bootstrap

            toast.show();
            // Muestra el Toast

            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
            // Elimina del DOM cuando desaparece
        }

        document.addEventListener('DOMContentLoaded', function () {
        // Se ejecuta cuando el DOM está listo

            const formRegistro = document.querySelector('form[action="/procesar-registro"]');
            // Busca el formulario específico

            if (formRegistro) {
            // Verifica que exista

                formRegistro.addEventListener('submit', async function (e) {
                // Escucha evento submit

                    e.preventDefault();
                    // Evita recarga tradicional

                    const formData  = new FormData(this);
                    // Captura datos del formulario

                    const submitBtn = this.querySelector('button[type="submit"]');
                    // Selecciona botón

                    const btnText   = submitBtn.textContent;
                    // Guarda texto original

                    submitBtn.disabled = true;
                    // Desactiva botón

                    submitBtn.textContent = 'Registrando...';
                    // Cambia texto

                    try {

                        const response = await fetch('/procesar-registro', {
                            method: 'POST',
                            body: formData
                        });
                        // Envía datos al backend usando fetch con método POST

                        const data = await response.json();
                        // Convierte respuesta a JSON

                        if (data.success) {
                        // Si el backend responde éxito

                            mostrarToast('Código enviado a tu correo 👍👻👻 Redirigiendo...', 'success');

                            setTimeout(() => {
                                window.location.href = data.redirect;
                            }, 1500);
                            // Redirige después de 1.5 segundos

                        } else {

                            mostrarToast(data.error || 'Error al registrar usuario', 'error');

                            submitBtn.disabled = false;
                            submitBtn.textContent = btnText;
                            // Restaura botón

                        }

                    } catch (error) {
                    // Si ocurre error de red

                        console.error('Error:', error);
                        // Muestra error en consola

                        mostrarToast('Error de conexión. Por favor, intenta de nuevo.', 'error');

                        submitBtn.disabled = false;
                        submitBtn.textContent = btnText;
                        // Restaura botón

                    }
                });
            }
        });