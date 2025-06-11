// Main logic for Beetiful web UI
// Handles stats, config, command execution, and UI setup

function getStats() {
    showGlobalSpinner('Loading stats...');
    fetch('/api/stats')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            const tracks = data.total_tracks || '0';
            const artists = data.total_artists || '0';
            const albums = data.total_albums || '0';
            ['totalTracks', 'statusTotalTracks'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = tracks;
            });
            ['totalArtists', 'statusTotalArtists'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = artists;
            });
            ['totalAlbums', 'statusTotalAlbums'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = albums;
            });
        })
        .catch(() => {
            ['totalTracks', 'totalArtists', 'totalAlbums', 'statusTotalTracks', 'statusTotalArtists', 'statusTotalAlbums'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = 'Error';
            });
        })
        .finally(hideGlobalSpinner);
}

function viewConfig() {
    showGlobalSpinner('Loading config...');
    fetch('/api/config')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            const configEditor = document.getElementById('configEditor');
            if (configEditor) configEditor.value = data.config || '';
        })
        .catch(error => {
            const configMessage = document.getElementById('configMessage');
            if (configMessage) configMessage.innerHTML = `<div class="alert alert-danger">Error loading config: ${error.message}</div>`;
        })
        .finally(hideGlobalSpinner);
}

function saveConfig() {
    const configEditor = document.getElementById('configEditor');
    const configMessageDiv = document.getElementById('configMessage');
    if (!configEditor || !configMessageDiv) return;
    const configContent = configEditor.value;
    if (!configContent.trim()) {
        configMessageDiv.innerHTML = '<div class="alert alert-warning">Configuration cannot be empty</div>';
        return;
    }
    configMessageDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving configuration...';
    configMessageDiv.className = 'mt-3 text-info';
    try {
        jsyaml.load(configContent);
    } catch (yamlError) {
        configMessageDiv.innerHTML = `<div class="alert alert-danger">Invalid YAML syntax: ${yamlError.message}</div>`;
        configMessageDiv.className = 'mt-3 text-danger';
        return;
    }
    showGlobalSpinner('Saving config...');
    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configContent })
    })
    .then(response => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        return response.json();
    })
    .then(data => {
        configMessageDiv.innerHTML = `<div class="alert alert-success">${data.message || 'Configuration saved successfully!'}</div>`;
        configMessageDiv.className = 'mt-3 text-success';
        setTimeout(viewConfig, 1000);
    })
    .catch(error => {
        configMessageDiv.innerHTML = `<div class="alert alert-danger">Error saving config: ${error.message}</div>`;
        configMessageDiv.className = 'mt-3 text-danger';
    })
    .finally(hideGlobalSpinner);
}

function setupCommandDropdown() {
    const commandDropdown = document.getElementById('command');
    if (!commandDropdown) return;
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
    if (!optionsDiv) return;
    optionsDiv.innerHTML = '';
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
        openFileBrowser(selectedPath => {
            const importPath = document.getElementById('importPath');
            if (importPath) importPath.value = selectedPath;
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
    switch(command) {
        case 'import':
            const importPath = document.getElementById('importPath').value;
            if (!importPath) {
                alert('Please specify a path to import');
                return;
            }
            const quotedPath = importPath.includes(' ') ? `"${importPath}"` : importPath;
            args.push(quotedPath);
            if (document.getElementById('linkCheckbox').checked) {
                args.push('-l');
            } else if (document.getElementById('moveCheckbox').checked) {
                args.push('-m');
            } else if (document.getElementById('copyCheckbox').checked) {
                args.push('-c');
            }
            if (document.getElementById('autotagCheckbox').checked) {
                args.push('-t');
            } else {
                args.push('-A');
            }
            if (document.getElementById('incrementalCheckbox').checked) {
                args.push('-i');
            }
            if (document.getElementById('skipCheckbox').checked) {
                args.push('-s');
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
            if (query) args.push(query);
            args.push(`${field}=${value}`);
            break;
        case 'update':
        case 'list':
            const queryBasic = document.getElementById('query').value;
            if (queryBasic) args.push(queryBasic);
            break;
        case 'config':
            const configAction = document.getElementById('configAction').value;
            if (configAction) args.push(configAction);
            break;
    }
    if (additionalArgs) args.push(additionalArgs);
    const commandResultDiv = document.getElementById('commandResult');
    if (!commandResultDiv) return;
    commandResultDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Executing ${command}...`;
    commandResultDiv.className = 'mt-2 text-info';
    showGlobalSpinner(`Executing ${command}...`);
    fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command, args: args.join(' ') })
    })
    .then(response => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        return response.json();
    })
    .then(data => {
        let displayMessage = '';
        if (data.message) displayMessage += `<i class="fas fa-check-circle"></i> ${data.message}`;
        if (data.output) displayMessage += `<br><strong>Output:</strong><pre class="mt-2 bg-dark p-2 rounded">${data.output}</pre>`;
        if (data.error) displayMessage += `<br><span class="text-warning"><i class="fas fa-exclamation-triangle"></i> Warnings/Errors:</span><pre class="mt-2 bg-dark p-2 rounded text-warning">${data.error}</pre>`;
        commandResultDiv.innerHTML = displayMessage || '<i class="fas fa-check-circle"></i> Command completed';
        commandResultDiv.className = 'mt-2 text-success';
        if (['import', 'modify', 'remove', 'update'].includes(command)) {
            if (typeof fetchLibrary === 'function') fetchLibrary();
            getStats();
        }
    })
    .catch(error => {
        commandResultDiv.innerHTML = `<i class="fas fa-times-circle"></i> Error: ${error.message}`;
        commandResultDiv.className = 'mt-2 text-danger';
    })
    .finally(hideGlobalSpinner);
}

function fetchAndDisplayLyrics(trackId) {
    let track = null;
    if (window.lastLoadedTracks && Array.isArray(window.lastLoadedTracks)) {
        track = window.lastLoadedTracks.find(t => String(t.id) === String(trackId));
    }
    if (!track) {
        track = { id: trackId };
    }
    window.openLyricsModal(track);
}

function showGlobalSpinner(message = 'Loading...') {
    let spinner = document.getElementById('globalSpinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'globalSpinner';
        spinner.style.position = 'fixed';
        spinner.style.top = '0';
        spinner.style.left = '0';
        spinner.style.width = '100vw';
        spinner.style.height = '100vh';
        spinner.style.background = 'rgba(0,0,0,0.4)';
        spinner.style.zIndex = '9999';
        spinner.style.display = 'flex';
        spinner.style.alignItems = 'center';
        spinner.style.justifyContent = 'center';
        spinner.innerHTML = `<div class="text-center"><div class="spinner-border text-light" role="status"></div><div class="mt-2 text-light">${message}</div></div>`;
        document.body.appendChild(spinner);
    } else {
        spinner.style.display = 'flex';
        spinner.querySelector('div.text-center div.mt-2').textContent = message;
    }
}

function hideGlobalSpinner() {
    const spinner = document.getElementById('globalSpinner');
    if (spinner) spinner.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    setupCommandDropdown();
    getStats();
    viewConfig();
    setupImportCheckboxes();
    setupLibraryView();
});

window.addEventListener('DOMContentLoaded', () => {
    const libraryTab = document.getElementById('library-tab');
    if (libraryTab) {
        libraryTab.addEventListener('click', () => {
            setupLibraryView();
        });
        if (libraryTab.classList.contains('active')) {
            setupLibraryView();
        }
    }
});

function setupImportCheckboxes() {
    document.addEventListener('change', event => {
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

window.onload = function() {
    getStats();
};

// Library view overhaul: tabbed navigation for Artists and Albums
function setupLibraryView() {
    const libraryTabs = document.getElementById('libraryTabs');
    const libraryContent = document.getElementById('libraryContent');
    if (!libraryTabs || !libraryContent) return;

    libraryTabs.innerHTML = `
        <ul class="nav nav-tabs">
            <li class="nav-item"><a class="nav-link active" id="tab-artists" href="#">Artists</a></li>
            <li class="nav-item"><a class="nav-link" id="tab-albums" href="#">Albums</a></li>
        </ul>
    `;

    document.getElementById('tab-artists').onclick = (e) => {
        e.preventDefault();
        showArtistsTab();
        setActiveTab('tab-artists');
    };
    document.getElementById('tab-albums').onclick = (e) => {
        e.preventDefault();
        showAlbumsTab();
        setActiveTab('tab-albums');
    };
    showArtistsTab();

    // Add event delegation for artist cards
    libraryContent.addEventListener('click', function(e) {
        const card = e.target.closest('.artist-card');
        if (card && card.querySelector('.card-title')) {
            const artistName = card.querySelector('.card-title').textContent;
            showArtistAlbums(artistName);
        }
    });
}

function setActiveTab(tabId) {
    document.querySelectorAll('#libraryTabs .nav-link').forEach(link => link.classList.remove('active'));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');
}

// Update showArtistsTab to display artist image if available
function showArtistsTab() {
    const libraryContent = document.getElementById('libraryContent');
    libraryContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading artists...</div>';
    fetch('/api/library/artists')
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showLibraryError(data.error, true);
                return;
            }
            if (data.message) {
                showLibraryError(data.message, true);
                return;
            }
            if (!data.artists || data.artists.length === 0) {
                showLibraryError('No artists found. Please import your music.', false);
                return;
            }
            let html = '<div class="row row-cols-2 row-cols-md-4 g-3">';
            data.artists.forEach(artist => {
                if (!artist.name || artist.name === '$artist') return;
                html += `
                <div class="col">
                    <div class="card h-100 artist-card">
                        <img src="${artist.cover_art ? '/api/library/cover/' + encodeURIComponent(artist.cover_art) : '/static/img/artist-placeholder.png'}" class="card-img-top artist-cover" alt="Artist Cover">
                        <div class="card-body text-center">
                            <h5 class="card-title">${artist.name}</h5>
                            ${!artist.cover_art ? `<form class='artist-upload-form' data-artist='${encodeURIComponent(artist.name)}' enctype='multipart/form-data'>
                                <input type='file' name='image' accept='image/*' class='form-control form-control-sm mb-2' required />
                                <button type='submit' class='btn btn-sm btn-primary'>Upload Image</button>
                            </form>` : ''}
                        </div>
                    </div>
                </div>`;
            });
            html += '</div>';
            libraryContent.innerHTML = html;

            // Add upload handler for each form
            document.querySelectorAll('.artist-upload-form').forEach(form => {
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    const artist = decodeURIComponent(this.getAttribute('data-artist'));
                    const fileInput = this.querySelector('input[type="file"]');
                    if (!fileInput.files.length) return;
                    const formData = new FormData();
                    formData.append('image', fileInput.files[0]);
                    fetch(`/api/library/artist-image/${encodeURIComponent(artist)}`, {
                        method: 'POST',
                        body: formData
                    })
                    .then(res => res.json())
                    .then(resp => {
                        if (resp.message) {
                            showArtistsTab(); // Refresh view
                        } else {
                            alert(resp.error || 'Upload failed');
                        }
                    })
                    .catch(() => alert('Upload failed'));
                });
            });
        })
        .catch(() => showLibraryError('Failed to load artists. Please check your backend and beets library.', true));
}

function showArtistAlbums(artistName) {
    const libraryContent = document.getElementById('libraryContent');
    libraryContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading albums...</div>';
    fetch(`/api/library/albums/by-artist/${encodeURIComponent(artistName)}`)
        .then(res => res.json())
        .then(data => {
            let html = `<button class="btn btn-link mb-3" onclick="setupLibraryView()">&larr; Back to Artists</button>`;
            // Show artist image if available
            fetch('/api/library/artists')
                .then(res => res.json())
                .then(artistsData => {
                    const artistObj = (artistsData.artists || []).find(a => a.name === artistName);
                    if (artistObj && artistObj.cover_art) {
                        html += `<div class="text-center mb-4"><img src="/api/library/cover/${encodeURIComponent(artistObj.cover_art)}" class="artist-cover rounded shadow" style="max-width:220px;max-height:220px;object-fit:contain;"></div>`;
                    }
                    html += `<h3 class="mb-4 text-center">${artistName}</h3>`;
                    if (!data.albums || data.albums.length === 0) {
                        html += '<div class="alert alert-warning text-center">No albums found for this artist.</div>';
                    } else {
                        html += '<div class="row row-cols-2 row-cols-md-4 g-3">';
                        data.albums.forEach(album => {
                            if (!album.album || album.album === '$album') return;
                            html += `
                            <div class="col">
                                <div class="card h-100 album-card" onclick="showAlbumTracks('${encodeURIComponent(artistName)}','${encodeURIComponent(album.album)}')">
                                    <img src="${album.cover_art && album.cover_art !== '$albumart' ? '/api/library/cover/' + encodeURIComponent(album.cover_art) : '/static/img/album-placeholder.png'}" class="card-img-top album-cover" alt="Album Cover">
                                    <div class="card-body text-center"><h6 class="card-title">${album.album}</h6></div>
                                </div>
                            </div>`;
                        });
                        html += '</div>';
                    }
                    libraryContent.innerHTML = html;
                });
        });
}

function showAlbumsTab() {
    const libraryContent = document.getElementById('libraryContent');
    libraryContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading albums...</div>';
    fetch('/api/library/albums')
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showLibraryError(data.error, true);
                return;
            }
            if (data.message) {
                showLibraryError(data.message, true);
                return;
            }
            if (!data.albums || data.albums.length === 0) {
                showLibraryError('No albums found. Please import your music.', false);
                return;
            }
            let html = '<div class="row row-cols-2 row-cols-md-4 g-3">';
            data.albums.forEach(album => {
                if (!album.album || album.album === '$album') return;
                html += `
                <div class="col">
                    <div class="card h-100 album-card" onclick="showAlbumTracks('${encodeURIComponent(album.artist)}','${encodeURIComponent(album.album)}')">
                        <img src="${album.cover_art && album.cover_art !== '$albumart' ? '/api/library/cover/' + encodeURIComponent(album.cover_art) : '/static/img/album-placeholder.png'}" class="card-img-top album-cover" alt="Album Cover">
                        <div class="card-body text-center"><h6 class="card-title">${album.album}</h6><div class="text-muted small">${album.artist}</div></div>
                    </div>
                </div>`;
            });
            html += '</div>';
            libraryContent.innerHTML = html;
        })
        .catch(() => showLibraryError('Failed to load albums. Please check your backend and beets library.', true));
}

function showAlbumTracks(artistName, albumName) {
    const libraryContent = document.getElementById('libraryContent');
    libraryContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading tracks...</div>';
    fetch(`/api/library/tracks/by-album/${artistName}/${albumName}`)
        .then(res => res.json())
        .then(data => {
            // Save tracks globally for modal use
            window.lastLoadedTracks = data.tracks || [];
            let html = `<button class="btn btn-link mb-3" onclick="setupLibraryView()">&larr; Back to Albums</button>`;
            html += `<div class="card mb-4"><div class="card-body">`;
            html += `<h4 class="mb-3">${decodeURIComponent(albumName)}</h4>`;
            if (!data.tracks || data.tracks.length === 0) {
                html += '<div class="alert alert-warning">No tracks found for this album.</div>';
            } else {
                html += '<div class="table-responsive">';
                html += '<table class="table table-dark table-hover"><thead><tr>' +
                    '<th>#</th><th>Title</th><th>Artist</th><th>Album</th><th>Length</th><th>Bitrate</th><th>Year</th><th>Genre</th><th></th><th></th></tr></thead><tbody>';
                data.tracks.forEach(track => {
                    html += `<tr>
                        <td>${track.track || ''}</td>
                        <td>${track.title || ''}</td>
                        <td>${track.artist || ''}</td>
                        <td>${track.album || ''}</td>
                        <td>${track.length || ''}</td>
                        <td>${track.bitrate || ''}</td>
                        <td>${track.year || ''}</td>
                        <td>${track.genre || ''}</td>
                        <td><button class="btn btn-sm btn-outline-info lyrics-btn" data-track-id="${track.id}" type="button">Lyrics</button></td>
                        <td><button class="btn btn-sm btn-outline-warning edit-btn" data-track-id="${track.id}" type="button">Edit</button></td>
                    </tr>`;
                });
                html += '</tbody></table></div>';
            }
            html += '</div></div>';
            libraryContent.innerHTML = html;

            // Attach event listeners for lyrics and edit buttons after DOM update
            document.querySelectorAll('.lyrics-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    fetchAndDisplayLyrics(this.getAttribute('data-track-id'));
                });
            });
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    editTrackMetadata(this.getAttribute('data-track-id'));
                });
            });
        });
}

// Show a user-friendly message if the library is not initialized or empty
function showLibraryError(message, showInitButton = false) {
    const libraryContent = document.getElementById('libraryContent');
    if (!libraryContent) return;
    let html = `<div class="alert alert-warning text-center">${message}</div>`;
    if (showInitButton) {
        html += `<div class="text-center mt-3"><button class="btn btn-primary" id="initLibraryBtn">Initialize Library</button></div>`;
    }
    libraryContent.innerHTML = html;
    if (showInitButton) {
        document.getElementById('initLibraryBtn').onclick = () => {
            libraryContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Initializing library...</div>';
            fetch('/api/library/init', {method: 'POST'})
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'initialized' || data.status === 'already-initialized') {
                        setupLibraryView();
                    } else {
                        showLibraryError('Failed to initialize library. Please check your config and music path.', false);
                    }
                })
                .catch(() => showLibraryError('Failed to initialize library. Please check your config and music path.', false));
        };
    }
}

// Edit track metadata modal logic (ensure this exists)
function editTrackMetadata(trackId) {
    // Find the track object from the last loaded tracks (from the table)
    let track = null;
    // Try to get the track from the last loaded album/artist view
    if (window.lastLoadedTracks && Array.isArray(window.lastLoadedTracks)) {
        track = window.lastLoadedTracks.find(t => String(t.id) === String(trackId));
    }
    // Fallback: try to fetch the track from the backend if not found
    if (!track) {
        fetch(`/api/library/track/${trackId}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.track) {
                    window.openEditModal(data.track);
                } else {
                    alert('Track not found.');
                }
            });
        return;
    }
    window.openEditModal(track);
}

// Ensure fetchAndDisplayLyrics and editTrackMetadata are defined globally
window.fetchAndDisplayLyrics = fetchAndDisplayLyrics;
window.editTrackMetadata = editTrackMetadata;
window.openLyricsModal = window.openLyricsModal || openLyricsModal;
window.openEditModal = window.openEditModal || openEditModal;