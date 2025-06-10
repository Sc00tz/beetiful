// static/js/plugins.js - Updated for beets 2.3.1

let pluginsData = {};

document.addEventListener('DOMContentLoaded', () => {
    loadPlugins();
});

function loadPlugins() {
    fetch('/api/plugins')
        .then(response => {
            if (!response.ok) {
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
    const availablePlugins = data.available.filter(p => !p.enabled);

    if (enabledPlugins.length > 0) {
        html += '<div class="plugin-section-title mt-4 mb-2 h5 text-success">Enabled Plugins</div>';
        enabledPlugins.forEach(plugin => {
            html += renderPluginCard(plugin, true);
        });
    }

    if (availablePlugins.length > 0) {
        html += '<div class="plugin-section-title mt-4 mb-2 h5 text-info">Available Plugins</div>';
        html += '<p class="text-muted mb-3">These plugins are built into beets 2.3.1 and ready to use. Just click "Enable" to activate them.</p>';
        availablePlugins.forEach(plugin => {
            html += renderPluginCard(plugin, false);
        });
    }

    container.innerHTML = html;
}

function renderPluginCard(plugin, isEnabled) {
    const statusBadgeClass = isEnabled ? 'badge-success' : 'badge-secondary';
    const builtInBadge = plugin.built_in ? '<span class="badge badge-info me-1">Built-in</span>' : '';

    const statusBadge = `<span class="badge ${statusBadgeClass} me-1">${isEnabled ? 'Enabled' : 'Disabled'}</span>`;

    const actionButtons = isEnabled ? `
        <button class="btn btn-sm btn-info me-1"
                onclick="configurePlugin('${plugin.name}')" title="Configure Plugin">
            <i class="fas fa-cog"></i> Configure
        </button>
        <button class="btn btn-sm btn-warning"
                onclick="disablePlugin('${plugin.name}')" title="Disable Plugin">
            <i class="fas fa-times-circle"></i> Disable
        </button>
    ` : `
        <button class="btn btn-sm btn-success"
                onclick="enablePlugin('${plugin.name}')" title="Enable Plugin">
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
                        ${builtInBadge}
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

// Remove the install function since plugins are built-in
function installPlugin(pluginName) {
    alert(`The ${pluginName} plugin is built into beets 2.3.1. Just click "Enable" to activate it!`);
}

function enablePlugin(pluginName) {
    fetch('/api/plugins/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugin_name: pluginName })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            alert('Enable failed: ' + data.error);
        } else {
            // Show success message with instructions
            alert(data.message + '\n\nNote: You may need to restart the application for some plugins to take full effect.');
            loadPlugins(); // Reload to update status
        }
    })
    .catch(error => {
        alert('Enable failed: ' + error.message);
        console.error('Enable error:', error);
    });
}

function disablePlugin(pluginName) {
    if (!confirm(`Are you sure you want to disable the ${pluginName} plugin?`)) {
        return;
    }

    fetch('/api/plugins/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugin_name: pluginName })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
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
                return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
            }
            return response.json();
        })
        .then(data => {
            const config = data.config && typeof data.config === 'object' ? data.config : {};
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
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }

    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content bg-dark text-light border-secondary">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title" id="${modalId}Label">Configure ${pluginName}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i> 
                            Configuration changes will be saved to your config.yaml file.
                        </div>
                        <form id="pluginConfigForm">
                            <div class="mb-3">
                                <label for="pluginConfigText" class="form-label">Configuration (YAML format):</label>
                                <textarea class="form-control bg-secondary text-light border-secondary" id="pluginConfigText" rows="15"
                                    placeholder="Enter plugin configuration in YAML format">${jsyaml.dump(currentConfig, {indent: 2})}</textarea>
                                <div class="form-text text-muted mt-2">
                                    <strong>Example configuration:</strong>
                                    <pre class="bg-body-secondary p-2 rounded text-black-50 small mt-1">${jsyaml.dump(template, {indent: 2})}</pre>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="savePluginConfig('${pluginName}')">
                            <i class="fas fa-save"></i> Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
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
        // Parse YAML to validate it
        const config = jsyaml.load(configText);

        fetch(`/api/plugins/config/${pluginName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: config })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                alert('Configuration save failed: ' + data.error);
            } else {
                alert(data.message + '\n\nNote: Restart the application for configuration changes to take effect.');
                const modalElement = document.getElementById('pluginConfigModal');
                if (modalElement) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) {
                        modal.hide();
                    }
                    modalElement.remove();
                }
            }
        })
        .catch(error => {
            alert('Configuration save failed: ' + error.message);
            console.error('Save plugin config error:', error);
        });

    } catch (e) {
        alert('Invalid YAML configuration: ' + e.message);
        console.error('YAML parsing error:', e);
    }
}