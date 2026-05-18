import React, { useState, useEffect } from 'react';
import DashboardStats from './components/DashboardStats';
import UsersManagement from './components/UsersManagement';
import SupportChat from './components/SupportChat';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarActive, setSidebarActive] = useState(false);
  const user = window.APP_USER || {};

  useEffect(() => {
    // Aplicar tema según el usuario (Blanco/Negro)
    const esOscuro = window.COLOR_PRINCIPAL === 'Negro';
    document.body.classList.toggle('tema-oscuro', esOscuro);
    document.body.classList.toggle('tema-claro', !esOscuro);
  }, []);

  const toggleSidebar = () => setSidebarActive(!isSidebarActive);

  return (
    <>
      <button className="hamburger-btn" id="hamburger-btn" onClick={toggleSidebar}>
        <i className="fas fa-bars"></i>
      </button>

      <div className="mobile-topbar">
        <a href="/perfil" className="mobile-topbar-user">
          {user.es_premium ? (
            <div className="avatar-premium-container">
              <img src={`/static/${user.foto}`} alt="Foto" className="user-avatar" />
              <img src={`/static/avatar_${user.avatar_plan || user.plan_premium}_animated.svg`} className={`avatar-frame ${user.avatar_plan === 'ninguno' ? 'frame-hidden' : ''}`} />
            </div>
          ) : (
            <img src={`/static/${user.foto}`} alt="Foto" className="free-user-avatar" />
          )}
          <span>
            {user.nombres}
            {user.es_premium && <i className="fas fa-crown" style={{ color: user.premium_color || '#f1c40f', marginLeft: '5px' }}></i>}
          </span>
        </a>
      </div>

      <div className={`sidebar-overlay ${isSidebarActive ? 'active' : ''}`} id="sidebar-overlay" onClick={toggleSidebar}></div>

      <div className={`sidebar ${isSidebarActive ? 'active' : ''}`}>
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
        <a href="#" className="logout-btn" data-bs-toggle="modal" data-bs-target="#logoutModal">
          <i className="fas fa-sign-out-alt"></i> Cerrar sesión
        </a>
      </div>

      <div className="main">
        <header>
          <a href="/perfil" className="usuario-info">
            {user.es_premium ? (
              <div className="avatar-premium-container">
                <img src={`/static/avatar_${user.avatar_plan || user.plan_premium}_animated.svg`} className={`avatar-frame ${user.avatar_plan === 'ninguno' ? 'frame-hidden' : ''}`} />
                <img src={`/static/${user.foto}`} alt="Foto" className="user-avatar" />
              </div>
            ) : (
              <img src={`/static/${user.foto}`} alt="Foto" className="free-user-avatar" />
            )}
            <span>
              <strong>{user.nombres}</strong>
              {user.es_premium && <i className="fas fa-crown" style={{ color: user.premium_color || '#f1c40f', marginLeft: '5px' }} title={`Usuario Premium - Plan ${user.plan_premium}`}></i>}
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
      
      {/* Modals from old HTML would go here, simplified for brevity */}
    </>
  );
}

export default App;
