// Tab management functionality

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
});

function initializeTabs() {
    // Handle tab switching
    const tabs = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function (event) {
            const targetId = event.target.getAttribute('data-bs-target');
            handleTabChange(targetId);
        });
    });
    
    // Initialize with library tab active
    handleTabChange('#library-content');
}

function handleTabChange(targetId) {
    switch(targetId) {
        case '#library-content':
            handleLibraryTab();
            break;
        case '#config-content':
            handleConfigTab();
            break;
    }
}

function handleLibraryTab() {
    // Refresh library data when switching to library tab
    if (typeof fetchLibrary === 'function') {
        fetchLibrary();
    }
}

function handleConfigTab() {
    // Load config and plugins when switching to config tab
    if (typeof viewConfig === 'function') {
        viewConfig();
    }
    
    if (typeof loadPlugins === 'function') {
        loadPlugins();
    }
}

// Remove all the old editTrack override code since we're doing inline editing now

// Function to switch to a specific tab programmatically
function switchToTab(tabId) {
    const tab = document.querySelector(`[data-bs-target="${tabId}"]`);
    if (tab) {
        const tabInstance = new bootstrap.Tab(tab);
        tabInstance.show();
    }
}

// Function to check which tab is currently active
function getCurrentTab() {
    const activeTab = document.querySelector('.nav-link.active');
    if (activeTab) {
        return activeTab.getAttribute('data-bs-target');
    }
    return null;
}// Tab management functionality

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
});

function initializeTabs() {
    // Handle tab switching
    const tabs = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function (event) {
            const targetId = event.target.getAttribute('data-bs-target');
            handleTabChange(targetId);
        });
    });
    
    // Initialize with library tab active
    handleTabChange('#library-content');
}

function handleTabChange(targetId) {
    switch(targetId) {
        case '#library-content':
            handleLibraryTab();
            break;
        case '#config-content':
            handleConfigTab();
            break;
    }
}

function handleLibraryTab() {
    // Refresh library data when switching to library tab
    if (typeof fetchLibrary === 'function') {
        fetchLibrary();
    }
    
    // Hide edit form container by default
    const editForm = document.getElementById('editFormContainer');
    if (editForm) {
        editForm.style.display = 'none';
    }
    
    // Ensure main content takes full width when edit form is hidden
    adjustLibraryLayout();
}

function handleConfigTab() {
    // Load config and plugins when switching to config tab
    if (typeof viewConfig === 'function') {
        viewConfig();
    }
    
    if (typeof loadPlugins === 'function') {
        loadPlugins();
    }
}

function adjustLibraryLayout() {
    const mainContent = document.querySelector('.main-content');
    const editForm = document.getElementById('editFormContainer');
    
    if (editForm && editForm.style.display === 'none') {
        // When edit form is hidden, let main content use more space
        mainContent.style.marginRight = '20px';
    } else {
        // When edit form is visible, adjust margins accordingly
        mainContent.style.marginRight = '0';
    }
}

// Override the existing editTrack function to show the form container
window.originalEditTrack = window.editTrack;
window.editTrack = function(track) {
    // Show the edit form container
    const editForm = document.getElementById('editFormContainer');
    if (editForm) {
        editForm.style.display = 'block';
        adjustLibraryLayout();
    }
    
    // Call the original editTrack function
    if (window.originalEditTrack) {
        window.originalEditTrack(track);
    }
};

// Override the closeEditForm function to hide the container
window.originalCloseEditForm = window.closeEditForm;
window.closeEditForm = function() {
    // Call the original closeEditForm function
    if (window.originalCloseEditForm) {
        window.originalCloseEditForm();
    }
    
    // Hide the edit form container
    const editForm = document.getElementById('editFormContainer');
    if (editForm) {
        editForm.style.display = 'none';
        adjustLibraryLayout();
    }
};

// Add event listener for escape key to close edit form
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const editForm = document.getElementById('editFormContainer');
        if (editForm && editForm.style.display !== 'none') {
            closeEditForm();
        }
    }
});

// Function to switch to a specific tab programmatically
function switchToTab(tabId) {
    const tab = document.querySelector(`[data-bs-target="${tabId}"]`);
    if (tab) {
        const tabInstance = new bootstrap.Tab(tab);
        tabInstance.show();
    }
}

// Function to check which tab is currently active
function getCurrentTab() {
    const activeTab = document.querySelector('.nav-link.active');
    if (activeTab) {
        return activeTab.getAttribute('data-bs-target');
    }
    return null;
}