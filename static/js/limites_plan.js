// ══════════════════════════════════════════════════════════════════
//  limites_plan.js — Límites por suscripción para todos los editores
//  Incluir ANTES de audio.js, video.js, etc.
// ══════════════════════════════════════════════════════════════════

(function() {
    const plan = (window.USER_PLAN || 'gratis').toLowerCase();

    // ── Texto (caracteres) ────────────────────────────────────────
    const TEXTO = {
        'gratis':    5_000,
        'quincenal': 15_000,
        'mensual':   50_000,
        'anual':     250_000
    };

    // ── Audio (bytes) ─────────────────────────────────────────────
    const AUDIO = {
        'gratis':    20  * 1024 * 1024,   //  20 MB
        'quincenal': 80  * 1024 * 1024,   //  80 MB
        'mensual':   200 * 1024 * 1024,   // 200 MB
        'anual':     500 * 1024 * 1024    // 500 MB
    };

    // ── Video (bytes) ─────────────────────────────────────────────
    const VIDEO = {
        'gratis':    100 * 1024 * 1024,             //  100 MB
        'quincenal': 500 * 1024 * 1024,             //  500 MB
        'mensual':   1   * 1024 * 1024 * 1024,      //    1 GB
        'anual':     2   * 1024 * 1024 * 1024       //    2 GB
    };

    // ── Imagen (bytes) ────────────────────────────────────────────
    const IMAGEN = {
        'gratis':    5  * 1024 * 1024,    //   5 MB
        'quincenal': 20 * 1024 * 1024,    //  20 MB
        'mensual':   50 * 1024 * 1024,    //  50 MB
        'anual':     200 * 1024 * 1024    // 200 MB
    };

    // ── Duración máxima de grabación (segundos) ───────────────────
    const DURACION_GRAB = {
        'gratis':    5  * 60,   //   5 min
        'quincenal': 15 * 60,   //  15 min
        'mensual':   60 * 60,   //   1 hora
        'anual':     3  * 3600  //   3 horas
    };

    // ── Adjuntos máximos por nota mixta ──────────────────────────
    const MAX_ADJUNTOS_MIXTA = {
        'gratis':    3,
        'quincenal': 6,
        'mensual':   15,
        'anual':     50,
    };

    // Exponer globalmente
    window.PLAN_LIMITES = {
        plan,
        texto:            TEXTO[plan]             ?? TEXTO['gratis'],
        audio:            AUDIO[plan]             ?? AUDIO['gratis'],
        video:            VIDEO[plan]             ?? VIDEO['gratis'],
        imagen:           IMAGEN[plan]            ?? IMAGEN['gratis'],
        grabacion:        DURACION_GRAB[plan]     ?? DURACION_GRAB['gratis'],
        maxAdjuntosMixta: MAX_ADJUNTOS_MIXTA[plan] ?? MAX_ADJUNTOS_MIXTA['gratis'],
    };

    // Helper: nombre legible del plan
    const NOMBRES = {
        'gratis':    'Gratis',
        'quincenal': 'Quincenal',
        'mensual':   'Mensual',
        'anual':     'Anual'
    };
    window.PLAN_LIMITES.nombre = NOMBRES[plan] ?? 'Gratis';

    // Helper: formatea bytes en KB/MB/GB
    window.PLAN_LIMITES.formatBytes = function(bytes) {
        if (bytes < 1024)            return bytes + ' B';
        if (bytes < 1024 ** 2)       return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 ** 3)       return (bytes / 1024 ** 2).toFixed(1) + ' MB';
        return (bytes / 1024 ** 3).toFixed(2) + ' GB';
    };

    // Helper: formatea segundos en m:ss
    window.PLAN_LIMITES.formatSeg = function(seg) {
        const m = Math.floor(seg / 60);
        const s = Math.floor(seg % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    };
})();
