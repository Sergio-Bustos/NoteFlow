/* ===========================================================
       ESTADO
       =========================================================== */
    var tagsActivos = new Set();

    /* ===========================================================
       MODAL
       =========================================================== */
    function abrirModal() {
        volver();
        document.getElementById('backdrop').classList.add('activo');
        document.body.style.overflow = 'hidden';
    }
    function cerrarModal() {
        document.getElementById('backdrop').classList.remove('activo');
        document.body.style.overflow = '';
    }
    function clickBackdrop(e) {
        if (e.target === document.getElementById('backdrop')) cerrarModal();
    }
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { cerrarModal(); cerrarModalAgregarNotas(); }
    });

    /* ===========================================================
       PREVISUALIZAR NOTA (plan vencido)
       =========================================================== */
    function abrirPreviewNota(notaId) {
        var modalEl = document.getElementById('previewModal');
        if (!modalEl) return;
        var body = document.getElementById('previewModalBody');
        body.innerHTML = '<div class="preview-loading"><div class="spinner-border" role="status"></div><p>Cargando nota...</p></div>';

        var bsModal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });
        bsModal.show();

        fetch('/api/nota/' + notaId + '/previsualizar')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.error) {
                    if (data.redirect) { window.location.href = data.redirect; return; }
                    body.innerHTML = '<div class="alert alert-danger m-3">' + data.error + '</div>';
                    return;
                }
                body.innerHTML = renderPreviewContent(data);
            })
            .catch(function() {
                body.innerHTML = '<div class="alert alert-danger m-3">Error al cargar la nota.</div>';
            });
    }

    function renderPreviewContent(data) {
        var fmtIconos = { texto:'fa-align-left', imagen:'fa-image', audio:'fa-microphone', video:'fa-video', dibujo:'fa-paint-brush', mixta:'fa-layer-group' };
        var fmtColores = { texto:'#5452d3', imagen:'#27ae60', audio:'#e74c3c', video:'#2980b9', dibujo:'#f39c12', mixta:'#8e44ad' };
        var icono = fmtIconos[data.formato] || 'fa-file-alt';
        var color = fmtColores[data.formato] || '#888';
        var html = '';

        html += '<div class="preview-meta">';
        html += '  <i class="fas ' + icono + '" style="color:' + color + ';font-size:1.2rem;"></i>';
        html += '  <span class="badge-format-preview" style="background:' + color + '18;color:' + color + ';border:1px solid ' + color + '30;">' + data.formato.toUpperCase() + '</span>';
        html += '</div>';
        html += '<h4 class="preview-titulo">' + escapeHtml(data.titulo) + '</h4>';
        if (data.descripcion) html += '<p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:16px;">' + escapeHtml(data.descripcion) + '</p>';

        if (data.formato === 'texto') {
            if (data.contenido) html += '<div class="preview-contenido-texto" style="border-left:4px solid ' + color + ';padding-left:16px;">' + data.contenido + '</div>';
        } else if (data.formato === 'mixta') {
            var mixtaHtml = '';
            if (data.contenido) mixtaHtml += '<div class="preview-contenido-texto">' + data.contenido + '</div>';
            if (data.adjuntos && data.adjuntos.length > 0) {
                mixtaHtml += '<div class="preview-adjuntos">';
                mixtaHtml += '  <h6 style="font-weight:700;font-size:0.85rem;color:var(--text-muted);"><i class="fas fa-paperclip"></i> Adjuntos (' + data.adjuntos.length + ')</h6>';
                for (var i = 0; i < data.adjuntos.length; i++) {
                    var a = data.adjuntos[i];
                    mixtaHtml += '<div class="preview-adjunto">';
                    mixtaHtml += '  <div class="adjunto-header"><i class="fas fa-file"></i> ' + escapeHtml(a.nombre) + ' <span class="badge bg-secondary text-uppercase" style="font-size:0.6rem;padding:2px 6px;">' + a.ext + '</span></div>';
                    if (a.tipo === 'imagen') mixtaHtml += '<img src="' + a.ruta + '" alt="">';
                    else if (a.tipo === 'audio') mixtaHtml += '<audio src="' + a.ruta + '" controls preload="metadata" style="width:100%;"></audio>';
                    else if (a.tipo === 'video') mixtaHtml += '<video src="' + a.ruta + '" controls preload="metadata" style="max-height:250px;width:100%;"></video>';
                    mixtaHtml += '</div>';
                }
                mixtaHtml += '</div>';
            }
            if (mixtaHtml) html += '<div style="border:3px solid ' + color + ';border-radius:12px;padding:16px;">' + mixtaHtml + '</div>';
        } else if (data.formato === 'imagen' || data.formato === 'dibujo') {
            var src = (data.adjuntos && data.adjuntos[0] ? data.adjuntos[0].ruta : '') || data.contenido;
            if (src) html += '<div style="display:table;margin:0 auto;border:3px solid ' + color + ';border-radius:12px;line-height:0;"><img src="' + src + '" alt="' + escapeHtml(data.titulo) + '" style="border-radius:10px;display:block;"></div>';
        } else if (data.formato === 'audio') {
            var src = (data.adjuntos && data.adjuntos[0] ? data.adjuntos[0].ruta : '') || data.contenido;
            if (src) html += '<div style="display:table;margin:0 auto;border:3px solid ' + color + ';border-radius:12px;padding:16px;background:var(--preview-adjunto-bg);"><audio src="' + src + '" controls preload="metadata" style="width:100%;"></audio></div>';
        } else if (data.formato === 'video') {
            var src = (data.adjuntos && data.adjuntos[0] ? data.adjuntos[0].ruta : '') || data.contenido;
            if (src) {
                var ext = src.split('.').pop().toLowerCase();
                var mime = { mp4:'video/mp4', webm:'video/webm', ogg:'video/ogg', mov:'video/quicktime', avi:'video/x-msvideo', mkv:'video/x-matroska', wmv:'video/x-ms-wmv' }[ext] || 'video/mp4';
                html += '<div style="display:table;margin:0 auto;border:3px solid ' + color + ';border-radius:12px;line-height:0;"><video controls preload="metadata" style="border-radius:10px;display:block;max-width:100%;"><source src="' + src + '" type="' + mime + '"></video></div>';
            }
        }

        return html;
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ===========================================================
       FLUJO DE PASOS
       =========================================================== */
    function elegirTipo(tipo) {
        document.getElementById('paso-seleccion').style.display = 'none';
        document.getElementById('panel-notas').classList.toggle('activo',    tipo === 'notas');
        document.getElementById('panel-carpetas').classList.toggle('activo', tipo === 'carpetas');
        setTimeout(function() {
            var inp = document.getElementById(tipo === 'notas' ? 'nota-texto' : 'carpeta-texto');
            if (inp) inp.focus();
        }, 80);
    }
    function volver() {
        document.getElementById('paso-seleccion').style.display = 'block';
        document.getElementById('panel-notas').classList.remove('activo');
        document.getElementById('panel-carpetas').classList.remove('activo');
    }

    /* ===========================================================
       ETIQUETAS
       =========================================================== */
    function filtrarEtiquetas(query) {
        var q = query.trim().toLowerCase();
        var chips = document.querySelectorAll('#chips-etiquetas .etiqueta-chip');
        var hayVisible = false;
        chips.forEach(function(chip) {
            var val = chip.dataset.valor.toLowerCase();
            var texto = chip.textContent.trim().toLowerCase();
            var visible = !q || val.includes(q) || texto.includes(q);
            chip.style.display = visible ? '' : 'none';
            if (visible) hayVisible = true;
        });
        var hint = document.getElementById('hint-nueva-etiqueta');
        var hintTexto = document.getElementById('hint-nueva-texto');
        if (q && !existeEtiqueta(q)) {
            hint.style.display = 'flex';
            hintTexto.textContent = 'Agregar "' + query.trim() + '" como etiqueta';
        } else {
            hint.style.display = 'none';
        }
    }

    function existeEtiqueta(valor) {
        var chips = document.querySelectorAll('#chips-etiquetas .etiqueta-chip');
        for (var i = 0; i < chips.length; i++) {
            if (chips[i].dataset.valor.toLowerCase() === valor.toLowerCase()) return true;
        }
        return false;
    }

    function agregarEtiquetaPersonalizada() {
        var input = document.getElementById('etiqueta-buscar');
        var valor = input.value.trim();
        if (!valor || existeEtiqueta(valor)) return;
        var chip = document.createElement('span');
        chip.className = 'etiqueta-chip activa';
        chip.dataset.valor = valor.toLowerCase();
        chip.onclick = function() { toggleTag(this); };
        var icono = document.createElement('i');
        icono.className = 'fas fa-check';
        chip.appendChild(icono);
        chip.appendChild(document.createTextNode(' ' + valor));
        document.getElementById('chips-etiquetas').appendChild(chip);
        tagsActivos.add(valor.toLowerCase());
        input.value = '';
        document.getElementById('hint-nueva-etiqueta').style.display = 'none';
        filtrarEtiquetas('');
        actualizarChipsActivos();
    }

    document.getElementById('etiqueta-buscar').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var hint = document.getElementById('hint-nueva-etiqueta');
            if (hint.style.display === 'flex') agregarEtiquetaPersonalizada();
        }
    });

    function toggleTag(el) {
        var val = el.dataset.valor;
        if (el.classList.contains('activa')) {
            el.classList.remove('activa');
            tagsActivos.delete(val);
        } else {
            el.classList.add('activa');
            tagsActivos.add(val);
        }
        actualizarChipsActivos();
    }

    /* ===========================================================
       CHIPS FILTROS ACTIVOS
       =========================================================== */
    function actualizarChipsActivos() {
        var bar       = document.getElementById('filtros-activos-notas');
        var container = document.getElementById('chips-activos');
        container.innerHTML = '';
        var hay = false;
        var campos = [
            { id: 'nota-carpeta',     label: 'Carpeta' },
            { id: 'nota-formato',     label: 'Formato' },
            { id: 'nota-fecha-desde', label: 'Desde'   },
            { id: 'nota-fecha-hasta', label: 'Hasta'   },
        ];
        campos.forEach(function(c) {
            var el = document.getElementById(c.id);
            if (el && el.value) {
                hay = true;
                container.appendChild(chipActivo(c.label + ': ' + el.value, (function(elem) {
                    return function() { elem.value = ''; actualizarChipsActivos(); };
                })(el)));
            }
        });
        tagsActivos.forEach(function(tag) {
            hay = true;
            container.appendChild(chipActivo('#' + tag, (function(t) {
                return function() {
                    tagsActivos.delete(t);
                    document.querySelectorAll('.etiqueta-chip[data-valor="' + t + '"]')
                        .forEach(function(ch) { ch.classList.remove('activa'); });
                    actualizarChipsActivos();
                };
            })(tag)));
        });
        bar.classList.toggle('visible', hay);
    }

    function chipActivo(texto, onRemove) {
        var div = document.createElement('div');
        div.className = 'chip-activo';
        div.innerHTML = texto + '<button>&times;</button>';
        div.querySelector('button').addEventListener('click', onRemove);
        return div;
    }

    ['nota-carpeta','nota-formato','nota-fecha-desde','nota-fecha-hasta'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', actualizarChipsActivos);
    });

    /* ===========================================================
       LIMPIAR
       =========================================================== */
    function limpiarNotas() {
        ['nota-texto','nota-carpeta','nota-formato','nota-fecha-desde','nota-fecha-hasta']
            .forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
        document.getElementById('nota-orden').value = 'reciente';
        document.getElementById('etiqueta-buscar').value = '';
        document.getElementById('hint-nueva-etiqueta').style.display = 'none';
        tagsActivos.clear();
        document.querySelectorAll('.etiqueta-chip').forEach(function(ch) {
            ch.classList.remove('activa');
            ch.style.display = '';
        });
        actualizarChipsActivos();
    }
    function limpiarCarpetas() {
        document.getElementById('carpeta-texto').value     = '';
        document.getElementById('carpeta-orden').value     = 'reciente';
        document.getElementById('carpeta-min-notas').value = '';
    }

    /* ===========================================================
       MOSTRAR SIN RESULTADOS
       =========================================================== */
    function mostrarSinResultados(tipo) {
        var area = document.getElementById('area-resultados');
        area.classList.add('visible');
        document.getElementById('resultados-notas').innerHTML    = '';
        document.getElementById('resultados-carpetas').innerHTML = '';
        document.getElementById('sin-resultados').style.display  = 'flex';
        document.getElementById('icono-res').className  = tipo === 'notas' ? 'fas fa-file-alt' : 'fas fa-folder';
        document.getElementById('label-res').textContent = tipo === 'notas' ? 'Notas encontradas' : 'Carpetas encontradas';
        document.getElementById('badge-res').textContent = '0';
        area.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ===========================================================
       ÍCONOS POR FORMATO
       =========================================================== */
    var ICONOS_FORMATO = {
        texto:   { clase: 'fas fa-align-left',   color: '#5452d3' },
        imagen:  { clase: 'fas fa-image',         color: '#27ae60' },
        audio:   { clase: 'fas fa-microphone',    color: '#e74c3c' },
        video:   { clase: 'fas fa-video',         color: '#2980b9' },
        dibujo:  { clase: 'fas fa-paint-brush',   color: '#f39c12' },
        mixta:   { clase: 'fas fa-layer-group',   color: '#8e44ad' },
        default: { clase: 'fas fa-file-alt',      color: '#888'    },
    };

    /* ===========================================================
       COLOR ÚNICO POR CARPETA (franja lateral)
       =========================================================== */
    var COLORES_CARPETA = [
        '#f39c12','#5452d3','#27ae60','#e74c3c',
        '#2980b9','#8e44ad','#16a085','#d35400',
        '#c0392b','#1abc9c','#2c3e50','#7f8c8d',
    ];
    var _mapaCarpetaColor = {};

    function _colorDeCarpeta(nombreCarpeta) {
        if (!nombreCarpeta) return null;
        if (!_mapaCarpetaColor[nombreCarpeta]) {
            var hash = 0;
            for (var i = 0; i < nombreCarpeta.length; i++) {
                hash = (hash * 31 + nombreCarpeta.charCodeAt(i)) & 0xffffffff;
            }
            _mapaCarpetaColor[nombreCarpeta] = COLORES_CARPETA[Math.abs(hash) % COLORES_CARPETA.length];
        }
        return _mapaCarpetaColor[nombreCarpeta];
    }

    /* ===========================================================
       BUILDER DE TARJETA DE NOTA (centralizado)
       =========================================================== */
    function _buildNotaCard(nota) {
        var fmt  = ICONOS_FORMATO[(nota.formato || '').toLowerCase()] || ICONOS_FORMATO.default;
        var tags = nota.etiquetas && nota.etiquetas.length
            ? nota.etiquetas.map(function(t) {
                return '<span class="nota-tag">#' + t + '</span>';
              }).join('')
            : '';
        var colorCarpeta = _colorDeCarpeta(nota.carpeta) || '#1abc9c';
        var colorFormato = fmt.color;
        var franjaStyle  = 'border-left:4px solid ' + colorFormato + ';';
        var carpetaHtml  = nota.carpeta
            ? '<span class="nota-carpeta-badge" style="background:' + colorCarpeta + '22;color:' + colorCarpeta + '; display: inline-flex; align-items: center; gap: 5px; border-radius: 6px; padding: 2px 6px;">' +
                  '<i class="fas fa-folder" style="color:' + colorCarpeta + ';"></i> <span style="font-size: 0.8rem;">' + nota.carpeta + '</span>' +
                  '<i class="fas fa-times" onclick="quitarNotaDeCarpeta(' + nota.id + ',\'' + nota.carpeta.replace(/'/g, "\\'") + '\', event)" style="cursor: pointer; opacity: 0.7; margin-left: 2px" title="Sacar de carpeta" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7"></i>' +
              '</span>'
            : '';

        var esPremium = window.ES_PREMIUM !== undefined ? window.ES_PREMIUM : true;
        var fmtLower = (nota.formato || '').toLowerCase();
        var esPremiumFormat = window.PREMIUM_FORMATOS && window.PREMIUM_FORMATOS.indexOf(fmtLower) !== -1;
        var bloqueada = !esPremium && esPremiumFormat;
        var onClick = bloqueada ? 'abrirPreviewNota(' + nota.id + ')' : 'window.location.href=\'/editar-nota/' + nota.id + '\'';

        return (
            '<div class="nota-card' + (bloqueada ? ' nota-bloqueada' : '') + '" data-id="' + nota.id + '" data-carpeta="' + (nota.carpeta || '') + '" draggable="' + (!bloqueada).toString() + '" ' +
                    (bloqueada ? '' : 'ondragstart="onDragStartNota(event,' + nota.id + ')" ') +
                    (bloqueada ? '' : 'ondragend="onDragEndNota(event)" ') +
                    'onclick="' + onClick + '" ' +
                    'style="' + franjaStyle + '">' +
                (bloqueada ? '' : '<button class="btn-eliminar-nota" ' +
                    'onclick="abrirModalEliminarNota(' + nota.id + ', \'' + (nota.titulo || 'Sin título').replace(/'/g, "\\'") + '\', event)" ' +
                    'title="Mover a papelera">' +
                    '<i class="fas fa-trash-alt"></i>' +
                '</button>') +
                (bloqueada ? '' : '<div class="nota-drag-handle" title="Arrastra a una carpeta"><i class="fas fa-grip-vertical"></i></div>') +
                '<div class="nota-card-header">' +
                    (bloqueada ? '<i class="fas fa-lock" style="color:#e74c3c;font-size:1rem;margin-right:4px;" title="Plan vencido — solo previsualización"></i>' : '') +
                    '<i class="' + fmt.clase + '" style="color:' + fmt.color + ';font-size:1.2rem;"></i>' +
                    '<span class="nota-formato-badge">' + (nota.formato || '') + '</span>' +
                    carpetaHtml +
                '</div>' +
                '<h4 class="nota-titulo">' + (nota.titulo || 'Sin título') + '</h4>' +
                '<p class="nota-descripcion">' + (nota.descripcion || '') + '</p>' +
                '<div class="nota-tags">' + tags + '</div>' +
                '<div class="nota-footer">' +
                    '<span><i class="fas fa-clock"></i> ' + nota.edicion + '</span>' +
                '</div>' +
            '</div>'
        );
    }

    /* ===========================================================
       RENDERIZAR TARJETAS DE NOTAS (búsqueda)
       =========================================================== */
    function renderizarNotas(notas, esVistaPrev) {
        var area       = document.getElementById('area-resultados');
        var contenedor = document.getElementById('resultados-notas');
        var sinRes     = document.getElementById('sin-resultados');
        var badge      = document.getElementById('badge-res');
        var icono      = document.getElementById('icono-res');
        var label      = document.getElementById('label-res');

        area.classList.add('visible');
        document.getElementById('resultados-carpetas').innerHTML = '';
        icono.className   = 'fas fa-file-alt';
        label.textContent = esVistaPrev ? 'Notas recientes' : 'Notas encontradas';
        badge.textContent = notas.length;

        // Mostrar u ocultar botón volver si estamos filtrando por carpeta
        var btnVolver = document.getElementById('btn-volver-atras');
        var params = new URLSearchParams(window.location.search);
        var selectCarpeta = document.getElementById('nota-carpeta');
        if (btnVolver) {
            btnVolver.style.display = (params.get('carpeta') || (selectCarpeta && selectCarpeta.value)) ? 'inline-block' : 'none';
        }

        if (notas.length === 0) {
            contenedor.innerHTML = '';
            sinRes.style.display = 'flex';
            area.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        sinRes.style.display = 'none';
        contenedor.innerHTML = notas.map(function(nota) {
            return _buildNotaCard(nota);
        }).join('');

        if (esVistaPrev) {
            contenedor.innerHTML += (
                '<div class="ver-todas-card" onclick="cargarTodoOrdenado()">' +
                    '<i class="fas fa-search"></i>' +
                    '<span>Ver todas mis notas y carpetas</span>' +
                '</div>'
            );
        }

        area.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ===========================================================
       BUSCAR NOTAS
       =========================================================== */
    function buscarNotas() {
        cerrarModal();
        var params = new URLSearchParams();
        var q = document.getElementById('nota-texto').value.trim();
        if (q.startsWith('#')) {
            var tagDesdeTexto = q.replace(/^#+/, '').trim().toLowerCase();
            if (tagDesdeTexto) tagsActivos.add(tagDesdeTexto);
        } else if (q) {
            params.set('q', q);
        }
        var formato = document.getElementById('nota-formato').value;
        if (formato) params.set('formato', formato);
        var carpeta = document.getElementById('nota-carpeta').value;
        if (carpeta) params.set('carpeta', carpeta);
        var desde = document.getElementById('nota-fecha-desde').value;
        if (desde) params.set('desde', desde);
        var hasta = document.getElementById('nota-fecha-hasta').value;
        if (hasta) params.set('hasta', hasta);
        var orden = document.getElementById('nota-orden').value;
        if (orden) params.set('orden', orden);
        if (tagsActivos.size > 0) {
            params.set('etiquetas', Array.from(tagsActivos).join(','));
        }
        fetch('/api/mis-notas?' + params.toString())
            .then(function(r) { return r.json(); })
            .then(function(data) {
                // EXPLICACIÃ“N: Si no estamos buscando una carpeta especÃ­fica, filtrar las que ya estÃ¡n agrupadas
                if (data.success) {
                    var tieneCarpeta = params.has('carpeta');
                    var filtradas = tieneCarpeta 
                        ? data.notas 
                        : data.notas.filter(function(n) { return !n.carpeta; });
                    
                    if (filtradas.length > 0) renderizarNotas(filtradas, false);
                    else mostrarSinResultados('notas');
                } else {
                    mostrarSinResultados('notas');
                }
            })
            .catch(function() { mostrarSinResultados('notas'); });
    }

    function volverAtrasCarpeta() {
        // Limpiar el filtro de carpeta
        var selectCarpeta = document.getElementById('nota-carpeta');
        if (selectCarpeta) selectCarpeta.value = '';
        
        // Quitar el parámetro de la URL sin recargar
        var url = new URL(window.location);
        url.searchParams.delete('carpeta');
        window.history.pushState({}, '', url);

        // Volver a cargar todo
        cargarTodoOrdenado();
    }
    window.volverAtrasCarpeta = volverAtrasCarpeta;



    /* ===========================================================
       BUSCAR CARPETAS
       =========================================================== */
    function buscarCarpetas() {
        cerrarModal();
        var params = new URLSearchParams();
        var q = document.getElementById('carpeta-texto').value.trim();
        if (q) params.set('q', q);
        var orden = document.getElementById('carpeta-orden').value;
        if (orden) params.set('orden', orden);
        var minNotas = document.getElementById('carpeta-min-notas').value;
        if (minNotas) params.set('min_notas', minNotas);
        fetch('/api/mis-carpetas?' + params.toString())
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) renderizarCarpetas(data.carpetas);
                else mostrarSinResultados('carpetas');
            })
            .catch(function() { mostrarSinResultados('carpetas'); });
    }

    /* ===========================================================
       RENDERIZAR TARJETAS DE CARPETAS
       =========================================================== */
    function _buildCarpetaCard(c, esReciente) {
        var nombreEscapado = (c.nombre || '').replace(/'/g, "\\'");
        
        // Si es la vista de recientes, al hacer clic (single clic) mandan a la vista completa
        // DESPUÉS
        var clickAccion = esReciente 
            ? 'cargarTodoOrdenado()' 
            : 'window.location.href=\'/notas?carpeta=\' + encodeURIComponent(\'' + nombreEscapado + '\')';

        var htmlAcciones = esReciente
            ? '<button class="btn-carpeta-accion ver" onclick="window.location.href=\'/notas?carpeta=\' + encodeURIComponent(\'' + nombreEscapado + '\'); event.stopPropagation();" title="Ver notas"><i class="fas fa-eye"></i></button>'
            : '<button class="btn-carpeta-accion ver" onclick="window.location.href=\'/notas?carpeta=\' + encodeURIComponent(\'' + nombreEscapado + '\'); event.stopPropagation();" title="Ver notas"><i class="fas fa-eye"></i></button>' +
              '<button class="btn-carpeta-accion agregar" onclick="abrirModalAgregarNotas(' + c.id + ',\'' + nombreEscapado + '\'); event.stopPropagation();" title="Agregar notas"><i class="fas fa-plus"></i></button>' +
              '<button class="btn-carpeta-accion editar" onclick="abrirModalEditarCarpeta(' + c.id + ',\'' + nombreEscapado + '\'); event.stopPropagation();" title="Editar"><i class="fas fa-pen"></i></button>' +
              '<button class="btn-carpeta-accion eliminar" onclick="abrirModalEliminarCarpeta(' + c.id + ',\'' + nombreEscapado + '\'); event.stopPropagation();" title="Eliminar"><i class="fas fa-trash-alt"></i></button>';

        return (
            '<div class="carpeta-card" data-id="' + c.id + '" ' +
                'onclick="' + clickAccion + '" ' +
                (!esReciente ? 'ondragover="onDragOverCarpeta(event)" ondragleave="onDragLeaveCarpeta(event)" ondrop="onDropEnCarpeta(event,' + c.id + ')"' : '') +
                '>' +
                (!esReciente ? '<div class="carpeta-drop-hint"><i class="fas fa-folder-open"></i> Suelta aquí</div>' : '') +
                '<div class="carpeta-card-icon"><i class="fas fa-folder-open"></i></div>' +
                '<div class="carpeta-card-info">' +
                    '<h4 class="carpeta-nombre">' + c.nombre + '</h4>' +
                    '<span class="carpeta-meta"><i class="fas fa-file-alt"></i> ' + c.total_notas + ' nota' + (c.total_notas !== 1 ? 's' : '') + '</span>' +
                    '<span class="carpeta-meta"><i class="fas fa-clock"></i> ' + c.edicion + '</span>' +
                '</div>' +
                '<div class="carpeta-card-acciones">' +
                    htmlAcciones +
                '</div>' +
            '</div>'
        );
    }



    function renderizarCarpetas(carpetas) {
        var area       = document.getElementById('area-resultados');
        var contenedor = document.getElementById('resultados-carpetas');
        var sinRes     = document.getElementById('sin-resultados');
        var badge      = document.getElementById('badge-res');
        var icono      = document.getElementById('icono-res');
        var label      = document.getElementById('label-res');

        area.classList.add('visible');
        document.getElementById('resultados-notas').innerHTML = '';
        icono.className   = 'fas fa-folder';
        label.textContent = 'Carpetas encontradas';
        badge.textContent = carpetas.length;

        if (carpetas.length === 0) {
            contenedor.innerHTML = '';
            sinRes.style.display = 'flex';
            area.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        sinRes.style.display = 'none';
        contenedor.innerHTML = carpetas.map(function(c) {
            return _buildCarpetaCard(c, false);
        }).join('');

        area.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ===========================================================
       VER NOTAS DE UNA CARPETA (toggle inline)
       =========================================================== */
    function verNotasDeCarpeta(carpetaId, carpetaNombre, event) {
        if (event) event.stopPropagation();

        // Toggle: si el panel ya existe, cerrarlo
        var panelExistente = document.getElementById('panel-notas-carpeta-' + carpetaId);
        if (panelExistente) { panelExistente.remove(); return; }

        fetch('/api/mis-notas?carpeta=' + encodeURIComponent(carpetaNombre))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) { mostrarToast('Error al cargar notas', 'error'); return; }
                var notas = data.notas || [];

                var carpetaCard = document.querySelector('.carpeta-card[data-id="' + carpetaId + '"]');
                if (!carpetaCard) return;

                var panel = document.createElement('div');
                panel.id        = 'panel-notas-carpeta-' + carpetaId;
                panel.className = 'panel-notas-carpeta';

                if (notas.length === 0) {
                    panel.innerHTML =
                        '<p class="panel-carpeta-vacio"><i class="fas fa-file-alt"></i> Esta carpeta no tiene notas aún. Usa el botón <strong>+</strong> para agregar.</p>';
                } else {
                    panel.innerHTML = notas.map(function(nota) {
                        return _buildNotaCard(nota);
                    }).join('');
                }

                carpetaCard.after(panel);
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            })
            .catch(function() { mostrarToast('Error de conexión', 'error'); });
    }

    /* ===========================================================
       DRAG & DROP — NOTAS → CARPETAS
       =========================================================== */
    var _notaArrastrandoId     = null;
    var _notaArrastrandoCarpeta = null; // carpeta actual de la nota que se arrastra

    // ── Zona flotante para sacar nota de carpeta ──────────────────
    (function crearZonaSacar() {
        var zona = document.createElement('div');
        zona.id        = 'zona-sacar-carpeta';
        zona.className = 'zona-sacar-carpeta';
        zona.innerHTML = '<i class="fas fa-folder-minus"></i><span>Soltar aquí para sacar de la carpeta</span>';
        document.body.appendChild(zona);

        zona.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zona.classList.add('activa');
        });
        zona.addEventListener('dragleave', function(e) {
            if (!zona.contains(e.relatedTarget)) {
                zona.classList.remove('activa');
            }
        });
        zona.addEventListener('drop', function(e) {
            e.preventDefault();
            zona.classList.remove('activa');
            var notaId = _notaArrastrandoId || parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (!notaId) return;

            fetch('/api/notas/' + notaId + '/carpeta', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ carpeta_id: null })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) {
                    mostrarToast('Nota sacada de la carpeta', 'exito');
                    var notaCard = document.querySelector('.nota-card[data-id="' + notaId + '"]');
                    if (notaCard) {
                        // 1) Guardar datos de la nota para reconstruirla
                        var notaDataClone = {
                            id:          notaId,
                            titulo:      notaCard.querySelector('.nota-titulo')  ? notaCard.querySelector('.nota-titulo').textContent  : 'Sin título',
                            descripcion: notaCard.querySelector('.nota-descripcion') ? notaCard.querySelector('.nota-descripcion').textContent : '',
                            formato:     (notaCard.querySelector('.nota-formato-badge') ? notaCard.querySelector('.nota-formato-badge').textContent : 'texto').trim(),
                            carpeta:     null,   // ya no tiene carpeta
                            etiquetas:   Array.from(notaCard.querySelectorAll('.nota-tag')).map(function(t) { return t.textContent.replace('#','').trim(); }),
                            edicion:     notaCard.querySelector('.nota-footer span') ? notaCard.querySelector('.nota-footer span').textContent.replace('','').trim() : ''
                        };

                        // 2) Actualizar contador de la carpeta en el panel
                        var panel = notaCard.closest('.panel-notas-carpeta');
                        if (panel) {
                            var carpetaCard = panel.previousElementSibling;
                            if (carpetaCard && carpetaCard.classList.contains('carpeta-card')) {
                                var meta = carpetaCard.querySelector('.carpeta-meta i.fa-file-alt');
                                if (meta) {
                                    var txt = meta.parentElement;
                                    var match = txt.textContent.match(/(\d+)/);
                                    if (match) {
                                        var n = Math.max(0, parseInt(match[1], 10) - 1);
                                        txt.innerHTML = '<i class="fas fa-file-alt"></i> ' + n + ' nota' + (n !== 1 ? 's' : '');
                                    }
                                }
                            }
                        }

                        // 3) Animar salida de la nota del panel / grid
                        notaCard.style.transition = 'opacity 0.3s, transform 0.3s';
                        notaCard.style.opacity    = '0';
                        notaCard.style.transform  = 'scale(0.9)';

                        setTimeout(function() {
                            // 4) Inyectar la nota de vuelta en el grid principal como nota suelta
                            var contNotas = document.getElementById('resultados-notas');
                            if (contNotas) {
                                // Antes de añadirla, nos aseguramos de que no exista ya fuera (evitar duplicados)
                                var existente = contNotas.querySelector('.nota-card[data-id="' + notaId + '"]:not(.panel-notas-carpeta .nota-card)');
                                if (!existente) {
                                    var tmp = document.createElement('div');
                                    tmp.innerHTML = _buildNotaCard(notaDataClone);
                                    var nuevaCard = tmp.firstElementChild;
                                    nuevaCard.dataset.carpeta = '';
                                    var badge = nuevaCard.querySelector('.nota-carpeta-badge');
                                    if (badge) badge.remove();

                                    contNotas.appendChild(nuevaCard);

                                    // Animación de entrada
                                    nuevaCard.style.opacity   = '0';
                                    nuevaCard.style.transform = 'scale(0.93) translateY(-8px)';
                                    nuevaCard.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                                    requestAnimationFrame(function() {
                                        requestAnimationFrame(function() {
                                            nuevaCard.style.opacity   = '1';
                                            nuevaCard.style.transform = 'scale(1) translateY(0)';
                                        });
                                    });
                                }
                            }
                            notaCard.remove();
                        }, 320);
                    }
                } else {
                    mostrarToast(data.error || 'Error al sacar la nota', 'error');
                }
            })
            .catch(function() { mostrarToast('Error de conexión', 'error'); });
        });
    })();

    function _mostrarZonaSacar(mostrar) {
        var zona = document.getElementById('zona-sacar-carpeta');
        if (zona) zona.classList.toggle('visible', mostrar);
    }

    function onDragStartNota(event, notaId) {
        _notaArrastrandoId = notaId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(notaId));
        setTimeout(function() {
            var card = document.querySelector('.nota-card[data-id="' + notaId + '"]');
            if (card) {
                card.classList.add('nota-arrastrando');
                _notaArrastrandoCarpeta = card.dataset.carpeta || '';
                // Mostrar zona de sacar solo si la nota está en una carpeta
                if (_notaArrastrandoCarpeta) {
                    _mostrarZonaSacar(true);
                }
            }
        }, 0);
    }

    function onDragEndNota(event) {
        document.querySelectorAll('.nota-card.nota-arrastrando').forEach(function(el) {
            el.classList.remove('nota-arrastrando');
        });
        document.querySelectorAll('.carpeta-card.drag-sobre').forEach(function(el) {
            el.classList.remove('drag-sobre');
        });
        _mostrarZonaSacar(false);
        var zona = document.getElementById('zona-sacar-carpeta');
        if (zona) zona.classList.remove('activa');
        _notaArrastrandoId      = null;
        _notaArrastrandoCarpeta = null;
    }

    function onDragOverCarpeta(event) {
        event.preventDefault();
        // Obtener el id de la carpeta sobre la que se está arrastrando
        var carpetaCard = event.currentTarget;
        var carpetaId   = carpetaCard.dataset.id;
        // Si la nota ya pertenece a esta carpeta, indicar que no se puede soltar
        if (_notaArrastrandoCarpeta && carpetaId && _notaArrastrandoCarpeta === carpetaCard.querySelector('.carpeta-nombre') && false) {
            event.dataTransfer.dropEffect = 'none';
            return;
        }
        event.dataTransfer.dropEffect = 'move';
        carpetaCard.classList.add('drag-sobre');
    }

    function onDragLeaveCarpeta(event) {
        var card = event.currentTarget;
        if (!card.contains(event.relatedTarget)) {
            card.classList.remove('drag-sobre');
        }
    }

    function onDropEnCarpeta(event, carpetaId) {
        event.preventDefault();
        var card = event.currentTarget;
        card.classList.remove('drag-sobre');

        var notaId = _notaArrastrandoId || parseInt(event.dataTransfer.getData('text/plain'), 10);
        if (!notaId) return;

        // Verificar si la nota ya está en esta carpeta
        var notaCard = document.querySelector('.nota-card[data-id="' + notaId + '"]');
        if (notaCard) {
            var carpetaCardEl = document.querySelector('.carpeta-card[data-id="' + carpetaId + '"]');
            var nombreCarpeta = carpetaCardEl ? (carpetaCardEl.querySelector('.carpeta-nombre') || {}).textContent : null;
            var carpetaActual = notaCard.dataset.carpeta || '';
            if (nombreCarpeta && carpetaActual && carpetaActual.trim() === nombreCarpeta.trim()) {
                mostrarToast('La nota ya está en esta carpeta', 'error');
                return;
            }
        }

        fetch('/api/notas/' + notaId + '/carpeta', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ carpeta_id: carpetaId })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                mostrarToast('Nota movida a la carpeta correctamente', 'exito');
                var metaNotas = card.querySelector('.carpeta-meta');
                if (metaNotas) {
                    var match = metaNotas.textContent.match(/(\d+)/);
                    if (match) {
                        var n = parseInt(match[1], 10) + 1;
                        metaNotas.innerHTML = '<i class="fas fa-file-alt"></i> ' + n + ' nota' + (n !== 1 ? 's' : '');
                    }
                }
                if (notaCard) {
                    notaCard.style.transition = 'opacity 0.3s, transform 0.3s';
                    notaCard.style.opacity    = '0';
                    notaCard.style.transform  = 'scale(0.9)';
                    setTimeout(function() { notaCard.remove(); }, 320);
                }
            } else {
                mostrarToast(data.error || 'Error al mover la nota', 'error');
            }
        })
        .catch(function() { mostrarToast('Error de conexión', 'error'); });
    }

    /* ===========================================================
       QUITAR NOTA DE CARPETA (Sacar de Carpeta)
       =========================================================== */
    async function quitarNotaDeCarpeta(notaId, carpetaNombre, event) {
        if (event) event.stopPropagation();
        try {
            var r = await fetch('/api/notas/' + notaId + '/carpeta', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ carpeta_id: null })
            });
            var data = await r.json();
            if (data.success) {
                mostrarToast('Nota sacada de la carpeta correctamente', 'exito');
                var card = document.querySelector('.nota-card[data-id="' + notaId + '"]');
                if (card) {
                    // Datos para recrearla afuera
                    var notaDataClone = {
                        id:          notaId,
                        titulo:      card.querySelector('.nota-titulo')  ? card.querySelector('.nota-titulo').textContent  : 'Sin título',
                        descripcion: card.querySelector('.nota-descripcion') ? card.querySelector('.nota-descripcion').textContent : '',
                        formato:     (card.querySelector('.nota-formato-badge') ? card.querySelector('.nota-formato-badge').textContent : 'texto').trim(),
                        carpeta:     null,
                        etiquetas:   Array.from(card.querySelectorAll('.nota-tag')).map(function(t) { return t.textContent.replace('#','').trim(); }),
                        edicion:     card.querySelector('.nota-footer span') ? card.querySelector('.nota-footer span').textContent.trim() : ''
                    };

                    var isInsidePanel = card.closest('.panel-notas-carpeta');
                    if (isInsidePanel) {
                        card.style.transition = 'opacity 0.3s, transform 0.3s';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.9)';
                        
                        // Descontar del total de la carpeta
                        var carpetaMeta = isInsidePanel.previousElementSibling;
                        if (carpetaMeta && carpetaMeta.classList.contains('carpeta-card')) {
                            var meta = carpetaMeta.querySelector('.carpeta-meta i.fa-file-alt');
                            if (meta) {
                                var txtWrapper = meta.parentElement;
                                var match = txtWrapper.textContent.match(/(\d+)/);
                                if (match) {
                                    var n = Math.max(0, parseInt(match[1], 10) - 1);
                                    txtWrapper.innerHTML = '<i class="fas fa-file-alt"></i> ' + n + ' nota' + (n !== 1 ? 's' : '');
                                }
                            }
                        }

                        setTimeout(function() { 
                            card.remove(); 
                            // Añadirla a la lista principal si existe
                            var contNotas = document.getElementById('resultados-notas');
                            if (contNotas) {
                                var tmp = document.createElement('div');
                                tmp.innerHTML = _buildNotaCard(notaDataClone);
                                var nuevaCard = tmp.firstElementChild;
                                nuevaCard.dataset.carpeta = '';
                                if (nuevaCard.querySelector('.nota-carpeta-badge')) nuevaCard.querySelector('.nota-carpeta-badge').remove();
                                contNotas.appendChild(nuevaCard);
                            }
                        }, 300);
                    } else {
                        var badge = card.querySelector('.nota-carpeta-badge');
                        if (badge) badge.remove();
                        card.dataset.carpeta = '';
                    }
                }
            } else {
                mostrarToast(data.error || 'Error al sacar la nota', 'error');
            }
        } catch (e) {
            mostrarToast('Error de conexión', 'error');
        }
    }
    window.quitarNotaDeCarpeta = quitarNotaDeCarpeta;

    /* ===========================================================
       MODAL CREAR / EDITAR CARPETA
       =========================================================== */
    (function inyectarModalCarpeta() {
        var overlay = document.createElement('div');
        overlay.id        = 'modalCarpeta';
        overlay.className = 'modal-overlay';
        overlay.innerHTML =
            '<div class="modal-box">' +
                '<div class="modal-icono" style="color:var(--color-principal)"><i class="fas fa-folder-plus"></i></div>' +
                '<h3 id="modalCarpetaTitulo">Crear carpeta</h3>' +
                '<input id="modalCarpetaNombre" class="modal-input-folder" type="text" placeholder="Nombre de la carpeta" maxlength="60">' +
                '<div class="modal-btns">' +
                    '<button class="btn-modal-cancelar" id="btnCancelarCarpeta">Cancelar</button>' +
                    '<button class="btn-modal-salir" id="btnConfirmarCarpeta" style="background:var(--color-principal,#5452d3);">Crear</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) cerrarModalCarpeta(); });
        document.getElementById('btnCancelarCarpeta').addEventListener('click', cerrarModalCarpeta);
        document.getElementById('btnConfirmarCarpeta').addEventListener('click', ejecutarAccionCarpeta);
        document.getElementById('modalCarpetaNombre').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') ejecutarAccionCarpeta();
        });
    })();

    var _carpetaAccion   = 'crear';
    var _carpetaEditarId = null;

    function abrirModalCrearCarpeta() {
        _carpetaAccion   = 'crear';
        _carpetaEditarId = null;
        document.getElementById('modalCarpetaTitulo').textContent = 'Crear carpeta';
        document.getElementById('btnConfirmarCarpeta').textContent = 'Crear';
        document.getElementById('modalCarpetaNombre').value = '';
        document.getElementById('modalCarpeta').classList.add('visible');
        setTimeout(function() { document.getElementById('modalCarpetaNombre').focus(); }, 80);
    }

    function abrirModalEditarCarpeta(id, nombreActual) {
        _carpetaAccion   = 'editar';
        _carpetaEditarId = id;
        document.getElementById('modalCarpetaTitulo').textContent = 'Editar carpeta';
        document.getElementById('btnConfirmarCarpeta').textContent = 'Guardar';
        document.getElementById('modalCarpetaNombre').value = nombreActual;
        document.getElementById('modalCarpeta').classList.add('visible');
        setTimeout(function() { document.getElementById('modalCarpetaNombre').focus(); }, 80);
    }

    function cerrarModalCarpeta() {
        document.getElementById('modalCarpeta').classList.remove('visible');
        _carpetaEditarId = null;
    }

    function ejecutarAccionCarpeta() {
        var nombre = document.getElementById('modalCarpetaNombre').value.trim();
        if (!nombre) { document.getElementById('modalCarpetaNombre').focus(); return; }

        var btn = document.getElementById('btnConfirmarCarpeta');
        if (btn) btn.disabled = true;

        if (_carpetaAccion === 'crear') {
            fetch('/api/carpetas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombre })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                cerrarModalCarpeta();
                if (data.success) {
                    mostrarToast('Carpeta "' + nombre + '" creada', 'exito');
                    cargarCarpetasEnSelect();
                    cargarNotasRecientes();
                } else {
                    mostrarToast(data.error || 'Error al crear la carpeta', 'error');
                }
            })
            .catch(function() { mostrarToast('Error de conexión', 'error'); })
            .finally(function() {
                if (btn) btn.disabled = false;
            });
        } else {
            fetch('/api/carpetas/' + _carpetaEditarId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombre })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                cerrarModalCarpeta();
                if (data.success) {
                    mostrarToast('Carpeta renombrada', 'exito');
                    buscarCarpetas();
                } else {
                    mostrarToast(data.error || 'Error al editar la carpeta', 'error');
                }
            })
            .catch(function() { mostrarToast('Error de conexión', 'error'); })
            .finally(function() {
                if (btn) btn.disabled = false;
            });
        }
    }

    /* ===========================================================
       MODAL ELIMINAR CARPETA
       =========================================================== */
    (function inyectarModalEliminarCarpeta() {
        var overlay = document.createElement('div');
        overlay.id        = 'modalEliminarCarpeta';
        overlay.className = 'modal-overlay';
        overlay.innerHTML =
            '<div class="modal-box">' +
                '<div class="modal-icono"><i class="fas fa-trash-alt"></i></div>' +
                '<h3>¿Eliminar carpeta?</h3>' +
                '<p id="modalEliminarCarpetaDesc">Las notas no se eliminarán, solo quedarán sin carpeta.</p>' +
                '<div class="modal-btns">' +
                    '<button class="btn-modal-cancelar" id="btnCancelarEliminarCarpeta">Cancelar</button>' +
                    '<button class="btn-modal-salir" id="btnConfirmarEliminarCarpeta">Eliminar</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) cerrarModalEliminarCarpeta(); });
        document.getElementById('btnCancelarEliminarCarpeta').addEventListener('click', cerrarModalEliminarCarpeta);
        document.getElementById('btnConfirmarEliminarCarpeta').addEventListener('click', ejecutarEliminarCarpeta);
    })();

    var _carpetaEliminarId = null;

    function abrirModalEliminarCarpeta(id, nombre) {
        _carpetaEliminarId = id;
        document.getElementById('modalEliminarCarpetaDesc').innerHTML =
            'La carpeta <strong>"' + nombre + '"</strong> se eliminará. Las notas <strong>no se borrarán</strong>, solo quedarán sin carpeta.';
        document.getElementById('modalEliminarCarpeta').classList.add('visible');
    }

    function cerrarModalEliminarCarpeta() {
        document.getElementById('modalEliminarCarpeta').classList.remove('visible');
        _carpetaEliminarId = null;
    }

    function ejecutarEliminarCarpeta() {
        if (!_carpetaEliminarId) return;
        var id = _carpetaEliminarId;
        cerrarModalEliminarCarpeta();
        fetch('/api/carpetas/' + id, { method: 'DELETE' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) {
                    mostrarToast('Carpeta eliminada', 'exito');
                    var card = document.querySelector('.carpeta-card[data-id="' + id + '"]');
                    if (card) {
                        var panel = document.getElementById('panel-notas-carpeta-' + id);
                        if (panel) panel.remove();
                        card.style.opacity = '0';
                        setTimeout(function() { card.remove(); }, 300);
                    }
                    cargarCarpetasEnSelect();
                    cargarNotasRecientes();
                } else {
                    mostrarToast(data.error || 'Error al eliminar', 'error');
                }
            })
            .catch(function() { mostrarToast('Error de conexión', 'error'); });
    }

    /* ===========================================================
       MODAL AGREGAR NOTAS A CARPETA
       =========================================================== */
    var _carpetaAgregarId     = null;
    var _carpetaAgregarNombre = '';
    var _notasDisponibles     = [];

    (function inyectarModalAgregarNotas() {
        var overlay = document.createElement('div');
        overlay.id        = 'modalAgregarNotas';
        overlay.className = 'modal-overlay modal-agregar-notas';
        overlay.innerHTML =
            '<div class="modal-box modal-box-grande">' +
                '<div class="modal-icono" style="color:var(--color-principal)"><i class="fas fa-folder-plus"></i></div>' +
                '<h3 id="tituloModalAgregarNotas">Agregar notas a carpeta</h3>' +
                '<p class="modal-subtitulo" id="subtituloModalAgregarNotas">Selecciona las notas que quieres mover a esta carpeta</p>' +
                '<div class="agregar-notas-buscador">' +
                    '<i class="fas fa-search"></i>' +
                    '<input type="text" id="inputBuscarNotasModal" placeholder="Buscar nota..." oninput="filtrarNotasModal(this.value)">' +
                '</div>' +
                '<div class="agregar-notas-lista" id="listaNotasModal"></div>' +
                '<div class="modal-btns">' +
                    '<button class="btn-modal-cancelar" id="btnCancelarAgregarNotas">Cancelar</button>' +
                    '<button class="btn-modal-salir" id="btnConfirmarAgregarNotas" style="background:var(--color-principal,#5452d3);">' +
                        '<i class="fas fa-check"></i> Agregar seleccionadas' +
                    '</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) cerrarModalAgregarNotas(); });
        document.getElementById('btnCancelarAgregarNotas').addEventListener('click', cerrarModalAgregarNotas);
        document.getElementById('btnConfirmarAgregarNotas').addEventListener('click', ejecutarAgregarNotas);
    })();

    function abrirModalAgregarNotas(carpetaId, carpetaNombre) {
        _carpetaAgregarId     = carpetaId;
        _carpetaAgregarNombre = carpetaNombre;
        document.getElementById('tituloModalAgregarNotas').textContent = 'Agregar notas a "' + carpetaNombre + '"';
        document.getElementById('inputBuscarNotasModal').value = '';
        document.getElementById('listaNotasModal').innerHTML =
            '<div class="agregar-notas-cargando"><i class="fas fa-spinner fa-spin"></i> Cargando notas...</div>';
        document.getElementById('modalAgregarNotas').classList.add('visible');

        fetch('/api/mis-notas')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) {
                    // Excluir notas que ya están guardadas en cualquier otra carpeta
                    _notasDisponibles = data.notas.filter(function(n) {
                        return !n.carpeta;
                    });
                    renderizarListaNotasModal(_notasDisponibles);
                } else {
                    _notasDisponibles = [];
                    renderizarListaNotasModal([]);
                }
            })
            .catch(function() { _notasDisponibles = []; renderizarListaNotasModal([]); });
    }

    function cerrarModalAgregarNotas() {
        var el = document.getElementById('modalAgregarNotas');
        if (el) el.classList.remove('visible');
        _carpetaAgregarId = null;
        _notasDisponibles = [];
    }

    function renderizarListaNotasModal(notas) {
        var lista = document.getElementById('listaNotasModal');
        if (!lista) return;
        if (notas.length === 0) {
            lista.innerHTML =
                '<div class="agregar-notas-vacio">' +
                    '<img src="/static/nota-vacia.svg" alt="Sin notas" class="agregar-notas-vacio-img">' +
                    '<p class="agregar-notas-vacio-titulo">No hay notas disponibles</p>' +
                    '<p class="agregar-notas-vacio-sub">Todas tus notas ya están en esta carpeta o aún no has creado ninguna.</p>' +
                '</div>';
            return;
        }
        lista.innerHTML = notas.map(function(nota) {
            var fmt = ICONOS_FORMATO[(nota.formato || '').toLowerCase()] || ICONOS_FORMATO.default;
            return (
                '<label class="nota-modal-item" data-id="' + nota.id + '">' +
                    '<input type="checkbox" class="nota-modal-check" value="' + nota.id + '">' +
                    '<div class="nota-modal-icono">' +
                        '<i class="' + fmt.clase + '" style="color:' + fmt.color + '"></i>' +
                    '</div>' +
                    '<div class="nota-modal-info">' +
                        '<span class="nota-modal-titulo">' + (nota.titulo || 'Sin título') + '</span>' +
                        '<span class="nota-modal-meta">' +
                            '<span class="nota-modal-formato">' + (nota.formato || '') + '</span>' +
                            (nota.carpeta ? ' · <i class="fas fa-folder" style="font-size:.75rem"></i> ' + nota.carpeta : '') +
                        '</span>' +
                    '</div>' +
                '</label>'
            );
        }).join('');
        lista.querySelectorAll('.nota-modal-check').forEach(function(chk) {
            chk.addEventListener('change', function() {
                chk.closest('.nota-modal-item').classList.toggle('seleccionada', chk.checked);
            });
        });
    }

    function filtrarNotasModal(query) {
        var q = query.trim().toLowerCase();
        var filtradas = q
            ? _notasDisponibles.filter(function(n) {
                return (n.titulo || '').toLowerCase().includes(q) ||
                       (n.formato || '').toLowerCase().includes(q);
              })
            : _notasDisponibles;
        renderizarListaNotasModal(filtradas);
    }

    function ejecutarAgregarNotas() {
        if (!_carpetaAgregarId) return;
        var checks = document.querySelectorAll('#listaNotasModal .nota-modal-check:checked');
        if (checks.length === 0) { mostrarToast('Selecciona al menos una nota', 'error'); return; }

        var promesas = Array.from(checks).map(function(chk) {
            return fetch('/api/notas/' + chk.value + '/carpeta', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ carpeta_id: _carpetaAgregarId })
            }).then(function(r) { return r.json(); });
        });

        Promise.all(promesas)
            .then(function(results) {
                var ok = results.filter(function(r) { return r.success; }).length;
                cerrarModalAgregarNotas();
                mostrarToast(ok + ' nota' + (ok !== 1 ? 's' : '') + ' agregada' + (ok !== 1 ? 's' : '') + ' a "' + _carpetaAgregarNombre + '"', 'exito');
                cargarNotasRecientes();
            })
            .catch(function() { mostrarToast('Error de conexión', 'error'); });
    }

    /* ===========================================================
       TOAST
       =========================================================== */
    function mostrarToast(mensaje, tipo) {
        var toast = document.createElement('div');
        toast.className = 'nf-toast nf-toast-' + (tipo || 'exito');
        toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'times-circle' : 'check-circle') + '"></i> ' + mensaje;
        document.body.appendChild(toast);
        setTimeout(function() { toast.classList.add('visible'); }, 10);
        setTimeout(function() {
            toast.classList.remove('visible');
            setTimeout(function() { toast.remove(); }, 400);
        }, 3000);
    }

    /* ===========================================================
       CARGAR CARPETAS EN SELECT DEL FILTRO
       =========================================================== */
    function cargarCarpetasEnSelect(carpetaParaSeleccionar) {
        return fetch('/api/mis-carpetas')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) return;
                var sel = document.getElementById('nota-carpeta');
                if (!sel) return;
                var valorActual = carpetaParaSeleccionar || sel.value;
                while (sel.options.length > 1) sel.remove(1);
                data.carpetas.forEach(function(c) {
                    var opt = document.createElement('option');
                    opt.value = c.nombre;
                    opt.textContent = c.nombre;
                    sel.appendChild(opt);
                });
                sel.value = valorActual;
            })
            .catch(function() {});
    }

    /* ===========================================================
       CARGA INICIAL — Carpetas (3) + Notas sueltas (3)
       =========================================================== */
    function cargarNotasRecientes() {
        fetch('/api/mis-notas-y-carpetas')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) {
                    document.getElementById('estado-vacio').style.display = 'flex';
                    return;
                }
                var carpetas     = data.carpetas || [];
                // Solo notas SIN carpeta en la vista previa
                var notasSueltas = (data.notas || []).filter(function(n) { return !n.carpeta; });

                if (carpetas.length === 0 && notasSueltas.length === 0) {
                    document.getElementById('estado-vacio').style.display = 'flex';
                    return;
                }

                // Combinar carpetas y notas sueltas en una sola lista para el "Recientes"
                // Usamos 'edicion' (fecha de última modificación) para ordenar
                var todos = [];
                carpetas.forEach(function(c) {
                    todos.push({ tipo: 'carpeta', data: c, fecha_raw: c.edicion || c.creacion });
                });
                notasSueltas.forEach(function(n) {
                    todos.push({ tipo: 'nota', data: n, fecha_raw: n.edicion || n.creacion });
                });

                // Ordenar: MÁS RECIENTE PRIMERO (descendente por fecha de edición)
                todos.sort(function(a, b) {
                    var dateA = a.fecha_raw ? new Date(a.fecha_raw) : new Date(0);
                    var dateB = b.fecha_raw ? new Date(b.fecha_raw) : new Date(0);
                    return dateB - dateA; // descendente: el más nuevo primero
                });

                // Tomamos los 3 más recientes
                var items = todos.slice(0, 3);

                renderizarRecientes(items);
            })
            .catch(function() {
                document.getElementById('estado-vacio').style.display = 'flex';
            });
    }

    function renderizarRecientes(items) {
        var area       = document.getElementById('area-resultados');
        var contenedor = document.getElementById('resultados-notas');
        var contCarpetas = document.getElementById('resultados-carpetas');
        var sinRes     = document.getElementById('sin-resultados');

        area.classList.add('visible');
        contCarpetas.innerHTML = '';
        sinRes.style.display   = 'none';
        document.getElementById('icono-res').className   = 'fas fa-layer-group';
        document.getElementById('label-res').textContent = 'Recientes';
        document.getElementById('badge-res').textContent = items.length;

        contenedor.innerHTML = '';

        items.forEach(function(item) {
            var tmp = document.createElement('div');
            if (item.tipo === 'carpeta') {
                tmp.innerHTML = _buildCarpetaCard(item.data, true);
            } else {
                tmp.innerHTML = _buildNotaCard(item.data);
            }
            contenedor.appendChild(tmp.firstElementChild);
        });

        // Botón ver todas
        var verTodasDiv = document.createElement('div');
        verTodasDiv.className = 'ver-todas-card';
        verTodasDiv.onclick   = cargarTodoOrdenado;
        verTodasDiv.innerHTML = '<i class="fas fa-search"></i><span>Ver todas mis notas y carpetas</span>';
        contenedor.appendChild(verTodasDiv);

        area.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ===========================================================
       CARGAR TODO ORDENADO — carpetas primero, notas sueltas después
       =========================================================== */
    function cargarTodoOrdenado() {
        cerrarModal();
        fetch('/api/mis-notas-y-carpetas')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) return;
                var carpetas     = data.carpetas || [];
                // FILTRO: Solo notas SIN carpeta. Las demÃ¡s estÃ¡n dentro de sus carpetas.
                var notasSueltas = (data.notas || []).filter(function(n) { return !n.carpeta; });

                var area             = document.getElementById('area-resultados');
                var contCarpetas     = document.getElementById('resultados-carpetas');
                var contNotas        = document.getElementById('resultados-notas');
                var sinRes           = document.getElementById('sin-resultados');

                area.classList.add('visible');
                sinRes.style.display = 'none';
                document.getElementById('icono-res').className   = 'fas fa-layer-group';
                document.getElementById('label-res').textContent = 'Todas mis notas y carpetas';
                document.getElementById('badge-res').textContent = carpetas.length + notasSueltas.length;

                // Ocultar botón volver
                var btnVolver = document.getElementById('btn-volver-atras');
                if (btnVolver) btnVolver.style.display = 'none';


                // Limpiar contenedores
                contCarpetas.innerHTML = '';
                contNotas.innerHTML    = '';

                // Renderizar todo en el contenedor de notas (el grid principal) para unificar tamaños
                var htmlCarpetas = carpetas.map(function(c) {
                    return _buildCarpetaCard(c, false);
                }).join('');

                var htmlNotas = notasSueltas.map(function(n) {
                    return _buildNotaCard(n);
                }).join('');

                contNotas.innerHTML = htmlCarpetas + htmlNotas;

                area.scrollIntoView({ behavior: 'smooth', block: 'start' });
            })
            .catch(function() {});
    }

    window.cargarTodoOrdenado = cargarTodoOrdenado;

    /* ===========================================================
       MODAL ELIMINAR NOTA
       =========================================================== */
    var _notaAEliminarId = null;

    (function inyectarModalEliminarNota() {
        if (document.getElementById('modalEliminarNota')) return;
        var overlay = document.createElement('div');
        overlay.id        = 'modalEliminarNota';
        overlay.className = 'modal-overlay';
        overlay.innerHTML =
            '<div class="modal-box">' +
                '<div class="modal-icono"><i class="fas fa-trash-alt"></i></div>' +
                '<h3>¿Eliminar nota?</h3>' +
                '<p>La nota se moverá a la <strong>papelera</strong>. Podrás restaurarla desde ahí.</p>' +
                '<div class="modal-btns">' +
                    '<button class="btn-modal-cancelar" id="btnCancelarEliminarNota">Cancelar</button>' +
                    '<button class="btn-modal-salir" id="btnConfirmarEliminarNota">Mover a papelera</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) cerrarModalEliminarNota(); });
        document.getElementById('btnCancelarEliminarNota').addEventListener('click', cerrarModalEliminarNota);
        document.getElementById('btnConfirmarEliminarNota').addEventListener('click', ejecutarEliminarNota);
    })();

    function abrirModalEliminarNota(id, titulo, e) {
        e.stopPropagation();
        _notaAEliminarId = id;
        document.getElementById('modalEliminarNota').querySelector('p').innerHTML =
            'La nota <strong>"' + titulo + '"</strong> se moverá a la papelera. Podrás restaurarla desde ahí.';
        document.getElementById('modalEliminarNota').classList.add('visible');
    }

    function cerrarModalEliminarNota() {
        document.getElementById('modalEliminarNota').classList.remove('visible');
        _notaAEliminarId = null;
    }

    async function ejecutarEliminarNota() {
        if (!_notaAEliminarId) return;
        var id = _notaAEliminarId;
        cerrarModalEliminarNota();
        try {
            var resp = await fetch('/papelera/mover/' + id, { method: 'POST' });
            var data = await resp.json();
            if (data.success) {
                var card = document.querySelector('.nota-card[data-id="' + id + '"]');
                if (card) {
                    card.style.transition = 'opacity 0.3s, transform 0.3s';
                    card.style.opacity    = '0';
                    card.style.transform  = 'scale(0.9)';
                    setTimeout(function() {
                        card.remove();
                        var badge = document.getElementById('badge-res');
                        if (badge) badge.textContent = document.querySelectorAll('.nota-card').length;
                    }, 320);
                }
            } else {
                alert(data.error || 'Error al mover la nota a la papelera');
            }
        } catch (e) {
            alert('Error de conexión');
        }
    }

    /* ===========================================================
       TEMA
       =========================================================== */
    function _aplicarTema(esOscuro) {
        document.body.classList.toggle('tema-oscuro', esOscuro);
        document.body.classList.toggle('tema-claro',  !esOscuro);
    }

    function _setTemaCookie(valor) {
        document.cookie = 'tema=' + valor + ';path=/;max-age=31536000';
    }

    document.addEventListener('DOMContentLoaded', function() {
        _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');
        _setTemaCookie(window.COLOR_PRINCIPAL);

        var params = new URLSearchParams(window.location.search);
        var carpetaUrl = params.get('carpeta');
        var previewId = params.get('preview');

        var promise = cargarCarpetasEnSelect(carpetaUrl);
        function despuesDeCargar() {
            if (carpetaUrl) {
                buscarNotas();
            } else {
                cargarNotasRecientes();
            }
            if (previewId) {
                setTimeout(function() { abrirPreviewNota(parseInt(previewId)); }, 500);
            }
        }
        if (promise && typeof promise.then === 'function') {
            promise.then(despuesDeCargar).catch(despuesDeCargar);
        } else {
            if (carpetaUrl) {
                var sel = document.getElementById('nota-carpeta');
                if (sel) sel.value = carpetaUrl;
            }
            despuesDeCargar();
        }
    });

    window.addEventListener('pageshow', function() {
        var cookie = document.cookie.split(';')
            .find(function(c) { return c.trim().startsWith('tema='); });
        if (cookie) {
            _aplicarTema(cookie.split('=')[1].trim() === 'Negro');
        } else if (window.COLOR_PRINCIPAL) {
            _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');
        }
    });

    function abrirFormato() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('visible');
            document.getElementById('hamburger-btn').classList.remove('hidden');
        }
        document.getElementById('formato-modal').classList.add('visible');
        document.getElementById('formato-backdrop').classList.add('visible');
    }
    function cerrarFormato() {
        document.getElementById('formato-modal').classList.remove('visible');
        document.getElementById('formato-backdrop').classList.remove('visible');
    }
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') cerrarFormato();
    });

    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const hambBtn = document.getElementById('hamburger-btn');
        const isOpen  = sidebar.classList.toggle('open');
        overlay.classList.toggle('visible', isOpen);
        hambBtn.classList.toggle('hidden', isOpen);
    }

    // ========== EXPOSICIÃ“N GLOBAL (SOLUCIÃ“N "NO SIRVE") ==========
    window.toggleSidebar              = toggleSidebar;
    window.abrirFormato                = abrirFormato;
    window.cerrarFormato               = cerrarFormato;
    window.verNotasDeCarpeta          = verNotasDeCarpeta;
    window.cargarTodoOrdenado         = cargarTodoOrdenado;
    window.abrirModalCrearCarpeta     = abrirModalCrearCarpeta;
    window.abrirModalEditarCarpeta    = abrirModalEditarCarpeta;
    window.abrirModalEliminarCarpeta  = abrirModalEliminarCarpeta;
    window.abrirModalAgregarNotas     = abrirModalAgregarNotas;
    window.abrirModalEliminarNota     = abrirModalEliminarNota;
    window.quitarNotaDeCarpeta        = quitarNotaDeCarpeta;
    window.buscarNotas                 = buscarNotas;
    window.buscarCarpetas              = buscarCarpetas;
    window.limpiarNotas                = limpiarNotas;
    window.limpiarCarpetas             = limpiarCarpetas;
    window.elegirTipo                 = elegirTipo;
    window.volver                     = volver;
