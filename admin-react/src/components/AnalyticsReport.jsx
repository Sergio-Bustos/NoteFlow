import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

function AnalyticsReport() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/admin/reporte-mensual')
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar reporte mensual');
        return res.json();
      })
      .then(result => {
        setData(result.datos || []);
        setSummary(result.resumen || null);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="analytics-loading"><i className="fas fa-spinner fa-spin"></i> Cargando reporte...</div>;
  }

  if (error) {
    return <div className="analytics-error"><i className="fas fa-exclamation-triangle"></i> {error}</div>;
  }

  return (
    <div className="analytics-report-container">
      <div className="analytics-header no-print">
        <div className="analytics-title">
          <h3><i className="fas fa-chart-pie"></i> Reporte Mensual (Últimos 30 días)</h3>
          <p>Análisis de actividad, creación de notas e ingresos estimados.</p>
        </div>
        <button className="btn-export-report" onClick={handlePrint}>
          <i className="fas fa-file-pdf"></i> Exportar / Imprimir PDF
        </button>
      </div>

      <div className="analytics-summary-box">
        <h4><i className="fas fa-chart-line"></i> Análisis Automático</h4>
        <p>{summary?.texto}</p>
        <div className="summary-badges">
          <div className="summary-badge">
            <span className="badge-value">{summary?.total_notas}</span>
            <span className="badge-label">Notas Nuevas</span>
          </div>
          <div className="summary-badge">
            <span className="badge-value">{summary?.total_cuentas}</span>
            <span className="badge-label">Cuentas Nuevas</span>
          </div>
          <div className="summary-badge highlight-badge">
            <span className="badge-value">${summary?.total_ingresos?.toLocaleString()}</span>
            <span className="badge-label">Ingresos COP</span>
          </div>
        </div>
      </div>

      <div className="analytics-charts-grid">
        {/* Gráfico de Notas y Cuentas (Líneas) */}
        <div className="chart-card">
          <h4>Creación de Contenido y Usuarios</h4>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="notas" name="Notas" stroke="#8884d8" activeDot={{ r: 8 }} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="cuentas" name="Cuentas" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Ingresos (Barras) */}
        <div className="chart-card">
          <h4>Ingresos Estimados (COP)</h4>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Ingresos']}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} 
                />
                <Legend />
                <Bar dataKey="ingresos" name="Ingresos (COP)" fill="#f1c40f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Tabla detallada - opcional para impresión */}
      <div className="analytics-data-table-container">
        <h4><i className="fas fa-table"></i> Datos Detallados</h4>
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Notas Creadas</th>
              <th>Usuarios Registrados</th>
              <th>Ingresos (COP)</th>
            </tr>
          </thead>
          <tbody>
            {data.slice().reverse().map((row, i) => (
              <tr key={i}>
                <td>{row.fecha}</td>
                <td>{row.notas}</td>
                <td>{row.cuentas}</td>
                <td>${row.ingresos.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer exclusivo de impresión (PDF) */}
      <div className="print-footer">
        <div className="print-footer-content">
          <img src="/static/logocircular.png" alt="NoteFlow Logo" className="print-logo" />
          <div className="print-text">
            <strong>NoteFlow</strong> - Palmira, Valle del Cauca, Colombia<br/>
            <em>"Para todos los viajeros que tienen un espíritu libre"</em>
          </div>
        </div>
        <div className="print-copyright">
          &copy; Derechos reservados a todo NoteFlow.<br/>
          Generado el: <span>{new Date().toLocaleString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      
    </div>
  );
}

export default AnalyticsReport;
