// admin_modal.js – modales premium del panel admin
// Usa clases 'nf-backdrop' / 'nf-modal-win' para no colisionar con Bootstrap.

(function () {
  'use strict';

  /* ── helpers ── */
  function qs(id) { return document.getElementById(id); }

  /* ── abrir / cerrar ── */
  function openModal(title, bodyHTML) {
    qs('nf-modal-backdrop').style.display = 'flex';
    qs('nf-modal-title').textContent = title;
    qs('nf-modal-body').innerHTML    = bodyHTML;
    document.body.style.overflow     = 'hidden';
  }

  function closeModal() {
    var el = qs('nf-modal-backdrop');
    if (el) el.style.display = 'none';
    document.body.style.overflow = '';
  }

  /* ── listener global: cerrar con X o click fuera ── */
  document.addEventListener('click', function (e) {
    // X del modal
    if (e.target.closest('.nf-modal-close')) {
      closeModal();
      return;
    }
    // clic en el fondo
    if (e.target.id === 'nf-modal-backdrop') {
      closeModal();
    }
  });

  /* ── listener global: botones admin-btn ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.admin-btn');
    if (!btn) return;

    var type  = btn.dataset.modal  || '';
    var title = btn.dataset.title  || 'Información';
    var msg   = btn.dataset.message || '';

    if (type === 'alerta') {
      openModal(title,
        '<div class="nf-alert nf-alert-warning">' +
          '<i class="fas fa-exclamation-triangle"></i> ' + msg +
        '</div>'
      );

    } else if (type === 'cerrar-sesion') {
      openModal(title,
        '<p style="margin:0 0 16px">¿Estás seguro de que deseas cerrar sesión?</p>' +
        '<div style="display:flex;justify-content:flex-end;gap:10px">' +
          '<button id="nf-cancel-logout"  class="nf-btn nf-btn-secondary">Cancelar</button>' +
          '<button id="nf-confirm-logout" class="nf-btn nf-btn-danger">Cerrar sesión</button>' +
        '</div>'
      );

      // adjuntar handlers DESPUÉS de que el HTML haya sido insertado
      qs('nf-cancel-logout').onclick  = closeModal;
      qs('nf-confirm-logout').onclick = function () {
        window.location.href = '/logout';
      };
    }
  });

})();

