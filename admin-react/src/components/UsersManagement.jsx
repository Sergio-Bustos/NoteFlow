import React, { useState, useEffect } from 'react';
import UserActivityModal from './UserActivityModal';

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/usuarios');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleDeleteUser = async (userId, name) => {
    if (window.confirm(`ATENCIÓN CRÍTICA:\nEstás a punto de eliminar la cuenta de ${name} y todos sus datos. Esta acción es irreversible.\n¿Estás seguro?`)) {
      try {
        const response = await fetch(`/api/admin/usuarios/eliminar/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.CSRF_TOKEN || '' }
        });
        const result = await response.json();
        if (response.ok && result.success) {
          alert('Cuenta eliminada de forma segura.');
          fetchUsers();
        } else {
          alert(`Error: ${result.error}`);
        }
      } catch (error) {
        alert('Error de red al eliminar usuario.');
      }
    }
  };

  const filteredUsers = users.filter(user => {
    const term = searchQuery.toLowerCase();
    const fullName = `${user.Nombres} ${user.Apellidos}`.toLowerCase();
    return fullName.includes(term) || (user.Correo || '').toLowerCase().includes(term) || (user.Usuario || '').toLowerCase().includes(term);
  });

  return (
    <>
      <div className="search-bar-wrapper" style={{ marginBottom: '20px' }}>
        <div className="search-input-group" style={{ border: '2px solid var(--border-claro)', borderRadius: '50px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fas fa-search" style={{ color: '#95a5a6' }}></i>
          <input 
            type="text" 
            placeholder="Buscar usuarios por nombre, correo, usuario o teléfono..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent', color: 'inherit' }}
          />
        </div>
      </div>

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
              <tr><td colSpan="5" className="loading-state"><i className="fas fa-spinner fa-spin"></i> Cargando cuentas registradas...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="5" className="loading-state">No se encontraron usuarios registrados.</td></tr>
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
                        <img src={user.Foto && user.Foto !== 'None' ? `/static/${user.Foto}` : '/static/default_profile.png'} alt="" />
                        <div className="name-username">
                          <span className="fullname" style={{ textDecoration: 'underline', color: 'var(--color-principal)', fontWeight: '700' }}>
                            {user.Nombres} {user.Apellidos}
                            {user.Es_admin && <span className="badge-hashed" style={{ background: 'rgba(46, 204, 113, 0.12)', color: '#2ecc71', borderColor: 'rgba(46,204,113,0.25)', fontSize: '0.65rem', padding: '2px 6px', fontWeight: '800', marginLeft: '5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><i className="fas fa-user-shield"></i> ADMIN</span>}
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
                    <td>
                      <span className={`plan-badge ${planClass}`}>{premiumLabel}</span>
                    </td>
                    <td>
                      <div className="password-wrap">
                        {showPass ? (
                          isHashed ? <span className="badge-hashed"><i className="fas fa-shield-alt"></i> Encriptada</span> : <span className="password-text text-danger">{user.Contraseña}</span>
                        ) : (
                          <span className="password-text">••••••••</span>
                        )}
                        <button className="btn-toggle-password" onClick={() => togglePasswordVisibility(user.ID_Cuenta)}>
                          <i className={showPass ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                        </button>
                      </div>
                    </td>
                    <td>
                      {user.ID_Cuenta === 1 ? (
                        <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: '700' }}><i className="fas fa-lock"></i> Principal</span>
                      ) : (
                        <button className="btn-delete-user" onClick={() => handleDeleteUser(user.ID_Cuenta, `${user.Nombres} ${user.Apellidos}`)}>
                          <i className="fas fa-trash-alt"></i> Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* User Activity Modal */}
      {selectedUserId && (
        <UserActivityModal 
          userId={selectedUserId} 
          onClose={() => setSelectedUserId(null)} 
        />
      )}
    </>
  );
};

export default UsersManagement;
