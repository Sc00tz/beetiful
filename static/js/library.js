document.addEventListener('DOMContentLoaded', () => {
    fetchLibrary();
    // Removed debugLibrary() as it is not defined and causes a ReferenceError.
});

let currentPage = 1;
const itemsPerPage = 20;
let libraryData = [];
let filteredData = [];
let sortOrder = { column: null, direction: 'asc' }; // Stores current sort column and direction

/**
 * Fetches the music library data from the backend API.
 * Updates global libraryData and filteredData, then displays the first page.
 */
function fetchLibrary() {
    fetch('/api/library')
        .then(response => {
            if (!response.ok) {
                // Check for HTTP errors
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (Array.isArray(data.items)) {
                libraryData = data.items;
                applyFilters(); // Apply filters immediately after fetching
            } else {
                console.error('Unexpected data format for library:', data);
                document.getElementById('libraryResults').innerHTML = '<tr><td colspan="10">No library data found or unexpected format.</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error fetching library data:', error);
            // Updated error message for better user guidance
            document.getElementById('libraryResults').innerHTML = `<tr><td colspan="10">Error loading library data: ${error.message}. Please ensure the backend is running and Beets library is accessible.</td></tr>`;
        });
}

/**
 * Renders the current page of filtered and sorted library data to the table.
 */
function displayLibrary() {
    const libraryResults = document.getElementById('libraryResults');
    libraryResults.innerHTML = ''; // Clear previous results

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

/**
 * Applies filters based on user input and updates the displayed library.
 */
function applyFilters() {
    // Safely get element values, handling cases where elements might not exist yet
    const filterInput = document.getElementById('filterInput');
    const searchTerm = filterInput ? filterInput.value.toLowerCase() : '';

    const genreFilterElement = document.getElementById('genreFilter');
    const genreFilter = genreFilterElement ? genreFilterElement.value.toLowerCase() : '';

    // Initialize filteredData with a copy of libraryData to prevent direct modification
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

    populateGenreFilter(); // Re-populate to show only genres in current filtered view

    sortData(); // Apply sorting after filtering
    currentPage = 1; // Reset to first page after filtering
    displayLibrary();
}

/**
 * Sorts the filtered data based on the current sort order.
 */
function sortData() {
    if (!sortOrder.column) {
        return; // No column to sort by
    }

    const column = sortOrder.column;
    const direction = sortOrder.direction === 'asc' ? 1 : -1;

    filteredData.sort((a, b) => {
        const valA = a[column] || ''; // Handle null/undefined values
        const valB = b[column] || ''; // Handle null/undefined values

        if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB) * direction;
        }
        // Numeric comparison for numbers, fallback to string for others
        if (typeof valA === 'number' && typeof valB === 'number') {
            return (valA - valB) * direction;
        }
        return String(valA).localeCompare(String(valB)) * direction;
    });

    displayLibrary(); // Re-display sorted data
}

/**
 * Handles sorting when a column header is clicked.
 * @param {string} column The data key to sort by (e.g., 'title', 'artist').
 */
function handleSort(column) {
    if (sortOrder.column === column) {
        sortOrder.direction = sortOrder.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortOrder.column = column;
        sortOrder.direction = 'asc';
    }
    updateSortIndicators();
    sortData();
}

/**
 * Updates the sort indicators (arrows) in the table headers.
 */
function updateSortIndicators() {
    document.querySelectorAll('.sortable').forEach(header => {
        const column = header.getAttribute('data-sort');
        const icon = header.querySelector('i');
        if (icon) {
            icon.remove(); // Remove existing icon
        }

        if (sortOrder.column === column) {
            const newIcon = document.createElement('i');
            newIcon.classList.add('fas', sortOrder.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down', 'ms-2');
            header.appendChild(newIcon);
        }
    });
}

/**
 * Populates the genre filter dropdown with unique genres from the library data.
 */
function populateGenreFilter() {
    const genreFilter = document.getElementById('genreFilter');
    // Clear existing options, but keep "All Genres"
    genreFilter.innerHTML = '<option value="">All Genres</option>'; 

    const genres = new Set();
    filteredData.forEach(item => { // Use filteredData to show relevant genres
        if (item.genre) {
            // Split genres by common delimiters like '/' or ',' or ';'
            item.genre.split(/[,/;]/).forEach(g => {
                const trimmedGenre = g.trim();
                if (trimmedGenre) {
                    genres.add(trimmedGenre);
                }
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

/**
 * Updates the pagination controls based on the total number of items.
 * @param {number} totalItems The total number of items after filtering.
 */
function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;

    // Attach event listeners to pagination buttons
    document.getElementById('prevPage').onclick = prevPage;
    document.getElementById('nextPage').onclick = nextPage;
}

/**
 * Navigates to the previous page.
 */
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayLibrary();
    }
}

/**
 * Navigates to the next page.
 */
function nextPage() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayLibrary();
    }
}

/**
 * Formats a length in seconds into a human-readable string (MM:SS).
 * @param {number} seconds The length in seconds.
 * @returns {string} Formatted length string.
 */
function formatLength(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
        return 'N/A';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

/**
 * Formats bitrate from bits per second to kbps.
 * @param {number} bitrate The bitrate in bits per second.
 * @returns {string} Formatted bitrate string.
 */
function formatBitrate(bitrate) {
    if (typeof bitrate !== 'number' || isNaN(bitrate) || bitrate < 0) {
        return 'N/A';
    }
    return `${Math.round(bitrate / 1000)} kbps`;
}


// --- Modal related functions ---

let currentEditItem = null; // Stores the item being edited

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

    const updates = {
        title: document.getElementById('editTitle').value,
        artist: document.getElementById('editArtist').value,
        album: document.getElementById('editAlbum').value,
        genre: document.getElementById('editGenre').value,
        year: document.getElementById('editYear').value,
        // Add other fields as necessary
    };

    fetch('/api/library/edit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: currentEditItem.id, updates: updates })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message || 'Changes saved successfully!');
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
        if (editModal) editModal.hide();
        fetchLibrary(); // Re-fetch library to update the view
    })
    .catch(error => {
        console.error('Error saving changes:', error);
        alert(`Error saving changes: ${error.message}`);
    });
}

function openLyricsModal(item) {
    document.getElementById('lyricsModalLabel').textContent = `Lyrics: ${item.title || 'N/A'} - ${item.artist || 'N/A'}`;
    const lyricsContent = document.getElementById('lyricsContent');
    lyricsContent.innerHTML = 'Loading lyrics...'; // Show loading message

    // Assuming a Beets plugin or external API for lyrics, 
    // for now, we'll just show a placeholder or a 'Not Available' message.
    // In a real scenario, you'd make an API call here.
    // Example: fetch(`/api/lyrics?id=${item.id}`)
    
    // Placeholder for actual lyrics fetching:
    // This part requires a backend endpoint to fetch lyrics.
    // For now, we'll display a static message.
    setTimeout(() => {
        lyricsContent.innerHTML = `<p class="text-muted">Lyrics fetching functionality would go here.</p><p>For track: <strong>${item.title || 'N/A'}</strong> by <strong>${item.artist || 'N/A'}</strong></p>`;
    }, 500); // Simulate loading

    const lyricsModal = new bootstrap.Modal(document.getElementById('lyricsModal'));
    lyricsModal.show();
}

function confirmAction(action, title, artist, album) {
    // Create a new modal element each time to avoid issues with Bootstrap's lifecycle
    const modalId = 'confirmationModal';
    let modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.remove(); // Remove existing modal if it somehow persists
    }

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
    confirmButton.onclick = () => {
        performAction(action, title, artist, album);
    };

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
        if (!response.ok) {
            // Check for HTTP errors and parse response for detailed error message
            return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message || `Track ${action}d successfully.`);
        fetchLibrary(); // Re-fetch library to update the view
        // Remove the confirmation modal from the DOM
        const modalElement = document.getElementById('confirmationModal');
        if (modalElement) {
            bootstrap.Modal.getInstance(modalElement)?.hide(); // Hide if Bootstrap modal instance exists
            modalElement.remove(); // Then remove from DOM
        }
    })
    .catch(error => {
        console.error(`Error ${action}ing track:`, error);
        alert(`Error ${action}ing track: ${error.message}`);
        // Ensure modal is closed even on error
        const modalElement = document.getElementById('confirmationModal');
        if (modalElement) {
            bootstrap.Modal.getInstance(modalElement)?.hide();
            modalElement.remove();
        }
    });
}