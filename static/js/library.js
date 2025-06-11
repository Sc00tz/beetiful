// Music library management logic for Beets web UI
// Handles fetching, displaying, filtering, sorting, and editing tracks

let currentPage = 1;
const itemsPerPage = 20;
let libraryData = [];
let filteredData = [];
let sortOrder = { column: null, direction: 'asc' };

document.addEventListener('DOMContentLoaded', () => {
    fetchLibrary();
});

function fetchLibrary() {
    showLibrarySpinner();
    fetch('/api/library')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (Array.isArray(data.items)) {
                libraryData = data.items;
                applyFilters();
            } else {
                const libraryResults = document.getElementById('libraryResults');
                if (libraryResults) libraryResults.innerHTML = '<tr><td colspan="10">No library data found or unexpected format.</td></tr>';
            }
        })
        .catch(error => {
            const libraryResults = document.getElementById('libraryResults');
            if (libraryResults) libraryResults.innerHTML = `<tr><td colspan="10">Error loading library data: ${error.message}. Please ensure the backend is running and Beets library is accessible.</td></tr>`;
        });
}

function showLibrarySpinner(message = 'Loading library...') {
    const libraryResults = document.getElementById('libraryResults');
    if (libraryResults) libraryResults.innerHTML = `<tr><td colspan="10" class="text-center"><i class="fas fa-spinner fa-spin"></i> ${message}</td></tr>`;
}

function displayLibrary() {
    const libraryResults = document.getElementById('libraryResults');
    if (!libraryResults) return;
    libraryResults.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToDisplay = filteredData.slice(startIndex, endIndex);
    if (itemsToDisplay.length === 0) {
        libraryResults.innerHTML = '<tr><td colspan="10">No tracks found matching your criteria.</td></tr>';
        updatePagination(0);
        return;
    }
    itemsToDisplay.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.title || 'N/A'}</td>
            <td>${item.artist || 'N/A'}</td>
            <td>${item.album || 'N/A'}</td>
            <td>${item.genre || 'N/A'}</td>
            <td>${item.year || 'N/A'}</td>
            <td>${item.length ? formatLength(item.length) : 'N/A'}</td>
            <td>${item.bitrate ? formatBitrate(item.bitrate) : 'N/A'}</td>
            <td>${item.path || 'N/A'}</td>
            <td class="text-nowrap">
                <button class="btn btn-sm btn-info me-1" onclick="openEditModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-light me-1" onclick="openLyricsModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                    <i class="fas fa-file-alt"></i> Lyrics
                </button>
                <button class="btn btn-sm btn-danger" onclick="confirmAction('remove', '${item.title}', '${item.artist}', '${item.album}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </td>
        `;
        libraryResults.appendChild(row);
    });
    updatePagination(filteredData.length);
}

function applyFilters() {
    const filterInput = document.getElementById('filterInput');
    const searchTerm = filterInput ? filterInput.value.toLowerCase() : '';
    const genreFilterElement = document.getElementById('genreFilter');
    const genreFilter = genreFilterElement ? genreFilterElement.value.toLowerCase() : '';
    filteredData = [...libraryData];
    if (searchTerm) {
        filteredData = filteredData.filter(item =>
            (item.title && item.title.toLowerCase().includes(searchTerm)) ||
            (item.artist && item.artist.toLowerCase().includes(searchTerm)) ||
            (item.album && item.album.toLowerCase().includes(searchTerm)) ||
            (item.genre && item.genre.toLowerCase().includes(searchTerm))
        );
    }
    if (genreFilter) {
        filteredData = filteredData.filter(item =>
            item.genre && item.genre.toLowerCase().includes(genreFilter)
        );
    }
    populateGenreFilter();
    sortData();
    currentPage = 1;
    displayLibrary();
}

function sortData() {
    if (!sortOrder.column) return;
    const column = sortOrder.column;
    const direction = sortOrder.direction === 'asc' ? 1 : -1;
    filteredData.sort((a, b) => {
        const valA = a[column] || '';
        const valB = b[column] || '';
        if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * direction;
        if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * direction;
        return String(valA).localeCompare(String(valB)) * direction;
    });
    displayLibrary();
}

function sortLibrary(column) {
    if (sortOrder.column === column) {
        sortOrder.direction = sortOrder.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortOrder.column = column;
        sortOrder.direction = 'asc';
    }
    updateSortIndicators();
    sortData();
}

function updateSortIndicators() {
    document.querySelectorAll('.sortable').forEach(header => {
        const column = header.getAttribute('data-sort');
        const icon = header.querySelector('i');
        if (icon) icon.remove();
        if (sortOrder.column === column) {
            const newIcon = document.createElement('i');
            newIcon.classList.add('fas', sortOrder.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down', 'ms-2');
            header.appendChild(newIcon);
        }
    });
}

function populateGenreFilter() {
    const genreFilter = document.getElementById('genreFilter');
    if (!genreFilter) return;
    genreFilter.innerHTML = '<option value="">All Genres</option>';
    const genres = new Set();
    filteredData.forEach(item => {
        if (item.genre) {
            item.genre.split(/[,/;]/).forEach(g => {
                const trimmedGenre = g.trim();
                if (trimmedGenre) genres.add(trimmedGenre);
            });
        }
    });
    Array.from(genres).sort().forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.toLowerCase();
        option.textContent = genre;
        genreFilter.appendChild(option);
    });
}

function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const pageInfoElement = document.getElementById('pageInfo') || 
                           document.querySelector('.text-light span:nth-child(1)') ||
                           document.querySelector('span:contains("Page")');
    if (pageInfoElement) pageInfoElement.textContent = `Page ${currentPage} of ${totalPages}`;
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage === 1;
        prevPageBtn.onclick = prevPage;
    }
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
        nextPageBtn.onclick = nextPage;
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayLibrary();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayLibrary();
    }
}

function formatLength(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function formatBitrate(bitrate) {
    if (typeof bitrate !== 'number' || isNaN(bitrate) || bitrate < 0) return 'N/A';
    return `${Math.round(bitrate / 1000)} kbps`;
}

let currentEditItem = null;

function openEditModal(item) {
    currentEditItem = item;
    document.getElementById('editTitle').value = item.title || '';
    document.getElementById('editArtist').value = item.artist || '';
    document.getElementById('editAlbum').value = item.album || '';
    document.getElementById('editGenre').value = item.genre || '';
    document.getElementById('editYear').value = item.year || '';
    document.getElementById('editModalLabel').textContent = `Edit: ${item.title || 'N/A'}`;
    const editModal = new bootstrap.Modal(document.getElementById('editModal'));
    editModal.show();
}

function saveChanges() {
    if (!currentEditItem) return;
    const title = document.getElementById('editTitle').value.trim();
    const artist = document.getElementById('editArtist').value.trim();
    if (!title || !artist) {
        alert('Title and Artist are required.');
        return;
    }
    const updates = {
        title: document.getElementById('editTitle').value,
        artist: document.getElementById('editArtist').value,
        album: document.getElementById('editAlbum').value,
        genre: document.getElementById('editGenre').value,
        year: document.getElementById('editYear').value,
    };
    fetch('/api/library/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentEditItem.id, updates: updates })
    })
    .then(response => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        return response.json();
    })
    .then(data => {
        alert(data.message || 'Changes saved successfully!');
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
        if (editModal) editModal.hide();
        fetchLibrary();
    })
    .catch(error => {
        alert(`Error saving changes: ${error.message}`);
    });
}

function openLyricsModal(item) {
    document.getElementById('lyricsModalLabel').textContent = `Lyrics: ${item.title || 'N/A'} - ${item.artist || 'N/A'}`;
    const lyricsContent = document.getElementById('lyricsContent');
    lyricsContent.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading lyrics...</div>';
    fetch(`/api/library/lyrics/${item.id}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            let lyrics = '';
            if (typeof data.lyrics === 'string') {
                lyrics = data.lyrics;
            } else if (data.lyrics) {
                lyrics = String(data.lyrics);
            }
            if (lyricsContent) {
                if (lyrics.trim()) {
                    const formattedLyrics = lyrics.replace(/\n/g, '<br>');
                    lyricsContent.innerHTML = `
                        <div class="lyrics-container">
                            <div class="mb-3">
                                <button class="btn btn-sm btn-primary me-2" onclick="editLyrics('${item.id}', '${item.title}', '${item.artist}')">
                                    <i class="fas fa-edit"></i> Edit Lyrics
                                </button>
                                <button class="btn btn-sm btn-info" onclick="fetchLyrics('${item.id}')">
                                    <i class="fas fa-download"></i> Fetch from Web
                                </button>
                            </div>
                            <div class="lyrics-text bg-dark p-3 rounded text-start" style="white-space: pre-wrap; max-height: 400px; overflow-y: auto;">
                                ${formattedLyrics}
                            </div>
                        </div>
                    `;
                } else {
                    lyricsContent.innerHTML = `
                        <div class="text-center text-muted">
                            <p><i class="fas fa-music"></i> No lyrics found for this track.</p>
                            <div class="mt-3">
                                <button class="btn btn-primary me-2" onclick="editLyrics('${item.id}', '${item.title}', '${item.artist}')">
                                    <i class="fas fa-edit"></i> Add Lyrics Manually
                                </button>
                                <button class="btn btn-info" onclick="fetchLyrics('${item.id}')">
                                    <i class="fas fa-download"></i> Fetch from Web
                                </button>
                            </div>
                        </div>
                    `;
                }
            }
        })
        .catch(error => {
            lyricsContent.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i> Error loading lyrics: ${error.message}
                    <div class="mt-2">
                        <button class="btn btn-sm btn-primary" onclick="editLyrics('${item.id}', '${item.title}', '${item.artist}')">
                            <i class="fas fa-edit"></i> Add Lyrics Manually
                        </button>
                    </div>
                </div>
            `;
        });
    const lyricsModal = new bootstrap.Modal(document.getElementById('lyricsModal'));
    lyricsModal.show();
}

function editLyrics(trackId, title, artist) {
    const lyricsModal = bootstrap.Modal.getInstance(document.getElementById('lyricsModal'));
    if (lyricsModal) lyricsModal.hide();
    const modalId = 'editLyricsModal';
    let modalElement = document.getElementById(modalId);
    if (modalElement) modalElement.remove();
    modalElement = document.createElement('div');
    modalElement.className = 'modal fade';
    modalElement.id = modalId;
    modalElement.setAttribute('tabindex', '-1');
    modalElement.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content bg-dark text-light">
                <div class="modal-header border-secondary">
                    <h5 class="modal-title">Edit Lyrics: ${title} - ${artist}</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <textarea id="lyricsEditor" class="form-control bg-secondary text-light border-secondary" 
                              rows="15" placeholder="Enter lyrics here..."></textarea>
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="saveLyrics('${trackId}')">
                        <i class="fas fa-save"></i> Save Lyrics
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalElement);
    fetch(`/api/library/lyrics/${trackId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('lyricsEditor').value = data.lyrics || '';
        });
    const editModal = new bootstrap.Modal(modalElement);
    editModal.show();
}

function saveLyrics(trackId) {
    const lyrics = document.getElementById('lyricsEditor').value;
    fetch(`/api/library/lyrics/${trackId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lyrics: lyrics })
    })
    .then(response => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        return response.json();
    })
    .then(data => {
        alert('Lyrics saved successfully!');
        const modal = bootstrap.Modal.getInstance(document.getElementById('editLyricsModal'));
        if (modal) modal.hide();
        document.getElementById('editLyricsModal').remove();
    })
    .catch(error => {
        alert(`Error saving lyrics: ${error.message}`);
    });
}

function fetchLyrics(trackId) {
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
    button.disabled = true;
    fetch(`/api/library/fetch-lyrics/${trackId}`, { method: 'POST' })
    .then(response => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        return response.json();
    })
    .then(data => {
        alert('Lyrics fetch completed! Check the lyrics again.');
        const modal = bootstrap.Modal.getInstance(document.getElementById('lyricsModal'));
        if (modal) modal.hide();
    })
    .catch(error => {
        alert(`Error fetching lyrics: ${error.message}`);
    })
    .finally(() => {
        button.innerHTML = originalText;
        button.disabled = false;
    });
}

function saveTrackChanges() {
    saveChanges();
}

function confirmAction(action, title, artist, album) {
    const modalId = 'confirmationModal';
    let modalElement = document.getElementById(modalId);
    if (modalElement) modalElement.remove();
    modalElement = document.createElement('div');
    modalElement.className = 'modal fade';
    modalElement.id = modalId;
    modalElement.setAttribute('tabindex', '-1');
    modalElement.setAttribute('aria-labelledby', 'confirmationModalLabel');
    modalElement.setAttribute('aria-hidden', 'true');
    modalElement.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content bg-dark text-light">
                <div class="modal-header border-secondary">
                    <h5 class="modal-title" id="confirmationModalLabel">Confirm Action</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    Are you sure you want to ${action} "${title}" by "${artist}" from album "${album}"?
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="confirmActionButton">
                        ${action === 'remove' ? 'Remove Permanently' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalElement);
    const confirmButton = document.getElementById('confirmActionButton');
    confirmButton.onclick = () => { performAction(action, title, artist, album); };
    const confirmationModal = new bootstrap.Modal(modalElement);
    confirmationModal.show();
}

function performAction(action, title, artist, album) {
    const endpoint = action === 'delete' ? '/api/library/delete' : '/api/library/remove';
    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist, album })
    })
    .then(response => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        return response.json();
    })
    .then(data => {
        alert(data.message || `Track ${action}d successfully.`);
        fetchLibrary();
        const modalElement = document.getElementById('confirmationModal');
        if (modalElement) {
            const bootstrapModal = bootstrap.Modal.getInstance(modalElement);
            if (bootstrapModal) bootstrapModal.hide();
        }
    })
    .catch(error => {
        alert(`Error performing action: ${error.message}`);
    });
}

// Remove or comment out old table-based library rendering logic if present
// (The new tabbed view now handles library display)