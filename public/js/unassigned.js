console.log("unassigned.js loaded");

let selectedIds = new Set();

// Load everything when page loads
window.onload = () => loadUnassigned();

async function loadUnassigned() {
  const sort = document.getElementById("sortSelect").value;
  const container = document.getElementById("unassignedContainer");
  container.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch("/api/inventory/unassigned");
    const items = await res.json();

    if (!items.length) {
      container.innerHTML = "<p>No unassigned inventory.</p>";
      updateActionButtons();
      attachButtonListeners();
      return;
    }

    // Group by product_id + lot (unique combination)
    const groups = {};
    for (const row of items) {
      const groupKey = `${row.product_id}|${row.lot || ""}`;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(row);
    }

    // Array form for sorting
    let groupArr = Object.entries(groups);

    groupArr.sort((a, b) => {
      const prodA = a[1][0];
      const prodB = b[1][0];

      switch (sort) {
        case "brand":
          return prodA.brand.localeCompare(prodB.brand);
        case "product_code":
          return prodA.product_code.localeCompare(prodB.product_code);
        case "lot":
          return (prodA.lot || "").localeCompare(prodB.lot || "");
        case "newest":
          return b[1][0].id - a[1][0].id;
        default:
          return 0;
      }
    });

    // Render
    container.innerHTML = "";

    groupArr.forEach(([groupKey, rows]) => {
      const prod = rows[0];
      // Each row is now 1 item, so totalQty = count of rows
      const totalQty = rows.length;
      const totalUnits = totalQty * (prod.units_per_package || 1);

      const div = document.createElement("div");
      div.className = "product-group";

      div.innerHTML = `
        <h3>${prod.brand} ${prod.product_code}</h3>
        <p>
          Lot: ${prod.lot || "N/A"} |
          Size: ${prod.seed_size || "N/A"} |
          Package: ${prod.package_type || "N/A"} |
          Units/Package: ${prod.units_per_package || 1}
        </p>        
        <p><strong>Total Qty: ${totalQty} | Total Units: ${totalUnits}</strong></p>

        <button onclick="toggleDetails('${groupKey}')">View Details</button>
        <button onclick="selectGroup('${groupKey}', true)">Select All</button>
        <button onclick="selectGroup('${groupKey}', false)">Clear</button>

        <div id="details-${escapeId(groupKey)}" class="details" style="display:none;"></div>
      `;

      container.appendChild(div);

      // Render detail list
      const detailDiv = div.querySelector(`#details-${escapeId(groupKey)}`);
      rows.forEach(r => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "detail-row";

        const checked = selectedIds.has(r.id) ? "checked" : "";
        const rowUnits = prod.units_per_package || 1;

        rowDiv.innerHTML = `
          <input type="checkbox" id="chk-${r.id}" ${checked} onchange="toggleSelect(${r.id})">
          <label for="chk-${r.id}">
            ID: ${r.id} — Qty: 1 (${rowUnits} units) — Owner: ${r.owner || "N/A"}
          </label>
        `;

        detailDiv.appendChild(rowDiv);
      });
    });

    updateActionButtons();

  } catch (err) {
    container.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }

  // Re-wire button events (they may be new DOM elements after render)
  attachButtonListeners();
}

function attachButtonListeners() {
  const moveBtn = document.getElementById("moveBtn");
  const deleteBtn = document.getElementById("deleteBtn");

  if (moveBtn) {
    moveBtn.onclick = () => {
if (selectedIds.size !== 1) {
  alert("Select exactly ONE item to move.");
  return;
}
      sessionStorage.setItem("moveSelection", JSON.stringify([...selectedIds]));
      window.location.href = "/map.html";    
    };
  }

  if (deleteBtn) {
    deleteBtn.onclick = () => {
      if (selectedIds.size === 0) return;
      deleteBtn.disabled = true;
      deleteBtn.innerText = "Deleting...";
      // Defer work to next tick - completely outside handler
      setTimeout(() => deleteSelected(), 0);
    };
  }
}

function toggleDetails(groupKey) {
  const box = document.getElementById(`details-${escapeId(groupKey)}`);
  box.style.display = box.style.display === "none" ? "block" : "none";
}

function toggleSelect(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);

  updateActionButtons();
}

function selectGroup(groupKey, selectAll) {
  const details = document.querySelectorAll(`#details-${escapeId(groupKey)} input[type=checkbox]`);

  details.forEach(chk => {
    const id = parseInt(chk.id.replace("chk-", ""));
    chk.checked = selectAll;

    if (selectAll) selectedIds.add(id);
    else selectedIds.delete(id);
  });

  updateActionButtons();
}

function updateActionButtons() {
  const moveBtn = document.getElementById("moveBtn");
  const deleteBtn = document.getElementById("deleteBtn");

  const hasSelection = selectedIds.size > 0;

  if (moveBtn) moveBtn.disabled = !hasSelection;
  if (deleteBtn) deleteBtn.disabled = !hasSelection;
}


async function deleteSelected() {
  const ids = Array.from(selectedIds);

  try {
    // Delete all in parallel instead of one-by-one
    const deletePromises = ids.map(id =>
      fetch(`/api/inventory/${id}`, { method: "DELETE" })
        .then(res => {
          if (!res.ok) {
            console.error(`Failed to delete inventory ${id}:`, res.status, res.statusText);
            return { failed: id };
          }
          return { success: id };
        })
        .catch(err => {
          console.error(`Error deleting ${id}:`, err);
          return { failed: id };
        })
    );

    const results = await Promise.all(deletePromises);
    const failedIds = results.filter(r => r.failed).map(r => r.failed);

    if (failedIds.length > 0) {
      alert(`Failed to delete ${failedIds.length} item(s). See console for details.`);
      // Reload on error
      window.location.href = '/unassigned.html';
    } else {
      // Success - all deleted, redirect
      selectedIds.clear();
      window.location.href = '/unassigned.html';
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert(`Error deleting inventory: ${err.message}`);
    window.location.href = '/unassigned.html';
  }
}

/**
 * Escape special characters in groupKey for use in HTML id attribute
 * groupKey format: "product_id|lot"
 */
function escapeId(key) {
  return key.replace(/[|]/g, "_");
}
