/**
 * NoteFlow - Unified Admin Control Panel JavaScript
 * Handles Dashboard Stats, Users Management (Search, Plain/Hashed Password Toggle, Cascading Delete)
 * and real-time Support System with drop-down conversation selection.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Aplicar tema según el usuario (Blanco/Negro)
    const esOscuro = window.COLOR_PRINCIPAL === 'Negro';
    document.body.classList.toggle('tema-oscuro', esOscuro);
    document.body.classList.toggle('tema-claro', !esOscuro);

    // Tab switching elements
    const tabDashboardBtn = document.getElementById('tab-dashboard-btn');
    const tabUsersBtn = document.getElementById('tab-users-btn');
    const contentDashboard = document.getElementById('content-dashboard');
    const contentUsers = document.getElementById('content-users');

    // Stats elements
    const valTotalRegistrados = document.getElementById('val-total-registrados');
    const valUsuariosPremium = document.getElementById('val-usuarios-premium');
    const valUsuariosGratis = document.getElementById('val-usuarios-gratis');
    const valUsuariosActivos = document.getElementById('val-usuarios-activos');
    const valIngresosTotales = document.getElementById('val-ingresos-totales');
    const valNotasCreadas = document.getElementById('val-notas-creadas');

    // Users list elements
    const usuariosTabla = document.getElementById('usuarios-lista-tabla');
    const buscarUsuarioInput = document.getElementById('buscar-usuario');

    // Support Chat elements
    const chatUserSelector = document.getElementById('select-chat-usuario');
    const noChatSelected = document.getElementById('no-chat-selected');
    const activeChat = document.getElementById('active-chat');
    const chatBody = document.getElementById('admin-chat-body');
    const replyInput = document.getElementById('admin-reply-input');
    const sendBtn = document.getElementById('admin-send-btn');
    
    // User details in active chat header
    const activeUserName = document.getElementById('active-user-name');
    const activeUserPhoto = document.getElementById('active-user-photo');
    const activeUserPlan = document.getElementById('active-user-plan');

    let allUsers = [];
    let activeChats = [];
    let visiblePasswords = {}; // Keeps track of password visibility by user ID
    let currentUserId = null;
    let pollingInterval = null;
    let activeTab = 'dashboard';

    // Delete account elements
    const deleteModalEl = document.getElementById('deleteUserModal');
    const deleteModal = new bootstrap.Modal(deleteModalEl);
    const deleteModalUserName = document.getElementById('delete-modal-user-name');
    const confirmDeleteBtn = document.getElementById('confirm-delete-user-btn');
    let userToDeleteId = null;

    // --- TAB SWITCHING SYSTEM ---
    window.cambiarPestana = (tabName) => {
        activeTab = tabName;
        
        if (tabName === 'dashboard') {
            tabDashboardBtn.classList.add('active');
            tabUsersBtn.classList.remove('active');
            contentDashboard.classList.add('active');
            contentUsers.classList.remove('active');
            loadEstadisticas();
        } else {
            tabDashboardBtn.classList.remove('active');
            tabUsersBtn.classList.add('active');
            contentDashboard.classList.remove('active');
            contentUsers.classList.add('active');
            loadUsers();
        }
    };

    // --- DASHBOARD STATS LOADER ---
    const loadEstadisticas = async () => {
        try {
            const response = await fetch('/api/admin/estadisticas');
            const data = await response.json();
            
            if (response.ok) {
                valTotalRegistrados.textContent = data.total_registrados || '0';
                valUsuariosPremium.textContent = data.premium || '0';
                valUsuariosGratis.textContent = data.gratis || '0';
                valUsuariosActivos.textContent = data.activos || '0';
                
                // Formatear ingresos en COP
                const copFormatter = new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    minimumFractionDigits: 0
                });
                valIngresosTotales.textContent = copFormatter.format(data.ingresos || 0);
                
                valNotasCreadas.textContent = data.notas_creadas || '0';
            }
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        }
    };

    // --- USERS MANAGEMENT ---
    const loadUsers = async () => {
        try {
            usuariosTabla.innerHTML = `
                <tr>
                    <td colspan="5" class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i> Cargando cuentas registradas...
                    </td>
                </tr>
            `;
            const response = await fetch('/api/admin/usuarios');
            const data = await response.json();
            
            if (response.ok && Array.isArray(data)) {
                allUsers = data;
                renderUsersTable(allUsers);
            } else {
                usuariosTabla.innerHTML = `
                    <tr>
                        <td colspan="5" class="loading-state text-danger">
                            <i class="fas fa-exclamation-circle"></i> Error al cargar usuarios: ${data.error || 'Desconocido'}
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Error loading users:', error);
            usuariosTabla.innerHTML = `
                <tr>
                    <td colspan="5" class="loading-state text-danger">
                        <i class="fas fa-exclamation-circle"></i> Error de conexión con el servidor.
                    </td>
                </tr>
            `;
        }
    };

    const renderUsersTable = (users) => {
        if (users.length === 0) {
            usuariosTabla.innerHTML = `
                <tr>
                    <td colspan="5" class="loading-state">
                        No se encontraron usuarios registrados.
                    </td>
                </tr>
            `;
            return;
        }

        usuariosTabla.innerHTML = users.map(user => {
            const photoUrl = user.Foto ? `/static/${user.Foto}` : '/static/default_profile.png';
            const plan = user.Plan_premium || 'gratis';
            const planClass = `premium-${plan}`;
            const premiumLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
            
            // Password logic
            const rawPassword = user.Contraseña || '';
            const isHashed = rawPassword.startsWith('pbkdf2:sha256:') || rawPassword.startsWith('scrypt:') || rawPassword.startsWith('bcrypt:');
            const showPass = visiblePasswords[user.ID_Cuenta] === true;
            
            let passwordContent = '';
            if (showPass) {
                if (isHashed) {
                    passwordContent = `<span class="badge-hashed"><i class="fas fa-shield-alt"></i> Encriptada</span>`;
                } else {
                    passwordContent = `<span class="password-text text-danger">${rawPassword}</span>`;
                }
            } else {
                passwordContent = `<span class="password-text">••••••••</span>`;
            }

            const eyeIcon = showPass ? 'fas fa-eye-slash' : 'fas fa-eye';

            const deleteButton = user.ID_Cuenta === 1 
                ? `<span class="text-muted" style="font-size: 0.78rem; font-weight:700;"><i class="fas fa-lock"></i> Principal</span>`
                : `<button class="btn-delete-user" onclick="abrirConfirmarEliminar(${user.ID_Cuenta}, '${user.Nombres} ${user.Apellidos}')">
                       <i class="fas fa-trash-alt"></i> Eliminar
                   </button>`;

            const adminIcon = user.Es_admin 
                ? ` <span class="badge-hashed" style="background: rgba(46, 204, 113, 0.12); color: #2ecc71; border-color: rgba(46,204,113,0.25); font-size: 0.65rem; padding: 2px 6px; font-weight: 800; margin-left: 5px; display: inline-flex; align-items: center; gap: 3px;"><i class="fas fa-user-shield"></i> ADMIN</span>`
                : '';

            return `
                <tr>
                    <td>
                        <div class="user-identity" onclick="verActividadUsuario(${user.ID_Cuenta})" style="cursor: pointer;" title="Ver toda la actividad y notas de este usuario">
                            <img src="${photoUrl}" alt="">
                            <div class="name-username">
                                <span class="fullname" style="text-decoration: underline; color: var(--color-principal); font-weight: 700;">${user.Nombres} ${user.Apellidos}${adminIcon}</span>
                                <span class="username">@${user.Usuario} (ID: ${user.ID_Cuenta})</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="contact-details">
                            <span class="email">${user.Correo}</span>
                            <span class="phone">${user.Telefono ? `+${user.Telefono}` : 'Sin teléfono'}</span>
                        </div>
                    </td>
                    <td>
                        <span class="plan-badge ${planClass}">${premiumLabel}</span>
                    </td>
                    <td>
                        <div class="password-wrap">
                            ${passwordContent}
                            <button class="btn-toggle-password" onclick="togglePasswordVisibility(${user.ID_Cuenta})" title="Mostrar/Ocultar contraseña">
                                <i class="${eyeIcon}"></i>
                            </button>
                        </div>
                    </td>
                    <td>
                        ${deleteButton}
                    </td>
                </tr>
            `;
        }).join('');
    };

    window.togglePasswordVisibility = (userId) => {
        visiblePasswords[userId] = !visiblePasswords[userId];
        renderUsersTable(allUsers);
    };
    // --- INTERACTIVE USER ACTIVITY ENGINE ---
    window.CURRENT_USER_NOTES = [];
    window.CURRENT_SELECTED_USER_ID = null;

    window.verActividadUsuario = async (userId) => {
        window.CURRENT_SELECTED_USER_ID = userId;

        // Encontrar o inicializar el modal de Bootstrap
        const modalEl = document.getElementById('userActivityModal');
        const activityModal = new bootstrap.Modal(modalEl);
        
        // Colocar cargador en las notas y carpetas mientras carga
        document.getElementById('act-folders-list').innerHTML = `<span class="text-muted"><i class="fas fa-spinner fa-spin"></i> Cargando carpetas...</span>`;
        document.getElementById('act-notes-container').innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="fas fa-spinner fa-spin fa-2x mb-2 text-primary"></i>
                <p class="mb-0">Consultando base de datos de NoteFlow...</p>
            </div>
        `;
        document.getElementById('buscar-nota-usuario').value = '';

        activityModal.show();

        try {
            const response = await fetch(`/api/admin/usuarios/${userId}/detalles`);
            const data = await response.json();
            
            if (response.ok) {
                const u = data.usuario;
                const photoUrl = u.Foto ? `/static/${u.Foto}` : '/static/default_profile.png';
                const plan = u.Plan_premium || 'gratis';
                
                // 1. Cabecera e identidad (con soporte para marcos animados de avatar)
                const avatarContainer = document.getElementById('act-user-avatar-container');
                const esPremium = u.Es_premium;
                const avatarPlan = u.Avatar_plan || 'ninguno';

                if (esPremium) {
                    const frameHiddenClass = (avatarPlan === 'ninguno') ? 'frame-hidden' : '';
                    avatarContainer.innerHTML = `
                        <img src="/static/avatar_${avatarPlan}_animated.svg" class="avatar-frame ${frameHiddenClass}" style="position: absolute; top: 39%; left: 49%; transform: translate(-50%, -50%) scale(1.3); width: 103%; height: 103%; pointer-events: none; z-index: 2; transition: opacity 0.3s ease;">
                        <img id="act-user-photo" src="${photoUrl}" alt="Foto" class="user-avatar" style="width: 65px; height: 65px; border-radius: 50%; object-fit: cover; z-index: 1; border: 2px solid transparent;">
                    `;
                } else {
                    avatarContainer.innerHTML = `
                        <img id="act-user-photo" src="${photoUrl}" alt="Foto" class="free-user-avatar" style="width: 65px; height: 65px; border-radius: 50%; object-fit: cover; border: 2px solid #8b5cf6; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);">
                    `;
                }
                document.getElementById('act-user-fullname').textContent = `${u.Nombres} ${u.Apellidos}`;
                document.getElementById('act-user-username').textContent = `@${u.Usuario} (ID: ${u.ID_Cuenta})`;
                
                const planBadge = document.getElementById('act-user-plan');
                planBadge.textContent = plan.toUpperCase();
                planBadge.className = `plan-badge premium-${plan}`;

                // Privilegios de administrador
                const adminBadge = document.getElementById('act-user-admin-badge');
                const toggleBtn = document.getElementById('btn-toggle-admin-privileges');

                if (u.Es_admin) {
                    adminBadge.textContent = 'ADMINISTRADOR';
                    adminBadge.style.background = 'rgba(46, 204, 113, 0.12)';
                    adminBadge.style.color = '#2ecc71';
                    adminBadge.style.borderColor = 'rgba(46, 204, 113, 0.25)';
                    
                    if (toggleBtn) {
                        toggleBtn.innerHTML = '<i class="fas fa-user-minus"></i> Quitar Acceso al Panel';
                        toggleBtn.className = 'btn btn-sm btn-outline-danger mt-3';
                    }
                } else {
                    adminBadge.textContent = 'Usuario Regular';
                    adminBadge.style.background = 'rgba(84, 82, 211, 0.12)';
                    adminBadge.style.color = 'var(--color-principal)';
                    adminBadge.style.borderColor = 'rgba(84, 82, 211, 0.25)';
                    
                    if (toggleBtn) {
                        toggleBtn.innerHTML = '<i class="fas fa-user-shield"></i> Otorgar Acceso al Panel';
                        toggleBtn.className = 'btn btn-sm btn-outline-warning mt-3';
                    }
                }

                // Ocultar botón si es el administrador principal (ID 1)
                if (toggleBtn) {
                    if (userId === 1) {
                        toggleBtn.style.display = 'none';
                    } else {
                        toggleBtn.style.display = 'inline-flex';
                    }
                }
                
                // 2. Información de contacto y estadísticas
                document.getElementById('act-user-email').textContent = u.Correo;
                document.getElementById('act-user-phone').textContent = u.Telefono ? `+${u.Telefono}` : 'Sin teléfono';
                document.getElementById('act-user-notes-count').textContent = data.notes.length;
                document.getElementById('act-user-folders-count').textContent = data.carpetas.length;
                
                // 3. Renderizar Carpetas
                if (data.carpetas.length === 0) {
                    document.getElementById('act-folders-list').innerHTML = `
                        <span class="text-muted italic" style="font-size: 0.85rem; font-style: italic;">
                            El usuario no ha creado ninguna carpeta todavía.
                        </span>
                    `;
                } else {
                    document.getElementById('act-folders-list').innerHTML = data.carpetas.map(c => `
                        <span class="badge-hashed" style="background: rgba(243, 156, 18, 0.12); color: #f39c12; border-color: rgba(243,156,18,0.25); padding: 5px 10px; font-size: 0.78rem; font-weight:700;">
                            <i class="fas fa-folder text-warning"></i> ${c.Nombre}
                        </span>
                    `).join('');
                }
                
                // 4. Guardar notas globalmente y renderizarlas
                window.CURRENT_USER_NOTES = data.notes;
                renderNotasUsuario(window.CURRENT_USER_NOTES);
            } else {
                document.getElementById('act-notes-container').innerHTML = `
                    <div class="alert alert-danger">
                        Error al cargar detalles del usuario: ${data.error}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching user activity details:', error);
            document.getElementById('act-notes-container').innerHTML = `
                <div class="alert alert-danger">
                    Error de conexión con el servidor.
                </div>
            `;
        }
    };

    window.renderNotasUsuario = (notas) => {
        const container = document.getElementById('act-notes-container');
        if (notas.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4" style="font-size: 0.9rem;">
                    No se encontraron notas registradas.
                </div>
            `;
            return;
        }

        container.innerHTML = notas.map(note => {
            const formatLabels = {
                'texto': { label: 'Texto', icon: 'fas fa-file-alt text-primary', bg: 'rgba(52, 152, 219, 0.12)', color: '#3498db' },
                'audio': { label: 'Audio', icon: 'fas fa-microphone text-success', bg: 'rgba(46, 204, 113, 0.12)', color: '#2ecc71' },
                'video': { label: 'Video', icon: 'fas fa-video text-danger', bg: 'rgba(231, 76, 60, 0.12)', color: '#e74c3c' },
                'dibujo': { label: 'Dibujo', icon: 'fas fa-paint-brush text-warning', bg: 'rgba(241, 196, 15, 0.12)', color: '#f1c40f' }
            };

            const fmt = formatLabels[note.Formato] || { label: 'Texto', icon: 'fas fa-file-alt text-primary', bg: 'rgba(52, 152, 219, 0.12)', color: '#3498db' };
            const folderInfo = note.Nombre_Carpeta 
                ? `<span class="badge-hashed" style="background: rgba(243, 156, 18, 0.08); color: #f39c12; border-color: rgba(243,156,18,0.18); font-size:0.7rem;"><i class="fas fa-folder"></i> ${note.Nombre_Carpeta}</span>`
                : '';

            return `
                <div class="stat-card" style="padding: 16px; border-radius: 12px; border: 1.5px solid var(--border-claro);">
                    <div class="d-flex justify-content-between align-items-start gap-2">
                        <div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                                <span class="badge-hashed" style="background: ${fmt.bg}; color: ${fmt.color}; border-color: ${fmt.color}44; font-size:0.7rem; font-weight:800;">
                                    <i class="${fmt.icon}"></i> ${fmt.label.toUpperCase()}
                                </span>
                                ${folderInfo}
                                <small class="text-muted" style="font-size:0.72rem;"><i class="far fa-clock"></i> Modificado: ${note.Fecha_deedicion}</small>
                            </div>
                            <h5 style="margin: 0; font-weight: 700; font-size: 0.98rem; color: var(--text-main);">${note.Titulo || 'Nota sin título'}</h5>
                        </div>
                        <button class="btn btn-sm btn-outline-primary" style="border-radius:8px; font-weight:700; font-size:0.78rem; display:inline-flex; align-items:center; gap:5px;" onclick="toggleNoteContentCollapsible(${note.ID_Nota})">
                            <i class="fas fa-eye" id="eye-icon-${note.ID_Nota}"></i> Previsualizar
                        </button>
                    </div>

                    <!-- CUERPO COLAPSIBLE PREVISUALIZAR NOTA -->
                    <div id="note-preview-${note.ID_Nota}" style="display:none; padding:12px 0 0 0; margin-top:12px; border-top:1px dashed var(--border-claro);">
                        <div class="p-3 rounded-3" style="background: rgba(0,0,0,0.02); font-size: 0.88rem; color: var(--text-main); border:1px solid var(--border-claro);">
                            ${renderContentPreview(note)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    const renderContentPreview = (note) => {
        if (!note.Contenido) {
            return `<span class="text-muted italic">Nota vacía.</span>`;
        }

        if (note.Formato === 'texto') {
            return `<div style="white-space: pre-wrap; font-family:inherit; line-height:1.5;">${note.Contenido}</div>`;
        } else if (note.Formato === 'audio') {
            return `
                <div class="text-center py-2">
                    <p class="mb-2" style="font-size: 0.82rem; font-weight:600;"><i class="fas fa-music text-success"></i> Reproductor de Audio Grabado:</p>
                    <audio src="${note.Contenido}" controls style="width: 100%; border-radius: 8px;"></audio>
                    <a href="${note.Contenido}" target="_blank" class="btn btn-sm btn-link mt-2" style="font-size:0.75rem;"><i class="fas fa-external-link-alt"></i> Descargar archivo físico</a>
                </div>
            `;
        } else if (note.Formato === 'video') {
            return `
                <div class="text-center py-2">
                    <p class="mb-2" style="font-size: 0.82rem; font-weight:600;"><i class="fas fa-video text-danger"></i> Reproductor de Video Grabado:</p>
                    <video src="${note.Contenido}" controls style="max-width: 100%; max-height: 240px; border-radius: 8px; border:1px solid var(--border-claro);"></video>
                    <br>
                    <a href="${note.Contenido}" target="_blank" class="btn btn-sm btn-link mt-2" style="font-size:0.75rem;"><i class="fas fa-external-link-alt"></i> Descargar archivo físico</a>
                </div>
            `;
        } else if (note.Formato === 'dibujo') {
            return `
                <div class="text-center py-2">
                    <p class="mb-2" style="font-size: 0.82rem; font-weight:600;"><i class="fas fa-paint-brush text-warning"></i> Canvas / Lienzo Dibujado:</p>
                    <div style="background: white; padding: 10px; border-radius: 8px; display: inline-block; border: 1px solid var(--border-claro);">
                        <img src="${note.Contenido}" style="max-width: 100%; max-height: 280px; border-radius: 4px;" alt="Lienzo NoteFlow">
                    </div>
                    <br>
                    <a href="${note.Contenido}" target="_blank" class="btn btn-sm btn-link mt-2" style="font-size:0.75rem;"><i class="fas fa-external-link-alt"></i> Ver en tamaño original</a>
                </div>
            `;
        }

        return `<div style="white-space: pre-wrap;">${note.Contenido}</div>`;
    };

    window.toggleNoteContentCollapsible = (noteId) => {
        const previewEl = document.getElementById(`note-preview-${noteId}`);
        const eyeIcon = document.getElementById(`eye-icon-${noteId}`);
        
        if (previewEl.style.display === 'none') {
            previewEl.style.display = 'block';
            eyeIcon.className = 'fas fa-eye-slash';
        } else {
            previewEl.style.display = 'none';
            eyeIcon.className = 'fas fa-eye';
        }
    };

    window.filtrarNotasUsuario = (query) => {
        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) {
            renderNotasUsuario(window.CURRENT_USER_NOTES);
            return;
        }

        const filtered = window.CURRENT_USER_NOTES.filter(note => {
            const title = (note.Titulo || '').toLowerCase();
            const content = (note.Contenido || '').toLowerCase();
            const folder = (note.Nombre_Carpeta || '').toLowerCase();
            return title.includes(cleanQuery) || content.includes(cleanQuery) || folder.includes(cleanQuery);
        });

        renderNotasUsuario(filtered);
    };

    window.toggleAdminPrivileges = async () => {
        const userId = window.CURRENT_SELECTED_USER_ID;
        if (!userId) return;

        const toggleBtn = document.getElementById('btn-toggle-admin-privileges');
        const originalHtml = toggleBtn.innerHTML;
        toggleBtn.disabled = true;
        toggleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

        try {
            const response = await fetch(`/api/admin/usuarios/${userId}/toggle-admin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (response.ok) {
                // Actualizar visualmente de inmediato
                await verActividadUsuario(userId);

                // Volver a cargar la lista general de usuarios para actualizar la tabla
                if (typeof loadAdminDashboard === 'function') {
                    loadAdminDashboard();
                }
            } else {
                alert(`Error al cambiar privilegios: ${data.error}`);
            }
        } catch (error) {
            console.error('Error toggling admin privileges:', error);
            alert('Error de red al intentar cambiar los privilegios.');
        } finally {
            if (toggleBtn) {
                toggleBtn.innerHTML = originalHtml;
                toggleBtn.disabled = false;
            }
        }
    };



    window.filtrarUsuarios = (query) => {
        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) {
            renderUsersTable(allUsers);
            return;
        }

        const filtered = allUsers.filter(user => {
            const fullName = `${user.Nombres} ${user.Apellidos}`.toLowerCase();
            const username = (user.Usuario || '').toLowerCase();
            const email = (user.Correo || '').toLowerCase();
            const phone = (user.Telefono || '').toLowerCase();
            
            return fullName.includes(cleanQuery) || 
                   username.includes(cleanQuery) || 
                   email.includes(cleanQuery) || 
                   phone.includes(cleanQuery);
        });

        renderUsersTable(filtered);
    };

    // --- CASCADE DELETE ACCOUNT SYSTEM ---
    window.abrirConfirmarEliminar = (userId, fullName) => {
        userToDeleteId = userId;
        deleteModalUserName.textContent = fullName;
        deleteModal.show();
    };

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!userToDeleteId) return;

        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Eliminando...`;

        try {
            const response = await fetch(`/api/admin/usuarios/eliminar/${userToDeleteId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.CSRF_TOKEN || ''
                }
            });

            const result = await response.json();
            if (response.ok && result.success) {
                alert(`✅ Cuenta y todos los datos asociados eliminados de forma segura.`);
                deleteModal.hide();
                loadUsers();
                loadEstadisticas();
                loadChatsSelector(); // Recargar selector de soporte
                
                // Si teníamos seleccionado al usuario eliminado, ocultamos el chat
                if (currentUserId === userToDeleteId) {
                    currentUserId = null;
                    if (pollingInterval) clearInterval(pollingInterval);
                    activeChat.style.display = 'none';
                    noChatSelected.style.display = 'flex';
                    chatUserSelector.value = "";
                }
            } else {
                alert(`❌ Error al eliminar usuario: ${result.error || 'Desconocido'}`);
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('❌ Ocurrió un error al intentar conectarse al servidor.');
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Sí, eliminar en cascada`;
            userToDeleteId = null;
        }
    });

    // --- CHAT LOGIC (SUPPORT INTEGRATED) ---
    const loadChatsSelector = async () => {
        try {
            const response = await fetch('/api/soporte-admin/chats');
            const chats = await response.json();
            
            if (Array.isArray(chats)) {
                activeChats = chats;
                renderChatsDropdown(chats);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    };

    const renderChatsDropdown = (chats) => {
        const previousValue = chatUserSelector.value;
        
        chatUserSelector.innerHTML = '<option value="">Selecciona un chat activo...</option>' + 
            chats.map(chat => {
                const plan = chat.Plan_premium || 'gratis';
                return `<option value="${chat.ID_Cuenta}">${chat.Nombres} (${plan.toUpperCase()}) - ${chat.Ultimo_Mensaje.substring(0, 20)}...</option>`;
            }).join('');
            
        // Si teníamos seleccionado un chat, mantener la selección
        if (previousValue && chats.some(c => c.ID_Cuenta == previousValue)) {
            chatUserSelector.value = previousValue;
        }
    };

    window.cambiarChatDeSelector = (userId) => {
        if (!userId) {
            currentUserId = null;
            if (pollingInterval) clearInterval(pollingInterval);
            activeChat.style.display = 'none';
            noChatSelected.style.display = 'flex';
            return;
        }

        const chat = activeChats.find(c => c.ID_Cuenta == userId);
        if (chat) {
            const photoUrl = chat.Foto ? `/static/${chat.Foto}` : '/static/default_profile.png';
            const plan = chat.Plan_premium || 'gratis';
            
            currentUserId = parseInt(userId);
            activeUserName.textContent = chat.Nombres;
            activeUserPhoto.src = photoUrl;
            
            // Badges
            activeUserPlan.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
            activeUserPlan.className = `plan-badge premium-${plan}`;
            
            noChatSelected.style.display = 'none';
            activeChat.style.display = 'flex';
            
            loadMessages();
            
            if (pollingInterval) clearInterval(pollingInterval);
            pollingInterval = setInterval(loadMessages, 3000);
        }
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

    const sendReply = async () => {
        const text = replyInput.value.trim();
        if (!text || !currentUserId) return;

        replyInput.value = '';

        try {
            const response = await fetch('/api/soporte-admin/responder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.CSRF_TOKEN || ''
                },
                body: JSON.stringify({
                    user_id: currentUserId,
                    mensaje: text
                })
            });

            if (response.ok) {
                loadMessages();
                loadChatsSelector(); 
            }
        } catch (error) {
            console.error('Error sending reply:', error);
        }
    };

    if (sendBtn) {
        sendBtn.addEventListener('click', sendReply);
        replyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendReply();
        });
    }

    // --- SIDEBAR RESPONSIVE TOGGLE ---
    window.toggleSidebar = () => {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar && overlay) {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    };

    // Initial setups
    loadEstadisticas();
    loadChatsSelector();
    
    // Polling active chats list in background
    setInterval(loadChatsSelector, 10000); 
});
