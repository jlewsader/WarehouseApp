console.log("move.js loaded");

let selectedIds = [];
let selectedLocationLabel = null;
let selectedLocationIds = []; // support multi-selection targets

window.onload = () => {
  const data = localStorage.getItem("moveSelection");
  if (!data) {
    alert("No items selected for move.");
    return;
  }

  selectedIds = JSON.parse(data);
  const listDiv = document.getElementById("selectedList");

  selectedIds.forEach(id => {
    const p = document.createElement("p");
    p.textContent = `Inventory ID: ${id}`;
    listDiv.appendChild(p);
  });

  setupGrid();
};

// Render a scalable grid of selectable locations.
async function setupGrid() {
  // Fetch actual locations and inventory to determine availability.
  let locations = [];
  try {
    const res = await fetch("/api/locations");
    if (!res.ok) throw new Error(`Failed to load locations: ${res.status}`);
    locations = await res.json();
  } catch (err) {
    console.error("Failed to fetch locations:", err);
    // fallback to small static set if server call fails
    locations = [
      { id: null, label: "C-R1-C1-1" },
      { id: null, label: "C-R1-C1-2" },
      { id: null, label: "C-R1-C2-1" },
      { id: null, label: "E-R5-C1-1" },
      { id: null, label: "W-R2-C3-1" },
      { id: null, label: "C-R10-C4-2" },
    ];
  }

  // Fetch inventory and compute occupied location ids
  let occupied = new Set();
  try {
    const invRes = await fetch("/api/inventory");
    if (invRes.ok) {
      const inv = await invRes.json();
      inv.forEach(row => {
        if (row.location_id) occupied.add(row.location_id);
      });
    }
  } catch (err) {
    console.error("Failed to fetch inventory for occupancy:", err);
  }

  // We will render up to 6 locations for testing; choose the first 6
  const toShow = locations.slice(0, 6);

  let grid = document.getElementById("locationGrid");
  if (!grid) {
    grid = document.createElement("div");
    grid.id = "locationGrid";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(3, 1fr)";
    grid.style.gap = "8px";
    grid.style.marginTop = "12px";

    const container = document.getElementById("selectedList") || document.body;
    container.parentNode.insertBefore(grid, container.nextSibling);
  }

  grid.innerHTML = "";

  const multiSelect = selectedIds.length > 1;

  toShow.forEach(loc => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "loc-tile";
    tile.textContent = loc.label;
    tile.dataset.label = loc.label;
    tile.dataset.id = loc.id;
    tile.style.padding = "8px";
    tile.style.border = "1px solid #444";
    tile.style.borderRadius = "4px";
    tile.style.background = "#fff";
    tile.style.cursor = "pointer";
    tile.style.minHeight = "40px";

    const isOccupied = loc.id != null && occupied.has(loc.id);
    if (isOccupied) {
      tile.disabled = true;
      tile.style.opacity = "0.5";
      tile.title = "Occupied - cannot move here";
      tile.textContent = `${loc.label} (occupied)`;
    } else {
      // selection behavior: single select or multi-select depending on how many items are being moved
      tile.onclick = () => {
        if (!multiSelect) {
          Array.from(grid.children).forEach(c => {
            c.style.background = "#fff";
            c.style.color = "#000";
          });
          tile.style.background = "#2b82ff";
          tile.style.color = "#fff";
          selectedLocationLabel = tile.dataset.label;
          selectedLocationIds = [tile.dataset.id || null];
        } else {
          // toggle selection for multi-select
          const idx = selectedLocationIds.indexOf(tile.dataset.id || null);
          if (idx === -1) {
            // enforce limit
            if (selectedLocationIds.length >= selectedIds.length) {
              alert(`You can only select ${selectedIds.length} locations for this move.`);
              return;
            }
            selectedLocationIds.push(tile.dataset.id || null);
            tile.style.background = "#2b82ff";
            tile.style.color = "#fff";
          } else {
            selectedLocationIds.splice(idx, 1);
            tile.style.background = "#fff";
            tile.style.color = "#000";
          }
        }
      };
    }

    grid.appendChild(tile);
  });

  // Add a small hint
  const hint = document.createElement("div");
  hint.textContent = "Select a target location, then click Move.";
  hint.style.marginTop = "8px";
  hint.style.fontSize = "0.9em";
  grid.parentNode.insertBefore(hint, grid.nextSibling);
}

async function moveInventory() {
  try {
    if (!selectedIds || selectedIds.length === 0) {
      alert("No inventory selected.");
      return;
    }

    // Determine target label: prefer the selected grid tile if present
    let label = selectedLocationLabel || null;

    if (!label) {
      // fallback to legacy dropdowns if the grid wasn't used
      const zoneEl = document.getElementById("zoneSelect");
      const rowEl = document.getElementById("rowSelect");
      const stackEl = document.getElementById("stackSelect");
      const levelEl = document.getElementById("levelSelect");

      if (!zoneEl || !rowEl || !stackEl || !levelEl) {
        alert("No target location selected.");
        return;
      }

      const zone = zoneEl.value;
      const row = rowEl.value;
      const stack = stackEl.value;
      const level = levelEl.value;

      let prefix = "C";
      if (zone === "East") prefix = "E";
      if (zone === "West") prefix = "W";

      label = `${prefix}-R${row}-C${stack}-${level}`;
    }

    console.log("Target label:", label);

    // If multiple inventory rows are selected, expect multiple target locations
    if (selectedIds.length > 1) {
      if (!selectedLocationIds || selectedLocationIds.length !== selectedIds.length) {
        alert(`Please select ${selectedIds.length} target locations (one per item).`);
        return;
      }

      // Resolve any null ids by looking up labels
      const resolvedIds = [];
      for (const lid of selectedLocationIds) {
        if (lid) {
          resolvedIds.push(parseInt(lid, 10));
          continue;
        }
        // find the button with this label in the grid
        const btn = Array.from(document.querySelectorAll('.loc-tile'))
          .find(b => (b.dataset.id === lid || (!b.dataset.id && b.dataset.label && selectedLocationIds.includes(b.dataset.id))));
        // fallback: try lookup by label from selectedLocationLabel (not ideal for multi)
        // As a safer approach, call by-label for each selected label found on tiles
      }

      // We'll perform sequential moves: one POST per inventory id -> to_location_id
      for (let i = 0; i < selectedIds.length; i++) {
        let targetId = selectedLocationIds[i];
        let targetLabel = null;

        if (!targetId) {
          // need to lookup by label from the tile text (match by order of selection)
          // Find the i-th selected tile in document order
          const selectedButtons = Array.from(document.querySelectorAll('.loc-tile'))
            .filter(b => b.style.background === 'rgb(43, 130, 255)' || b.style.background === '#2b82ff');
          const btn = selectedButtons[i];
          if (!btn) {
            alert('Failed to map selected locations to targets.');
            return;
          }
          targetLabel = btn.dataset.label;
          const lookupRes = await fetch(`/api/locations/by-label/${encodeURIComponent(targetLabel)}`);
          if (!lookupRes.ok) {
            const txt = await lookupRes.text();
            alert(`Location lookup failed (${lookupRes.status}): ${txt}`);
            return;
          }
          const locObj = await lookupRes.json();
          targetId = locObj.id;
        }

        const moveRes = await fetch('/api/inventory/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inventory_ids: [selectedIds[i]], to_location_id: targetId })
        });

        const resp = await moveRes.json();
        if (!moveRes.ok) {
          alert(`Move failed for inventory ${selectedIds[i]}: ${resp.error || JSON.stringify(resp)}`);
          return;
        }
      }

      alert(`Moved ${selectedIds.length} entries to ${selectedIds.length} locations.`);
      localStorage.removeItem('moveSelection');
      window.location = '/unassigned.html';
      return;
    }

    // Single-item move (existing flow)
    const locRes = await fetch(`/api/locations/by-label/${encodeURIComponent(label)}`);
    if (!locRes.ok) {
      const txt = await locRes.text();
      alert(`Location lookup failed (${locRes.status}): ${txt}`);
      return;
    }
    const location = await locRes.json();
    console.log('Location row:', location);

    // Call inventory/move (keeps original request shape)
    const moveRes = await fetch('/api/inventory/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory_ids: selectedIds, to_location_id: location.id })
    });

    const body = await moveRes.json();
    if (!moveRes.ok) {
      alert(`Move failed: ${body.error || JSON.stringify(body)}`);
      return;
    }

    alert(`Moved ${selectedIds.length} entries to ${label}.`);
    localStorage.removeItem("moveSelection");
    window.location = "/unassigned.html";
  } catch (err) {
    console.error("Move error:", err);
    alert("Unexpected move error: " + err.message);
  }
}

function cancelMove() {
  window.location = "/unassigned.html";
}
