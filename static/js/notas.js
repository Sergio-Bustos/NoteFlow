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
        var colorCarpeta = _colorDeCarpeta(nota.carpeta);
        var franjaStyle  = colorCarpeta ? 'border-left:4px solid ' + colorCarpeta + ';' : '';
        var carpetaHtml  = nota.carpeta
            ? '<span class="nota-carpeta-badge" style="background:' + colorCarpeta + '22;color:' + colorCarpeta + ';">' +
                  '<i class="fas fa-folder" style="color:' + colorCarpeta + ';"></i> ' + nota.carpeta +
              '</span>'
            : '';

        return (
            '<div class="nota-card" data-id="' + nota.id + '" draggable="true" ' +
                    'ondragstart="onDragStartNota(event,' + nota.id + ')" ' +
                    'ondragend="onDragEndNota(event)" ' +
                    'onclick="window.location.href=\'/editar-nota/' + nota.id + '\'" ' +
                    'style="' + franjaStyle + '">' +
                '<button class="btn-eliminar-nota" ' +
                    'onclick="abrirModalEliminarNota(' + nota.id + ', \'' + (nota.titulo || 'Sin título').replace(/'/g, "\\'") + '\', event)" ' +
                    'title="Mover a papelera">' +
                    '<i class="fas fa-trash-alt"></i>' +
                '</button>' +
                '<div class="nota-drag-handle" title="Arrastra a una carpeta"><i class="fas fa-grip-vertical"></i></div>' +
                '<div class="nota-card-header">' +
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
                if (data.success) renderizarNotas(data.notas, false);
                else mostrarSinResultados('notas');
            })
            .catch(function() { mostrarSinResultados('notas'); });
    }

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
    function _buildCarpetaCard(c) {
        return (
            '<div class="carpeta-card" data-id="' + c.id + '" ' +
                'ondragover="onDragOverCarpeta(event)" ' +
                'ondragleave="onDragLeaveCarpeta(event)" ' +
                'ondrop="onDropEnCarpeta(event,' + c.id + ')">' +
                '<div class="carpeta-drop-hint"><i class="fas fa-folder-open"></i> Suelta aquí</div>' +
                '<div class="carpeta-card-icon"><i class="fas fa-folder-open"></i></div>' +
                '<div class="carpeta-card-info">' +
                    '<h4 class="carpeta-nombre">' + c.nombre + '</h4>' +
                    '<span class="carpeta-meta"><i class="fas fa-file-alt"></i> ' + c.total_notas + ' nota' + (c.total_notas !== 1 ? 's' : '') + '</span>' +
                    '<span class="carpeta-meta"><i class="fas fa-clock"></i> ' + c.edicion + '</span>' +
                '</div>' +
                '<div class="carpeta-card-acciones">' +
                    '<button class="btn-carpeta-accion ver" onclick="verNotasDeCarpeta(' + c.id + ',\'' + c.nombre.replace(/'/g, "\\'") + '\',event)" title="Ver notas"><i class="fas fa-eye"></i></button>' +
                    '<button class="btn-carpeta-accion agregar" onclick="abrirModalAgregarNotas(' + c.id + ',\'' + c.nombre.replace(/'/g, "\\'") + '\')" title="Agregar notas"><i class="fas fa-plus"></i></button>' +
                    '<button class="btn-carpeta-accion editar" onclick="abrirModalEditarCarpeta(' + c.id + ',\'' + c.nombre.replace(/'/g, "\\'") + '\')" title="Editar"><i class="fas fa-pen"></i></button>' +
                    '<button class="btn-carpeta-accion eliminar" onclick="abrirModalEliminarCarpeta(' + c.id + ',\'' + c.nombre.replace(/'/g, "\\'") + '\')" title="Eliminar"><i class="fas fa-trash-alt"></i></button>' +
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
            return _buildCarpetaCard(c);
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
    var _notaArrastrandoId = null;

    function onDragStartNota(event, notaId) {
        _notaArrastrandoId = notaId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(notaId));
        setTimeout(function() {
            var card = document.querySelector('.nota-card[data-id="' + notaId + '"]');
            if (card) card.classList.add('nota-arrastrando');
        }, 0);
    }

    function onDragEndNota(event) {
        document.querySelectorAll('.nota-card.nota-arrastrando').forEach(function(el) {
            el.classList.remove('nota-arrastrando');
        });
        document.querySelectorAll('.carpeta-card.drag-sobre').forEach(function(el) {
            el.classList.remove('drag-sobre');
        });
        _notaArrastrandoId = null;
    }

    function onDragOverCarpeta(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-sobre');
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
                var notaCard = document.querySelector('.nota-card[data-id="' + notaId + '"]');
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
                '<input id="modalCarpetaNombre" type="text" placeholder="Nombre de la carpeta" maxlength="60" ' +
                    'style="width:100%;padding:10px 14px;border-radius:8px;border:1.5px solid var(--border,#ddd);font-size:.95rem;margin-bottom:18px;background:var(--bg-input,#f9f9f9);color:var(--texto-principal,#222);outline:none;">' +
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
            .catch(function() { mostrarToast('Error de conexión', 'error'); });
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
            .catch(function() { mostrarToast('Error de conexión', 'error'); });
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
                    _notasDisponibles = data.notas.filter(function(n) {
                        return !n.carpeta || n.carpeta !== carpetaNombre;
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
    function cargarCarpetasEnSelect() {
        fetch('/api/mis-carpetas')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) return;
                var sel = document.getElementById('nota-carpeta');
                var valorActual = sel.value;
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
                // Solo notas SIN carpeta en la vista previa — las que tienen carpeta viven dentro de su carpeta
                var notasSueltas = (data.notas || []).filter(function(n) { return !n.carpeta; });

                if (carpetas.length === 0 && notasSueltas.length === 0) {
                    document.getElementById('estado-vacio').style.display = 'flex';
                    return;
                }

                // Carpetas primero (max 3), notas sueltas (max 3)
                var items = [];
                carpetas.slice(0, 3).forEach(function(c) { items.push({ tipo: 'carpeta', data: c }); });
                notasSueltas.slice(0, 3).forEach(function(n) { items.push({ tipo: 'nota', data: n }); });

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
            if (item.tipo === 'carpeta') {
                var c   = item.data;
                var div = document.createElement('div');
                div.className = 'nota-card carpeta-card-reciente';
                div.innerHTML =
                    '<div class="card-header"><span class="folder-indicator"><i class="fas fa-folder" style="color:#f39c12;"></i></span></div>' +
                    '<h4>' + c.nombre + '</h4>' +
                    '<p class="description">' + c.total_notas + ' nota' + (c.total_notas !== 1 ? 's' : '') + '</p>' +
                    '<div class="card-footer">' +
                        '<small><i class="fas fa-clock"></i> ' + c.edicion + '</small>' +
                        '<a href="/notas" class="view-btn" onclick="cargarTodoOrdenado();return false;">Ver todas</a>' +
                    '</div>';
                contenedor.appendChild(div);
            } else {
                var tmp = document.createElement('div');
                tmp.innerHTML = _buildNotaCard(item.data);
                contenedor.appendChild(tmp.firstElementChild);
            }
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
                var notasSueltas = (data.notas || []).filter(function(n) { return !n.carpeta; });

                var area             = document.getElementById('area-resultados');
                var contCarpetas     = document.getElementById('resultados-carpetas');
                var contNotas        = document.getElementById('resultados-notas');
                var sinRes           = document.getElementById('sin-resultados');

                area.classList.add('visible');
                sinRes.style.display = 'none';
                document.getElementById('icono-res').className   = 'fas fa-folder';
                document.getElementById('label-res').textContent = 'Todo (carpetas y notas)';
                document.getElementById('badge-res').textContent = carpetas.length + notasSueltas.length;

                // Renderizar carpetas
                contCarpetas.innerHTML = carpetas.map(function(c) {
                    return _buildCarpetaCard(c);
                }).join('');

                // Renderizar notas sueltas
                contNotas.innerHTML = notasSueltas.map(function(n) {
                    return _buildNotaCard(n);
                }).join('');

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

    document.addEventListener('DOMContentLoaded', function() {
        _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');
        cargarNotasRecientes();
        cargarCarpetasEnSelect();
    });

    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            var cookie = document.cookie.split(';')
                .find(function(c) { return c.trim().startsWith('tema='); });
            if (cookie) {
                _aplicarTema(cookie.split('=')[1].trim() === 'Negro');
            } else {
                _aplicarTema(window.COLOR_PRINCIPAL === 'Negro');
            }
        }
    });

    function abrirFormato() {
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