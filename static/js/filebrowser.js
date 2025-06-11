// File browser modal and directory navigation logic for Beets web UI
// Handles browsing, selecting, and rendering directories

let currentBrowserPath = '/music';
let browserCallback = null;

/**
 * Opens the file browser modal.
 * @param {function} callback - The callback function to call with the selected path.
 * @param {string} [initialPath='/music'] - The initial path to display in the browser.
 */
function openFileBrowser(callback, initialPath = '/music') {
    browserCallback = callback;
    currentBrowserPath = initialPath;
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
                            <ul id="fileList" class="list-group"></ul>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const existingModal = document.getElementById('fileBrowserModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('fileBrowserModal'));
    modal.show();
    browseDirectory(initialPath);
}

/**
 * Renders the file and directory browser.
 * @param {Array} items - The list of files and directories to display.
 */
function renderBrowser(items) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
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
            if (item.size) li.innerHTML += `<span class="badge bg-secondary ms-2">${formatBytes(item.size)}</span>`;
        }
        fileList.appendChild(li);
    });
}

/**
 * Browses a directory and fetches its contents.
 * @param {string} path - The path of the directory to browse.
 */
function browseDirectory(path) {
    fetch(`/api/browse?path=${encodeURIComponent(path)}`)
    .then(response => {
        if (!response.ok) {
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
        alert('Error Browse directory: ' + error.message);
    });
}

/**
 * Navigates up to the parent directory.
 */
function goUpDirectory() {
    const parentPath = currentBrowserPath.substring(0, currentBrowserPath.lastIndexOf('/'));
    if (parentPath === '') {
        browseDirectory('/');
    } else {
        browseDirectory(parentPath);
    }
}

/**
 * Selects the current path and closes the modal.
 */
function selectCurrentPath() {
    if (browserCallback) browserCallback(currentBrowserPath);
    const modal = bootstrap.Modal.getInstance(document.getElementById('fileBrowserModal'));
    modal.hide();
}

/**
 * Formats bytes into a human-readable string.
 * @param {number} bytes - The number of bytes.
 * @param {number} [decimals=2] - The number of decimal places.
 * @returns {string} The formatted string.
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Adds a browse button next to the specified input field.
 * @param {string} inputId - The ID of the input field.
 * @param {string} [buttonText='Browse'] - The text to display on the button.
 */
function addBrowseButton(inputId, buttonText = 'Browse') {
    const input = document.getElementById(inputId);
    if (!input) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-secondary btn-sm ms-2';
    button.innerHTML = `<i class="fas fa-folder-open"></i> ${buttonText}`;
    button.onclick = () => {
        openFileBrowser((selectedPath) => {
            input.value = selectedPath;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }, input.value || '/music');
    };
    input.parentNode.insertBefore(button, input.nextSibling);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const importPath = document.getElementById('importPath');
        if (importPath && !importPath.parentNode.querySelector('.btn')) {
            addBrowseButton('importPath', 'Browse');
        }
    }, 1000);
});