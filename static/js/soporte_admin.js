/**
 * Admin Support Panel Logic - Refined
 */

document.addEventListener('DOMContentLoaded', () => {
    const chatsList = document.getElementById('chats-list');
    const noChatSelected = document.getElementById('no-chat-selected');
    const activeChat = document.getElementById('active-chat');
    const chatBody = document.getElementById('admin-chat-body');
    const replyInput = document.getElementById('admin-reply-input');
    const sendBtn = document.getElementById('admin-send-btn');
    const themeBtn = document.getElementById('theme-toggle-admin');
    
    // User details in header
    const activeUserName = document.getElementById('active-user-name');
    const activeUserPhoto = document.getElementById('active-user-photo');
    const activeUserPlan = document.getElementById('active-user-plan');

    let currentUserId = null;
    let pollingInterval = null;

    // --- THEME MANAGEMENT ---
    const toggleTheme = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('admin-theme', newTheme);
        
        themeBtn.querySelector('i').className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    };

    // Initialize Theme
    const savedTheme = localStorage.getItem('admin-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeBtn.querySelector('i').className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    themeBtn.addEventListener('click', toggleTheme);

    // --- CHAT LOGIC ---
    const loadChats = async () => {
        try {
            const response = await fetch('/api/soporte-admin/chats');
            const chats = await response.json();
            
            if (Array.isArray(chats)) {
                renderChatsList(chats);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    };

    const renderChatsList = (chats) => {
        if (chats.length === 0) {
            chatsList.innerHTML = '<div class="loading-state">No hay mensajes de soporte aún.</div>';
            return;
        }

        chatsList.innerHTML = chats.map(chat => {
            const planClass = `premium-${chat.Plan_premium || 'gratis'}`;
            const photoUrl = chat.Foto ? `/static/${chat.Foto}` : '/static/default_profile.png';
            
            return `
                <div class="chat-item ${currentUserId === chat.ID_Cuenta ? 'active' : ''}" 
                     onclick="selectChat(${chat.ID_Cuenta}, '${chat.Nombres}', '${photoUrl}', '${chat.Plan_premium || 'gratis'}')">
                    <img src="${photoUrl}" alt="" class="chat-avatar">
                    <div class="chat-info">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h4>${chat.Nombres}</h4>
                            <span class="plan-badge ${planClass}" style="font-size:0.5rem; padding: 1px 4px;">${chat.Plan_premium || 'Gratis'}</span>
                        </div>
                        <p>${chat.Ultimo_Mensaje}</p>
                    </div>
                </div>
            `;
        }).join('');
    };

    window.selectChat = (userId, name, photo, plan) => {
        currentUserId = userId;
        activeUserName.textContent = name;
        activeUserPhoto.src = photo;
        
        // Update Plan Badge
        activeUserPlan.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
        activeUserPlan.className = `plan-badge premium-${plan}`;
        
        noChatSelected.style.display = 'none';
        activeChat.style.display = 'flex';
        
        // Update sidebar active state
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
        
        loadMessages();
        
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(loadMessages, 3000);
    };

    const loadMessages = async () => {
        if (!currentUserId) return;

        try {
            const response = await fetch(`/api/soporte-admin/mensajes/${currentUserId}`);
            const mensajes = await response.json();
            
            if (Array.isArray(mensajes)) {
                renderMessages(mensajes);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    };

    const renderMessages = (mensajes) => {
        const wasAtBottom = chatBody.scrollHeight - chatBody.scrollTop <= chatBody.clientHeight + 50;
        
        chatBody.innerHTML = mensajes.map(msg => `
            <div class="message ${msg.Remitente}">
                ${msg.Mensaje}
                <span class="message-time">${msg.Fecha}</span>
            </div>
        `).join('');
        
        if (wasAtBottom) {
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    };

    const getCSRFToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : '';
    };

    const sendReply = async () => {
        const text = replyInput.value.trim();
        if (!text || !currentUserId) return;

        replyInput.value = '';

        try {
            const response = await fetch('/api/soporte-admin/responder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({
                    user_id: currentUserId,
                    mensaje: text
                })
            });

            if (response.ok) {
                loadMessages();
                loadChats(); 
            }
        } catch (error) {
            console.error('Error sending reply:', error);
        }
    };

    sendBtn.addEventListener('click', sendReply);
    replyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendReply();
    });

    // Initial load
    loadChats();
    setInterval(loadChats, 10000); 
});
