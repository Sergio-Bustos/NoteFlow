import React, { useState, useEffect, useRef } from 'react';

const SupportChat = () => {
  const [activeChats, setActiveChats] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const chatBodyRef = useRef(null);

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
      const interval = setInterval(() => loadMessages(selectedUserId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedUserId) return;
    try {
      const response = await fetch('/api/soporte-admin/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.CSRF_TOKEN || '' },
        body: JSON.stringify({ user_id: selectedUserId, mensaje: replyText })
      });
      if (response.ok) {
        setReplyText('');
        loadMessages(selectedUserId);
        loadChats();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const activeChatData = activeChats.find(c => c.ID_Cuenta == selectedUserId);

  return (
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
                  {chat.Nombres} ({plan.toUpperCase()}) - {chat.Ultimo_Mensaje.substring(0, 20)}...
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
          <div className="chat-active-user-info">
            <img id="active-user-photo" src={activeChatData?.Foto && activeChatData.Foto !== 'None' ? `/static/${activeChatData.Foto}` : '/static/default_profile.png'} alt="" className="chat-avatar" />
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

          <div id="admin-chat-body" className="admin-chat-body" ref={chatBodyRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.Remitente}`}>
                {msg.Mensaje}
                <span className="message-time">{msg.Fecha}</span>
              </div>
            ))}
          </div>

          <div className="chat-footer">
            <input 
              type="text" 
              id="admin-reply-input" 
              placeholder="Escribe tu respuesta..." 
              autoComplete="off"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
            />
            <button id="admin-send-btn" onClick={handleSendReply}>
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportChat;
