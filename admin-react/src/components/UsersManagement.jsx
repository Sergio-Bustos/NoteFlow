import React, { useState, useEffect } from 'react';
import UserActivityModal from './UserActivityModal';
import { NfModal, NfBtn, NfAlert, useNfModal } from './NfModal';

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const { modal, openModal, closeModal } = useNfModal();

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/usuarios');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  /* ── Eliminar usuario ── */
  const handleDeleteUser = (userId, name) => {
    openModal({
      type: 'confirm-delete',
      userId,
      name,
    });
  };

  const confirmDelete = async () => {
    const { userId, name } = modal;
    closeModal();
    try {
      const response = await fetch(`/api/admin/usuarios/eliminar/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.CSRF_TOKEN || '' },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        openModal({ type: 'info', variant: 'success', message: 'Cuenta eliminada de forma segura.' });
        fetchUsers();
      } else {
        openModal({ type: 'info', variant: 'danger', message: `Error: ${result.error}` });
      }
    } catch {
      openModal({ type: 'info', variant: 'danger', message: 'Error de red al eliminar usuario.' });
    }
  };

  /* ── Toggle admin ── */
  const handleToggleAdmin = (userId, name, isCurrentlyAdmin) => {
    openModal({ type: 'confirm-admin', userId, name, isCurrentlyAdmin });
  };

  const confirmToggleAdmin = async () => {
    const { userId, name, isCurrentlyAdmin } = modal;
    closeModal();
    try {
      const response = await fetch(`/api/admin/usuarios/${userId}/toggle-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.CSRF_TOKEN || '' },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        openModal({ type: 'info', variant: 'success', message: result.message || 'Privilegios actualizados correctamente.' });
        fetchUsers();
      } else {
        openModal({ type: 'info', variant: 'danger', message: `Error: ${result.error}` });
      }
    } catch {
      openModal({ type: 'info', variant: 'danger', message: 'Error de red al cambiar privilegios.' });
    }
  };

  const filteredUsers = users.filter(user => {
    const term = searchQuery.toLowerCase();
    const fullName = `${user.Nombres} ${user.Apellidos}`.toLowerCase();
    return fullName.includes(term) || (user.Correo || '').toLowerCase().includes(term) || (user.Usuario || '').toLowerCase().includes(term);
  });

  return (
    <>
      {/* Barra de búsqueda */}
      <div className="search-bar-wrapper" style={{ marginBottom: '20px' }}>
        <div className="search-input-group" style={{ border: '2px solid var(--border-claro)', borderRadius: '50px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fas fa-search" style={{ color: '#95a5a6' }}></i>
          <input
            type="text"
            placeholder="Buscar usuarios por nombre, correo o usuario..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent', color: 'inherit' }}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="premium-table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Contacto</th>
              <th>Plan</th>
              <th>Contraseña</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="loading-state"><i className="fas fa-spinner fa-spin"></i> Cargando cuentas...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="5" className="loading-state">No se encontraron usuarios.</td></tr>
            ) : (
              filteredUsers.map(user => {
                const planClass = `premium-${user.Plan_premium || 'gratis'}`;
                const premiumLabel = (user.Plan_premium || 'gratis').toUpperCase();
                const showPass = visiblePasswords[user.ID_Cuenta];
                const isHashed = (user.Contraseña || '').startsWith('pbkdf2') || (user.Contraseña || '').startsWith('scrypt');

                return (
                  <tr key={user.ID_Cuenta}>
                    <td>
                      <div className="user-identity" style={{ cursor: 'pointer' }} onClick={() => setSelectedUserId(user.ID_Cuenta)}>
                        {user.Es_premium ? (
                          <div className="avatar-premium-container" style={{ width: '40px', height: '40px', marginRight: '10px' }}>
                            {user.Avatar_plan === 'cosmico' ? (
                              <img src="/static/marco_cosmico_admin.svg" className="avatar-frame admin-cosmic-frame" alt="marco" />
                            ) : (
                              <img src={`/static/avatar_${(user.Avatar_plan || user.Plan_premium || 'quincenal').toLowerCase()}_animated.svg`} className={`avatar-frame ${user.Avatar_plan === 'ninguno' ? 'frame-hidden' : ''}`} alt="marco" />
                            )}
                            <img src={user.Foto && user.Foto !== 'None' ? (user.Foto.startsWith('http') ? user.Foto : `/static/${user.Foto}`) : '/static/default_profile.png'} alt="" className="user-avatar" style={{ width: '43px', height: '40px', position: 'absolute', right: '-1px' }} />
                          </div>
                        ) : (
                          <img src={user.Foto && user.Foto !== 'None' ? (user.Foto.startsWith('http') ? user.Foto : `/static/${user.Foto}`) : '/static/default_profile.png'} alt="" className="free-user-avatar" style={{ width: '40px', height: '40px', marginRight: '10px' }} />
                        )}
                        <div className="name-username">
                          <span className="fullname" style={{ textDecoration: 'underline', color: 'var(--color-principal)', fontWeight: '700' }}>
                            {user.Nombres} {user.Apellidos}
                            {user.Es_admin && <span className="badge-hashed" style={{ background: 'rgba(46,204,113,0.12)', color: '#2ecc71', borderColor: 'rgba(46,204,113,0.25)', fontSize: '0.65rem', padding: '2px 6px', fontWeight: '800', marginLeft: '5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><i className="fas fa-user-shield"></i> ADMIN</span>}
                          </span>
                          <span className="username">@{user.Usuario} (ID: {user.ID_Cuenta})</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-details">
                        <span className="email">{user.Correo}</span>
                        <span className="phone">{user.Telefono ? `+${user.Telefono}` : 'Sin teléfono'}</span>
                      </div>
                    </td>
                    <td><span className={`plan-badge ${planClass}`}>{premiumLabel}</span></td>
                    <td>
                      <div className="password-wrap">
                        {showPass ? (
                          isHashed
                            ? <span className="badge-hashed"><i className="fas fa-shield-alt"></i> Encriptada</span>
                            : <span className="password-text text-danger">{user.Contraseña}</span>
                        ) : (
                          <span className="password-text">••••••••</span>
                        )}
                        <button className="btn-toggle-password" onClick={() => togglePasswordVisibility(user.ID_Cuenta)}>
                          <i className={showPass ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                        </button>
                      </div>
                    </td>
                    <td>
                      {user.ID_Cuenta === 1 ? (
                        <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: '700' }}><i className="fas fa-lock"></i> Principal</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button className="btn-delete-user" onClick={() => handleDeleteUser(user.ID_Cuenta, `${user.Nombres} ${user.Apellidos}`)}>
                            <i className="fas fa-trash-alt"></i> Eliminar
                          </button>
                          {user.Es_admin ? (
                            <button className="btn-demote-admin" onClick={() => handleToggleAdmin(user.ID_Cuenta, `${user.Nombres} ${user.Apellidos}`, true)}>
                              <i className="fas fa-user-minus"></i> Quitar Admin
                            </button>
                          ) : (
                            <button className="btn-make-admin" onClick={() => handleToggleAdmin(user.ID_Cuenta, `${user.Nombres} ${user.Apellidos}`, false)}>
                              <i className="fas fa-user-shield"></i> Hacer Admin
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal actividad usuario */}
      {selectedUserId && (
        <UserActivityModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}

      {/* ── Modal confirmar eliminar ── */}
      {modal?.type === 'confirm-delete' && (
        <NfModal
          title={<><i className="fas fa-trash-alt" style={{ marginRight: '8px', color: '#e74c3c' }}></i>Eliminar cuenta</>}
          onClose={closeModal}
          footer={
            <>
              <NfBtn.Secondary onClick={closeModal}>Cancelar</NfBtn.Secondary>
              <NfBtn.Danger onClick={confirmDelete}>Sí, eliminar</NfBtn.Danger>
            </>
          }
        >
          <NfAlert.Danger>
            Estás a punto de eliminar la cuenta de <strong>{modal.name}</strong> y todos sus datos. Esta acción es <strong>irreversible</strong>.
          </NfAlert.Danger>
          <p style={{ margin: '10px 0 0' }}>¿Estás seguro de que deseas continuar?</p>
        </NfModal>
      )}

      {/* ── Modal confirmar toggle admin ── */}
      {modal?.type === 'confirm-admin' && (
        <NfModal
          title={<><i className="fas fa-user-shield" style={{ marginRight: '8px', color: '#a78bfa' }}></i>{modal.isCurrentlyAdmin ? 'Quitar Admin' : 'Hacer Admin'}</>}
          onClose={closeModal}
          footer={
            <>
              <NfBtn.Secondary onClick={closeModal}>Cancelar</NfBtn.Secondary>
              <NfBtn.Primary onClick={confirmToggleAdmin}>Confirmar</NfBtn.Primary>
            </>
          }
        >
          <NfAlert.Warning>
            {modal.isCurrentlyAdmin
              ? <>Vas a <strong>quitar los privilegios de administrador</strong> a <strong>{modal.name}</strong>. Ya no tendrá acceso a este panel.</>
              : <>Vas a <strong>dar privilegios de administrador</strong> a <strong>{modal.name}</strong>. Tendrá acceso completo a este panel de control.</>
            }
          </NfAlert.Warning>
        </NfModal>
      )}

      {/* ── Modal info / resultado ── */}
      {modal?.type === 'info' && (
        <NfModal
          title="Resultado"
          onClose={closeModal}
          footer={<NfBtn.Primary onClick={closeModal}>Aceptar</NfBtn.Primary>}
        >
          {modal.variant === 'success' && <NfAlert.Success>{modal.message}</NfAlert.Success>}
          {modal.variant === 'danger'  && <NfAlert.Danger>{modal.message}</NfAlert.Danger>}
          {!modal.variant              && <p style={{ margin: 0 }}>{modal.message}</p>}
        </NfModal>
      )}
    </>
  );
};

export default UsersManagement;
