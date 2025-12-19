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
      loadDropdownOptions();
      loadProducts();
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
async function loadDropdownOptions() {
  try {
    const response = await fetch('/api/admin/dropdown-options');
    const options = await response.json();
    
    // Group by category
    const grouped = {
      brand: [],
      seed_size: [],
      package_type: []
    };
    
    options.forEach(opt => {
      if (grouped[opt.category]) {
        grouped[opt.category].push(opt);
      }
    });
    
    // Render each category
    const container = document.getElementById('dropdownCategories');
    container.innerHTML = '';
    
    const categoryLabels = {
      brand: 'Brands',
      seed_size: 'Seed Sizes',
      package_type: 'Package Types'
    };
    
    for (const [category, items] of Object.entries(grouped)) {
      const section = document.createElement('div');
      section.className = 'category-section';
      section.innerHTML = `
        <h3>${categoryLabels[category]}</h3>
        <div id="${category}-options"></div>
        <div class="add-option-form">
          <input type="text" placeholder="New value" id="${category}-new-value">
          <input type="number" placeholder="Order" id="${category}-new-order" value="${items.length + 1}" style="width: 80px;">
          <button class="btn btn-primary btn-small" onclick="addOption('${category}')">Add</button>
        </div>
      `;
      container.appendChild(section);
      
      // Render items
      const optionsContainer = section.querySelector(`#${category}-options`);
      items.forEach(item => {
        renderOptionItem(optionsContainer, item);
      });
    }
  } catch (error) {
    console.error('Failed to load dropdown options:', error);
  }
}

function renderOptionItem(container, item) {
  const div = document.createElement('div');
  div.className = 'option-item';
  div.dataset.id = item.id;
  div.innerHTML = `
    <input type="number" class="order-input" value="${item.display_order}" 
           onchange="updateOptionOrder(${item.id}, this.value)">
    <input type="text" value="${item.value}" 
           onchange="updateOptionValue(${item.id}, this.value)">
    <button class="btn btn-danger btn-small" onclick="deleteOption(${item.id})">Delete</button>
  `;
  container.appendChild(div);
}

// Add new dropdown option
window.addOption = async function(category) {
  const valueInput = document.getElementById(`${category}-new-value`);
  const orderInput = document.getElementById(`${category}-new-order`);
  
  const value = valueInput.value.trim();
  const display_order = parseInt(orderInput.value) || 0;
  
  if (!value) return;
  
  try {
    const response = await fetch('/api/admin/dropdown-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, value, display_order })
    });
    
    if (response.ok) {
      valueInput.value = '';
      orderInput.value = parseInt(orderInput.value) + 1;
      loadDropdownOptions();
    } else {
      const data = await response.json();
      alert('Error: ' + (data.error || 'Failed to add option'));
    }
  } catch (error) {
    alert('Network error: ' + error.message);
  }
};

// Update option order
window.updateOptionOrder = async function(id, order) {
  try {
    await fetch(`/api/admin/dropdown-options/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_order: parseInt(order) })
    });
  } catch (error) {
    console.error('Failed to update order:', error);
  }
};

// Update option value
window.updateOptionValue = async function(id, value) {
  try {
    await fetch(`/api/admin/dropdown-options/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
  } catch (error) {
    console.error('Failed to update value:', error);
  }
};

// Delete option
window.deleteOption = async function(id) {
  if (!confirm('Are you sure you want to delete this option?')) return;
  
  try {
    const response = await fetch(`/api/admin/dropdown-options/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadDropdownOptions();
    } else {
      const data = await response.json();
      alert('Error: ' + (data.error || 'Failed to delete option'));
    }
  } catch (error) {
    alert('Network error: ' + error.message);
  }
};

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

// Load products
async function loadProducts() {
  const tbody = document.getElementById('productsTableBody');
  const errorDiv = document.getElementById('productsError');
  errorDiv.style.display = 'none';
  
  try {
    const response = await fetch('/api/admin/products');
    const products = await response.json();
    
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No products found</td></tr>';
      return;
    }
    
    tbody.innerHTML = products.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.brand || '-'}</td>
        <td>${p.product_code || '-'}</td>
        <td>${p.seed_size || '-'}</td>
        <td>${p.package_type || '-'}</td>
        <td>${p.barcode || '-'}</td>
        <td>${p.inventory_count || 0}</td>
        <td>
          ${p.inventory_count === 0 
            ? `<button class="btn btn-danger btn-small" onclick="deleteProduct(${p.id})">Delete</button>`
            : `<span style="color: #999;">Has inventory</span>`
          }
        </td>
      </tr>
    `).join('');
  } catch (error) {
    errorDiv.textContent = 'Failed to load products: ' + error.message;
    errorDiv.style.display = 'block';
  }
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

// Initialize on page load
checkAuth();
