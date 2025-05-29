// Administrer Lokasjoner JavaScript Functionality
// Håndterer visning av alle steder i card-in-card design

class AdministrerLokasjoner {
    constructor() {
        this.locations = [];
        this.isLoading = false;
    }    // Last alle steder fra Firestore
    async loadAllLocations() {
        console.log('AdministrerLokasjoner: loadAllLocations() called');
        try {
            this.isLoading = true;
            this.showLoading();

            // Hent alle aktive steder fra Firestore via AppServices
            if (typeof AppServices !== 'undefined' && AppServices.locations && AppServices.locations.getActiveLocations) {
                this.locations = await AppServices.locations.getActiveLocations();
            } else {
                console.error('AdministrerLokasjoner: AppServices.locations ikke tilgjengelig');
                this.locations = [];
            }

            // Oppdater visningen
            this.renderLocations();
            this.updateLocationCount();

        } catch (error) {
            console.error('Feil ved lasting av lokasjoner:', error);
            this.showError('Kunne ikke laste lokasjoner');
        } finally {
            this.isLoading = false;
        }
    }

    // Vis loading-tilstand
    showLoading() {
        const gridContainer = document.getElementById('steder-cards-grid');
        if (gridContainer) {
            gridContainer.innerHTML = '<div class="loading-message">Laster steder...</div>';
        }
    }

    // Vis feilmelding
    showError(message) {
        const gridContainer = document.getElementById('steder-cards-grid');
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div class="empty-message">
                    <span style="color: #f56565;">⚠️ ${message}</span>
                </div>
            `;
        }
    }    // Render alle lokasjonscards
    renderLocations() {
        console.log('AdministrerLokasjoner: renderLocations() called, locations:', this.locations?.length || 0);
        const gridContainer = document.getElementById('steder-cards-grid');
        
        if (!gridContainer) {
            console.error('AdministrerLokasjoner: Grid container not found');
            return;
        }

        // Hvis ingen lokasjoner finnes
        if (!this.locations || this.locations.length === 0) {
            gridContainer.innerHTML = `
                <div class="empty-message">
                    <span style="color: #888;">📍 Ingen steder er lagt til ennå</span>
                    <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #666;">
                        Gå til "Driftsområder" for å legge til nye steder
                    </p>
                </div>
            `;
            return;
        }

        // Generer HTML for alle sted-cards
        const cardsHTML = this.locations.map((location, index) => {
            return this.createLocationCardHTML(location, index);
        }).join('');

        gridContainer.innerHTML = cardsHTML;
    }

    // Opprett HTML for en enkelt sted-card
    createLocationCardHTML(location, index) {
        const locationIcon = this.getLocationIcon(location.type || 'default');
        const locationInfo = this.getLocationInfo(location);

        return `
            <div class="sted-card" data-location-id="${index}">
                <div class="sted-card-header">
                    <span class="sted-card-icon" aria-hidden="true">${locationIcon}</span>
                    <h4>${this.escapeHtml(location.name)}</h4>
                </div>
                <div class="sted-card-info">
                    ${locationInfo}
                </div>
                <div class="sted-card-actions">
                    <button class="sted-card-btn" onclick="administrerLokasjoner.editLocation(${index})">
                        ✏️ Rediger
                    </button>
                    <button class="sted-card-btn" onclick="administrerLokasjoner.archiveLocation(${index})">
                        📦 Arkiver
                    </button>
                    <button class="sted-card-btn" onclick="administrerLokasjoner.deleteLocation(${index})">
                        🗑️ Slett
                    </button>
                </div>
            </div>
        `;
    }

    // Hent passende ikon basert på sted-type
    getLocationIcon(type) {
        const icons = {
            'office': '🏢',
            'warehouse': '🏭',
            'shop': '🏪',
            'facility': '🏗️',
            'field': '🌾',
            'default': '📍'
        };
        return icons[type] || icons.default;
    }

    // Hent informasjon om lokasjon
    getLocationInfo(location) {
        let info = [];

        if (location.area) {
            info.push(`<strong>Område:</strong> ${this.escapeHtml(location.area)}`);
        }

        if (location.hours && location.hours > 0) {
            info.push(`<strong>Timer:</strong> ${location.hours}`);
        }

        if (location.description) {
            info.push(`<strong>Beskrivelse:</strong> ${this.escapeHtml(location.description)}`);
        }

        if (info.length === 0) {
            info.push('<em>Ingen tilleggsinformasjon tilgjengelig</em>');
        }

        return info.join('<br>');
    }

    // Oppdater antall steder i header
    updateLocationCount() {
        const countElement = document.getElementById('steder-count');
        if (countElement) {
            const count = this.locations ? this.locations.length : 0;
            const text = count === 1 ? '1 sted' : `${count} steder`;
            countElement.textContent = text;
        }
    }

    // Rediger lokasjon (placeholder)
    editLocation(index) {
        if (index >= 0 && index < this.locations.length) {
            const location = this.locations[index];
            alert(`Redigering av "${location.name}" kommer snart!`);
            // TODO: Implementer redigeringsfunksjonalitet
        }
    }    // Slett lokasjon
    async deleteLocation(index) {
        if (index >= 0 && index < this.locations.length) {
            const location = this.locations[index];
            if (confirm(`Er du sikker på at du vil slette "${location.name}" permanent? Dette kan ikke angres!`)) {
                try {
                    if (typeof AppServices !== 'undefined' && AppServices.locations && AppServices.locations.deleteLocation) {
                        const success = await AppServices.locations.deleteLocation(location.id);
                        if (success) {
                            // Fjern fra lokal array og oppdater visning
                            this.locations.splice(index, 1);
                            this.renderLocations();
                            this.updateLocationCount();
                            alert(`Lokasjon "${location.name}" ble slettet permanent.`);
                        } else {
                            alert('Kunne ikke slette lokasjonen. Prøv igjen.');
                        }
                    } else {
                        console.error('AdministrerLokasjoner: AppServices.locations.deleteLocation ikke tilgjengelig');
                        alert('Feil: Kan ikke slette lokasjon.');
                    }
                } catch (error) {
                    console.error('Feil ved sletting av lokasjon:', error);
                    alert('En feil oppstod ved sletting av lokasjonen.');
                }
            }
        }
    }    // Arkiver lokasjon
    async archiveLocation(index) {
        if (index >= 0 && index < this.locations.length) {
            const location = this.locations[index];
            if (confirm(`Er du sikker på at du vil arkivere \"${location.name}\"?`)) {
                try {
                    if (typeof AppServices !== 'undefined' && AppServices.locations && AppServices.locations.archiveLocation) {
                        const success = await AppServices.locations.archiveLocation(location.id);
                        if (success) {
                            this.locations.splice(index, 1);
                            this.renderLocations();
                            this.updateLocationCount();
                            alert(`Lokasjon \"${location.name}\" ble arkivert.`);
                        } else {
                            alert('Kunne ikke arkivere lokasjonen. Prøv igjen.');
                        }
                    } else {
                        console.error('AdministrerLokasjoner: AppServices.locations.archiveLocation ikke tilgjengelig');
                        alert('Feil: Kan ikke arkivere lokasjon.');
                    }
                } catch (error) {
                    console.error('Feil ved arkivering av lokasjon:', error);
                    alert('En feil oppstod ved arkivering av lokasjonen.');
                }
            }
        }
    }

    // Escape HTML for sikkerhet
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Oppdater visning når data endres
    refresh() {
        this.loadAllLocations();
    }
}

// Initialiser global instans
let administrerLokasjoner = null;

// Funksjon for å sikre at objektet er initialisert
function ensureAdministrerLokasjoner() {
    if (!administrerLokasjoner) {
        administrerLokasjoner = new AdministrerLokasjoner();
    }
    return administrerLokasjoner;
}

// Initialiser når DOM er klar
document.addEventListener('DOMContentLoaded', function() {
    try {
        administrerLokasjoner = new AdministrerLokasjoner();
        console.log('AdministrerLokasjoner initialisert');
    } catch (error) {
        console.error('Feil ved initialisering av AdministrerLokasjoner:', error);
    }
});

// Eksporter for bruk i andre filer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdministrerLokasjoner;
}
