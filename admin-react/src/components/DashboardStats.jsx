import React, { useState, useEffect } from 'react';

const DashboardStats = () => {
  const [stats, setStats] = useState({
    total_registrados: 0,
    premium: 0,
    gratis: 0,
    activos: 0,
    ingresos: 0,
    notas_creadas: 0,
    notas_este_mes: 0,
    notas_mes_pasado: 0,
    total_carpetas: 0,
    notas_papelera: 0,
    total_compras: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/estadisticas');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error al cargar estadísticas:', error);
      }
    };
    fetchStats();
  }, []);

  const formatCOP = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);

  // Calcular tendencia notas mes vs mes pasado
  const notasDiff = stats.notas_este_mes - stats.notas_mes_pasado;
  const notasTrend = notasDiff > 0 ? 'up' : notasDiff < 0 ? 'down' : 'same';

  return (
    <>
      {/* Primera fila — Usuarios */}
      <h4 className="stats-section-title"><i className="fas fa-users"></i> Usuarios</h4>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">Total Registrados</span>
            <i className="fas fa-users icon bg-blue"></i>
          </div>
          <div className="stat-card-value">{stats.total_registrados}</div>
          <div className="stat-card-sub text-muted">Cuentas creadas en total</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">Usuarios Premium</span>
            <i className="fas fa-crown icon bg-gold"></i>
          </div>
          <div className="stat-card-value">{stats.premium}</div>
          <div className="stat-card-sub text-gold">Usuarios con plan activo</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">Usuarios Gratis</span>
            <i className="fas fa-user-circle icon bg-gray"></i>
          </div>
          <div className="stat-card-value">{stats.gratis}</div>
          <div className="stat-card-sub text-muted">Cuentas con plan gratuito</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">Activos (30 Días)</span>
            <i className="fas fa-calendar-check icon bg-green"></i>
          </div>
          <div className="stat-card-value">{stats.activos}</div>
          <div className="stat-card-sub text-green">Actividad en Notas o Soporte</div>
        </div>
      </div>

      {/* Segunda fila — Contenido */}
      <h4 className="stats-section-title" style={{ marginTop: '25px' }}><i className="fas fa-sticky-note"></i> Contenido</h4>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">Notas (Total)</span>
            <i className="fas fa-sticky-note icon bg-orange"></i>
          </div>
          <div className="stat-card-value">{stats.notas_creadas}</div>
          <div className="stat-card-sub text-orange">Total de notas en el sistema</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">Notas Este Mes</span>
            <i className={`fas ${notasTrend === 'up' ? 'fa-arrow-up' : notasTrend === 'down' ? 'fa-arrow-down' : 'fa-equals'} icon bg-green`}></i>
          </div>
          <div className="stat-card-value">{stats.notas_este_mes}</div>
          <div className={`stat-card-sub ${notasTrend === 'up' ? 'text-green' : notasTrend === 'down' ? 'text-danger' : 'text-muted'}`}>
            {notasTrend === 'up' ? `+${notasDiff}` : notasTrend === 'down' ? `${notasDiff}` : '='} vs mes pasado ({stats.notas_mes_pasado})
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">Total Carpetas</span>
            <i className="fas fa-folder icon bg-blue"></i>
          </div>
          <div className="stat-card-value">{stats.total_carpetas}</div>
          <div className="stat-card-sub text-muted">Carpetas creadas por todos</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">En Papelera</span>
            <i className="fas fa-trash-alt icon bg-gray"></i>
          </div>
          <div className="stat-card-value">{stats.notas_papelera}</div>
          <div className="stat-card-sub text-muted">Notas eliminadas (recuperables)</div>
        </div>
      </div>

      {/* Tercera fila — Ingresos */}
      <h4 className="stats-section-title" style={{ marginTop: '25px' }}><i className="fas fa-wallet"></i> Ingresos</h4>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">Ingresos Totales</span>
            <i className="fas fa-wallet icon bg-purple"></i>
          </div>
          <div className="stat-card-value">{formatCOP(stats.ingresos)}</div>
          <div className="stat-card-sub text-purple">Estimación recurrente activa</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="title">Total Compras</span>
            <i className="fas fa-shopping-cart icon bg-green"></i>
          </div>
          <div className="stat-card-value">{stats.total_compras}</div>
          <div className="stat-card-sub text-green">Suscripciones realizadas</div>
        </div>
      </div>
    </>
  );
};

export default DashboardStats;
