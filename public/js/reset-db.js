// Reset Database functionality for testing
class ResetDB {
  constructor() {
    this.isResetting = false;
  }

  render() {
    return `
      <div class="reset-db-section">
        <h3>🔄 Database Reset & Testing</h3>
        <div class="reset-info">
          <p><strong>Warning:</strong> This will clear all existing data and reload dummy data for testing.</p>
          <p>Use this feature to reset the database to a clean state with sample Raipur hospital data.</p>
        </div>
        
        <div class="reset-actions">
          <button class="btn btn-danger" onclick="resetDatabase()" ${this.isResetting ? 'disabled' : ''}>
            ${this.isResetting ? 'Resetting...' : '🔄 Reset Database'}
          </button>
          <button class="btn btn-info" onclick="showTestCredentials()">
            📋 Show Test Credentials
          </button>
          <button class="btn btn-success" onclick="runQuickTest()">
            ✅ Run Quick Test
          </button>
        </div>
        
        <div id="reset-status" class="reset-status"></div>
        
        <div class="test-credentials" id="test-credentials" style="display: none;">
          <h4>Test Credentials</h4>
          <div class="credentials-grid">
            <div class="cred-category">
              <h5>🏥 Hospitals</h5>
              <div class="cred-item">HOSP001 - Password: test@1234</div>
              <div class="cred-item">HOSP002 - Password: test@1234</div>
            </div>
            <div class="cred-category">
              <h5>👨‍⚕️ Doctors</h5>
              <div class="cred-item">DOC100 - Password: test@123</div>
              <div class="cred-item">DOC101 - Password: test@123</div>
            </div>
            <div class="cred-category">
              <h5>🚑 Ambulances</h5>
              <div class="cred-item">AMB001 - Password: test@1234</div>
            </div>
          </div>
        </div>
        
        <div class="quick-test-results" id="quick-test-results" style="display: none;">
          <h4>Quick Test Results</h4>
          <div id="test-output"></div>
        </div>
      </div>
    `;
  }

  static addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .reset-db-section {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 10px;
        background: #f8f9fa;
      }
      
      .reset-info {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 20px;
      }
      
      .reset-info p {
        margin: 4px 0;
        color: #856404;
      }
      
      .reset-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      
      .btn {
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.3s;
      }
      
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      .btn-danger {
        background: #dc3545;
        color: white;
      }
      
      .btn-danger:hover:not(:disabled) {
        background: #c82333;
        transform: translateY(-1px);
      }
      
      .btn-info {
        background: #17a2b8;
        color: white;
      }
      
      .btn-info:hover {
        background: #138496;
        transform: translateY(-1px);
      }
      
      .btn-success {
        background: #28a745;
        color: white;
      }
      
      .btn-success:hover {
        background: #218838;
        transform: translateY(-1px);
      }
      
      .reset-status {
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 20px;
        display: none;
      }
      
      .reset-status.success {
        background: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
        display: block;
      }
      
      .reset-status.error {
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
        display: block;
      }
      
      .reset-status.info {
        background: #d1ecf1;
        border: 1px solid #bee5eb;
        color: #0c5460;
        display: block;
      }
      
      .test-credentials {
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 16px;
        margin-top: 20px;
      }
      
      .credentials-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 16px;
        margin-top: 12px;
      }
      
      .cred-category h5 {
        margin: 0 0 8px 0;
        color: #495057;
        border-bottom: 1px solid #dee2e6;
        padding-bottom: 4px;
      }
      
      .cred-item {
        background: #f8f9fa;
        padding: 8px 12px;
        border-radius: 4px;
        margin-bottom: 6px;
        font-family: monospace;
        font-size: 14px;
      }
      
      .quick-test-results {
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 16px;
        margin-top: 20px;
      }
      
      .test-output {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        padding: 12px;
        font-family: monospace;
        font-size: 14px;
        white-space: pre-wrap;
        max-height: 300px;
        overflow-y: auto;
      }
    `;
    document.head.appendChild(style);
  }
}

// Global reset functions
window.resetDatabase = async function() {
  const statusEl = document.getElementById('reset-status');
  const resetBtn = document.querySelector('.btn-danger');
  
  try {
    resetBtn.disabled = true;
    resetBtn.textContent = 'Resetting...';
    
    statusEl.className = 'reset-status info';
    statusEl.textContent = 'Resetting database... This may take a few seconds.';
    statusEl.style.display = 'block';
    
    const response = await fetch('/api/reset-db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    
    statusEl.className = 'reset-status success';
    statusEl.innerHTML = `
      <strong>✅ Database reset successful!</strong><br>
      Created ${result.hospitals} hospitals, ${result.doctors} doctors, ${result.beds} beds, ${result.ambulances} ambulances
    `;
    
    // Reload current page data if applicable
    if (window.loadBeds) window.loadBeds();
    if (window.loadDoctors) window.loadDoctors();
    if (window.loadAmbulances) window.loadAmbulances();
    if (window.loadAllHospitals) window.loadAllHospitals();
    
  } catch (error) {
    statusEl.className = 'reset-status error';
    statusEl.textContent = `❌ Reset failed: ${error.message}`;
  } finally {
    resetBtn.disabled = false;
    resetBtn.textContent = '🔄 Reset Database';
  }
};

window.showTestCredentials = function() {
  const credsEl = document.getElementById('test-credentials');
  credsEl.style.display = credsEl.style.display === 'none' ? 'block' : 'none';
};

window.runQuickTest = async function() {
  const resultsEl = document.getElementById('quick-test-results');
  const outputEl = document.getElementById('test-output');
  
  resultsEl.style.display = 'block';
  outputEl.textContent = 'Running quick test...\n';
  
  const tests = [
    { name: 'Test Hospital API', fn: () => fetch('/api/hospital').then(r => r.json()) },
    { name: 'Test Beds API', fn: () => fetch('/api/beds/HOSP001').then(r => r.json()) },
    { name: 'Test Doctors API', fn: () => fetch('/api/doctors/HOSP001').then(r => r.json()) },
    { name: 'Test Ambulances API', fn: () => fetch('/api/ambulances/HOSP001').then(r => r.json()) }
  ];
  
  let output = 'Quick Test Results:\n';
  output += '='.repeat(50) + '\n\n';
  
  for (const test of tests) {
    try {
      output += `✅ ${test.name}: `;
      const result = await test.fn();
      output += `OK (${Array.isArray(result) ? result.length : '1'} items)\n`;
    } catch (error) {
      output += `❌ FAILED: ${error.message}\n`;
    }
  }
  
  output += '\n' + '='.repeat(50) + '\n';
  output += 'Test completed at: ' + new Date().toLocaleString() + '\n';
  
  outputEl.textContent = output;
};

window.ResetDB = ResetDB;

