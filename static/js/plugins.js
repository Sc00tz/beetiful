// static/js/plugins.js

let pluginsData = {};

document.addEventListener('DOMContentLoaded', () => {
    loadPlugins();
});

function loadPlugins() {
    fetch('/api/plugins')
        .then(response => {
            if (!response.ok) {
                // If response is not OK (e.g., 404, 500), try to read error message
                return response.json().then(err => {
                    throw new Error(err.error || `HTTP error! Status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            pluginsData = data;
            renderPlugins(data);
        })
        .catch(error => {
            console.error('Error loading plugins:', error);
            const pluginsList = document.getElementById('pluginsList');
            if (pluginsList) {
                pluginsList.innerHTML = '<div class="alert alert-danger">Error loading plugins: ' + error.message + '</div>';
            }
        });
}
// static/js/plugins.js

// ... (Previous Part 1 code: pluginsData, DOMContentLoaded, loadPlugins) ...

function renderPlugins(data) {
    const container = document.getElementById('pluginsList');

    if (!container) {
        console.error('Plugins list container not found.');
        return;
    }

    if (!data.available || data.available.length === 0) {
        container.innerHTML = '<div class="plugin-empty text-muted text-center py-3">No plugins available</div>';
        return;
    }

    let html = '';

    // Group plugins by status
    const enabledPlugins = data.available.filter(p => p.enabled);
    const disabledPlugins = data.available.filter(p => !p.enabled);

    if (enabledPlugins.length > 0) {
        html += '<div class="plugin-section-title mt-4 mb-2 h5 text-primary">Enabled Plugins</div>';
        enabledPlugins.forEach(plugin => {
            html += renderPluginCard(plugin, true);
        });
    }

    if (disabledPlugins.length > 0) {
        html += '<div class="plugin-section-title mt-4 mb-2 h5 text-info">Available Plugins</div>';
        disabledPlugins.forEach(plugin => {
            html += renderPluginCard(plugin, false);
        });
    }

    container.innerHTML = html;
}

function renderPluginCard(plugin, isEnabled) {
    const statusBadgeClass = isEnabled ? 'badge-success' : 'badge-secondary';
    const installBadgeClass = plugin.installed ? 'badge-info' : 'badge-warning';

    const statusBadge = `<span class="badge ${statusBadgeClass} me-1">${isEnabled ? 'Enabled' : 'Disabled'}</span>`;
    const installBadge = `<span class="badge ${installBadgeClass}">${plugin.installed ? 'Installed' : 'Not Installed'}</span>`;

    const actionButtons = isEnabled ? `
        <button class="btn btn-sm btn-info me-1"
                onclick="configurePlugin('${plugin.name}')" title="Configure Plugin">
            <i class="fas fa-cog"></i> Configure
        </button>
        <button class="btn btn-sm btn-danger"
                onclick="disablePlugin('${plugin.name}')" title="Disable Plugin">
            <i class="fas fa-times-circle"></i> Disable
        </button>
    ` : `
        ${!plugin.installed ? `
            <button class="btn btn-sm btn-primary me-1"
                    onclick="installPlugin('${plugin.name}')" title="Install Plugin">
                <i class="fas fa-download"></i> Install
            </button>
        ` : ''}
        <button class="btn btn-sm btn-success"
                onclick="enablePlugin('${plugin.name}')"
                ${!plugin.installed ? 'disabled' : ''} title="Enable Plugin">
            <i class="fas fa-check-circle"></i> Enable
        </button>
    `;

    return `
        <div class="card bg-dark text-light border-secondary mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="card-title mb-0">${plugin.name}</h5>
                    <div>
                        ${statusBadge}
                        ${installBadge}
                    </div>
                </div>
                <p class="card-text text-muted">${plugin.description || 'No description available.'}</p>
                <div class="d-flex justify-content-end mt-3">
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
}
// static/js/plugins.js

// ... (Previous Part 1 & 2 code) ...

function installPlugin(pluginName) {
    const button = event.target; // Get the button that was clicked
    if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Installing...';
    }

    fetch('/api/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugin_name: pluginName })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || `HTTP error! Status: ${response.status}`); });
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            alert('Installation failed: ' + data.error);
        } else {
            alert(data.message);
            loadPlugins(); // Reload to update status
        }
    })
    .catch(error => {
        alert('Installation failed: ' + error.message);
        console.error('Installation error:', error);
    })
    .finally(() => {
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-download"></i> Install'; // Restore original icon and text
        }
    });
}

function enablePlugin(pluginName) {
    fetch('/api/plugins/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugin_name: pluginName })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || `HTTP error! Status: ${response.status}`); });
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            alert('Enable failed: ' + data.error);
        } else {
            alert(data.message);
            loadPlugins(); // Reload to update status
        }
    })
    .catch(error => {
        alert('Enable failed: ' + error.message);
        console.error('Enable error:', error);
    });
}

function disablePlugin(pluginName) {
    if (!confirm(`Are you sure you want to disable the ${pluginName} plugin? This might require a restart of Beets or the web UI.`)) {
        return;
    }

    fetch('/api/plugins/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugin_name: pluginName })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || `HTTP error! Status: ${response.status}`); });
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            alert('Disable failed: ' + data.error);
        } else {
            alert(data.message);
            loadPlugins(); // Reload to update status
        }
    })
    .catch(error => {
        alert('Disable failed: ' + error.message);
        console.error('Disable error:', error);
    });
}

function configurePlugin(pluginName) {
    fetch(`/api/plugins/config/${pluginName}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || `HTTP error! Status: ${response.status}`); });
            }
            return response.json();
        })
        .then(data => {
            // Ensure data.config is an object and not null
            const config = data.config && typeof data.config === 'object' ? data.config : {};
            // Ensure data.template is an object and not null
            const template = data.template && typeof data.template === 'object' ? data.template : {};
            showPluginConfigModal(pluginName, config, template);
        })
        .catch(error => {
            alert('Failed to load plugin configuration: ' + error.message);
            console.error('Load plugin config error:', error);
        });
}

function showPluginConfigModal(pluginName, currentConfig, template) {
    const modalId = 'pluginConfigModal';
    // Remove existing modal if any to prevent issues with multiple instances
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }

    // Modal content with improved styling for JSON textarea
    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content bg-dark text-light border-secondary">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title" id="${modalId}Label">Configure ${pluginName}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="pluginConfigForm">
                            <div class="mb-3">
                                <label for="pluginConfigText" class="form-label">Configuration (JSON format):</label>
                                <textarea class="form-control bg-secondary text-light border-secondary" id="pluginConfigText" rows="15"
                                    placeholder="Enter plugin configuration in JSON format">${JSON.stringify(currentConfig, null, 2)}</textarea>
                                <div class="form-text text-muted mt-2">
                                    Default template: <pre class="bg-body-secondary p-2 rounded text-black-50 small">${JSON.stringify(template, null, 2)}</pre>
                                    Edit the configuration above. Ensure it's valid JSON.
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="savePluginConfig('${pluginName}')">Save Configuration</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
}

function savePluginConfig(pluginName) {
    const configTextarea = document.getElementById('pluginConfigText');
    const configText = configTextarea ? configTextarea.value : '';

    if (!configText) {
        alert('Configuration content cannot be empty.');
        return;
    }

    try {
        const config = JSON.parse(configText);

        fetch(`/api/plugins/config/${pluginName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: config })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || `HTTP error! Status: ${response.status}`); });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                alert('Configuration save failed: ' + data.error);
            } else {
                alert(data.message);
                // Close modal
                const modalElement = document.getElementById('pluginConfigModal');
                if (modalElement) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) {
                        modal.hide();
                    }
                    modalElement.remove(); // Remove modal from DOM after hiding
                }
            }
        })
        .catch(error => {
            alert('Configuration save failed: ' + error.message);
            console.error('Save plugin config error:', error);
        });

    } catch (e) {
        alert('Invalid JSON configuration: ' + e.message);
        console.error('JSON parsing error:', e);
    }
}