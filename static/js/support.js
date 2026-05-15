/**
 * NoteFlow Support Widget Logic
 * Internal Chat System
 */

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('support-btn');
    const windowChat = document.getElementById('support-window');
    const input = document.getElementById('support-input');
    const sendBtn = document.getElementById('support-send');
    const chatBody = document.getElementById('support-body');

    let pollingInterval = null;
    
    // Function to get CSRF token from cookies
    const getCSRFToken = () => {
        const name = 'csrf_token=';
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : '';
    };

    // Detectar si la página fue refrescada (F5) o es una nueva pestaña/sesión
    const navEntries = performance.getEntriesByType("navigation");
    const isReload = navEntries.length > 0 && navEntries[0].type === 'reload';
    const isNewSession = !sessionStorage.getItem('support_session_active');

    if (isReload || isNewSession) {
        // Si es un refresco literal o una nueva sesión, limpiamos el chat en el servidor
        fetch('/api/limpiar-soporte', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        }).then(response => {
            if (response.ok) {
                console.log('Chat de soporte reiniciado');
            }
        }).catch(err => console.error('Error al reiniciar chat:', err));
        
        // Marcar la sesión como activa para que no se borre al navegar
        sessionStorage.setItem('support_session_active', 'true');
    }

    // Toggle Chat Window
    btn.addEventListener('click', () => {
        const isActive = windowChat.classList.toggle('active');
        btn.classList.toggle('active');
        
        // Change icon based on state
        const icon = btn.querySelector('i');
        if (isActive) {
            icon.className = 'fas fa-times';
            loadMessages();
            // Iniciar polling cada 5 segundos cuando está abierto
            pollingInterval = setInterval(loadMessages, 5000);
        } else {
            icon.className = 'fas fa-comment-dots';
            if (pollingInterval) clearInterval(pollingInterval);
        }
    });

    const loadMessages = async () => {
        try {
            const response = await fetch('/api/mensajes-soporte');
            const mensajes = await response.json();
            
            if (Array.isArray(mensajes)) {
                // Solo limpiar y renderizar si hay cambios o es la primera vez
                // Para simplificar, renderizamos siempre si hay mensajes
                renderChat(mensajes);
            }
        } catch (error) {
            console.error('Error al cargar mensajes de soporte:', error);
        }
    };

    const renderChat = (mensajes) => {
        // Mantener el mensaje de bienvenida fijo arriba
        const welcomeMsg = `
            <div class="support-message received">
                Bienvenido al soporte de NoteFlow. Si tiene alguna duda o reporte de problemas, comuníquese aquí.Por favor esperar a que alguien le responda antes de cerrar sesion o reiniciar pagina 
                <span class="support-time">Sistema</span>
            </div>
        `;
        
        let html = welcomeMsg;
        mensajes.forEach(msg => {
            const type = msg.Remitente === 'usuario' ? 'sent' : 'received';
            html += `
                <div class="support-message ${type}">
                    ${msg.Mensaje}
                    <span class="support-time">${msg.Fecha}</span>
                </div>
            `;
        });
        
        const oldScrollTop = chatBody.scrollTop;
        const wasAtBottom = chatBody.scrollHeight - chatBody.scrollTop <= chatBody.clientHeight + 10;
        
        chatBody.innerHTML = html;
        
        if (wasAtBottom) {
            chatBody.scrollTop = chatBody.scrollHeight;
        } else {
            chatBody.scrollTop = oldScrollTop;
        }
    };

    // Send Message Logic
    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        // Limpiar input inmediatamente
        input.value = '';

        try {
            const response = await fetch('/api/enviar-soporte', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({ mensaje: text })
            });

            if (response.ok) {
                loadMessages(); // Recargar para ver el mensaje enviado
            } else {
                console.error('Error al enviar mensaje');
            }
        } catch (error) {
            console.error('Error de red al enviar soporte:', error);
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});
