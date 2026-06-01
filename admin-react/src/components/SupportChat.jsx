import React, { useState, useEffect, useRef } from 'react';
import { NfModal, NfBtn, NfAlert, useNfModal } from './NfModal';

const SupportChat = () => {
  const [activeChats, setActiveChats] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const chatBodyRef = useRef(null);
  const textareaRef = useRef(null);
  const { modal, openModal, closeModal } = useNfModal();

  const loadChats = async () => {
    try {
      const response = await fetch('/api/soporte-admin/chats');
      if (response.ok) {
        const data = await response.json();
        setActiveChats(data);
      }
    } catch (error) {
      console.error('Error fetching active chats:', error);
    }
  };

  const loadMessages = async (userId) => {
    try {
      const response = await fetch(`/api/soporte-admin/mensajes/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadMessages(selectedUserId);
      const interval = setInterval(() => loadMessages(selectedUserId), 2000);
      return () => clearInterval(interval);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '38px';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [replyText]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || !selectedUserId) return;

    setReplyText('');

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempId = Date.now();

    const optimisticMessage = {
      id: tempId,
      Mensaje: text,
      Remitente: 'soporte',
      Fecha: timeStr,
      pending: true,
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const response = await fetch('/api/soporte-admin/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.CSRF_TOKEN || '' },
        body: JSON.stringify({ user_id: selectedUserId, mensaje: text }),
      });
      if (response.ok) {
        loadMessages(selectedUserId);
        loadChats();
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, error: true } : m));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, error: true } : m));
    }
  };

  /* ── Terminar chat: abre modal en lugar de confirm() ── */
  const handleResolveChat = () => {
    if (!selectedUserId) return;
    openModal({ type: 'confirm-resolve' });
  };

  const confirmResolve = async () => {
    closeModal();
    try {
      const response = await fetch('/api/soporte-admin/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.CSRF_TOKEN || '' },
        body: JSON.stringify({ user_id: selectedUserId }),
      });
      if (response.ok) {
        setSelectedUserId(null);
        setMessages([]);
        loadChats();
        openModal({ type: 'result', variant: 'success', message: 'Chat resuelto y usuario notificado correctamente.' });
      } else {
        openModal({ type: 'result', variant: 'danger', message: 'Error al resolver el chat.' });
      }
    } catch (error) {
      console.error('Error resolving chat:', error);
      openModal({ type: 'result', variant: 'danger', message: 'Error de red al resolver el chat.' });
    }
  };

  const activeChatData = activeChats.find(c => c.ID_Cuenta == selectedUserId);

  return (
    <>
      <div className="admin-chat-widget">
        <div className="chat-widget-header">
          <div className="header-main-title">
            <h3><i className="fas fa-comments"></i> Chat Soporte</h3>
          </div>
          <div className="chat-user-select-container">
            <label htmlFor="select-chat-usuario">Conversación:</label>
            <select
              id="select-chat-usuario"
              className="form-select chat-dropdown-selector"
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Selecciona un chat activo...</option>
              {activeChats.map(chat => {
                const plan = chat.Plan_premium || 'gratis';
                return (
                  <option key={chat.ID_Cuenta} value={chat.ID_Cuenta}>
                    {chat.Nombres} ({plan.toUpperCase()}) - {(chat.Ultimo_Mensaje || '').substring(0, 20)}...
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {!selectedUserId ? (
          <div id="no-chat-selected" className="chat-empty-state">
            <i className="fas fa-comment-dots"></i>
            <h4>Sin chat seleccionado</h4>
            <p>Elige un usuario del selector superior para iniciar la conversación.</p>
          </div>
        ) : (
          <div id="active-chat" className="chat-active-container">
            <div className="chat-active-user-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img
                  id="active-user-photo"
                  src={activeChatData?.Foto && activeChatData.Foto !== 'None' ? (activeChatData.Foto.startsWith('http') ? activeChatData.Foto : `/static/${activeChatData.Foto}`) : '/static/default_profile.png'}
                  alt=""
                  className="chat-avatar"
                />
                <div className="user-details-wrap">
                  <div className="name-plan">
                    <h4 id="active-user-name">{activeChatData?.Nombres || 'Usuario'}</h4>
                    <span id="active-user-plan" className={`plan-badge premium-${activeChatData?.Plan_premium || 'gratis'}`}>
                      {(activeChatData?.Plan_premium || 'gratis').charAt(0).toUpperCase() + (activeChatData?.Plan_premium || 'gratis').slice(1)}
                    </span>
                  </div>
                  <span id="active-user-status"><i className="fas fa-circle text-success"></i> Chat activo</span>
                </div>
              </div>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={handleResolveChat}
                title="Terminar y resolver chat"
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.25rem' }}
              >
                <i className="fas fa-check-circle"></i> Terminar Chat
              </button>
            </div>

            <div id="admin-chat-body" className="admin-chat-body" ref={chatBodyRef}>
              {messages.map((msg, idx) => {
                const isPending = msg.pending;
                const hasError = msg.error;
                let style = {};
                if (isPending) style = { opacity: 0.7 };
                if (hasError) style = { border: '1px solid #ff7675' };
                return (
                  <div key={idx} className={`message ${msg.Remitente}`} style={style}>
                    {msg.Mensaje}
                    <span className="message-time">
                      {msg.Fecha}
                      {isPending && !hasError && <i className="fas fa-spinner fa-spin" style={{ marginLeft: '4px' }}></i>}
                      {hasError && <span style={{ color: '#ff7675', marginLeft: '4px' }}>(Error)</span>}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="chat-footer">
              <textarea
                id="admin-reply-input"
                placeholder="Escribe tu respuesta..."
                autoComplete="off"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                ref={textareaRef}
              />
              <button id="admin-send-btn" onClick={handleSendReply}>
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal confirmar terminar chat ── */}
      {modal?.type === 'confirm-resolve' && (
        <NfModal
          title={<><i className="fas fa-check-circle"></i> Terminar Chat</>}
          onClose={closeModal}
          footer={
            <>
              <NfBtn.Secondary onClick={closeModal}>Cancelar</NfBtn.Secondary>
              <NfBtn.Danger onClick={confirmResolve}>
                <i className="fas fa-check"></i> Sí, terminar
              </NfBtn.Danger>
            </>
          }
        >
          <NfAlert.Warning>
            Esto cerrará la conversación, limpiará el historial y <strong>notificará al usuario por correo</strong>. Esta acción no se puede deshacer.
          </NfAlert.Warning>
          <p style={{ margin: '10px 0 0', color: 'inherit' }}>¿Estás seguro de que deseas terminar y resolver este chat?</p>
        </NfModal>
      )}

      {/* ── Modal resultado ── */}
      {modal?.type === 'result' && (
        <NfModal
          title="Resultado"
          onClose={closeModal}
          footer={<NfBtn.Primary onClick={closeModal}>Aceptar</NfBtn.Primary>}
        >
          {modal.variant === 'success' && <NfAlert.Success>{modal.message}</NfAlert.Success>}
          {modal.variant === 'danger'  && <NfAlert.Danger>{modal.message}</NfAlert.Danger>}
        </NfModal>
      )}
    </>
  );
};

export default SupportChat;