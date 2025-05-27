// js/core/logger.js
var AppLogger = (function() {
    const DETAILED_LOGGING_ENABLED = true; // Sett til false for produksjon

    function _log(level, messages) {
        if (!DETAILED_LOGGING_ENABLED) return;
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        switch (level.toLowerCase()) {
            case 'error': console.error(prefix, ...messages); break;
            case 'warn':  console.warn(prefix, ...messages);  break;
            case 'info':  console.info(prefix, ...messages);  break;
            default:      console.log(prefix, ...messages);   break;
        }
    }
    return {
        debug: function(...m) { _log('debug', m); },
        info:  function(...m) { _log('info',  m); },
        warn:  function(...m) { _log('warn',  m); },
        error: function(...m) { _log('error', m); }
    };
})();
AppLogger.info('AppLogger initialisert.');