        /* ── Toast ── */
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

        /* ── Inputs de código: navegación automática ── */
        const boxes  = Array.from(document.querySelectorAll('#codigo-inputs input'));
        const hidden = document.getElementById('campo-codigo');

        function syncHidden() {
            hidden.value = boxes.map(b => b.value).join('');
        }

        boxes.forEach((box, i) => {
            box.addEventListener('input', (e) => {
                // Solo dígitos
                box.value = box.value.replace(/\D/g, '').slice(-1);
                box.classList.toggle('filled', box.value !== '');
                syncHidden();
                if (box.value && i < boxes.length - 1) {
                    boxes[i + 1].focus();
                }
            });

            box.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !box.value && i > 0) {
                    boxes[i - 1].focus();
                    boxes[i - 1].value = '';
                    boxes[i - 1].classList.remove('filled');
                    syncHidden();
                }
            });

            // Soporte para pegar el código completo en la primera caja
            box.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = (e.clipboardData || window.clipboardData)
                    .getData('text')
                    .replace(/\D/g, '')
                    .slice(0, 6);
                pasted.split('').forEach((ch, j) => {
                    if (boxes[j]) {
                        boxes[j].value = ch;
                        boxes[j].classList.add('filled');
                    }
                });
                syncHidden();
                const next = boxes[pasted.length] || boxes[boxes.length - 1];
                next.focus();
            });
        });

        /* ── Temporizador de 15 minutos ── */
        let segundosRestantes = 15 * 60;
        const timerEl = document.getElementById('timer-count');

        const intervalTimer = setInterval(() => {
            segundosRestantes--;
            const m = String(Math.floor(segundosRestantes / 60)).padStart(2, '0');
            const s = String(segundosRestantes % 60).padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
            if (segundosRestantes <= 0) {
                clearInterval(intervalTimer);
                timerEl.textContent = '00:00';
                timerEl.style.color = '#ff6b6b';
                mostrarToast('El código ha expirado. Solicita uno nuevo.', 'error');
                document.getElementById('btn-verificar').disabled = true;
            }
        }, 1000);

        /* ── Contador de reenvío (60s antes de permitir reenviar) ── */
        let esperaSegundos = 60;
        const esperaEl  = document.getElementById('espera-count');
        const btnReenv  = document.getElementById('btn-reenviar');

        const intervalEspera = setInterval(() => {
            esperaSegundos--;
            esperaEl.textContent = `${esperaSegundos}s`;
            if (esperaSegundos <= 0) {
                clearInterval(intervalEspera);
                btnReenv.disabled = false;
                btnReenv.textContent = 'Reenviar código';
            }
        }, 1000);

        /* ── Reenviar código ── */
        btnReenv.addEventListener('click', async () => {
            btnReenv.disabled = true;
            btnReenv.textContent = 'Enviando...';
            try {
                const res  = await fetch('/reenviar-codigo', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    mostrarToast('Nuevo código enviado a tu correo ✉️', 'success');
                    // Reiniciar temporizador de 15 min
                    segundosRestantes = 15 * 60;
                    document.getElementById('btn-verificar').disabled = false;
                    timerEl.style.color = '';
                    // Volver a bloquear el botón 60s
                    esperaSegundos = 60;
                    btnReenv.textContent = `Reenviar (espera <span id="espera-count">60s</span>)`;
                    // Refrescar referencia después de innerHTML
                    setTimeout(() => { btnReenv.disabled = false; }, 60000);
                } else {
                    mostrarToast(data.error || 'No se pudo reenviar el código', 'error');
                    btnReenv.disabled = false;
                    btnReenv.textContent = 'Reenviar código';
                }
            } catch (err) {
                mostrarToast('Error de conexión', 'error');
                btnReenv.disabled = false;
                btnReenv.textContent = 'Reenviar código';
            }
        });

        /* ── Enviar formulario de verificación ── */
        document.getElementById('form-verificacion').addEventListener('submit', async function(e) {
            e.preventDefault();

            syncHidden();
            const codigo = hidden.value;

            if (codigo.length !== 6) {
                mostrarToast('Ingresa los 6 dígitos del código', 'error');
                return;
            }

            const btn     = document.getElementById('btn-verificar');
            const btnText = btn.textContent;
            btn.disabled  = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verificando...';

            try {
                const formData = new FormData();
                formData.append('codigo', codigo);

                const res  = await fetch('/procesar-verificacion', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    mostrarToast('¡Cuenta verificada! Redirigiendo... 🎉', 'success');
                    setTimeout(() => { window.location.href = data.redirect; }, 1500);
                } else {
                    mostrarToast(data.error || 'Código incorrecto', 'error');
                    btn.disabled = false;
                    btn.textContent = btnText;
                    // Sacudir las cajas para indicar error
                    document.getElementById('codigo-inputs').style.animation = 'none';
                    boxes.forEach(b => { b.style.borderColor = '#ff6b6b'; });
                    setTimeout(() => { boxes.forEach(b => { b.style.borderColor = ''; }); }, 1000);
                }
            } catch (err) {
                mostrarToast('Error de conexión', 'error');
                btn.disabled = false;
                btn.textContent = btnText;
            }
        });

        // Enfocar primer input al cargar
        boxes[0].focus();