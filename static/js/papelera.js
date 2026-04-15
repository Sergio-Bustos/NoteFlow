/* ──────────────────────────────────────────
       TEMA (claro / oscuro)
    ────────────────────────────────────────── */
    function _aplicarTema(esOscuro) {
        document.body.classList.toggle('tema-oscuro', esOscuro);
        document.body.classList.toggle('tema-claro',  !esOscuro);
    }

    document.addEventListener('DOMContentLoaded', function () {
        _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');
    });

    window.addEventListener('pageshow', function (event) {
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


    /* ──────────────────────────────────────────
       TOASTS
    ────────────────────────────────────────── */
    function mostrarToast(mensaje, tipo = 'info') {
        const container = document.getElementById('toast-container');
        const colores = {
            success: 'bg-success',
            error:   'bg-danger',
            warning: 'bg-warning text-dark',
            info:    'bg-info text-dark'
        };
        const iconos = {
            success: 'fa-check-circle',
            error:   'fa-times-circle',
            warning: 'fa-exclamation-circle',
            info:    'fa-info-circle'
        };

        const el = document.createElement('div');
        el.className = `toast align-items-center text-white ${colores[tipo]} border-0`;
        el.setAttribute('role', 'alert');
        el.setAttribute('aria-atomic', 'true');
        el.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas ${iconos[tipo]} me-2"></i>${mensaje}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto"
                        data-bs-dismiss="toast"></button>
            </div>`;
        container.appendChild(el);
        const toast = new bootstrap.Toast(el, { autohide: true, delay: 4000 });
        toast.show();
        el.addEventListener('hidden.bs.toast', () => el.remove());
    }


    /* ──────────────────────────────────────────
       RESTAURAR NOTA
    ────────────────────────────────────────── */
    function confirmarRestaurar(btn) {
        const id     = btn.dataset.id;
        const titulo = btn.dataset.titulo;

        document.getElementById('modal-restaurar-titulo').textContent = `"${titulo}"`;

        const modal = new bootstrap.Modal(document.getElementById('modalRestaurar'));
        modal.show();

        // Reemplazar el listener para evitar acumulación
        const btnConfirmar = document.getElementById('btn-confirmar-restaurar');
        const nuevoBtn = btnConfirmar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);

        nuevoBtn.addEventListener('click', async function () {
            modal.hide();
            await ejecutarAccion(`/papelera/restaurar/${id}`, id, 'restaurar');
        });
    }

    function confirmarRestaurarCarpeta(btn) {
        const id     = btn.dataset.id;
        const titulo = btn.dataset.titulo;

        document.getElementById('modal-restaurar-titulo').textContent = `la carpeta "${titulo}" y todas sus notas`;

        const modal = new bootstrap.Modal(document.getElementById('modalRestaurar'));
        modal.show();

        const btnConfirmar = document.getElementById('btn-confirmar-restaurar');
        const nuevoBtn = btnConfirmar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);

        nuevoBtn.addEventListener('click', async function () {
            modal.hide();
            await ejecutarAccionCarpeta(`/papelera/restaurar-carpeta/${id}`, id, 'restaurar');
        });
    }


    /* ──────────────────────────────────────────
       ELIMINAR DEFINITIVAMENTE
    ────────────────────────────────────────── */
    function confirmarEliminar(btn) {
        const id     = btn.dataset.id;
        const titulo = btn.dataset.titulo;

        document.getElementById('modal-eliminar-titulo').textContent = `"${titulo}"`;

        const modal = new bootstrap.Modal(document.getElementById('modalEliminar'));
        modal.show();

        const btnConfirmar = document.getElementById('btn-confirmar-eliminar');
        const nuevoBtn = btnConfirmar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);

        nuevoBtn.addEventListener('click', async function () {
            modal.hide();
            await ejecutarAccion(`/papelera/eliminar/${id}`, id, 'eliminar');
        });
    }

    function confirmarEliminarCarpeta(btn) {
        const id     = btn.dataset.id;
        const titulo = btn.dataset.titulo;

        document.getElementById('modal-eliminar-titulo').textContent = `la carpeta "${titulo}" y TODAS sus notas`;

        const modal = new bootstrap.Modal(document.getElementById('modalEliminar'));
        modal.show();

        const btnConfirmar = document.getElementById('btn-confirmar-eliminar');
        const nuevoBtn = btnConfirmar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);

        nuevoBtn.addEventListener('click', async function () {
            modal.hide();
            await ejecutarAccionCarpeta(`/papelera/eliminar-carpeta/${id}`, id, 'eliminar');
        });
    }


    /* ──────────────────────────────────────────
       VACIAR TODA LA PAPELERA
    ────────────────────────────────────────── */
    function confirmarVaciarTodo() {
        const modal = new bootstrap.Modal(document.getElementById('modalVaciar'));
        modal.show();
    }

    async function vaciarPapelera() {
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalVaciar'));
        if (modalInstance) modalInstance.hide();

        try {
            const resp = await fetch('/papelera/vaciar', { method: 'POST' });
            const data = await resp.json();

            if (data.success) {
                document.querySelectorAll('.nota-papelera').forEach(el => el.remove());
                actualizarContador();
                mostrarVacia();
                mostrarToast('Papelera vaciada correctamente', 'success');
            } else {
                mostrarToast(data.error || 'Error al vaciar la papelera', 'error');
            }
        } catch (e) {
            console.error(e);
            mostrarToast('Error de conexión al vaciar la papelera', 'error');
        }
    }


    /* ──────────────────────────────────────────
       ACCIÓN GENÉRICA (restaurar / eliminar)
    ────────────────────────────────────────── */
    async function ejecutarAccion(url, id, tipo) {
        try {
            const resp = await fetch(url, { method: 'POST' });
            const data = await resp.json();

            if (data.success) {
                const card = document.getElementById(`nota-${id}`);
                if (card) {
                    card.style.transition = 'opacity 0.35s, transform 0.35s';
                    card.style.opacity    = '0';
                    card.style.transform  = 'translateX(30px)';
                    setTimeout(() => {
                        card.remove();
                        actualizarContador();
                    }, 360);
                }
                const msg = tipo === 'restaurar'
                    ? 'Nota restaurada correctamente'
                    : 'Nota eliminada definitivamente';
                mostrarToast(msg, 'success');
            } else {
                mostrarToast(data.error || 'Error al procesar la acción', 'error');
            }
        } catch (e) {
            console.error(e);
            mostrarToast('Error de conexión', 'error');
        }
    }

    async function ejecutarAccionCarpeta(url, id, tipo) {
        try {
            const resp = await fetch(url, { method: 'POST' });
            const data = await resp.json();

            if (data.success) {
                const card = document.getElementById(`carpeta-${id}`);
                if (card) {
                    card.style.transition = 'opacity 0.35s, transform 0.35s';
                    card.style.opacity    = '0';
                    card.style.transform  = 'scale(0.9)';
                    setTimeout(() => {
                        card.remove();
                        actualizarContador();
                    }, 360);
                }
                const msg = tipo === 'restaurar'
                    ? 'Carpeta restaurada correctamente'
                    : 'Carpeta eliminada definitivamente';
                mostrarToast(msg, 'success');
            } else {
                mostrarToast(data.error || 'Error al procesar la acción', 'error');
            }
        } catch (e) {
            console.error(e);
            mostrarToast('Error de conexión', 'error');
        }
    }


    /* ──────────────────────────────────────────
       CONTADOR Y ESTADO VACÍO
    ────────────────────────────────────────── */
    function actualizarContador() {
        const totalNotas    = document.querySelectorAll('.nota-papelera:not(.carpeta-papelera)').length;
        const totalCarpetas = document.querySelectorAll('.carpeta-papelera').length;
        
        actualizarBadge(totalNotas, totalCarpetas);
        
        if (totalNotas === 0 && totalCarpetas === 0) {
            mostrarVacia();
        }

        // Ocultar cabeceras si no hay elementos
        const headCarpetas = document.getElementById('header-carpetas');
        if (headCarpetas) headCarpetas.style.display = totalCarpetas === 0 ? 'none' : '';

        const headNotas = document.getElementById('header-notas');
        if (headNotas) headNotas.style.display = totalNotas === 0 ? 'none' : '';
    }

    function actualizarBadge(totalNotas, totalCarpetas) {
        const badgeNotas = document.getElementById('badge-total');
        if (badgeNotas) badgeNotas.textContent = totalNotas;

        const badgeCarp = document.getElementById('badge-carpetas');
        if (badgeCarp) badgeCarp.textContent = totalCarpetas;

        // Ocultar botón "Vaciar papelera" si no hay nada
        const totalTotal = totalNotas + totalCarpetas;
        const btnVaciar = document.getElementById('btn-vaciar-todo');
        if (btnVaciar) btnVaciar.style.display = totalTotal === 0 ? 'none' : '';
    }

    function mostrarVacia() {
        const lista = document.getElementById('lista-papelera');
        if (lista && !lista.querySelector('.papelera-vacia')) {
            lista.innerHTML = `
                <div class="papelera-vacia">
                    <i class="fas fa-trash-alt"></i>
                    <p>La papelera está vacía. ¡Todo en orden!</p>
                </div>`;
        }
    }


    /* ──────────────────────────────────────────
       MODAL FORMATO (crear nota)
    ────────────────────────────────────────── */
    function abrirFormato() {
        document.getElementById('formato-modal').classList.add('visible');
        document.getElementById('formato-backdrop').classList.add('visible');
    }
    function cerrarFormato() {
        document.getElementById('formato-modal').classList.remove('visible');
        document.getElementById('formato-backdrop').classList.remove('visible');
    }
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') cerrarFormato();
    });

// Boton de hamburguesa funcion
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hambBtn = document.getElementById('hamburger-btn');

    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('visible', isOpen);
    hambBtn.classList.toggle('hidden', isOpen);
}
