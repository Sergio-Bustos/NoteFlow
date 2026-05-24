import React, { useState, useEffect } from 'react';
import DashboardStats from './components/DashboardStats';
import UsersManagement from './components/UsersManagement';
import SupportChat from './components/SupportChat';
import { NfModal, NfBtn, useNfModal } from './components/NfModal';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarActive, setSidebarActive] = useState(false);
  const { modal, openModal, closeModal } = useNfModal();
  const user = window.APP_USER || {};

  const getAvatarUrl = (foto) => {
    if (!foto || foto === 'None') return '/static/default_profile.png';
    return foto.startsWith('http') ? foto : `/static/${foto}`;
  };

  useEffect(() => {
    const esOscuro = window.COLOR_PRINCIPAL === 'Negro';
    document.body.classList.toggle('tema-oscuro', esOscuro);
    document.body.classList.toggle('tema-claro', !esOscuro);
  }, []);

  const toggleSidebar = () => setSidebarActive(!isSidebarActive);

  const handleLogoutClick = (e) => {
    e.preventDefault();
    openModal({ type: 'logout' });
  };

  return (
    <>
      <button className="hamburger-btn" id="hamburger-btn" onClick={toggleSidebar}>
        <i className="fas fa-bars"></i>
      </button>

      <div className="mobile-topbar">
        <a href="/perfil" className="mobile-topbar-user">
          {(user.es_admin || user.es_premium) ? (
            <div className="avatar-premium-container">
              <img src={getAvatarUrl(user.foto)} alt="Foto" className="user-avatar" />
              {user.avatar_plan === 'cosmico' ? (
                <img src="/static/marco_cosmico_admin.svg" className="avatar-frame admin-cosmic-frame" />
              ) : (
                <img src={`/static/avatar_${user.avatar_plan || user.plan_premium}_animated.svg`} className={`avatar-frame ${user.avatar_plan === 'ninguno' ? 'frame-hidden' : ''}`} />
              )}
            </div>
          ) : (
            <img src={getAvatarUrl(user.foto)} alt="Foto" className="free-user-avatar" />
          )}
          <span>
            {user.nombres}
            {user.es_admin && <i className="fas fa-shield-alt" style={{ color: '#a78bfa', marginLeft: '5px' }} title="Administrador"></i>}
            {!user.es_admin && user.es_premium && <i className="fas fa-crown" style={{ color: user.premium_color || '#f1c40f', marginLeft: '5px' }}></i>}
          </span>
        </a>
      </div>

      <div className={`sidebar-overlay ${isSidebarActive ? 'visible' : ''}`} id="sidebar-overlay" onClick={toggleSidebar}></div>

      <div className={`sidebar ${isSidebarActive ? 'open' : ''}`}>
        <div className="logo">NoteFlow</div>
        <ul className="menu">
          <li><a href="/dashboard"><i className="fas fa-home"></i> Inicio</a></li>
          <li><a href="/notas"><i className="fas fa-list-ul"></i> Mis notas</a></li>
          <li className="separator"></li>
          <li><a href="/papelera"><i className="fas fa-trash-alt"></i> Papelera</a></li>
          <li className="separator"></li>
          <li><a href="/perfil"><i className="fas fa-user-circle"></i> Perfil</a></li>
          <li><a href="/soporte-admin" className="active" style={{ color: '#f1c40f' }}><i className="fas fa-user-shield"></i> Panel Soporte</a></li>
        </ul>
        <a href="/planes" className="upgrade-btn">
          <i className="fas fa-crown"></i>
          <span>Mejorar plan</span>
          <small>Desbloquea todo Premium</small>
        </a>
        <a href="#" className="logout-btn" onClick={handleLogoutClick}>
          <i className="fas fa-sign-out-alt"></i> Cerrar sesión
        </a>
      </div>

      <div className="main">
        <header>
          <a href="/perfil" className="usuario-info">
            {(user.es_admin || user.es_premium) ? (
              <div className="avatar-premium-container">
                {user.avatar_plan === 'cosmico' ? (
                  <img src="/static/marco_cosmico_admin.svg" className="avatar-frame admin-cosmic-frame" />
                ) : (
                  <img src={`/static/avatar_${user.avatar_plan || user.plan_premium}_animated.svg`} className={`avatar-frame ${user.avatar_plan === 'ninguno' ? 'frame-hidden' : ''}`} />
                )}
                <img src={getAvatarUrl(user.foto)} alt="Foto" className="user-avatar" />
              </div>
            ) : (
              <img src={getAvatarUrl(user.foto)} alt="Foto" className="free-user-avatar" />
            )}
            <span>
              <strong>{user.nombres}</strong>
              {user.es_admin && <i className="fas fa-shield-alt" style={{ color: '#a78bfa', marginLeft: '5px' }} title="Administrador"></i>}
              {!user.es_admin && user.es_premium && <i className="fas fa-crown" style={{ color: user.premium_color || '#f1c40f', marginLeft: '5px' }} title={`Usuario Premium - Plan ${user.plan_premium}`}></i>}
            </span>
            <i className="fas fa-chevron-down profile-dropdown-icon"></i>
          </a>
        </header>

        <section className="bienvenida" style={{ marginBottom: '25px' }}>
          <h2><i className="fas fa-user-shield" style={{ color: 'var(--color-principal)', marginRight: '8px' }}></i>Panel de Control</h2>
          <p>Gestión global de usuarios y soporte técnico en tiempo real.</p>
        </section>

        <div className="admin-tabs-nav">
          <button className={`admin-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <i className="fas fa-chart-line"></i> Dashboard
          </button>
          <button className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            <i className="fas fa-users-cog"></i> Cuentas
          </button>
        </div>

        <div className="admin-split-layout">
          <div className="admin-panel-left-content">
            <div className={`admin-tab-content ${activeTab === 'dashboard' ? 'active' : ''}`}>
              <DashboardStats />
            </div>
            <div className={`admin-tab-content ${activeTab === 'users' ? 'active' : ''}`}>
              <UsersManagement />
            </div>
          </div>
          <div className="admin-panel-right-chat">
            <SupportChat />
          </div>
        </div>
      </div>

      {/* Modal cerrar sesión */}
      {modal?.type === 'logout' && (
        <NfModal
          title={<><i className="fas fa-sign-out-alt" style={{ marginRight: '8px', color: '#e74c3c' }}></i>Cerrar sesión</>}
          onClose={closeModal}
          footer={
            <>
              <NfBtn.Secondary onClick={closeModal}>Cancelar</NfBtn.Secondary>
              <NfBtn.Danger onClick={() => { window.location.href = '/logout'; }}>Sí, cerrar sesión</NfBtn.Danger>
            </>
          }
        >
          <p style={{ margin: 0 }}>¿Estás seguro de que deseas cerrar tu sesión en NoteFlow?</p>
        </NfModal>
      )}
    </>
  );
}

export default App;
