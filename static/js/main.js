// static/js/main.js

// Define functions before they are called in window.onload
function getStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            // Update the stats in the command tab as well as library tab
            document.getElementById('totalTracks').textContent = data.total_tracks !== undefined ? `(${data.total_tracks})` : '';
            document.getElementById('totalArtists').textContent = data.total_artists !== undefined ? `(${data.total_artists})` : '';
            document.getElementById('totalAlbums').textContent = data.total_albums !== undefined ? `(${data.total_albums})` : '';
        })
        .catch(error => {
            console.error('Error loading stats:', error);
        });
}

function viewConfig() {
    fetch('/api/config')
        .then(response => response.json())
        .then(data => {
            document.getElementById('configEditor').value = data.config;
        })
        .catch(error => {
            console.error('Error loading config:', error);
            document.getElementById('configMessage').innerHTML = '<div class="alert alert-danger">Error loading config: ' + error.message + '</div>';
        });
}

function saveConfig() {
    const configContent = document.getElementById('configEditor').value;
    const configMessageDiv = document.getElementById('configMessage');

    configMessageDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving configuration...';
    configMessageDiv.className = 'mt-3 text-info';

    fetch('/api/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: configContent })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            configMessageDiv.innerHTML = '<div class="alert alert-danger">' + data.error + '</div>';
            configMessageDiv.className = 'mt-3 text-danger';
        } else {
            configMessageDiv.innerHTML = '<div class="alert alert-success">' + data.message + '</div>';
            configMessageDiv.className = 'mt-3 text-success';
        }
    })
    .catch(error => {
        console.error('Error saving config:', error);
        configMessageDiv.innerHTML = '<div class="alert alert-danger">Error saving config: ' + error.message + '</div>';
        configMessageDiv.className = 'mt-3 text-danger';
    });
}


function setupCommandDropdown() {
    const commandDropdown = document.getElementById('command');
    commandDropdown.innerHTML = `
        <option value="">Choose Command</option>
        <option value="import">Import</option>
        <option value="update">Update</option>
        <option value="list">List</option>
        <option value="modify">Modify</option>
        <option value="config">Config</option>
    `;
    commandDropdown.addEventListener('change', updateCommandOptions);
}

function updateCommandOptions() {
    const command = document.getElementById('command').value;
    const optionsDiv = document.getElementById('command-options');
    optionsDiv.innerHTML = ''; // Clear previous options

    switch(command) {
        case 'import':
            optionsDiv.innerHTML = `
                <div class="mb-3">
                    <label for="importPath" class="form-label text-light">Path to import:</label>
                    <input type="text" class="form-control bg-secondary text-light border-secondary" id="importPath" placeholder="/music">
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="copyCheckbox" checked>
                    <label class="form-check-label text-light" for="copyCheckbox">Copy files (default)</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="autotagCheckbox">
                    <label class="form-check-label text-light" for="autotagCheckbox">Autotag (recommended)</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="linkCheckbox">
                    <label class="form-check-label text-light" for="linkCheckbox">Link files (don't copy)</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="moveCheckbox">
                    <label class="form-check-label text-light" for="moveCheckbox">Move files (don't copy)</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="incrementalCheckbox">
                    <label class="form-check-label text-light" for="incrementalCheckbox">Incremental import</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="skipCheckbox">
                    <label class="form-check-label text-light" for="skipCheckbox">Skip existing files</label>
                </div>
            `;
            // Add browse button for import path
            addBrowseButton('importPath');
            break;
        case 'modify':
        case 'update':
        case 'list':
            optionsDiv.innerHTML = `
                <div class="mb-3">
                    <label for="query" class="form-label text-light">Query (e.g., artist: "The Beatles" album: "Abbey Road"):</label>
                    <input type="text" class="form-control bg-secondary text-light border-secondary" id="query">
                </div>
            `;
            if (command === 'modify') {
                optionsDiv.innerHTML += `
                    <div class="mb-3">
                        <label for="field" class="form-label text-light">Field to modify (e.g., genre):</label>
                        <input type="text" class="form-control bg-secondary text-light border-secondary" id="field">
                    </div>
                    <div class="mb-3">
                        <label for="value" class="form-label text-light">New Value (e.g., "Rock"):</label>
                        <input type="text" class="form-control bg-secondary text-light border-secondary" id="value">
                    </div>
                `;
            }
            break;
        case 'config':
            optionsDiv.innerHTML = `
                <div class="mb-3">
                    <label for="configArgs" class="form-label text-light">Config Arguments (e.g., -p plugins, -e editor):</label>
                    <input type="text" class="form-control bg-secondary text-light border-secondary" id="configArgs">
                </div>
            `;
            break;
        default:
            optionsDiv.innerHTML = '';
            break;
    }
}

function executeCommand() {
    const command = document.getElementById('command').value;
    let args = document.getElementById('args').value;
    let fullArgs = [];

    // Add command-specific arguments
    switch(command) {
        case 'import':
            const importPath = document.getElementById('importPath').value;
            if (importPath) {
                fullArgs.push(`"${importPath}"`); // Quote path to handle spaces
            }
            if (document.getElementById('copyCheckbox').checked) {
                // 'copy' is default, so no flag needed unless 'link' or 'move' is active
            } else if (document.getElementById('linkCheckbox').checked) {
                fullArgs.push('-l'); // Link
            } else if (document.getElementById('moveCheckbox').checked) {
                fullArgs.push('-m'); // Move
            }

            if (document.getElementById('autotagCheckbox').checked) {
                fullArgs.push('-t'); // Autotag
            }
            if (document.getElementById('incrementalCheckbox').checked) {
                fullArgs.push('-i'); // Incremental
            }
            if (document.getElementById('skipCheckbox').checked) {
                fullArgs.push('-s'); // Skip existing
            }
            // Add -A (don't autotag) if autotag is unchecked
            if (!document.getElementById('autotagCheckbox').checked) {
                fullArgs.push('-A');
            }
            break;
        case 'modify':
            const queryModify = document.getElementById('query').value;
            const field = document.getElementById('field').value;
            const value = document.getElementById('value').value;
            if (queryModify) fullArgs.push(queryModify);
            if (field && value) fullArgs.push(`${field}=${value}`);
            break;
        case 'update':
        case 'list':
            const queryBasic = document.getElementById('query').value;
            if (queryBasic) fullArgs.push(queryBasic);
            break;
        case 'config':
            const configArgs = document.getElementById('configArgs').value;
            if (configArgs) fullArgs.push(configArgs);
            break;
    }

    // Append any manually entered additional arguments
    if (args) {
        fullArgs.push(args);
    }

    const commandResultDiv = document.getElementById('commandResult');
    commandResultDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Executing ${command}...`;
    commandResultDiv.className = 'mt-2 text-info'; // Keep it blue during loading

    fetch('/api/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: command, args: fullArgs.join(' ') })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            commandResultDiv.innerHTML = `<i class="fas fa-times-circle"></i> Error: <pre>${data.error}</pre>`;
            commandResultDiv.className = 'mt-2 text-danger';
        } else {
            // Display message, and error output if present
            let displayMessage = `<i class="fas fa-check-circle"></i> ${data.message}`;
            if (data.error) { // Backend might return error field even on 200 status if it's a warning
                displayMessage += `<br><span class="text-warning"><i class="fas fa-exclamation-triangle"></i> Warnings/Errors from Beets:</span> <pre>${data.error}</pre>`;
            }
            commandResultDiv.innerHTML = displayMessage;
            commandResultDiv.className = 'mt-2 text-success';
        }
        // Re-fetch library data if a command that might change it was run
        if (['import', 'modify', 'remove', 'update'].includes(command)) {
            fetchLibrary();
        }
    })
    .catch(error => {
        commandResultDiv.innerHTML = `<i class="fas fa-times-circle"></i> Network Error: ${error.message}`;
        commandResultDiv.className = 'mt-2 text-danger';
        console.error('Error executing command:', error);
    });
}

// Function to update the preview of import path - if you have such functionality
function updatePreview() {
    console.log("Import path changed to: " + document.getElementById('importPath').value);
}

// Function to add browse button dynamically - ensuring it's not duplicated
function addBrowseButton(inputId, buttonText = 'Browse') {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const existingButton = input.parentNode.querySelector('.btn-outline-secondary');
    if (existingButton && existingButton.textContent.includes(buttonText)) {
        return; 
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-secondary btn-sm ms-2';
    button.innerHTML = `<i class="fas fa-folder-open"></i> ${buttonText}`;
    button.onclick = () => {
        // Ensure openFileBrowser is defined (from filebrowser.js)
        if (typeof openFileBrowser === 'function') {
            openFileBrowser((selectedPath) => {
                input.value = selectedPath;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }, input.value || '/music');
        } else {
            alert('File browser not available. Ensure filebrowser.js is loaded.');
        }
    };
    
    input.parentNode.insertBefore(button, input.nextSibling);
}


// This should be at the very top of the script or wrapped in DOMContentLoaded if functions are not global
window.onload = function() {
    getStats();              
    viewConfig();            
    
    setupCommandDropdown();  
};

// This ensures browse button is added after DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add browse button to import path input if it exists
    // A slight delay to ensure filebrowser.js has registered openFileBrowser
    setTimeout(() => {
        const importPath = document.getElementById('importPath');
        if (importPath) {
            addBrowseButton('importPath');
        }
    }, 100); 
});