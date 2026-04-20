// ═════════════════════════════════════════════════════════════════════════════
// ParkManager — Frontend Application  (JWT-authenticated, API-backed)
// ═════════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

// --- PARKING ZONE CONFIG (mirrors backend) ---
const ZONE_CONFIG = {
    employee: { blocks: ['A', 'B'], label: 'Employee Zone', slotsPerBlock: 20 },
    visitor:  { blocks: ['C', 'D'], label: 'Visitor Zone',  slotsPerBlock: 20 }
};
const SLOTS_PER_BLOCK = 20;

// ═════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

function showToast(message, type = 'success') {
    let container = document.getElementById('customToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'customToastContainer';
        container.className = 'position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '1060';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const isError = type === 'error';
    const bgClass = isError ? 'bg-danger' : (type === 'info' ? 'bg-primary' : 'bg-success');
    const iconClass = isError ? 'fa-circle-xmark' : (type === 'info' ? 'fa-info-circle' : 'fa-check-circle');
    toast.className = `toast show align-items-center text-white border-0 mb-2 ${bgClass}`;
    toast.style.minWidth = '250px';
    toast.innerHTML = `
        <div class="d-flex p-3">
            <div class="toast-body fw-bold flex-grow-1">
                <i class="fa-solid ${iconClass} me-2"></i> ${message}
            </div>
            <button type="button" class="btn-close btn-close-white" onclick="this.closest('.toast').remove()"></button>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.5s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function showConfirm(message, confirmText = 'Yes', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-backdrop fade show';
        const modal = document.createElement('div');
        modal.className = 'modal fade show d-block';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-body p-4 text-center">
                        <i class="fa-solid fa-triangle-exclamation text-warning mb-3" style="font-size: 3rem;"></i>
                        <h5 class="fw-bold mb-4">${message}</h5>
                        <div class="d-flex justify-content-center gap-3">
                            <button class="btn btn-outline-secondary px-4 fw-bold" id="confirmCancelBtn">${cancelText}</button>
                            <button class="btn btn-danger px-4 fw-bold" id="confirmOkBtn">${confirmText}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        const cleanup = () => { overlay.remove(); modal.remove(); };
        document.getElementById('confirmOkBtn').onclick = () => { cleanup(); resolve(true); };
        document.getElementById('confirmCancelBtn').onclick = () => { cleanup(); resolve(false); };
    });
}


// ═════════════════════════════════════════════════════════════════════════════
// SESSION & AUTH HELPERS
// ═════════════════════════════════════════════════════════════════════════════


/** Get the stored JWT token */
function getToken() {
    return sessionStorage.getItem('token');
}

/** Get the stored user role */
function getUserRole() {
    return sessionStorage.getItem('userRole');
}

/** Clear all session data and redirect to login */
function clearSessionAndRedirect() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('username');
    window.location.href = 'login.html';
}

// ─── Page-level auth gate ────────────────────────────────────────────────────
const currentPath = window.location.pathname;
const isLoginPage = currentPath.endsWith('login.html');

if (!isLoginPage) {
    const token = getToken();
    const role = getUserRole();
    if (!token || !role) {
        clearSessionAndRedirect();
    } else if (role === 'security' && currentPath.endsWith('admin.html')) {
        showToast('Access Denied: You do not have permission to view the Admin Panel.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    }
}

// ─── DOMContentLoaded — Theme, Nav, Page Init ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Dark mode persistence
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        updateDarkModeIcon(true);
    }

    // Active nav link
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === page) link.classList.add('active');
    });

    // Hide admin link for security role
    if (!isLoginPage) {
        const role = getUserRole();
        if (role === 'security') {
            const adminLink = document.querySelector('a[href="admin.html"]');
            if (adminLink) adminLink.parentElement.style.display = 'none';
        }
    }

    // ── Page-specific setup ──────────────────────────────────────────────
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', registerEmployee);
        renderEmployeeTable();
    }

    if (document.getElementById('logsTableBody')) {
        renderLogsTable();
    }

    // Revenue chart must render AFTER its tab is visible (Chart.js needs real dimensions)
    const revenueTab = document.getElementById('revenue-tab');
    if (revenueTab) {
        revenueTab.addEventListener('shown.bs.tab', () => {
            fetchSettings();
            renderRevenueChart();
        });
    }

    // Refresh logs when switching to the Logs tab
    const logsTab = document.getElementById('logs-tab');
    if (logsTab) {
        logsTab.addEventListener('shown.bs.tab', () => {
            renderLogsTable();
        });
    }

    const entryForm = document.getElementById('entryForm');
    if (entryForm) entryForm.addEventListener('submit', handleEntrySubmit);

    const exitForm = document.getElementById('exitForm');
    if (exitForm) exitForm.addEventListener('submit', processExit);

    refreshDashboardUI();
});


// ═════════════════════════════════════════════════════════════════════════════
// HELPER UTILITIES
// ═════════════════════════════════════════════════════════════════════════════

function cleanPlateNumber(plate) {
    return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Generic fetch wrapper with JWT auth and global 401 handling.
 * Automatically attaches the Authorization header if a token exists.
 * On 401 from the server, clears the session and redirects to login.
 */
async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        // ── Global 401 handler: session expired or invalid token ─────────
        if (res.status === 401) {
            showToast('Session expired. Please log in again.', 'error');
            setTimeout(() => clearSessionAndRedirect(), 1500);
            return; // unreachable, but explicit
        }

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || `Server error (${res.status})`);
        }
        return data;
    } catch (err) {
        if (err.message === 'Failed to fetch') {
            throw new Error('Cannot connect to server. Is the backend running on port 5000?');
        }
        throw err;
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// LOGIN / LOGOUT  (JWT-based)
// ═════════════════════════════════════════════════════════════════════════════

async function handleSecurityLogin() {
    try {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'security', password: 'security123' }),
        });
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('userRole', data.role);
        sessionStorage.setItem('username', data.username);
        window.location.href = 'entry.html';
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleAdminLogin(event) {
    if (event) event.preventDefault();
    const username = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;

    if (!username || !password) {
        showToast('Please enter both username and password.', 'error');
        return;
    }

    try {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('userRole', data.role);
        sessionStorage.setItem('username', data.username);
        window.location.href = data.role === 'admin' ? 'admin.html' : 'entry.html';
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function logout() {
    clearSessionAndRedirect();
}


// ═════════════════════════════════════════════════════════════════════════════
// VEHICLE ENTRY
// ═════════════════════════════════════════════════════════════════════════════

async function handleEntrySubmit(event) {
    event.preventDefault();
    const submitBtn = document.querySelector('#entryForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Processing...';

    try {
        const plateNumber = document.getElementById('plateNumber').value.trim();
        const slotInput = document.getElementById('manualSlot').value.trim();

        const data = await apiFetch('/parking/entry', {
            method: 'POST',
            body: JSON.stringify({ plateNumber, slotInput }),
        });

        const log = data.log;
        document.getElementById('displayType').innerHTML = log.type === 'Employee'
            ? '<span class="badge bg-success">Employee</span>'
            : '<span class="badge bg-info text-dark">Visitor</span>';
        document.getElementById('displaySlot').innerText = log.slot;
        document.getElementById('displayToken').innerText = log.token;
        document.getElementById('resultCard').style.display = 'block';
        showToast('Vehicle entry recorded successfully!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
    }

    submitBtn.innerHTML = '<i class="fa-solid fa-check-to-slot me-2"></i>Check & Assign Slot';
}


// ═════════════════════════════════════════════════════════════════════════════
// VEHICLE EXIT
// ═════════════════════════════════════════════════════════════════════════════

async function processExit(event) {
    event.preventDefault();
    const submitBtn = document.querySelector('#exitForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Processing...';

    try {
        const input = document.getElementById('exitInput').value.trim();

        const data = await apiFetch('/parking/exit', {
            method: 'POST',
            body: JSON.stringify({ input }),
        });

        const record = data.log;
        document.getElementById('resPlate').innerText = `Vehicle: ${record.plate} (${record.type})`;
        document.getElementById('resEntryTime').innerText = record.timeIn;
        document.getElementById('resExitTime').innerText = record.timeOut;
        document.getElementById('resDuration').innerText = data.duration;
        document.getElementById('resSlot').innerText = record.slot;
        document.getElementById('exitResultCard').style.display = 'block';
        showToast('Vehicle exit processed successfully!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
    }

    submitBtn.innerHTML = 'Process Exit & Free Slot';
}


// ═════════════════════════════════════════════════════════════════════════════
// AUTO-ASSIGN SLOT
// ═════════════════════════════════════════════════════════════════════════════

async function autoAssignSlot() {
    try {
        const plateNumber = document.getElementById('plateNumber').value.trim();
        if (!plateNumber) { showToast('Please enter a plate number first.', 'info'); return; }

        const data = await apiFetch('/parking/auto-assign', {
            method: 'POST',
            body: JSON.stringify({ plateNumber }),
        });

        document.getElementById('manualSlot').value = data.slot;
        showToast(`Auto-assigned slot ${data.slot}`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// EMPLOYEE MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

async function registerEmployee(event) {
    event.preventDefault();

    const name  = document.getElementById('empName').value.trim();
    const employeeId = document.getElementById('empId').value.trim();
    const plate = document.getElementById('empPlate').value.trim();

    try {
        await apiFetch('/employees', {
            method: 'POST',
            body: JSON.stringify({ name, employeeId, plate }),
        });

        document.getElementById('registerForm').reset();
        renderEmployeeTable();
        showToast('Employee registered successfully', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderEmployeeTable() {
    const tbody = document.getElementById('employeeTableBody');
    const emptyState = document.getElementById('emptyState');
    const totalDisplay = document.getElementById('totalEmployees');
    if (!tbody) return;

    try {
        const employees = await apiFetch('/employees');
        tbody.innerHTML = '';
        totalDisplay.innerText = employees.length;

        if (employees.length === 0) {
            emptyState.classList.remove('d-none');
        } else {
            emptyState.classList.add('d-none');
            employees.forEach(emp => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="ps-4 text-muted fw-semibold">${emp.employeeId}</td>
                    <td class="fw-bold">${emp.name}</td>
                    <td><span class="badge bg-light text-dark border plate-input">${emp.plate}</span></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${emp._id}" title="Delete Record">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>`;
                tbody.appendChild(row);
            });
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    deleteEmployee(this.getAttribute('data-id'));
                });
            });
        }
    } catch (err) {
        console.error('Failed to load employee table:', err.message);
    }
}

async function deleteEmployee(id) {
    const isConfirmed = await showConfirm('Are you sure you want to delete this employee record?', 'Delete', 'Cancel');
    if (!isConfirmed) return;

    try {
        await apiFetch(`/employees/${id}`, { method: 'DELETE' });
        renderEmployeeTable();
        showToast('Employee record deleted', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD — STATS, LIVE GRID
// ═════════════════════════════════════════════════════════════════════════════

async function updateDashboardStats() {
    try {
        const stats = await apiFetch('/parking/stats');

        const el = (id) => document.getElementById(id);
        if (el('totalSlots'))     el('totalSlots').innerText     = stats.totalSlots;
        if (el('empSlotsFree'))   el('empSlotsFree').innerText   = stats.empSlotsFree;
        if (el('visSlotsFree'))   el('visSlotsFree').innerText   = stats.visSlotsFree;
        if (el('activeParkings')) el('activeParkings').innerText = stats.activeParkings;
        if (el('dailyRevenue'))   el('dailyRevenue').innerText   = `₹${stats.dailyRevenue}`;
    } catch (err) {
        console.error('Failed to update dashboard stats:', err.message);
    }
}

async function renderLiveGrid() {
    const gridContainer = document.getElementById('parkingGridContainer');
    if (!gridContainer) return;

    try {
        const logs = await apiFetch('/parking/logs');
        const activeParkings = logs.filter(l => l.status === 'Parked');
        const occupiedSlots = {};
        activeParkings.forEach(log => { occupiedSlots[log.slot] = log.type; });

        gridContainer.innerHTML = '';

        const zones = [
            { label: 'Employee Zone — Blocks A & B', blocks: ZONE_CONFIG.employee.blocks, headerClass: 'zone-header-emp' },
            { label: 'Visitor Zone — Blocks C & D',  blocks: ZONE_CONFIG.visitor.blocks,  headerClass: 'zone-header-vis' }
        ];

        zones.forEach(zone => {
            const header = document.createElement('div');
            header.className = `zone-header ${zone.headerClass}`;
            header.innerHTML = zone.label;
            gridContainer.appendChild(header);

            const slotsWrapper = document.createElement('div');
            slotsWrapper.className = 'zone-slots';

            zone.blocks.forEach(block => {
                for (let i = 1; i <= SLOTS_PER_BLOCK; i++) {
                    const slotNum = `${block}-${i.toString().padStart(2, '0')}`;
                    const slotDiv = document.createElement('div');
                    if (occupiedSlots[slotNum] === 'Employee') {
                        slotDiv.className = 'parking-slot slot-emp';
                        slotDiv.innerHTML = `<span>${slotNum}</span><i class="fa-solid fa-car"></i>`;
                    } else if (occupiedSlots[slotNum] === 'Visitor') {
                        slotDiv.className = 'parking-slot slot-vis';
                        slotDiv.innerHTML = `<span>${slotNum}</span><i class="fa-solid fa-car"></i>`;
                    } else {
                        slotDiv.className = 'parking-slot slot-empty';
                        slotDiv.innerHTML = `<span>${slotNum}</span>`;
                    }
                    slotsWrapper.appendChild(slotDiv);
                }
            });
            gridContainer.appendChild(slotsWrapper);
        });
    } catch (err) {
        console.error('Failed to render live grid:', err.message);
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — LOGS TABLE
// ═════════════════════════════════════════════════════════════════════════════

async function renderLogsTable() {
    const tbody = document.getElementById('logsTableBody');
    const emptyState = document.getElementById('emptyLogsState');
    if (!tbody) return;

    try {
        const logs = await apiFetch('/parking/logs');
        tbody.innerHTML = '';

        if (logs.length === 0) {
            emptyState.classList.remove('d-none');
        } else {
            emptyState.classList.add('d-none');
            logs.forEach(log => {
                const row = document.createElement('tr');

                const statusBadge = log.status === 'Parked'
                    ? '<span class="badge bg-success">Parked</span>'
                    : '<span class="badge bg-secondary">Exited</span>';

                const typeBadge = log.type === 'Employee'
                    ? '<span class="badge bg-primary">Employee</span>'
                    : '<span class="badge bg-info text-dark">Visitor</span>';

                row.innerHTML = `
                    <td class="ps-4 text-muted fw-semibold">${log.token}</td>
                    <td class="fw-bold"><span class="badge bg-light text-dark border plate-input">${log.plate}</span></td>
                    <td>${typeBadge}</td>
                    <td>${log.slot}</td>
                    <td>${log.date}</td>
                    <td>${log.timeIn}</td>
                    <td>${log.timeOut || '-'}</td>
                    <td class="fw-bold text-success">${log.revenue ? '₹' + log.revenue : '-'}</td>
                    <td>${statusBadge}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-danger delete-log-btn" data-id="${log._id}" title="Delete Log">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            if (document.getElementById('lastCollectedRevenue')) {
                const lastRevLog = logs.reverse().find(l => l.status === 'Exited' && l.revenue > 0);
                document.getElementById('lastCollectedRevenue').innerText = lastRevLog ? `₹${lastRevLog.revenue}` : '₹0';
            }

            document.querySelectorAll('.delete-log-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    deleteLog(this.getAttribute('data-id'));
                });
            });
        }
    } catch (err) {
        console.error('Failed to load logs table:', err.message);
    }
}

async function deleteLog(id) {
    const isConfirmed = await showConfirm('Are you sure you want to delete this log entry?', 'Delete', 'Cancel');
    if (!isConfirmed) return;

    try {
        await apiFetch(`/parking/logs/${id}`, { method: 'DELETE' });
        renderLogsTable();
        refreshDashboardUI();
        showToast('Log entry deleted', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function clearAllSlots() {
    const isConfirmed = await showConfirm("⚠️ WARNING: Are you sure you want to clear ALL parking slots? This will mark all currently parked vehicles as 'Exited'.", 'Clear All', 'Cancel');
    if (!isConfirmed) return;

    try {
        const data = await apiFetch('/parking/clear-all', { method: 'POST' });
        showToast(`Success! ${data.modifiedCount} vehicles have been checked out. All slots are now empty.`, 'success');
        refreshDashboardUI();
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// DARK MODE
// ═════════════════════════════════════════════════════════════════════════════

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateDarkModeIcon(isDark);
}

function updateDarkModeIcon(isDark) {
    const btn = document.getElementById('darkModeBtn');
    if (btn) btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}


// ═════════════════════════════════════════════════════════════════════════════
// FORM RESETS & REFRESH
// ═════════════════════════════════════════════════════════════════════════════

function resetFormState(formId, cardId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = false;
    }
    const card = document.getElementById(cardId);
    if (card) card.style.display = 'none';
}

function resetForm()     { resetFormState('entryForm', 'resultCard'); }
function resetExitForm() { resetFormState('exitForm', 'exitResultCard'); }

function refreshDashboardUI() {
    if (document.querySelector('.stat-card')) {
        updateDashboardStats();
        renderLiveGrid();
    }
    if (document.getElementById('logsTableBody')) {
        renderLogsTable();
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// REAL-TIME UPDATES (Socket.io)
// ═════════════════════════════════════════════════════════════════════════════

(function initSocket() {
    // Only connect if socket.io client is loaded and user is authenticated
    if (typeof io === 'undefined' || isLoginPage) return;

    try {
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        socket.on('connect', () => {
            console.log('🔌 Real-time connection established:', socket.id);
        });

        socket.on('parkingUpdate', (data) => {
            console.log('📡 parkingUpdate received:', data?.action || 'refresh');
            refreshDashboardUI();
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Real-time connection lost:', reason);
        });
    } catch (err) {
        console.warn('Socket.io initialization skipped:', err.message);
    }
})();

// ═════════════════════════════════════════════════════════════════════════════
// REVENUE DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

let revenueChartInstance = null;

async function fetchSettings() {
    try {
        const settings = await apiFetch('/settings');
        if (document.getElementById('ratePerHour')) {
            document.getElementById('ratePerHour').value = settings.visitorRatePerHour;
        }
    } catch (err) {
        console.error('Failed to load settings:', err.message);
    }
}

async function renderRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;

    try {
        const chartData = await apiFetch('/settings/revenue-chart');
        const ctx = canvas.getContext('2d');

        if (revenueChartInstance) {
            revenueChartInstance.destroy();
        }

        revenueChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Daily Revenue (₹)',
                    data: chartData.data,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    } catch (err) {
        console.error('Failed to render revenue chart:', err.message);
    }
}

if (document.getElementById('settingsForm')) {
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rate = document.getElementById('ratePerHour').value;
        try {
            await apiFetch('/settings', {
                method: 'PUT',
                body: JSON.stringify({ visitorRatePerHour: rate })
            });
            showToast('Pricing settings updated successfully', 'success');
            renderRevenueChart();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}


// ═════════════════════════════════════════════════════════════════════════════
// CAMERA LOGIC & YOLO SCANNING
// ═════════════════════════════════════════════════════════════════════════════


let activeStream = null;
let scanningInterval = null;

async function toggleScanner(videoId, btnId, statusId, inputId, isExit = false) {
    const video = document.getElementById(videoId);
    const btn = document.getElementById(btnId);
    const status = document.getElementById(statusId);

    if (activeStream) {
        // Stop scanning
        clearInterval(scanningInterval);
        activeStream.getTracks().forEach(t => t.stop());
        activeStream = null;
        video.style.display = 'none';
        status.style.display = 'none';
        btn.innerHTML = '<i class="fa-solid fa-power-off me-1"></i>Start Auto-Scanner';
        btn.className = `btn btn-outline-${isExit ? 'danger' : 'primary'} btn-sm fw-bold`;
        return;
    }

    try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = activeStream;
        video.style.display = 'block';
        status.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-stop me-1"></i>Stop Scanner';
        btn.className = `btn btn-${isExit ? 'danger' : 'primary'} btn-sm fw-bold`;

        // Start scanning frames
        scanningInterval = setInterval(() => {
            scanFrame(videoId, inputId, btnId, isExit);
        }, 1500); // scan every 1.5s
    } catch (err) {
        showToast('Camera access denied or unavailable.', 'error');
        console.error(err);
    }
}

async function scanFrame(videoId, inputId, btnId, isExit = false) {
    const video = document.getElementById(videoId);
    if (!video || video.videoWidth === 0) return;

    // Use a canvas to capture the frame
    const canvasId = videoId.replace('Feed', 'Canvas');
    let canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
        try {
            const formData = new FormData();
            formData.append('image', blob, 'frame.jpg');

            const token = getToken();
            const res = await fetch(`${API_BASE}/parking/scan`, {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData
            });

            if (!res.ok) return; // Silent fail for continuous scanning to avoid spam

            const data = await res.json();
            if (data && data.text && data.text.length >= 3) {
                // Populate input and stop scanner
                document.getElementById(inputId).value = data.text;
                showToast(`Scanned Plate: ${data.text} (Confidence: ${(data.confidence * 100).toFixed(1)}%)`, 'success');
                
                // simulate click to turn off scanner
                document.getElementById(btnId).click();
                
                if (!isExit) {
                    autoAssignSlot();
                }
            }
        } catch (err) {
            console.error('Scan API error:', err);
        }
    }, 'image/jpeg', 0.8);
}

