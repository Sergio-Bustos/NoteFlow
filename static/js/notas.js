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
        if (e.key === 'Escape') cerrarModal();
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
       FIX 3 — ETIQUETAS: buscador + etiquetas personalizadas
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

        // Mostrar hint para agregar etiqueta personalizada si no existe ya
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

        // Crear chip
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

        // Limpiar buscador y ocultar hint
        input.value = '';
        document.getElementById('hint-nueva-etiqueta').style.display = 'none';
        filtrarEtiquetas('');
        actualizarChipsActivos();
    }

    // Permitir Enter para agregar etiqueta personalizada
    document.getElementById('etiqueta-buscar').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var hint = document.getElementById('hint-nueva-etiqueta');
            if (hint.style.display === 'flex') {
                agregarEtiquetaPersonalizada();
            }
        }
    });

    /* ===========================================================
       ETIQUETAS PREDEFINIDAS
       =========================================================== */
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
       MOSTRAR RESULTADOS
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
   RENDERIZAR TARJETAS DE NOTAS
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

    if (esVistaPrev) {
        label.textContent = 'Notas recientes';
        badge.textContent = notas.length;
    } else {
        label.textContent = 'Notas encontradas';
        badge.textContent = notas.length;
    }

    if (notas.length === 0) {
        contenedor.innerHTML = '';
        sinRes.style.display = 'flex';
        area.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    sinRes.style.display = 'none';
    contenedor.innerHTML = notas.map(function(nota) {
        var fmt    = ICONOS_FORMATO[nota.formato] || ICONOS_FORMATO.default;
        var tags   = nota.etiquetas.length
            ? nota.etiquetas.map(function(t) {
                return '<span class="nota-tag">#' + t + '</span>';
              }).join('')
            : '';
        var carpeta = nota.carpeta
            ? '<span class="nota-carpeta"><i class="fas fa-folder"></i> ' + nota.carpeta + '</span>'
            : '';

        return (
            '<div class="nota-card" onclick="window.location.href=\'/editar-nota/' + nota.id + '\'">' +
                '<div class="nota-card-header">' +
                    '<i class="' + fmt.clase + '" style="color:' + fmt.color + ';font-size:1.2rem;"></i>' +
                    '<span class="nota-formato-badge">' + nota.formato + '</span>' +
                    carpeta +
                '</div>' +
                '<h4 class="nota-titulo">' + (nota.titulo || 'Sin título') + '</h4>' +
                '<p class="nota-descripcion">' + (nota.descripcion || '') + '</p>' +
                '<div class="nota-tags">' + tags + '</div>' +
                '<div class="nota-footer">' +
                    '<span><i class="fas fa-clock"></i> ' + nota.edicion + '</span>' +
                '</div>' +
            '</div>'
        );
    }).join('');

    // Si es vista previa, agrega el botón "Ver todas"
    if (esVistaPrev) {
        contenedor.innerHTML += (
            '<div class="ver-todas-card" onclick="buscarNotas()">' +
                '<i class="fas fa-search"></i>' +
                '<span>Ver todas mis notas</span>' +
            '</div>'
        );
    }

    area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===========================================================
   BUSCAR NOTAS (real — reemplaza el stub anterior)
   =========================================================== */
function buscarNotas() {
    cerrarModal();
    fetch('/api/mis-notas')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                renderizarNotas(data.notas);
            } else {
                mostrarSinResultados('notas');
            }
        })
        .catch(function() {
            mostrarSinResultados('notas');
        });
}

/* ===========================================================
   CARGA AUTOMÁTICA — 3 NOTAS MÁS RECIENTES
   =========================================================== */
function cargarNotasRecientes() {
    fetch('/api/mis-notas')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.notas.length > 0) {
                // Solo las 3 más recientes
                renderizarNotas(data.notas.slice(0, 3), true);
            }
        })
        .catch(function() {
            // Si falla silenciosamente, no pasa nada
        });
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
    });

    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            var cookie = document.cookie.split(';')
                .find(function(c) { return c.trim().startsWith('tema='); });
            if (cookie) {
                var val = cookie.split('=')[1].trim();
                _aplicarTema(val === 'Negro');
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