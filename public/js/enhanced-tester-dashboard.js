class EnhancedTesterDashboard {
    constructor() {
        this.testers = [];
        this.selectedTesters = new Set();
        this.activeMonitoring = false;
        this.eventSource = null;
        this.currentEditIndex = null;
        
        this.init();
    }

    async init() {
        await this.loadConfiguration();
        this.setupEventListeners();
        this.renderTesterSelection();
        this.connectEventSource();
    }

    async loadConfiguration() {
        try {
            const response = await fetch('/api/config');
            this.testers = await response.json();
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.showError('Failed to load configuration');
        }
    }

    setupEventListeners() {
        // Selection controls
        document.getElementById('select-all').addEventListener('click', () => this.selectAllTesters());
        document.getElementById('deselect-all').addEventListener('click', () => this.deselectAllTesters());
        document.getElementById('query-btn').addEventListener('click', () => this.toggleMonitoring());

        // Configuration
        document.getElementById('config-btn').addEventListener('click', () => this.openConfigModal());
        document.getElementById('add-tester').addEventListener('click', () => this.openTesterForm());
        document.getElementById('import-config').addEventListener('click', () => this.importConfiguration());
        document.getElementById('export-config').addEventListener('click', () => this.exportConfiguration());
        
        // Modal close buttons
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal);
            });
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        // Tester form
        document.getElementById('tester-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTester();
        });

        document.getElementById('cancel-form').addEventListener('click', () => {
            this.closeModal(document.getElementById('tester-form-modal'));
        });

        // Error dismiss
        document.getElementById('dismiss-error').addEventListener('click', () => {
            this.hideError();
        });
    }

    renderTesterSelection() {
        const container = document.getElementById('tester-checkboxes');
        container.innerHTML = '';

        this.testers.forEach(tester => {
            const checkbox = document.createElement('div');
            checkbox.className = 'tester-checkbox';
            checkbox.innerHTML = `
                <input type="checkbox" id="tester-${tester.id}" value="${tester.id}" ${tester.enabled !== false ? 'checked' : ''}>
                <label for="tester-${tester.id}">${tester.name}</label>
            `;
            
            checkbox.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedTesters.add(tester.id);
                } else {
                    this.selectedTesters.delete(tester.id);
                }
            });
            
            container.appendChild(checkbox);
        });
    }

    selectAllTesters() {
        const checkboxes = document.querySelectorAll('.tester-checkbox input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            this.selectedTesters.add(cb.value);
        });
    }

    deselectAllTesters() {
        const checkboxes = document.querySelectorAll('.tester-checkbox input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
        this.selectedTesters.clear();
    }

    async toggleMonitoring() {
        if (this.activeMonitoring) {
            this.stopMonitoring();
        } else {
            await this.startMonitoring();
        }
    }

    async startMonitoring() {
        if (this.selectedTesters.size === 0) {
            this.showError('Please select at least one tester to monitor');
            return;
        }

        this.showLoading(true);
        this.activeMonitoring = true;
        
        // Update button
        const btn = document.getElementById('query-btn');
        btn.textContent = 'Stop Monitoring';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-danger');
        
        // Clear existing cards
        document.getElementById('tester-dashboard').innerHTML = '';
        
        // Create cards for selected testers
        this.selectedTesters.forEach(testerId => {
            const tester = this.testers.find(t => t.id === testerId);
            if (tester) {
                this.createTesterCard(tester);
            }
        });

        try {
            // Start monitoring on backend
            await fetch('/api/scheduler/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    testerIds: Array.from(this.selectedTesters)
                })
            });

            // Initial data fetch
            await this.fetchTesterData();
        } catch (error) {
            console.error('Error starting monitoring:', error);
            this.showError('Failed to start monitoring');
            this.stopMonitoring();
        } finally {
            this.showLoading(false);
        }
    }

    stopMonitoring() {
        this.activeMonitoring = false;
        
        // Update button
        const btn = document.getElementById('query-btn');
        btn.textContent = 'Start Monitoring';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-success');

        // Stop monitoring on backend
        fetch('/api/scheduler/stop', { method: 'POST' })
            .catch(error => console.error('Error stopping monitoring:', error));
    }

    createTesterCard(tester) {
        const template = document.getElementById('enhanced-tester-card-template');
        const clone = template.content.cloneNode(true);
        
        const card = clone.querySelector('.tester-card');
        card.dataset.testerId = tester.id;
        
        clone.querySelector('.tester-name').textContent = tester.name;
        
        // Add click handler for opening URL
        clone.querySelector('.url-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(tester.url, '_blank');
        });
        
        // Add click handler for the entire card
        card.addEventListener('click', () => {
            window.open(tester.url, '_blank');
        });
        
        document.getElementById('tester-dashboard').appendChild(clone);
    }

    async fetchTesterData() {
        if (this.selectedTesters.size === 0) return;

        try {
            const response = await fetch('/api/testers/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    testerIds: Array.from(this.selectedTesters)
                })
            });

            const data = await response.json();
            
            data.forEach(testerData => {
                this.updateTesterCard(testerData);
            });

            document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
        } catch (error) {
            console.error('Error fetching tester data:', error);
            this.showError('Failed to fetch tester data');
        }
    }

    updateTesterCard(data) {
        const card = document.querySelector(`[data-tester-id="${data.id}"]`);
        if (!card) return;

        // Update status indicator
        const statusIndicator = card.querySelector('.status-indicator');
        const lastUpdate = card.querySelector('.last-update');
        
        statusIndicator.className = 'status-indicator';
        lastUpdate.textContent = new Date(data.timestamp).toLocaleTimeString();

        // Update status counters
        this.updateStatusCounters(card, data.counters);

        // Determine overall status based on counters
        let overallStatus = 'available';
        if (data.counters.failing > 0 || data.counters.failed > 0) {
            overallStatus = 'error';
            statusIndicator.classList.add('error');
            card.className = 'tester-card error';
        } else if (data.counters.testing > 0) {
            overallStatus = 'success';
            statusIndicator.classList.add('success');
            card.className = 'tester-card success';
        } else if (data.counters.passed > 0) {
            overallStatus = 'warning';
            statusIndicator.classList.add('warning');
            card.className = 'tester-card warning';
        }

        // Update slots
        const slotsContainer = card.querySelector('.slots-container');
        slotsContainer.innerHTML = '';

        if (data.slots && data.slots.length > 0) {
            data.slots.forEach(slot => {
                const slotElement = this.createEnhancedSlotElement(slot);
                slotsContainer.appendChild(slotElement);
            });
        } else {
            slotsContainer.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">No slot data available</p>';
        }
    }

    updateStatusCounters(card, counters) {
        card.querySelector('.counter-value.testing').textContent = counters.testing || 0;
        card.querySelector('.counter-value.failing').textContent = counters.failing || 0;
        card.querySelector('.counter-value.passed').textContent = counters.passed || 0;
        card.querySelector('.counter-value.failed').textContent = counters.failed || 0;
        card.querySelector('.counter-value.aborted').textContent = counters.aborted || 0;
    }

    createEnhancedSlotElement(slot) {
        const template = document.getElementById('enhanced-slot-template');
        const clone = template.content.cloneNode(true);
        
        const slotElement = clone.querySelector('.slot');
        slotElement.dataset.slotId = slot.id;
        slotElement.className = `slot ${slot.status}`;
        
        clone.querySelector('.slot-name').textContent = slot.name;
        clone.querySelector('.slot-status').textContent = slot.status;
        clone.querySelector('.slot-status').className = `slot-status ${slot.status}`;
        clone.querySelector('.slot-time').textContent = slot.testTime;
        
        clone.querySelector('.serial-number .value').textContent = slot.serialNumber;
        
        // Add sub-slots
        const subSlotGrid = clone.querySelector('.sub-slot-grid');
        if (slot.subSlots && slot.subSlots.length > 0) {
            slot.subSlots.forEach(subSlot => {
                const subSlotElement = document.createElement('div');
                subSlotElement.className = `sub-slot ${subSlot.status}`;
                subSlotElement.textContent = subSlot.name;
                subSlotGrid.appendChild(subSlotElement);
            });
        } else {
            subSlotGrid.innerHTML = '<div class="sub-slot">No sub-slots</div>';
        }
        
        clone.querySelector('.production-type').textContent = slot.productionInfo;
        clone.querySelector('.software-version').textContent = slot.softwareVersion;
        
        return clone;
    }

    connectEventSource() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.eventSource = new EventSource('/events');
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'tester-update') {
                    this.updateTesterCard(data.data);
                } else if (data.type === 'batch-update') {
                    data.data.forEach(testerData => {
                        this.updateTesterCard(testerData);
                    });
                } else if (data.type === 'connected') {
                    console.log('Connected to monitoring dashboard');
                }
            } catch (error) {
                console.error('Error processing SSE message:', error);
            }
        };

        this.eventSource.onerror = () => {
            document.getElementById('connection-status').textContent = 'Disconnected';
            document.getElementById('connection-status').classList.add('disconnected');
        };

        this.eventSource.onopen = () => {
            document.getElementById('connection-status').textContent = 'Connected';
            document.getElementById('connection-status').classList.remove('disconnected');
        };
    }

    // Configuration management
    openConfigModal() {
        document.getElementById('config-modal').style.display = 'block';
        this.renderConfigTable();
    }

    closeModal(modal) {
        modal.style.display = 'none';
    }

    renderConfigTable() {
        const tbody = document.getElementById('config-table-body');
        tbody.innerHTML = '';

        this.testers.forEach((tester, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${tester.name}</td>
                <td>${tester.url}</td>
                <td>
                    <input type="checkbox" ${tester.enabled !== false ? 'checked' : ''} 
                           onchange="dashboard.toggleTesterEnabled('${tester.id}', this.checked)">
                </td>
                <td>
                    <button class="btn btn-sm btn-primary edit-btn" data-index="${index}">Edit</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-index="${index}">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Add event listeners for edit/delete buttons
        tbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.editTester(parseInt(e.target.dataset.index)));
        });

        tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteTester(parseInt(e.target.dataset.index)));
        });
    }

    openTesterForm(tester = null) {
        this.currentEditIndex = tester ? this.testers.indexOf(tester) : null;
        
        const modal = document.getElementById('tester-form-modal');
        const title = document.getElementById('tester-form-title');
        
        if (tester) {
            title.textContent = 'Edit Tester';
            document.getElementById('tester-id').value = tester.id;
            document.getElementById('tester-name').value = tester.name;
            document.getElementById('tester-url').value = tester.url;
            document.getElementById('tester-enabled').checked = tester.enabled !== false;
            document.getElementById('tester-id').disabled = true;
        } else {
            title.textContent = 'Add Tester';
            document.getElementById('tester-form').reset();
            document.getElementById('tester-id').disabled = false;
        }
        
        modal.style.display = 'block';
    }

    async saveTester() {
        const formData = {
            id: document.getElementById('tester-id').value.trim(),
            name: document.getElementById('tester-name').value.trim(),
            url: document.getElementById('tester-url').value.trim(),
            enabled: document.getElementById('tester-enabled').checked
        };

        try {
            let response;
            if (this.currentEditIndex !== null) {
                // Update existing tester
                response = await fetch(`/api/tester/${this.testers[this.currentEditIndex].id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            } else {
                // Add new tester
                response = await fetch('/api/tester', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            }

            if (response.ok) {
                await this.loadConfiguration();
                this.renderConfigTable();
                this.renderTesterSelection();
                this.closeModal(document.getElementById('tester-form-modal'));
            } else {
                const error = await response.json();
                this.showError(error.error || 'Failed to save tester');
            }
        } catch (error) {
            console.error('Error saving tester:', error);
            this.showError('Failed to save tester');
        }
    }

    editTester(index) {
        this.openTesterForm(this.testers[index]);
    }

    async deleteTester(index) {
        const tester = this.testers[index];
        if (!confirm(`Are you sure you want to delete ${tester.name}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/tester/${tester.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadConfiguration();
                this.renderConfigTable();
                this.renderTesterSelection();
            } else {
                const error = await response.json();
                this.showError(error.error || 'Failed to delete tester');
            }
        } catch (error) {
            console.error('Error deleting tester:', error);
            this.showError('Failed to delete tester');
        }
    }

    async toggleTesterEnabled(testerId, enabled) {
        try {
            const tester = this.testers.find(t => t.id === testerId);
            if (tester) {
                tester.enabled = enabled;
                
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        testers: this.testers
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to update tester');
                }
            }
        } catch (error) {
            console.error('Error toggling tester:', error);
            this.showError('Failed to update tester');
        }
    }

    async importConfiguration() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const config = JSON.parse(text);
                
                const response = await fetch('/api/config/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(config)
                });

                if (response.ok) {
                    await this.loadConfiguration();
                    this.renderConfigTable();
                    this.renderTesterSelection();
                    alert('Configuration imported successfully');
                } else {
                    const error = await response.json();
                    this.showError(error.error || 'Failed to import configuration');
                }
            } catch (error) {
                console.error('Error importing configuration:', error);
                this.showError('Failed to import configuration');
            }
        };
        
        input.click();
    }

    async exportConfiguration() {
        try {
            const response = await fetch('/api/config/export');
            const config = await response.json();
            
            const blob = new Blob([JSON.stringify(config, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tester-config-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting configuration:', error);
            this.showError('Failed to export configuration');
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        loading.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        const errorContainer = document.getElementById('error-container');
        const errorText = document.getElementById('error-text');
        
        errorText.textContent = message;
        errorContainer.style.display = 'flex';
    }

    hideError() {
        const errorContainer = document.getElementById('error-container');
        errorContainer.style.display = 'none';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new EnhancedTesterDashboard();
});