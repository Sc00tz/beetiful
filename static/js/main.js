// static/js/main.js

// Define functions before they are called in window.onload
function getStats() {
    fetch('/api/stats')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Update the stats in both library tab and command tab
            // Library tab stats
            const libraryTotalTracks = document.getElementById('totalTracks');
            const libraryTotalArtists = document.getElementById('totalArtists');
            const libraryTotalAlbums = document.getElementById('totalAlbums');
            
            // Command tab stats (use different IDs to avoid conflicts)
            const statusTotalTracks = document.getElementById('statusTotalTracks');
            const statusTotalArtists = document.getElementById('statusTotalArtists');
            const statusTotalAlbums = document.getElementById('statusTotalAlbums');
            
            const tracks = data.total_tracks || '0';
            const artists = data.total_artists || '0';
            const albums = data.total_albums || '0';
            
            if (libraryTotalTracks) libraryTotalTracks.textContent = tracks;
            if (libraryTotalArtists) libraryTotalArtists.textContent = artists;
            if (libraryTotalAlbums) libraryTotalAlbums.textContent = albums;
            
            if (statusTotalTracks) statusTotalTracks.textContent = tracks;
            if (statusTotalArtists) statusTotalArtists.textContent = artists;
            if (statusTotalAlbums) statusTotalAlbums.textContent = albums;
        })
        .catch(error => {
            console.error('Error loading stats:', error);
            // Update with error message
            const elements = [
                'totalTracks', 'totalArtists', 'totalAlbums',
                'statusTotalTracks', 'statusTotalArtists', 'statusTotalAlbums'
            ];
            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.textContent = 'Error';
            });
        });
}

function viewConfig() {
    fetch('/api/config')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Backend now returns {config: yaml_string}
            const configEditor = document.getElementById('configEditor');
            if (configEditor) {
                configEditor.value = data.config || '';
            }
        })
        .catch(error => {
            console.error('Error loading config:', error);
            const configMessage = document.getElementById('configMessage');
            if (configMessage) {
                configMessage.innerHTML = '<div class="alert alert-danger">Error loading config: ' + error.message + '</div>';
            }
        });
}

function saveConfig() {
    const configEditor = document.getElementById('configEditor');
    const configMessageDiv = document.getElementById('configMessage');
    
    if (!configEditor || !configMessageDiv) {
        console.error('Config editor elements not found');
        return;
    }

    const configContent = configEditor.value;
    
    if (!configContent.trim()) {
        configMessageDiv.innerHTML = '<div class="alert alert-warning">Configuration cannot be empty</div>';
        return;
    }

    configMessageDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving configuration...';
    configMessageDiv.className = 'mt-3 text-info';

    // Validate YAML on frontend before sending
    try {
        // Basic YAML validation - try to parse it
        jsyaml.load(configContent);
    } catch (yamlError) {
        configMessageDiv.innerHTML = '<div class="alert alert-danger">Invalid YAML syntax: ' + yamlError.message + '</div>';
        configMessageDiv.className = 'mt-3 text-danger';
        return;
    }

    fetch('/api/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: configContent })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        }
        return response.json();
    })
    .then(data => {
        configMessageDiv.innerHTML = '<div class="alert alert-success">' + (data.message || 'Configuration saved successfully!') + '</div>';
        configMessageDiv.className = 'mt-3 text-success';
        
        // Reload config to show any formatting changes
        setTimeout(() => {
            viewConfig();
        }, 1000);
    })
    .catch(error => {
        console.error('Error saving config:', error);
        configMessageDiv.innerHTML = '<div class="alert alert-danger">Error saving config: ' + error.message + '</div>';
        configMessageDiv.className = 'mt-3 text-danger';
    });
}

function setupCommandDropdown() {
    const commandDropdown = document.getElementById('command');
    if (!commandDropdown) {
        console.error('Command dropdown not found');
        return;
    }
    
    commandDropdown.innerHTML = `
        <option value="">Choose Command</option>
        <option value="import">Import</option>
        <option value="update">Update</option>
        <option value="list">List</option>
        <option value="modify">Modify</option>
        <option value="config">Config</option>
        <option value="stats">Stats</option>
        <option value="version">Version</option>
    `;
    commandDropdown.addEventListener('change', updateCommandOptions);
}

function updateCommandOptions() {
    const command = document.getElementById('command').value;
    const optionsDiv = document.getElementById('command-options');
    
    if (!optionsDiv) {
        console.error('Command options div not found');
        return;
    }
    
    optionsDiv.innerHTML = ''; // Clear previous options

    switch(command) {
        case 'import':
            optionsDiv.innerHTML = `
                <div class="mb-3">
                    <label for="importPath" class="form-label text-light">Path to import:</label>
                    <div class="input-group">
                        <input type="text" class="form-control bg-secondary text-light border-secondary" id="importPath" placeholder="/music/new_albums">
                        <button type="button" class="btn btn-outline-secondary" onclick="browseForImportPath()">
                            <i class="fas fa-folder-open"></i> Browse
                        </button>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="autotagCheckbox" checked>
                            <label class="form-check-label text-light" for="autotagCheckbox">Autotag (recommended)</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="copyCheckbox" checked>
                            <label class="form-check-label text-light" for="copyCheckbox">Copy files</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="incrementalCheckbox">
                            <label class="form-check-label text-light" for="incrementalCheckbox">Incremental import</label>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="linkCheckbox">
                            <label class="form-check-label text-light" for="linkCheckbox">Link files (don't copy)</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="moveCheckbox">
                            <label class="form-check-label text-light" for="moveCheckbox">Move files (don't copy)</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="skipCheckbox">
                            <label class="form-check-label text-light" for="skipCheckbox">Skip existing files</label>
                        </div>
                    </div>
                </div>
            `;
            break;
        case 'modify':
        case 'update':
        case 'list':
            optionsDiv.innerHTML = `
                <div class="mb-3">
                    <label for="query" class="form-label text-light">Query (e.g., artist:"The Beatles" album:"Abbey Road"):</label>
                    <input type="text" class="form-control bg-secondary text-light border-secondary" id="query" 
                           placeholder='artist:"Artist Name" OR album:"Album Name"'>
                    <div class="form-text text-muted">Leave empty to apply to all items. Use quotes for exact matches.</div>
                </div>
            `;
            if (command === 'modify') {
                optionsDiv.innerHTML += `
                    <div class="row">
                        <div class="col-md-6">
                            <label for="field" class="form-label text-light">Field to modify:</label>
                            <select class="form-select bg-secondary text-light border-secondary" id="field">
                                <option value="">Select field...</option>
                                <option value="genre">Genre</option>
                                <option value="year">Year</option>
                                <option value="albumartist">Album Artist</option>
                                <option value="artist">Artist</option>
                                <option value="album">Album</option>
                                <option value="title">Title</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label for="value" class="form-label text-light">New Value:</label>
                            <input type="text" class="form-control bg-secondary text-light border-secondary" id="value" placeholder="Rock">
                        </div>
                    </div>
                `;
            }
            break;
        case 'config':
            optionsDiv.innerHTML = `
                <div class="mb-3">
                    <label for="configAction" class="form-label text-light">Config Action:</label>
                    <select class="form-select bg-secondary text-light border-secondary" id="configAction">
                        <option value="">Show current configuration</option>
                        <option value="-p">Show plugins</option>
                        <option value="-e">Edit configuration</option>
                        <option value="-l">List configuration locations</option>
                    </select>
                </div>
            `;
            break;
        default:
            optionsDiv.innerHTML = '';
            break;
    }
}

function browseForImportPath() {
    if (typeof openFileBrowser === 'function') {
        openFileBrowser((selectedPath) => {
            const importPath = document.getElementById('importPath');
            if (importPath) {
                importPath.value = selectedPath;
            }
        }, '/music');
    } else {
        alert('File browser not available. Please enter the path manually.');
    }
}

function executeCommand() {
    const command = document.getElementById('command').value;
    const additionalArgs = document.getElementById('args').value;
    
    if (!command) {
        alert('Please select a command');
        return;
    }
    
    let args = [];

    // Build command-specific arguments
    switch(command) {
        case 'import':
            const importPath = document.getElementById('importPath').value;
            if (!importPath) {
                alert('Please specify a path to import');
                return;
            }
            
            // Quote the path if it contains spaces
            const quotedPath = importPath.includes(' ') ? `"${importPath}"` : importPath;
            args.push(quotedPath);
            
            // Handle mutually exclusive options
            if (document.getElementById('linkCheckbox').checked) {
                args.push('-l'); // Link
            } else if (document.getElementById('moveCheckbox').checked) {
                args.push('-m'); // Move
            } else if (document.getElementById('copyCheckbox').checked) {
                args.push('-c'); // Copy (explicit)
            }

            if (document.getElementById('autotagCheckbox').checked) {
                args.push('-t'); // Autotag
            } else {
                args.push('-A'); // Don't autotag
            }
            
            if (document.getElementById('incrementalCheckbox').checked) {
                args.push('-i'); // Incremental
            }
            
            if (document.getElementById('skipCheckbox').checked) {
                args.push('-s'); // Skip existing
            }
            break;
            
        case 'modify':
            const query = document.getElementById('query').value;
            const field = document.getElementById('field').value;
            const value = document.getElementById('value').value;
            
            if (!field || !value) {
                alert('Please specify both field and value for modify command');
                return;
            }
            
            if (query) {
                args.push(query);
            }
            // Let the backend handle proper quoting
            args.push(`${field}=${value}`);
            break;
            
        case 'update':
        case 'list':
            const queryBasic = document.getElementById('query').value;
            if (queryBasic) {
                args.push(queryBasic);
            }
            break;
            
        case 'config':
            const configAction = document.getElementById('configAction').value;
            if (configAction) {
                args.push(configAction);
            }
            break;
    }

    // Append any manually entered additional arguments
    if (additionalArgs) {
        args.push(additionalArgs);
    }

    const commandResultDiv = document.getElementById('commandResult');
    if (!commandResultDiv) {
        console.error('Command result div not found');
        return;
    }
    
    commandResultDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Executing ${command}...`;
    commandResultDiv.className = 'mt-2 text-info';

    fetch('/api/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            command: command, 
            args: args.join(' ') 
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        }
        return response.json();
    })
    .then(data => {
        let displayMessage = '';
        
        if (data.message) {
            displayMessage += `<i class="fas fa-check-circle"></i> ${data.message}`;
        }
        
        if (data.output) {
            displayMessage += `<br><strong>Output:</strong><pre class="mt-2 bg-dark p-2 rounded">${data.output}</pre>`;
        }
        
        if (data.error) {
            displayMessage += `<br><span class="text-warning"><i class="fas fa-exclamation-triangle"></i> Warnings/Errors:</span><pre class="mt-2 bg-dark p-2 rounded text-warning">${data.error}</pre>`;
        }
        
        commandResultDiv.innerHTML = displayMessage || '<i class="fas fa-check-circle"></i> Command completed';
        commandResultDiv.className = 'mt-2 text-success';
        
        // Re-fetch library and stats if a command that might change them was run
        if (['import', 'modify', 'remove', 'update'].includes(command)) {
            if (typeof fetchLibrary === 'function') {
                fetchLibrary();
            }
            getStats();
        }
    })
    .catch(error => {
        commandResultDiv.innerHTML = `<i class="fas fa-times-circle"></i> Error: ${error.message}`;
        commandResultDiv.className = 'mt-2 text-danger';
        console.error('Error executing command:', error);
    });
}

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set up the UI
    setupCommandDropdown();
    
    // Load initial data
    getStats();
    viewConfig();
    
    // Set up event handlers for checkbox interactions
    setupImportCheckboxes();
});

function setupImportCheckboxes() {
    // Add event listeners to make copy/link/move mutually exclusive
    document.addEventListener('change', (event) => {
        if (event.target.matches('#copyCheckbox, #linkCheckbox, #moveCheckbox')) {
            const copyBox = document.getElementById('copyCheckbox');
            const linkBox = document.getElementById('linkCheckbox');
            const moveBox = document.getElementById('moveCheckbox');
            
            if (copyBox && linkBox && moveBox) {
                if (event.target.id === 'copyCheckbox' && copyBox.checked) {
                    linkBox.checked = false;
                    moveBox.checked = false;
                } else if (event.target.id === 'linkCheckbox' && linkBox.checked) {
                    copyBox.checked = false;
                    moveBox.checked = false;
                } else if (event.target.id === 'moveCheckbox' && moveBox.checked) {
                    copyBox.checked = false;
                    linkBox.checked = false;
                }
            }
        }
    });
}

// Keep the old window.onload for compatibility, but most initialization is now in DOMContentLoaded
window.onload = function() {
    // Refresh stats in case they weren't loaded during DOMContentLoaded
    getStats();
};