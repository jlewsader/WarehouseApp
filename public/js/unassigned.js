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
      const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
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
        const rowUnits = r.qty * (prod.units_per_package || 1);

        rowDiv.innerHTML = `
          <input type="checkbox" id="chk-${r.id}" ${checked} onchange="toggleSelect(${r.id})">
          <label for="chk-${r.id}">
            ID: ${r.id} — Qty: ${r.qty} (${rowUnits} units) — Owner: ${r.owner || "N/A"}
          </label>
        `;

        detailDiv.appendChild(rowDiv);
      });
    });

    updateActionButtons();

  } catch (err) {
    container.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
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

  moveBtn.disabled = !hasSelection;
  deleteBtn.disabled = !hasSelection;
}

document.getElementById("moveBtn").onclick = () => {
  if (selectedIds.size === 0) return;

  // Store selected IDs so Move page can read them
  localStorage.setItem("moveSelection", JSON.stringify([...selectedIds]));

  // Redirect to move UI
  window.location = "/move.html";
};

document.getElementById("deleteBtn").onclick = () => {
  if (selectedIds.size === 0) return;

  if (confirm(`Delete ${selectedIds.size} inventory item(s)?`)) {
    deleteSelected();
  }
};

async function deleteSelected() {
  const ids = Array.from(selectedIds);
  const deleteBtn = document.getElementById("deleteBtn");
  deleteBtn.disabled = true;
  deleteBtn.innerText = "Deleting...";

  try {
    for (const id of ids) {
      await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    }
    selectedIds.clear();
    loadUnassigned();
  } catch (err) {
    alert(`Error deleting inventory: ${err.message}`);
    deleteBtn.disabled = false;
    deleteBtn.innerText = "Delete Selected";
  }
}

/**
 * Escape special characters in groupKey for use in HTML id attribute
 * groupKey format: "product_id|lot"
 */
function escapeId(key) {
  return key.replace(/[|]/g, "_");
}
