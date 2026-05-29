// static/js/tracking.js

(function() {
    let activeTimeSeconds = 0;
    const PING_INTERVAL_MS = 30000; // 30 segundos
    let lastActivityTime = Date.now();
    const INACTIVE_THRESHOLD_MS = 60000; // 1 minuto sin hacer nada -> inactivo

    // Detectar interacción
    function markActive() {
        lastActivityTime = Date.now();
    }

    ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, markActive, { passive: true });
    });

    // Bucle para acumular y enviar
    setInterval(() => {
        const now = Date.now();
        // Si han pasado menos de 60s desde la última actividad, consideramos los últimos 30s como activos
        if (now - lastActivityTime < INACTIVE_THRESHOLD_MS) {
            activeTimeSeconds += (PING_INTERVAL_MS / 1000);
        }

        if (activeTimeSeconds > 0) {
            enviarPingActividad(activeTimeSeconds);
            activeTimeSeconds = 0; // Resetear después de intentar enviar
        }
    }, PING_INTERVAL_MS);

    function enviarPingActividad(seconds) {
        // Buscar el ID_Nota en la URL si estamos en un editor, ej: /editortexto/5
        let notaId = null;
        const match = window.location.pathname.match(/\/(editortexto|editoraudio|editorvideo|editorimagen|editordibujo|editormixta)\/(\d+)/);
        if (match && match[2]) {
            notaId = match[2];
        } else {
            // Opcional: Buscar un input oculto si es nuevo
            const editNotaIdInput = document.getElementById('editNotaId');
            if (editNotaIdInput && editNotaIdInput.value) {
                notaId = editNotaIdInput.value;
            }
        }

        const data = new FormData();
        data.append('tiempo_segundos', seconds);
        if (notaId) {
            data.append('nota_id', notaId);
        }

        // Obtener el CSRF Token si existe (las vistas lo tienen en meta)
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        const headers = {};
        if (csrfMeta) {
            headers['X-CSRFToken'] = csrfMeta.content;
        }

        fetch('/ping-actividad', {
            method: 'POST',
            body: data,
            headers: headers
        }).catch(err => console.error("Error en ping de actividad:", err));
    }
})();
