// Tab management functionality

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
});

/**
 * Initializes Bootstrap tab switching functionality.
 */
function initializeTabs() {
    // Handle tab switching when a tab is shown
    const tabs = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function (event) {
            const targetId = event.target.getAttribute('data-bs-target');
            handleTabChange(targetId);
        });
    });

    // Manually trigger the 'shown.bs.tab' event for the initially active tab
    // to ensure content loads on first page visit.
    const activeTabButton = document.querySelector('.nav-link.active[data-bs-toggle="tab"]');
    if (activeTabButton) {
        const targetId = activeTabButton.getAttribute('data-bs-target');
        handleTabChange(targetId); // Directly call handler for initial load
    }
}

/**
 * Handles actions to perform when a specific tab becomes active.
 * @param {string} targetId The ID of the content pane being activated (e.g., '#library-content').
 */
function handleTabChange(targetId) {
    switch(targetId) {
        case '#library-content':
            handleLibraryTab();
            break;
        case '#config-content':
            handleConfigTab();
            break;
        case '#plugins-content': // Assuming you have a #plugins-content tab
            handlePluginsTab();
            break;
        // Add more cases for other tabs as needed
    }
}

/**
 * Actions specific to the Library tab when it becomes active.
 */
function handleLibraryTab() {
    // Refresh library data when switching to library tab
    if (typeof fetchLibrary === 'function') {
        fetchLibrary();
    }
    // Adjust layout if there's a function for it
    if (typeof adjustLibraryLayout === 'function') {
        adjustLibraryLayout();
    }
}

/**
 * Actions specific to the Configuration tab when it becomes active.
 */
function handleConfigTab() {
    // Load config and plugins when switching to config tab
    if (typeof viewConfig === 'function') {
        viewConfig();
    }
}

/**
 * Actions specific to the Plugins tab when it becomes active.
 */
function handlePluginsTab() {
    if (typeof loadPlugins === 'function') {
        loadPlugins();
    }
}

// --- Removed old editTrack/closeEditForm override code ---
// As per previous discussions and comments, this global override pattern
// is being removed to allow for a more direct inline editing approach,
// where edit functionality is likely handled within library.js or directly
// in the generated HTML for each row.
// --- End of removed section ---


// Add event listener for escape key to close a potential edit form or modal
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const editForm = document.getElementById('editFormContainer'); // Assuming this still represents some form/modal
        // Only attempt to close if it's visible (or not explicitly hidden)
        if (editForm && window.getComputedStyle(editForm).display !== 'none') {
            // If closeEditForm exists (e.g., in library.js), call it.
            // Otherwise, manually hide the element.
            if (typeof closeEditForm === 'function') {
                closeEditForm();
            } else {
                editForm.style.display = 'none';
                if (typeof adjustLibraryLayout === 'function') {
                    adjustLibraryLayout();
                }
            }
        }
    }
});

/**
 * Function to switch to a specific tab programmatically.
 * Useful if you want to navigate between tabs from other parts of your JS.
 * @param {string} tabId The data-bs-target ID of the tab (e.g., '#library-content').
 */
function switchToTab(tabId) {
    const tabButton = document.querySelector(`[data-bs-target="${tabId}"]`);
    if (tabButton) {
        const tabInstance = new bootstrap.Tab(tabButton);
        tabInstance.show(); // Activates the tab
    }
}

/**
 * Function to check which tab is currently active.
 * @returns {string|null} The data-bs-target ID of the active tab, or null if none is active.
 */
function getCurrentTab() {
    const activeTab = document.querySelector('.nav-link.active[data-bs-toggle="tab"]');
    if (activeTab) {
        return activeTab.getAttribute('data-bs-target');
    }
    return null;
}

// Placeholder for adjustLibraryLayout if it's defined elsewhere (e.g., style.js or index.html)
// This function would typically adjust the layout of the library view,
// for instance, if an inline edit form expands/collapses.
function adjustLibraryLayout() {
    // console.log('adjustLibraryLayout called (placeholder)');
    // Implement actual layout adjustments here if needed
}