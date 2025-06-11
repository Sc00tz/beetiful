// Tab switching and tab-specific logic for Beets web UI
// Handles tab initialization, switching, and tab-specific actions

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
});

// Initialize tabs and set up event listeners for tab switching
function initializeTabs() {
    const tabs = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function (event) {
            const targetId = event.target.getAttribute('data-bs-target');
            handleTabChange(targetId);
        });
    });
    const activeTabButton = document.querySelector('.nav-link.active[data-bs-toggle="tab"]');
    if (activeTabButton) {
        const targetId = activeTabButton.getAttribute('data-bs-target');
        handleTabChange(targetId);
    }
}

// Handle actions specific to each tab
function handleTabChange(targetId) {
    switch(targetId) {
        case '#library-content':
            handleLibraryTab();
            break;
        case '#config-content':
            handleConfigTab();
            break;
        case '#plugins-content':
            handlePluginsTab();
            break;
    }
}

// Actions to perform when the Library tab is active
function handleLibraryTab() {
    if (typeof fetchLibrary === 'function') fetchLibrary();
    if (typeof adjustLibraryLayout === 'function') adjustLibraryLayout();
}

// Actions to perform when the Config tab is active
function handleConfigTab() {
    if (typeof viewConfig === 'function') viewConfig();
}

// Actions to perform when the Plugins tab is active
function handlePluginsTab() {
    if (typeof loadPlugins === 'function') loadPlugins();
}

// Global keydown event listener
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const editForm = document.getElementById('editFormContainer');
        if (editForm && window.getComputedStyle(editForm).display !== 'none') {
            if (typeof closeEditForm === 'function') {
                closeEditForm();
            } else {
                editForm.style.display = 'none';
                if (typeof adjustLibraryLayout === 'function') adjustLibraryLayout();
            }
        }
    }
});

// Switch to a specific tab programmatically
function switchToTab(tabId) {
    const tabButton = document.querySelector(`[data-bs-target="${tabId}"]`);
    if (tabButton) {
        const tabInstance = new bootstrap.Tab(tabButton);
        tabInstance.show();
    }
}

// Get the currently active tab
function getCurrentTab() {
    const activeTab = document.querySelector('.nav-link.active[data-bs-toggle="tab"]');
    if (activeTab) return activeTab.getAttribute('data-bs-target');
    return null;
}

// Adjust the layout of the library section
function adjustLibraryLayout() {
    // Placeholder for layout adjustment logic
}