// File Browser functionality

let currentBrowserPath = '/music';
let browserCallback = null;

function openFileBrowser(callback, initialPath = '/music') {
    browserCallback = callback;
    currentBrowserPath = initialPath;
    
    // Create the modal HTML
    const modalHtml = `
        <div class="modal fade" id="fileBrowserModal" tabindex="-1" aria-labelledby="fileBrowserModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content bg-dark text-light">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title" id="fileBrowserModalLabel">
                            <i class="fas fa-folder-open"></i> Select Directory
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Navigation Bar -->
                        <div class="d-flex mb-3">
                            <div class="input-group">
                                <span class="input-group-text bg-secondary border-secondary text-light">
                                    <i class="fas fa-folder"></i>
                                </span>
                                <input type="text" class="form-control bg-dark border-secondary text-light" 
                                       id="currentPathInput" value="${initialPath}">
                                <button class="btn btn-outline-secondary" type="button" onclick="navigateToPath()">
                                    <i class="fas fa-arrow-right"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Quick Access -->
                        <div class="mb-3">
                            <small class="text-muted">Quick Access:</small>
                            <div id="quickAccessButtons" class="mt-1">
                                <!-- Populated by loadCommonDirectories -->
                            </div>
                        </div>
                        
                        <!-- File Browser -->
                        <div class="browser-container">
                            <div id="browserLoading" class="text-center p-4">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <div class="mt-2">Loading directories...</div>
                            </div>
                            <div id="browserContent" style="display: none;">
                                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                    <table class="table table-dark table-hover">
                                        <thead class="table-secondary">
                                            <tr>
                                                <th><i class="fas fa-folder"></i> Name</th>
                                                <th><i class="fas fa-calendar"></i> Modified</th>
                                                <th width="100">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody id="browserItems">
                                            <!-- Populated by loadDirectory -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div id="browserError" style="display: none;" class="alert alert-danger">
                                <!-- Error messages -->
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <div class="me-auto">
                            <small class="text-muted">Current: <span id="selectedPath">${initialPath}</span></small>
                        </div>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="selectCurrentPath()">
                            <i class="fas fa-check"></i> Select This Directory
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('fileBrowserModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('fileBrowserModal'));
    modal.show();
    
    // Load initial directory and common directories
    loadCommonDirectories();
    loadDirectory(currentBrowserPath);
}

function loadCommonDirectories() {
    fetch('/api/browse/music-dirs')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('quickAccessButtons');
            if (data.directories && data.directories.length > 0) {
                const buttons = data.directories.map(dir => 
                    `<button class="btn btn-outline-info btn-sm me-2 mb-1" 
                             onclick="loadDirectory('${dir.path}')" title="${dir.subdirs} subdirectories">
                        <i class="fas fa-music"></i> ${dir.name}
                     </button>`
                ).join('');
                container.innerHTML = buttons;
            } else {
                container.innerHTML = '<small class="text-muted">No common music directories found</small>';
            }
        })
        .catch(error => {
            console.error('Error loading common directories:', error);
            document.getElementById('quickAccessButtons').innerHTML = 
                '<small class="text-muted">Unable to load quick access</small>';
        });
}

function loadDirectory(path) {
    currentBrowserPath = path;
    document.getElementById('currentPathInput').value = path;
    document.getElementById('selectedPath').textContent = path;
    
    // Show loading state
    document.getElementById('browserLoading').style.display = 'block';
    document.getElementById('browserContent').style.display = 'none';
    document.getElementById('browserError').style.display = 'none';
    
    fetch(`/api/browse?path=${encodeURIComponent(path)}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showBrowserError(data.error);
                return;
            }
            
            displayDirectoryContents(data);
        })
        .catch(error => {
            showBrowserError('Failed to load directory: ' + error.message);
        });
}

function displayDirectoryContents(data) {
    const tbody = document.getElementById('browserItems');
    tbody.innerHTML = '';
    
    if (!data.items || data.items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted">
                    <i class="fas fa-folder-open"></i> No accessible directories found
                </td>
            </tr>
        `;
    } else {
        data.items.forEach(item => {
            const icon = item.is_parent ? 'fa-level-up-alt' : 'fa-folder';
            const nameDisplay = item.is_parent ? '.. (Parent Directory)' : item.name;
            
            const row = document.createElement('tr');
            row.className = 'directory-row';
            row.style.cursor = 'pointer';
            
            row.innerHTML = `
                <td onclick="loadDirectory('${item.path}')" class="directory-name">
                    <i class="fas ${icon} text-warning me-2"></i>
                    <span>${nameDisplay}</span>
                </td>
                <td onclick="loadDirectory('${item.path}')" class="text-muted">
                    ${item.modified}
                </td>
                <td>
                    ${!item.is_parent ? `
                        <button class="btn btn-outline-success btn-sm" 
                                onclick="selectPath('${item.path}')"
                                title="Select this directory">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    // Hide loading, show content
    document.getElementById('browserLoading').style.display = 'none';
    document.getElementById('browserContent').style.display = 'block';
}

function showBrowserError(message) {
    document.getElementById('browserLoading').style.display = 'none';
    document.getElementById('browserContent').style.display = 'none';
    
    const errorDiv = document.getElementById('browserError');
    errorDiv.innerHTML = `
        <strong>Error:</strong> ${message}
        <button class="btn btn-outline-light btn-sm ms-2" onclick="loadDirectory('/music')">
            Try /music
        </button>
        <button class="btn btn-outline-light btn-sm ms-2" onclick="loadDirectory('/')">
            Go to Root
        </button>
    `;
    errorDiv.style.display = 'block';
}

function navigateToPath() {
    const path = document.getElementById('currentPathInput').value;
    if (path) {
        loadDirectory(path);
    }
}

function selectPath(path) {
    currentBrowserPath = path;
    document.getElementById('selectedPath').textContent = path;
    selectCurrentPath();
}

function selectCurrentPath() {
    if (browserCallback) {
        browserCallback(currentBrowserPath);
    }
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('fileBrowserModal'));
    modal.hide();
}

// Utility function to add browse button to any input field
function addBrowseButton(inputId, buttonText = 'Browse') {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    // Create button
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-secondary btn-sm ms-2';
    button.innerHTML = `<i class="fas fa-folder-open"></i> ${buttonText}`;
    button.onclick = () => {
        openFileBrowser((selectedPath) => {
            input.value = selectedPath;
            // Trigger input event to update any listeners
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }, input.value || '/music');
    };
    
    // Insert button after input
    input.parentNode.insertBefore(button, input.nextSibling);
}

// Auto-initialize browse buttons on page load
document.addEventListener('DOMContentLoaded', () => {
    // Add browse button to import path input if it exists
    setTimeout(() => {
        const importPath = document.getElementById('importPath');
        if (importPath && !importPath.parentNode.querySelector('.btn')) {
            addBrowseButton('importPath', 'Browse');
        }
    }, 1000);
})