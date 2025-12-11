console.log("move.js loaded");

let selectedIds = [];
let selectedLocations = []; // Array of location IDs, one per item

window.onload = () => {
  const data = localStorage.getItem("moveSelection");
  if (!data) {
    alert("No items selected for move.");
    window.location.href = "/unassigned.html";
    return;
  }

  selectedIds = JSON.parse(data);
  
  // Display selected inventory items and required location selections
  const listDiv = document.getElementById("selectedList");
  const heading = document.createElement("div");
  heading.className = "selection-heading";
  heading.innerHTML = `<strong>Items to move: ${selectedIds.length}</strong><br><small>Select ${selectedIds.length} target location(s)</small>`;
  listDiv.appendChild(heading);

  selectedIds.forEach((id, idx) => {
    const div = document.createElement("div");
    div.className = "inventory-item";
    div.textContent = `${idx + 1}. Inventory ID: ${id}`;
    listDiv.appendChild(div);
  });

  // Load and render location grid
  loadLocationGrid();
};

/**
 * Fetch locations, determine occupancy, and render grid
 */
async function loadLocationGrid() {
  const statusEl = document.getElementById("gridStatus");
  const gridEl = document.getElementById("locationGrid");

  try {
    // Fetch all locations from API
    const locRes = await fetch("/api/locations");
    if (!locRes.ok) throw new Error(`Failed to load locations: ${locRes.status}`);
    let locations = await locRes.json();

    // If no locations from DB, use fallback for testing
    if (!locations || locations.length === 0) {
      locations = generateFallbackLocations();
    }

    // Fetch all inventory to determine occupied locations
    const invRes = await fetch("/api/inventory");
    let occupied = new Set();
    if (invRes.ok) {
      const inventory = await invRes.json();
      inventory.forEach(item => {
        if (item.location_id && item.location_id !== 9999) {
          occupied.add(item.location_id);
        }
      });
    }

    // Show up to 6 locations for testing
    const displayLocations = locations.slice(0, 6);

    if (displayLocations.length === 0) {
      statusEl.textContent = "No locations available.";
      return;
    }

    statusEl.textContent = `${displayLocations.length} locations available`;
    gridEl.innerHTML = "";

    // Render location tiles
    displayLocations.forEach(loc => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "location-tile";
      tile.dataset.id = loc.id;
      tile.dataset.label = loc.label;

      const isOccupied = occupied.has(loc.id);
      const isSelected = selectedLocations.includes(loc.id);

      // Build display text
      let displayText = loc.label || `Location ${loc.id}`;
      let statusText = "";

      if (isOccupied) {
        tile.disabled = true;
        tile.classList.add("occupied");
        statusText = " (occupied)";
      } else {
        tile.onclick = () => selectLocation(tile, loc.id);
        if (isSelected) {
          tile.classList.add("selected");
          const selectionIndex = selectedLocations.indexOf(loc.id) + 1;
          statusText = ` (selection #${selectionIndex})`;
        }
      }

      tile.innerHTML = `
        <div>${displayText}</div>
        <div class="status-text">${statusText || "Available"}</div>
      `;

      gridEl.appendChild(tile);
    });

  } catch (err) {
    console.error("Failed to load locations:", err);
    statusEl.textContent = `Error loading locations: ${err.message}`;
  }
}

/**
 * Fallback locations for testing (6 locations)
 */
function generateFallbackLocations() {
  return [
    { id: 1, label: "C-R1-C1", zone: "Center", row_index: 1, col_index: 1 },
    { id: 2, label: "C-R1-C2", zone: "Center", row_index: 1, col_index: 2 },
    { id: 3, label: "E-R5-C1", zone: "East", row_index: 5, col_index: 1 },
    { id: 4, label: "E-R5-C2", zone: "East", row_index: 5, col_index: 2 },
    { id: 5, label: "W-R2-C1", zone: "West", row_index: 2, col_index: 1 },
    { id: 6, label: "W-R2-C2", zone: "West", row_index: 2, col_index: 2 },
  ];
}

/**
 * Handle location tile selection (toggle, allows multiple selections)
 */
function selectLocation(tile, locationId) {
  // Check if already selected
  if (selectedLocations.includes(locationId)) {
    // Deselect
    selectedLocations = selectedLocations.filter(id => id !== locationId);
    tile.classList.remove("selected");
    updateSelectionDisplay();
  } else {
    // Can only select up to N locations where N = number of items
    if (selectedLocations.length < selectedIds.length) {
      selectedLocations.push(locationId);
      tile.classList.add("selected");
      updateSelectionDisplay();
    } else {
      alert(`You can only select ${selectedIds.length} location(s)`);
    }
  }
}

/**
 * Update selection display and enable/disable move button
 */
function updateSelectionDisplay() {
  const moveBtn = document.getElementById("moveBtn");
  const statusEl = document.getElementById("gridStatus");

  // Rebuild grid to show selection numbers
  loadLocationGrid();

  // Update button state
  const selectionComplete = selectedLocations.length === selectedIds.length;
  if (moveBtn) {
    moveBtn.disabled = !selectionComplete;
    if (selectionComplete) {
      statusEl.textContent = `All ${selectedIds.length} locations selected ✓`;
    } else {
      statusEl.textContent = `Select ${selectedIds.length - selectedLocations.length} more location(s)`;
    }
  }
}

/**
 * Move all selected inventory to their respective target locations
 * Pairs each inventory ID with its corresponding selected location (in order)
 */
async function moveInventory() {
  if (!selectedIds || selectedIds.length === 0) {
    alert("No inventory items selected.");
    return;
  }

  if (selectedLocations.length !== selectedIds.length) {
    alert(`Please select ${selectedIds.length} target location(s).`);
    return;
  }

  const moveBtn = document.getElementById("moveBtn");
  moveBtn.disabled = true;
  moveBtn.textContent = "Moving...";

  try {
    // Move items one at a time, each to its corresponding selected location
    let successCount = 0;
    for (let i = 0; i < selectedIds.length; i++) {
      const invId = selectedIds[i];
      const targetLocId = selectedLocations[i];

      const response = await fetch("/api/inventory/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inventory_ids: [invId],
          to_location_id: targetLocId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`Failed to move item ${i + 1} (ID: ${invId}):`, result.error);
      } else {
        successCount++;
      }
    }

    if (successCount === selectedIds.length) {
      alert(`Successfully moved all ${successCount} item(s)!`);
      localStorage.removeItem("moveSelection");
      window.location.href = "/unassigned.html";
    } else {
      alert(`Moved ${successCount}/${selectedIds.length} items. Some failed - see console.`);
      moveBtn.disabled = false;
      moveBtn.textContent = "Confirm Move";
    }

  } catch (err) {
    console.error("Move error:", err);
    alert(`Error during move: ${err.message}`);
    moveBtn.disabled = false;
    moveBtn.textContent = "Confirm Move";
  }
}

/**
 * Cancel the move operation
 */
function cancelMove() {
  if (confirm("Cancel move operation?")) {
    localStorage.removeItem("moveSelection");
    window.location.href = "/unassigned.html";
  }
}

