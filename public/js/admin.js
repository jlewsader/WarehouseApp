// Admin Panel JavaScript

let currentUser = null;

// Check authentication status on page load
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/check');
    const data = await response.json();

    if (data.authenticated && data.user.role === 'admin') {
      currentUser = data.user;
      showAdminPanel();
      loadStats();
      loadProducts();
      loadOutboundLog();
    } else {
      showLoginForm();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLoginForm();
  }
}

function showLoginForm() {
  document.getElementById('loginContainer').classList.remove('hidden');
  document.getElementById('adminPanel').classList.add('hidden');
}

function showAdminPanel() {
  document.getElementById('loginContainer').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');
  document.getElementById('currentUser').textContent = currentUser.username;
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      currentUser = data.user;
      showAdminPanel();
      loadStats();
      loadDropdownOptions();
      loadProducts();
    } else {
      errorDiv.textContent = data.error || 'Login failed';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error. Please try again.';
    errorDiv.style.display = 'block';
  }
});

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    showLoginForm();
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  } catch (error) {
    console.error('Logout failed:', error);
  }
});

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Show corresponding content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Reload data if needed
    if (tabName === 'products') {
      loadProducts();
    }
  });
});

// Load statistics
async function loadStats() {
  try {
    const response = await fetch('/api/admin/stats');
    const stats = await response.json();
    
    document.getElementById('productCount').textContent = stats.productCount || 0;
    document.getElementById('inventoryCount').textContent = stats.inventoryCount || 0;
    document.getElementById('locationCount').textContent = stats.locationCount || 0;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Load and display dropdown options

// Clear inventory
document.getElementById('clearInventoryBtn').addEventListener('click', async () => {
  const confirmed = confirm(
    '⚠️ WARNING ⚠️\n\n' +
    'This will permanently delete ALL inventory records!\n\n' +
    'Products and locations will be preserved, but all inventory tracking will be lost.\n\n' +
    'Are you absolutely sure you want to continue?'
  );
  
  if (!confirmed) return;
  
  // Double confirmation
  const doubleConfirmed = confirm(
    'FINAL CONFIRMATION\n\n' +
    'Click OK to permanently delete all inventory records.\n\n' +
    'This cannot be undone!'
  );
  
  if (!doubleConfirmed) return;
  
  const successDiv = document.getElementById('bulkSuccess');
  const errorDiv = document.getElementById('bulkError');
  successDiv.style.display = 'none';
  errorDiv.style.display = 'none';
  
  try {
    const response = await fetch('/api/admin/clear-inventory', {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      successDiv.textContent = data.message || 'Inventory cleared successfully';
      successDiv.style.display = 'block';
      loadStats(); // Refresh stats
    } else {
      errorDiv.textContent = data.error || 'Failed to clear inventory';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error: ' + error.message;
    errorDiv.style.display = 'block';
  }
});

// Load products with search
let allProducts = [];

async function loadProducts(searchTerm = '') {
  const tbody = document.getElementById('productsTableBody');
  const errorDiv = document.getElementById('productsError');
  errorDiv.style.display = 'none';
  
  try {
    const response = await fetch('/api/admin/products');
    allProducts = await response.json();
    
    // Filter products by search term
    let filteredProducts = allProducts;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredProducts = allProducts.filter(p => 
        (p.brand && p.brand.toLowerCase().includes(term)) ||
        (p.product_code && p.product_code.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        (p.seed_size && p.seed_size.toLowerCase().includes(term)) ||
        (p.package_type && p.package_type.toLowerCase().includes(term))
      );
    }
    
    if (filteredProducts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No products found</td></tr>';
      return;
    }
    
    tbody.innerHTML = filteredProducts.map(p => `
      <tr data-product-id="${p.id}">
        <td>${p.id}</td>
        <td>${p.barcode || '-'}</td>
        <td class="editable-cell" data-field="brand" data-product-id="${p.id}">${p.brand || '-'}</td>
        <td class="editable-cell" data-field="product_code" data-product-id="${p.id}">${p.product_code || '-'}</td>
        <td class="editable-cell" data-field="seed_size" data-product-id="${p.id}">${p.seed_size || '-'}</td>
        <td class="editable-cell" data-field="package_type" data-product-id="${p.id}">${p.package_type || '-'}</td>
        <td>${p.inventory_count || 0}</td>
        <td>
          ${p.inventory_count === 0 
            ? `<button class="btn btn-danger btn-small" onclick="deleteProduct(${p.id})">Delete</button>`
            : `<span style="color: #999;">Has inventory</span>`
          }
        </td>
      </tr>
    `).join('');
    
    // Add click listeners for inline editing
    document.querySelectorAll('.editable-cell').forEach(cell => {
      cell.addEventListener('click', function() {
        if (this.classList.contains('editing-cell')) return;
        makeEditable(this);
      });
    });
  } catch (error) {
    errorDiv.textContent = 'Failed to load products: ' + error.message;
    errorDiv.style.display = 'block';
  }
}

// Make cell editable
function makeEditable(cell) {
  const currentValue = cell.textContent === '-' ? '' : cell.textContent;
  const field = cell.dataset.field;
  const productId = cell.dataset.productId;
  
  cell.classList.add('editing-cell');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentValue;
  input.style.width = '100%';
  
  cell.textContent = '';
  cell.appendChild(input);
  input.focus();
  input.select();
  
  const saveEdit = async () => {
    const newValue = input.value.trim();
    cell.classList.remove('editing-cell');
    
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue || null })
      });
      
      if (response.ok) {
        cell.textContent = newValue || '-';
        showProductSuccess('Product updated successfully');
        // Update the allProducts array
        const product = allProducts.find(p => p.id == productId);
        if (product) product[field] = newValue;
      } else {
        const data = await response.json();
        cell.textContent = currentValue || '-';
        showProductError(data.error || 'Failed to update product');
      }
    } catch (error) {
      cell.textContent = currentValue || '-';
      showProductError('Network error: ' + error.message);
    }
  };
  
  input.addEventListener('blur', saveEdit);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      cell.classList.remove('editing-cell');
      cell.textContent = currentValue || '-';
    }
  });
}

function showProductSuccess(message) {
  const successDiv = document.getElementById('productsSuccess');
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  setTimeout(() => { successDiv.style.display = 'none'; }, 3000);
}

function showProductError(message) {
  const errorDiv = document.getElementById('productsError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// Delete product
window.deleteProduct = async function(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  
  const errorDiv = document.getElementById('productsError');
  errorDiv.style.display = 'none';
  
  try {
    const response = await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      loadProducts();
      loadStats();
    } else {
      errorDiv.textContent = data.error || 'Failed to delete product';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error: ' + error.message;
    errorDiv.style.display = 'block';
  }
};

// ===== Outbound Log Functions =====

// Helper function to calculate date 30 days ago
function getLast30DaysDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

// Helper function to get today's date
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Load outbound log with date filtering
async function loadOutboundLog() {
  const tbody = document.getElementById('outboundTableBody');
  const errorDiv = document.getElementById('outboundError');
  const statsDiv = document.getElementById('outboundStats');
  
  errorDiv.style.display = 'none';
  tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px;">Loading...</td></tr>';

  // Set default dates if not already set
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');
  
  if (!fromDateInput.value) {
    fromDateInput.value = getLast30DaysDate();
  }
  if (!toDateInput.value) {
    toDateInput.value = getTodayDate();
  }

  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;

  try {
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);

    const response = await fetch(`/api/admin/outbound-log?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch outbound log');
    }
    
    const data = await response.json();
    const logs = data.logs || [];

    statsDiv.textContent = `Showing ${logs.length} dispatched item(s) from ${fromDate} to ${toDate}`;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px; color: #999;">No dispatched items found for this date range.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(log => {
      const dispatchDate = new Date(log.dispatched_at);
      const formattedDate = dispatchDate.toLocaleString();

      return `
        <tr>
          <td style="white-space: nowrap;">${formattedDate}</td>
          <td>${log.brand || '-'}</td>
          <td>${log.product_code || '-'}</td>
          <td>${log.seed_size || '-'}</td>
          <td>${log.package_type || '-'}</td>
          <td>${log.lot || '-'}</td>
          <td>${log.owner || '-'}</td>
          <td>${log.location_label || '-'}</td>
          <td>${log.zone || '-'}</td>
          <td>${log.dispatched_by || '-'}</td>
          <td style="max-width: 200px; white-space: normal;">${log.notes || '-'}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Failed to load outbound log:', error);
    errorDiv.textContent = 'Failed to load outbound log: ' + error.message;
    errorDiv.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px; color: #f44336;">Error loading data</td></tr>';
  }
}

// Export outbound log as CSV
async function exportOutboundCSV() {
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;

  try {
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);

    const response = await fetch(`/api/admin/outbound-log/export?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error('Failed to export CSV');
    }
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outbound-log-${fromDate}-to-${toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export CSV:', error);
    alert('Failed to export CSV: ' + error.message);
  }
}

// Event listeners for outbound log
document.getElementById('filterOutboundBtn')?.addEventListener('click', loadOutboundLog);
document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
  document.getElementById('fromDate').value = getLast30DaysDate();
  document.getElementById('toDate').value = getTodayDate();
  loadOutboundLog();
});
document.getElementById('exportCsvBtn')?.addEventListener('click', exportOutboundCSV);

// Import Products functionality
let selectedFile = null;

document.getElementById('selectFileBtn')?.addEventListener('click', () => {
  document.getElementById('excelFileInput').click();
});

document.getElementById('excelFileInput')?.addEventListener('change', (e) => {
  selectedFile = e.target.files[0];
  const fileNameDisplay = document.getElementById('selectedFileName');
  const importBtn = document.getElementById('importBtn');
  
  if (selectedFile) {
    fileNameDisplay.textContent = `Selected: ${selectedFile.name}`;
    importBtn.disabled = false;
  } else {
    fileNameDisplay.textContent = '';
    importBtn.disabled = true;
  }
});

document.getElementById('importBtn')?.addEventListener('click', async () => {
  if (!selectedFile) return;

  const progressDiv = document.getElementById('importProgress');
  const resultsDiv = document.getElementById('importResults');
  const summaryDiv = document.getElementById('importSummary');
  const errorsDiv = document.getElementById('importErrors');
  const brandName = document.getElementById('importBrandName').value.trim();
  
  progressDiv.classList.remove('hidden');
  resultsDiv.classList.add('hidden');

  try {
    const formData = new FormData();
    formData.append('file', selectedFile);
    if (brandName) {
      formData.append('brand', brandName);
    }

    const response = await fetch('/api/products/import', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    progressDiv.classList.add('hidden');
    resultsDiv.classList.remove('hidden');

    if (response.ok && data.success) {
      const brandInfo = brandName ? `<p style="margin: 5px 0;"><strong>Brand:</strong> ${brandName}</p>` : '';
      summaryDiv.innerHTML = `
        <div style="padding: 15px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; margin-bottom: 15px;">
          <h4 style="margin-top: 0; color: #155724;">✓ Import Successful</h4>
          ${brandInfo}
          <p style="margin: 5px 0;"><strong>New Products:</strong> ${data.imported}</p>
          <p style="margin: 5px 0;"><strong>Updated Products:</strong> ${data.updated}</p>
          <p style="margin: 5px 0;"><strong>Skipped Rows:</strong> ${data.skipped}</p>
          <p style="margin: 5px 0;"><strong>Total Rows:</strong> ${data.total}</p>
        </div>
      `;

      if (data.errors && data.errors.length > 0) {
        errorsDiv.innerHTML = `
          <div style="padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
            <h4 style="margin-top: 0; color: #856404;">⚠️ Errors (${data.errors.length})</h4>
            <ul style="margin: 0; padding-left: 20px;">
              ${data.errors.map(err => `<li>Row ${err.row} (GTIN: ${err.gtin}): ${err.error}</li>`).join('')}
            </ul>
          </div>
        `;
      } else {
        errorsDiv.innerHTML = '';
      }

      // Reload products table
      loadProducts();
      
      // Reset form
      document.getElementById('importBrandName').value = '';
      document.getElementById('excelFileInput').value = '';
      document.getElementById('selectedFileName').textContent = '';
      document.getElementById('importBtn').disabled = true;
      selectedFile = null;
    } else {
      summaryDiv.innerHTML = `
        <div style="padding: 15px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
          <h4 style="margin-top: 0; color: #721c24;">✗ Import Failed</h4>
          <p>${data.error || 'Unknown error occurred'}</p>
        </div>
      `;
      errorsDiv.innerHTML = '';
    }
  } catch (error) {
    progressDiv.classList.add('hidden');
    resultsDiv.classList.remove('hidden');
    summaryDiv.innerHTML = `
      <div style="padding: 15px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
        <h4 style="margin-top: 0; color: #721c24;">✗ Import Failed</h4>
        <p>${error.message}</p>
      </div>
    `;
    errorsDiv.innerHTML = '';
  }
});

// Product search functionality
document.getElementById('productSearchInput')?.addEventListener('input', (e) => {
  const searchTerm = e.target.value;
  loadProducts(searchTerm);
});

document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
  document.getElementById('productSearchInput').value = '';
  loadProducts();
});

// Initialize on page load
checkAuth();
