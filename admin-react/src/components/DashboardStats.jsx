import React, { useState, useEffect } from 'react';

const DashboardStats = () => {
  const [stats, setStats] = useState({
    total_registrados: 0,
    premium: 0,
    gratis: 0,
    activos: 0,
    ingresos: 0,
    notas_creadas: 0
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

  return (
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
          <span className="title">Usuario con plan</span>
          <i className="fas fa-crown icon bg-gold"></i>
        </div>
        <div className="stat-card-value">{stats.premium}</div>
        <div className="stat-card-sub text-gold">Usuarios premium activos</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-header">
          <span className="title">Usuarios gratis</span>
          <i className="fas fa-user-circle icon bg-gray"></i>
        </div>
        <div className="stat-card-value">{stats.gratis}</div>
        <div className="stat-card-sub text-muted">Cuentas con plan gratuito</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-header">
          <span className="title">Usuarios activos (30 Días)</span>
          <i className="fas fa-calendar-check icon bg-green"></i>
        </div>
        <div className="stat-card-value">{stats.activos}</div>
        <div className="stat-card-sub text-green">Actividad registrada en Notas o Soporte</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-header">
          <span className="title">Ingresos totales</span>
          <i className="fas fa-wallet icon bg-purple"></i>
        </div>
        <div className="stat-card-value">{formatCOP(stats.ingresos)}</div>
        <div className="stat-card-sub text-purple">Estimación mensual recurrente activa</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-header">
          <span className="title">Notas creadas</span>
          <i className="fas fa-sticky-note icon bg-orange"></i>
        </div>
        <div className="stat-card-value">{stats.notas_creadas}</div>
        <div className="stat-card-sub text-orange">Total de notas en el sistema</div>
      </div>
    </div>
  );
};

export default DashboardStats;
