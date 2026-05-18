import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const UserActivityModal = ({ userId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchNote, setSearchNote] = useState('');
  const [expandedNotes, setExpandedNotes] = useState({});

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/admin/usuarios/${userId}/detalles`);
        const json = await response.json();
        if (response.ok) {
          setData(json);
        } else {
          setError(json.error);
        }
      } catch (err) {
        setError('Error de conexión con el servidor.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const toggleAdmin = async () => {
    try {
      const response = await fetch(`/api/admin/usuarios/${userId}/toggle-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        // Refresh data
        const res = await fetch(`/api/admin/usuarios/${userId}/detalles`);
        setData(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleNote = (id) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!userId) return null;

  return createPortal(
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-user-clock" style={{ color: 'var(--color-principal)' }}></i> Detalles del Usuario
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {loading ? (
              <div className="text-center text-muted py-5">
                <i className="fas fa-spinner fa-spin fa-2x mb-2 text-primary"></i>
                <p>Consultando base de datos de NoteFlow...</p>
              </div>
            ) : error ? (
              <div className="alert alert-danger">{error}</div>
            ) : (
              <>
                <div className="d-flex align-items-center gap-3 pb-3 mb-4 border-bottom">
                  {data.usuario.Es_premium ? (
                    <div className="avatar-premium-container" style={{ width: '65px', height: '65px' }}>
                      <img src={data.usuario.Foto && data.usuario.Foto !== 'None' ? `/static/${data.usuario.Foto}` : '/static/default_profile.png'} alt="" className="user-avatar" style={{ width: '100%', height: '100%' }} />
                      <img src={`/static/avatar_${data.usuario.Avatar_plan || data.usuario.Plan_premium}_animated.svg`} className={`avatar-frame ${data.usuario.Avatar_plan === 'ninguno' ? 'frame-hidden' : ''}`} />
                    </div>
                  ) : (
                    <img src={data.usuario.Foto && data.usuario.Foto !== 'None' ? `/static/${data.usuario.Foto}` : '/static/default_profile.png'} alt="" className="free-user-avatar" style={{ width: '65px', height: '65px', objectFit: 'cover', borderRadius: '50%' }} />
                  )}
                  <div>
                    <h4 className="mb-1" style={{ fontWeight: '800', fontSize: '1.3rem' }}>{data.usuario.Nombres} {data.usuario.Apellidos}</h4>
                    <p className="text-muted mb-2" style={{ fontSize: '0.82rem' }}>@{data.usuario.Usuario} (ID: {data.usuario.ID_Cuenta})</p>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className={`plan-badge premium-${data.usuario.Plan_premium || 'gratis'}`}>
                        {(data.usuario.Plan_premium || 'gratis').toUpperCase()}
                      </span>
                      {data.usuario.Es_admin ? (
                        <span className="badge-hashed" style={{ background: 'rgba(46, 204, 113, 0.12)', color: '#2ecc71', borderColor: 'rgba(46, 204, 113, 0.25)', fontSize: '0.72rem', fontWeight: 700 }}>ADMINISTRADOR</span>
                      ) : (
                        <span className="badge-hashed" style={{ background: 'rgba(84, 82, 211, 0.1)', color: 'var(--color-principal)', borderColor: 'rgba(84, 82, 211, 0.2)', fontSize: '0.72rem', fontWeight: 700 }}>Usuario Regular</span>
                      )}
                    </div>
                    {window.APP_USER?.id === 1 && data.usuario.ID_Cuenta !== 1 && (
                      <button className={`btn btn-sm mt-3 ${data.usuario.Es_admin ? 'btn-outline-danger' : 'btn-outline-warning'}`} style={{ fontWeight: 700, fontSize: '0.75rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={toggleAdmin}>
                        <i className={`fas ${data.usuario.Es_admin ? 'fa-user-minus' : 'fa-user-shield'}`}></i> 
                        {data.usuario.Es_admin ? 'Quitar Acceso al Panel' : 'Otorgar Acceso al Panel'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <div className="p-3 border rounded-3 act-info-card">
                      <h6 className="text-uppercase text-muted mb-2" style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' }}><i className="fas fa-envelope"></i> Contacto</h6>
                      <p className="mb-1" style={{ fontSize: '0.88rem' }}><strong>Correo:</strong> {data.usuario.Correo}</p>
                      <p className="mb-0" style={{ fontSize: '0.88rem' }}><strong>Teléfono:</strong> {data.usuario.Telefono ? `+${data.usuario.Telefono}` : 'Sin teléfono'}</p>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="p-3 border rounded-3 act-info-card">
                      <h6 className="text-uppercase text-muted mb-2" style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' }}><i className="fas fa-chart-bar"></i> Actividad Global</h6>
                      <p className="mb-1" style={{ fontSize: '0.88rem' }}><strong>Notas creadas:</strong> <span className="badge-hashed" style={{ background: 'rgba(84,82,211,0.15)', color: 'var(--color-principal)', borderColor: 'rgba(84,82,211,0.25)' }}>{data.notes.length}</span></p>
                      <p className="mb-0" style={{ fontSize: '0.88rem' }}><strong>Carpetas creadas:</strong> <span className="badge-hashed" style={{ background: 'rgba(243,156,18,0.15)', color: 'var(--color-secundario)', borderColor: 'rgba(243,156,18,0.25)' }}>{data.carpetas.length}</span></p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h5 className="mb-3" style={{ fontWeight: 700, fontSize: '1rem' }}><i className="fas fa-folder-open text-warning me-2"></i> Carpetas Registradas</h5>
                  <div className="d-flex flex-wrap gap-2">
                    {data.carpetas.length === 0 ? (
                      <span className="text-muted" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>El usuario no ha creado ninguna carpeta.</span>
                    ) : (
                      data.carpetas.map(c => (
                        <span key={c.ID_Carpeta} className="badge-hashed" style={{ background: 'rgba(243, 156, 18, 0.12)', color: '#f39c12', borderColor: 'rgba(243,156,18,0.25)', padding: '5px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                          <i className="fas fa-folder text-warning"></i> {c.Nombre}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0" style={{ fontWeight: 700, fontSize: '1rem' }}><i className="fas fa-sticky-note text-primary me-2"></i> Notas Creadas</h5>
                    <input type="text" className="form-control form-control-sm" placeholder="Buscar nota..." style={{ width: '200px', borderRadius: '8px' }} value={searchNote} onChange={(e) => setSearchNote(e.target.value)} />
                  </div>
                  <div className="d-flex flex-column gap-3">
                    {data.notes.filter(n => (n.Titulo || '').toLowerCase().includes(searchNote.toLowerCase())).length === 0 ? (
                      <div className="text-center text-muted py-4">No se encontraron notas registradas.</div>
                    ) : (
                      data.notes.filter(n => (n.Titulo || '').toLowerCase().includes(searchNote.toLowerCase())).map(note => {
                        const fmt = note.Formato === 'audio' ? { label: 'Audio', icon: 'fas fa-microphone text-success', bg: 'rgba(46, 204, 113, 0.12)', color: '#2ecc71' } :
                                    note.Formato === 'video' ? { label: 'Video', icon: 'fas fa-video text-danger', bg: 'rgba(231, 76, 60, 0.12)', color: '#e74c3c' } :
                                    note.Formato === 'dibujo' ? { label: 'Dibujo', icon: 'fas fa-paint-brush text-warning', bg: 'rgba(241, 196, 15, 0.12)', color: '#f1c40f' } :
                                    { label: 'Texto', icon: 'fas fa-file-alt text-primary', bg: 'rgba(52, 152, 219, 0.12)', color: '#3498db' };
                        
                        return (
                          <div key={note.ID_Nota} className="stat-card" style={{ padding: '16px', borderRadius: '12px', border: '1.5px solid var(--border-claro)' }}>
                            <div className="d-flex justify-content-between align-items-start gap-2">
                              <div>
                                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                  <span className="badge-hashed" style={{ background: fmt.bg, color: fmt.color, borderColor: `${fmt.color}44`, fontSize: '0.7rem', fontWeight: 800 }}>
                                    <i className={fmt.icon}></i> {fmt.label.toUpperCase()}
                                  </span>
                                  {note.Nombre_Carpeta && (
                                    <span className="badge-hashed" style={{ background: 'rgba(243, 156, 18, 0.08)', color: '#f39c12', borderColor: 'rgba(243,156,18,0.18)', fontSize: '0.7rem' }}>
                                      <i className="fas fa-folder"></i> {note.Nombre_Carpeta}
                                    </span>
                                  )}
                                  <small className="text-muted" style={{ fontSize: '0.72rem' }}><i className="far fa-clock"></i> Modificado: {note.Fecha_deedicion}</small>
                                </div>
                                <h5 style={{ margin: 0, fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)' }}>{note.Titulo || 'Nota sin título'}</h5>
                              </div>
                              <button className="btn btn-sm btn-outline-primary" style={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={() => toggleNote(note.ID_Nota)}>
                                <i className={`fas ${expandedNotes[note.ID_Nota] ? 'fa-eye-slash' : 'fa-eye'}`}></i> Previsualizar
                              </button>
                            </div>
                            {expandedNotes[note.ID_Nota] && (
                              <div style={{ padding: '12px 0 0 0', marginTop: '12px', borderTop: '1px dashed var(--border-claro)' }}>
                                <div className="p-3 rounded-3" style={{ background: 'rgba(0,0,0,0.02)', fontSize: '0.88rem', color: 'var(--text-main)', border: '1px solid var(--border-claro)' }}>
                                  {note.Formato === 'texto' ? <div style={{ whiteSpace: 'pre-wrap' }}>{note.Contenido}</div> :
                                   note.Formato === 'audio' ? <audio src={note.Contenido} controls style={{ width: '100%' }}></audio> :
                                   note.Formato === 'video' ? <video src={note.Contenido} controls style={{ maxWidth: '100%' }}></video> :
                                   note.Formato === 'dibujo' ? <img src={note.Contenido} style={{ maxWidth: '100%' }} alt="Dibujo" /> : null}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UserActivityModal;
