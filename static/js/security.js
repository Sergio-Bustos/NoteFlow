/**
 * security.js - NoteFlow Security Enhancements
 *
 * Intercepta globalmente todas las peticiones fetch() para añadir
 * el token CSRF automáticamente en métodos que mutan datos.
 */
(function() {
    const originalFetch = window.fetch;

    window.fetch = function(resource, config) {
        // Si no hay config, inicializar como objeto vacío
        config = config || {};

        const method = (config.method || 'GET').toUpperCase();

        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            // Obtener el token CSRF de la metaetiqueta
            const csrfToken = document.querySelector('meta[name="csrf-token"]')
                                      ?.getAttribute('content');

            if (csrfToken) {
                // Clonar para no mutar el objeto original
                config = Object.assign({}, config);
                config.headers = Object.assign({}, config.headers || {});

                if (!config.headers['X-CSRFToken'] && !config.headers['X-CSRF-Token']) {
                    config.headers['X-CSRFToken'] = csrfToken;
                }
            }
        }

        return originalFetch(resource, config);
    };

    console.log('🛡️ NoteFlow Security: CSRF protection initialized.');
})();
