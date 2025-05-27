// js/main.js
document.addEventListener('DOMContentLoaded', function() {
    if (typeof AppLogger !== 'undefined') {
        AppLogger.info('main.js lastet.');
    }

    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
});