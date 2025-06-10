// static/js/plugins.js

let pluginsData = {};

document.addEventListener('DOMContentLoaded', () => {
    loadPlugins();
});

function loadPlugins() {
    fetch('/api/plugins')
        .then(response => response.json())
        .then(data => {
            pluginsData = data;
            renderPlugins(data);
        })
        .catch(error => {
            console.error('Error loading plugins:', error);
            document.getElementById('pluginsList').innerHTML = 
                '<div class="alert alert-danger">Error loading plugins</div>';
        });
}

function renderPlugins(data) {
    const container = document.getElementById('pluginsList');
    
    if (!data.available || data.available.length === 0) {
        container.innerHTML = '<div class="plugin-empty">No plugins available</div>';
        return;
    }
    
    let html = '';
    
    // Group plugins by status
    const enabledPlugins = data.available.filter(p => p.enabled);
    const disabledPlugins = data.available.filter(p => !p.enabled);
    
    if (enabledPlugins.length > 0) {
        html += '<div class="plugin-section-title">Enabled Plugins</div>';
        enabledPlugins.forEach(plugin => {
            html += renderPluginCard(plugin, true);
        });
    }
    
    if (disabledPlugins.length > 0) {
        html += '<div class="plugin-section-title">Available Plugins</div>';
        disabledPlugins.forEach(plugin => {
            html += renderPluginCard(plugin, false);
        });
    }
    
    container.innerHTML = html;
}

function renderPluginCard(plugin, isEnabled) {
    const statusBadge = isEnabled ? 
        '<span class="plugin-badge badge-enabled">Enabled</span>' : 
        '<span class="plugin-badge badge-disabled">Disabled</span>';
    
    const installBadge = plugin.installed ? 
        '<span class="plugin-badge badge-installed">Installed</span>' : 
        '<span class="plugin-badge badge-not-installed">Not Installed</span>';
    
    const actionButtons = isEnabled ? `
        <button class="plugin-btn plugin-btn-secondary" 
                onclick="configurePlugin('${plugin.name}')">
            Configure
        </button>
        <button class="plugin-btn plugin-btn-danger" 
                onclick="disablePlugin('${plugin.name}')">
            Disable
        </button>
    ` : `
        ${!plugin.installed ? `
            <button class="plugin-btn plugin-btn-primary" 
                    onclick="installPlugin('${plugin.name}')">
                Install
            </button>
        ` : ''}
        <button class="plugin-btn plugin-btn-success" 
                onclick="enablePlugin('${plugin.name}')"
                ${!plugin.installed ? 'disabled' : ''}>
            Enable
        </button>
    `;
    
    return `
        <div class="plugin-card">
            <div class="plugin-header">
                <h6 class="plugin-name">${plugin.name}</h6>
                <div class="plugin-badges">
                    ${statusBadge}
                    ${installBadge}
                </div>
            </div>
            <div class="plugin-description">${plugin.description}</div>
            <div class="plugin-actions">
                ${actionButtons}
            </div>
        </div>
    `;
}

function installPlugin(pluginName) {
    const button = event.target;
    button.disabled = true;
    button.innerHTML = 'Installing...';
    
    fetch('/api/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugin_name: pluginName })
    })
    .then(response => response.json())
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
    })
    .finally(() => {
        button.disabled = false;
        button.innerHTML = 'Install';
    });
}

function enablePlugin(pluginName) {
    fetch('/api/plugins/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugin_name: pluginName })
    })
    .then(response => response.json())
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
    .then(response => response.json())
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
    });
}

function configurePlugin(pluginName) {
    fetch(`/api/plugins/config/${pluginName}`)
        .then(response => response.json())
        .then(data => {
            showPluginConfigModal(pluginName, data.config, data.template);
        })
        .catch(error => {
            alert('Failed to load plugin configuration: ' + error.message);
        });
}

function showPluginConfigModal(pluginName, currentConfig, template) {
    const modalHtml = `
        <div class="modal fade" id="pluginConfigModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Configure ${pluginName}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="pluginConfigForm">
                            <div class="mb-3">
                                <label class="form-label">Configuration (JSON format):</label>
                                <textarea class="form-control" id="pluginConfigText" rows="10"
                                    placeholder="Enter plugin configuration in JSON format">${JSON.stringify(currentConfig, null, 2)}</textarea>
                                <div class="form-text">
                                    Default template: <code>${JSON.stringify(template, null, 2)}</code>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="savePluginConfig('${pluginName}')">Save Configuration</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('pluginConfigModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('pluginConfigModal'));
    modal.show();
}

function savePluginConfig(pluginName) {
    const configText = document.getElementById('pluginConfigText').value;
    
    try {
        const config = JSON.parse(configText);
        
        fetch(`/api/plugins/config/${pluginName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: config })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Configuration save failed: ' + data.error);
            } else {
                alert(data.message);
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('pluginConfigModal'));
                modal.hide();
            }
        })
        .catch(error => {
            alert('Configuration save failed: ' + error.message);
        });
        
    } catch (e) {
        alert('Invalid JSON configuration: ' + e.message);
    }
}