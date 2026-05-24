import React, { useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   NfModal – modal premium que replica el estilo del dashboard.css
   (modalPop, border-radius 24px, gradiente rojo en header, etc.)
   ═══════════════════════════════════════════════════════════════ */

/* Inyectar los keyframes una sola vez en el <head> */
if (!document.getElementById('nf-modal-kf')) {
  const s = document.createElement('style');
  s.id = 'nf-modal-kf';
  s.textContent = `
    @keyframes nf-modalPop {
      0%   { opacity: 0; transform: scale(0.92) translateY(20px); }
      100% { opacity: 1; transform: scale(1)    translateY(0);     }
    }
    @keyframes nf-fadeBackdrop {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .nf-modal-backdrop-wrap {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      padding-top: 3px;
      animation: nf-fadeBackdrop 0.2s ease both;
    }
    .nf-modal-content {
      border: none !important;
      border-radius: 24px !important;
      overflow: hidden !important;
      box-shadow: 0 30px 70px rgba(0,0,0,0.25) !important;
      font-family: 'Plus Jakarta Sans', sans-serif !important;
      background: #fff;
      min-width: 340px; max-width: 480px; width: 90%;
      animation: nf-modalPop 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .nf-modal-header {
      padding: 24px 32px !important;
      border-bottom: 1px solid rgba(0,0,0,0.05) !important;
      position: relative;
      background: #fff;
    }
    .nf-modal-header::before {
      content: "";
      position: absolute;
      top: 0; left: 0; width: 100%; height: 5px;
      background: linear-gradient(90deg, #dc2626, #ef4444);
    }
    .nf-modal-title-text {
      font-weight: 800 !important;
      font-size: 1.2rem !important;
      letter-spacing: -0.02em;
      display: flex; align-items: center; gap: 12px;
      color: #212529;
    }
    .nf-modal-title-text i { font-size: 1.3rem; color: #dc2626; }
    .nf-modal-close-x {
      position: absolute; top: 16px; right: 20px;
      background: none; border: none;
      font-size: 1.35rem; cursor: pointer; color: #6c757d;
      line-height: 1; padding: 4px;
      transition: color .15s;
    }
    .nf-modal-close-x:hover { color: #212529; }
    .nf-modal-body {
      padding: 28px 32px !important;
      font-size: 1.05rem !important;
      line-height: 1.6;
      font-weight: 500;
      color: #495057;
    }
    .nf-modal-footer {
      padding: 16px 32px 24px !important;
      border-top: 1px solid rgba(0,0,0,0.05) !important;
      display: flex; justify-content: flex-end; gap: 14px;
      background: #f8f9fa;
    }
    /* Botones del modal */
    .nf-btn-modal {
      padding: 12px 26px !important;
      border-radius: 14px !important;
      font-weight: 700 !important;
      font-size: 0.93rem !important;
      transition: all 0.25s cubic-bezier(0.4,0,0.2,1) !important;
      border: none !important;
      display: inline-flex !important; align-items: center; gap: 8px;
      cursor: pointer;
    }
    .nf-btn-modal:hover { transform: translateY(-2px) scale(1.02); }
    .nf-btn-danger-modal {
      background: linear-gradient(135deg, #dc2626, #ef4444) !important;
      color: #fff !important;
      box-shadow: 0 6px 18px rgba(220,38,38,0.28) !important;
    }
    .nf-btn-danger-modal:hover { box-shadow: 0 10px 24px rgba(220,38,38,0.42) !important; }
    .nf-btn-secondary-modal {
      background: #f1f5f9 !important;
      color: #475569 !important;
    }
    .nf-btn-secondary-modal:hover { background: #e2e8f0 !important; }
    .nf-btn-primary-modal {
      background: linear-gradient(135deg, #5452d3, #7c6af7) !important;
      color: #fff !important;
      box-shadow: 0 6px 18px rgba(84,82,211,0.28) !important;
    }
    .nf-btn-primary-modal:hover { box-shadow: 0 10px 24px rgba(84,82,211,0.42) !important; }
    /* Alertas internas */
    .nf-alert-inner {
      display: flex; align-items: flex-start; gap: 12px;
      border-radius: 12px; padding: 14px 16px;
      font-size: 0.93rem; font-weight: 500; margin-bottom: 6px;
    }
    .nf-alert-inner i { margin-top: 2px; flex-shrink: 0; }
    .nf-alert-warning-inner { background: rgba(241,196,15,0.12); border: 1.5px solid #f1c40f; color: #7d6608; }
    .nf-alert-danger-inner  { background: rgba(231,76,60,0.12);  border: 1.5px solid #e74c3c; color: #922b21; }
    .nf-alert-success-inner { background: rgba(46,204,113,0.12); border: 1.5px solid #2ecc71; color: #1e8449; }
    /* Modo oscuro */
    body.tema-oscuro .nf-modal-content,
    body.tema-oscuro .nf-modal-header {
      background: #0f172a !important; color: #f1f5f9 !important;
      border-color: rgba(255,255,255,0.08) !important;
    }
    body.tema-oscuro .nf-modal-title-text { color: #f1f5f9 !important; }
    body.tema-oscuro .nf-modal-body { color: #cbd5e1 !important; }
    body.tema-oscuro .nf-modal-footer { background: rgba(30,41,59,0.5) !important; border-color: rgba(255,255,255,0.06) !important; }
    body.tema-oscuro .nf-btn-secondary-modal { background: #334155 !important; color: #e2e8f0 !important; }
    body.tema-oscuro .nf-btn-secondary-modal:hover { background: #475569 !important; }
    body.tema-oscuro .nf-alert-warning-inner { color: #fcd34d !important; }
    body.tema-oscuro .nf-alert-danger-inner  { color: #fca5a5 !important; }
    body.tema-oscuro .nf-alert-success-inner { color: #86efac !important; }
    body.tema-oscuro .nf-modal-close-x { color: #94a3b8; }
    body.tema-oscuro .nf-modal-close-x:hover { color: #f1f5f9; }
  `;
  document.head.appendChild(s);
}

/* ── Componente principal ── */
export function NfModal({ title, children, onClose, footer }) {
  return (
    <div className="nf-modal-backdrop-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nf-modal-content">
        <div className="nf-modal-header">
          <div className="nf-modal-title-text">{title}</div>
          <button className="nf-modal-close-x" onClick={onClose} aria-label="Cerrar">&times;</button>
        </div>
        <div className="nf-modal-body">{children}</div>
        {footer && <div className="nf-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Alertas internas ── */
export const NfAlert = {
  Warning: ({ children }) => (
    <div className="nf-alert-inner nf-alert-warning-inner">
      <i className="fas fa-exclamation-triangle" />
      <span>{children}</span>
    </div>
  ),
  Danger: ({ children }) => (
    <div className="nf-alert-inner nf-alert-danger-inner">
      <i className="fas fa-times-circle" />
      <span>{children}</span>
    </div>
  ),
  Success: ({ children }) => (
    <div className="nf-alert-inner nf-alert-success-inner">
      <i className="fas fa-check-circle" />
      <span>{children}</span>
    </div>
  ),
};

/* ── Botones ── */
export const NfBtn = {
  Danger:    ({ children, ...p }) => <button className="nf-btn-modal nf-btn-danger-modal"    {...p}>{children}</button>,
  Secondary: ({ children, ...p }) => <button className="nf-btn-modal nf-btn-secondary-modal" {...p}>{children}</button>,
  Primary:   ({ children, ...p }) => <button className="nf-btn-modal nf-btn-primary-modal"   {...p}>{children}</button>,
};

/* ── Hook ── */
export function useNfModal() {
  const [modal, setModal] = useState(null);
  const openModal  = useCallback((config) => setModal(config), []);
  const closeModal = useCallback(() => setModal(null), []);
  return { modal, openModal, closeModal };
}

export default NfModal;
