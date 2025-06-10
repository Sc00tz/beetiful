document.addEventListener('DOMContentLoaded', () => {
    fetchLibrary();
    debugLibrary();
});

let currentPage = 1;
const itemsPerPage = 20;
let libraryData = [];
let filteredData = [];
let sortOrder = { column: null, direction: 'asc' };

function fetchLibrary() {
    fetch('/api/library')
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data.items)) {
                libraryData = data.items; 
                filteredData = libraryData; 
                showPage(currentPage);    
            } else {
                console.error('Unexpected data format:', data);
                document.getElementById('libraryResults').innerHTML = '<tr><td colspan="8">No library data found.</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error fetching library data:', error);
            document.getElementById('libraryResults').innerHTML = '<tr><td colspan="8">Error loading library data.</td></tr>';
        });
}

function showPage(page) {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const itemsToDisplay = filteredData.slice(start, end);

    populateLibrary(itemsToDisplay);
    updatePaginationControls();
}

function applyFilters() {
    const filterTitle = document.getElementById('filterTitle').value.toLowerCase();
    const filterArtist = document.getElementById('filterArtist').value.toLowerCase();
    const filterAlbum = document.getElementById('filterAlbum').value.toLowerCase();
    const filterGenre = document.getElementById('filterGenre').value.toLowerCase();
    const filterYear = document.getElementById('filterYear')?.value.toLowerCase() || '';
    const filterBPM = document.getElementById('filterBPM')?.value.toLowerCase() || '';
    const filterComposer = document.getElementById('filterComposer')?.value.toLowerCase() || '';

    filteredData = libraryData.filter(item => {
        return (
            (!filterTitle || item.title.toLowerCase().includes(filterTitle)) &&
            (!filterArtist || item.artist.toLowerCase().includes(filterArtist)) &&
            (!filterAlbum || item.album.toLowerCase().includes(filterAlbum)) &&
            (!filterGenre || item.genre.toLowerCase().includes(filterGenre)) &&
            (!filterYear || item.year.toLowerCase().includes(filterYear)) &&
            (!filterBPM || item.bpm.toLowerCase().includes(filterBPM)) &&
            (!filterComposer || item.composer.toLowerCase().includes(filterComposer))
        );
    });

    // Clear sorting when filtering
    document.querySelectorAll('th').forEach(th => th.classList.remove('asc', 'desc'));
    sortOrder = { column: null, direction: 'asc' };

    currentPage = 1; 
    showPage(currentPage);
}

function clearFilters() {
    // Clear all filter inputs
    document.getElementById('filterTitle').value = '';
    document.getElementById('filterArtist').value = '';
    document.getElementById('filterAlbum').value = '';
    document.getElementById('filterGenre').value = '';
    
    // Clear additional filters if they exist
    const filterYear = document.getElementById('filterYear');
    const filterBPM = document.getElementById('filterBPM');
    const filterComposer = document.getElementById('filterComposer');
    
    if (filterYear) filterYear.value = '';
    if (filterBPM) filterBPM.value = '';
    if (filterComposer) filterComposer.value = '';

    // Reset filtered data
    filteredData = libraryData;
    currentPage = 1;

    // Clear sorting
    document.querySelectorAll('th').forEach(th => th.classList.remove('asc', 'desc'));
    sortOrder = { column: null, direction: 'asc' };

    showPage(currentPage);
}

// Add event listeners for all filter inputs
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.filter-input').forEach(input => {
        input.addEventListener('input', () => {
            applyFilters();
        });
    });
});

function sortByColumn(column) {
    // Clear previous sort indicators
    document.querySelectorAll('#tableHeaders th').forEach(th => {
        th.classList.remove('asc', 'desc');
        th.querySelector('.sort-arrow')?.remove(); 
    });

    // Toggle sort direction
    if (sortOrder.column === column) {
        sortOrder.direction = sortOrder.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortOrder.column = column;
        sortOrder.direction = 'asc';
    }

    // Sort the data
    filteredData.sort((a, b) => {
        const aValue = Object.values(a)[column]?.toLowerCase() || '';
        const bValue = Object.values(b)[column]?.toLowerCase() || '';

        if (aValue < bValue) return sortOrder.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Update visual indicator
    const header = document.querySelector(`#tableHeaders th[data-column="${column}"]`);
    if (header) {
        header.classList.add(sortOrder.direction); 
        const arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        arrow.innerHTML = sortOrder.direction === 'asc' ? '▲' : '▼';
        header.appendChild(arrow);
    }

    showPage(currentPage); 
}

function updatePaginationControls() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginationControls = document.getElementById('paginationControls');
    paginationControls.innerHTML = '';

    const firstButton = document.createElement('button');
    firstButton.innerText = 'First';
    firstButton.disabled = currentPage === 1;
    firstButton.onclick = () => {
        currentPage = 1;
        showPage(currentPage);
    };
    paginationControls.appendChild(firstButton);

    const prevButton = document.createElement('button');
    prevButton.innerText = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            showPage(currentPage);
        }
    };
    paginationControls.appendChild(prevButton);

    // Show page numbers
    const maxButtons = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    const endPage = Math.min(totalPages, startPage + maxButtons - 1);

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.innerText = i;
        pageButton.disabled = i === currentPage;
        pageButton.classList.toggle('active-page', i === currentPage); 
        pageButton.onclick = () => {
            currentPage = i;
            showPage(currentPage);
        };
        paginationControls.appendChild(pageButton);
    }

    const nextButton = document.createElement('button');
    nextButton.innerText = 'Next';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            showPage(currentPage);
        }
    };
    paginationControls.appendChild(nextButton);

    const lastButton = document.createElement('button');
    lastButton.innerText = 'Last';
    lastButton.disabled = currentPage === totalPages;
    lastButton.onclick = () => {
        currentPage = totalPages;
        showPage(currentPage);
    };
    paginationControls.appendChild(lastButton);

    const pageInfo = document.createElement('span');
    pageInfo.innerText = ` Page ${currentPage} of ${totalPages} `;
    paginationControls.appendChild(pageInfo);
}

// Add click event listener for table headers
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tableHeaders').addEventListener('click', (event) => {
        const column = event.target.dataset.column;
        if (column !== undefined) {
            sortByColumn(parseInt(column));
        }
    });
});

function populateLibrary(items) {
    const libraryResults = document.getElementById('libraryResults');
    libraryResults.innerHTML = '';  

    items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.id = `track-row-${index}`;
        row.innerHTML = `
            <td title="${item.title || ''}">${item.title || ''}</td>
            <td title="${item.artist || ''}">${item.artist || ''}</td>
            <td title="${item.album || ''}">${item.album || ''}</td>
            <td title="${item.genre || ''}">${item.genre || ''}</td>
            <td title="${item.year || ''}">${item.year || ''}</td>
            <td title="${item.bpm || ''}">${item.bpm || ''}</td>
            <td title="${item.composer || ''}">${item.composer || ''}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="testEdit(${index})">
                    Edit
                </button>
            </td>
        `;
        libraryResults.appendChild(row);
    });
    
    // Store items globally so we can access them
    window.currentLibraryItems = items;
}

// Simple test function
function testEdit(index) {
    console.log('testEdit called with index:', index);
    
    if (window.currentLibraryItems && window.currentLibraryItems[index]) {
        const track = window.currentLibraryItems[index];
        console.log('Track data:', track);
        editTrack(track, index);
    } else {
        console.error('No track found at index:', index);
        alert('No track data found');
    }
}

function editTrack(track, rowIndex) {
    console.log('=== editTrack called ===');
    console.log('Track:', track);
    console.log('Row Index:', rowIndex);
    
    // Close any existing edit forms first
    closeEditForm();
    
    // Find the target row by ID
    const targetRow = document.getElementById(`track-row-${rowIndex}`);
    console.log('Looking for row ID:', `track-row-${rowIndex}`);
    console.log('Found target row:', targetRow);
    
    if (!targetRow) {
        console.error('Could not find target row:', `track-row-${rowIndex}`);
        alert('Could not find target row');
        return;
    }
    
    console.log('Creating form HTML...');
    
    // Create edit form HTML
    const formHtml = `
        <tr class="edit-form-row">
            <td colspan="8" style="background-color: #252525; padding: 20px;">
                <h3 style="color: white;">EDIT FORM TEST</h3>
                <p style="color: white;">Editing: ${track.title} by ${track.artist}</p>
                <button onclick="closeEditForm()" style="background: red; color: white; padding: 10px;">Close</button>
            </td>
        </tr>
    `;
    
    console.log('Inserting form HTML...');
    
    // Insert the form row right after the clicked row
    targetRow.insertAdjacentHTML('afterend', formHtml);
    
    console.log('Form should be inserted now');
}

function saveTrack(originalTitle, originalArtist, originalAlbum) {
    const updatedTrack = {
        title: document.getElementById('editTitle').value,
        artist: document.getElementById('editArtist').value,
        album: document.getElementById('editAlbum').value,
        year: document.getElementById('editYear').value,
        genre: document.getElementById('editGenre').value,
        composer: document.getElementById('editComposer').value,
        bpm: document.getElementById('editBpm').value,
        comments: document.getElementById('editComments').value,
    };

    fetch('/api/library/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalTitle, originalArtist, originalAlbum, updatedTrack })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message || 'Track updated successfully.');
        fetchLibrary();  
        closeEditForm();
    })
    .catch(error => {
        alert('Error updating track: ' + error.message);
    });
}

function removeTrack(title, artist, album) {
    if (!confirm('Are you sure you want to remove this track from the library?')) return;

    fetch('/api/library/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist, album })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Remove response:', data);
        if (data.message) {
            alert(data.message || 'Track removed successfully.');
        } else {
            alert('Failed to remove track: ' + (data.error || 'Unknown error.'));
        }
        fetchLibrary();  
        closeEditForm();
    })
    .catch(error => {
        console.error('Error removing track:', error);
        alert('Error removing track: ' + error.message);
    });
}

function deleteTrack(title, artist, album) {
    if (!confirm('Are you sure you want to delete this track? This action cannot be undone.')) return;

    fetch('/api/library/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist, album })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Delete response:', data);
        if (data.message) {
            alert(data.message || 'Track deleted successfully.');
        } else {
            alert('Failed to delete track: ' + (data.error || 'Unknown error.'));
        }
        fetchLibrary();  
        closeEditForm(); 
    })
    .catch(error => {
        console.error('Error deleting track:', error);
        alert('Error deleting track: ' + error.message);
    });
}

function closeEditForm() {
    // Remove any existing edit form rows
    const editRows = document.querySelectorAll('.edit-form-row');
    editRows.forEach(row => row.remove());
}

function debugLibrary() {
    fetch('/api/debug_library')
        .then(response => response.json())
        .then(data => {
            console.log('Raw items:', data.raw_items);
            console.log('Parsed items:', data.parsed_items);
        })
        .catch(error => console.error('Error fetching debug data:', error));
}

function confirmAction(action, title, artist, album) {
    const actionText = action === 'delete' ? 'delete this track? This action cannot be undone.' : 'remove this track from the library?';
    const modalHtml = `
        <div class="modal fade" id="confirmationModal" tabindex="-1" aria-labelledby="confirmationModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="confirmationModalLabel">Confirm Action</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        Are you sure you want to ${actionText}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" onclick="executeAction('${action}', '${title}', '${artist}', '${album}')">Confirm</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    confirmationModal.show();
}

function executeAction(action, title, artist, album) {
    const endpoint = action === 'delete' ? '/api/library/delete' : '/api/library/remove';
    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist, album })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        alert(data.message || `Track ${action}d successfully.`);
        fetchLibrary();  
        closeEditForm();
        document.getElementById('confirmationModal').remove();
    })
    .catch(error => {
        alert(`Error ${action}ing track: ${error.message}`);
        document.getElementById('confirmationModal').remove();
    });
}