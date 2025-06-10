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
                        <div class="d-flex mb-3">
                            <div class="input-group">
                                <span class="input-group-text bg-secondary border-secondary text-light">
                                    <i class="fas fa-folder"></i>
                                </span>
                                <input type="text" class="form-control bg-dark border-secondary text-light" 
                                       id="currentPathInput" value="${currentBrowserPath}" readonly>
                            </div>
                            <button type="button" class="btn btn-outline-secondary ms-2" onclick="goUpDirectory()">
                                <i class="fas fa-arrow-up"></i> Up
                            </button>
                            <button type="button" class="btn btn-primary ms-2" onclick="selectCurrentPath()">
                                <i class="fas fa-check"></i> Select
                            </button>
                        </div>
                        
                        <div class="file-list-container overflow-auto" style="max-height: 400px;">
                            <ul id="fileList" class="list-group">
                                </ul>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
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

    // Initial browse
    browseDirectory(initialPath);
}

function renderBrowser(items) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = ''; // Clear previous items

    if (!items || items.length === 0) {
        fileList.innerHTML = '<li class="list-group-item bg-dark text-muted">No items found.</li>';
        return;
    }

    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-group-item bg-dark text-light d-flex justify-content-between align-items-center directory-row';
        
        let icon = '';
        let onClickAction = '';

        if (item.type === 'directory') {
            icon = '<i class="fas fa-folder text-warning me-2"></i>';
            onClickAction = `onclick="browseDirectory('${item.path}')"`;
            li.innerHTML = `${icon}<span class="directory-name" ${onClickAction}>${item.name}</span>`;
        } else {
            icon = '<i class="fas fa-file text-info me-2"></i>';
            li.innerHTML = `${icon}<span>${item.name}</span>`;
            if (item.size) {
                li.innerHTML += `<span class="badge bg-secondary ms-2">${formatBytes(item.size)}</span>`;
            }
        }
        
        fileList.appendChild(li);
    });
}

function browseDirectory(path) {
    // Corrected: Change method to GET and pass path as query parameter
    fetch(`/api/browse?path=${encodeURIComponent(path)}`)
    .then(response => {
        if (!response.ok) {
            // Check if the response is JSON, if not, parse as text for better error message
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json().then(err => { throw new Error(err.error || `HTTP error! Status: ${response.status}`); });
            } else {
                return response.text().then(text => { throw new Error(`HTTP error! Status: ${response.status}. Response: ${text.substring(0, 200)}...`); });
            }
        }
        return response.json();
    })
    .then(data => {
        currentBrowserPath = data.current_path;
        renderBrowser(data.items);
        document.getElementById('currentPathInput').value = currentBrowserPath;
    })
    .catch(error => {
        console.error('Error Browse directory:', error);
        alert('Error Browse directory: ' + error.message);
    });
}


function goUpDirectory() {
    const parentPath = currentBrowserPath.substring(0, currentBrowserPath.lastIndexOf('/'));
    if (parentPath === '') { // If already at root, stay at root
        browseDirectory('/');
    } else {
        browseDirectory(parentPath);
    }
}

function selectCurrentPath() {
    if (browserCallback) {
        browserCallback(currentBrowserPath);
    }
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('fileBrowserModal'));
    modal.hide();
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
});