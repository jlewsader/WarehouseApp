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

    // Group by product_id
    const groups = {};
    for (const row of items) {
      if (!groups[row.product_id]) groups[row.product_id] = [];
      groups[row.product_id].push(row);
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

    groupArr.forEach(([product_id, rows]) => {
      const prod = rows[0];
      const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);

      const div = document.createElement("div");
      div.className = "product-group";

      div.innerHTML = `
        <h3>${prod.brand} ${prod.product_code}</h3>
        <p>Lot: ${prod.lot || "N/A"} | Size: ${prod.seed_size} | Package: ${prod.package_type}</p>
        <p><strong>Total Qty: ${totalQty}</strong></p>

        <button onclick="toggleDetails('${product_id}')">View Details</button>
        <button onclick="selectGroup('${product_id}', true)">Select All</button>
        <button onclick="selectGroup('${product_id}', false)">Clear</button>

        <div id="details-${product_id}" class="details" style="display:none;"></div>
      `;

      container.appendChild(div);

      // Render detail list
      const detailDiv = div.querySelector(`#details-${product_id}`);
      rows.forEach(r => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "detail-row";

        const checked = selectedIds.has(r.id) ? "checked" : "";

        rowDiv.innerHTML = `
          <input type="checkbox" id="chk-${r.id}" ${checked} onchange="toggleSelect(${r.id})">
          <label for="chk-${r.id}">
            ID: ${r.id} — Qty: ${r.qty} — Owner: ${r.owner}
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

function toggleDetails(product_id) {
  const box = document.getElementById(`details-${product_id}`);
  box.style.display = box.style.display === "none" ? "block" : "none";
}

function toggleSelect(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);

  updateActionButtons();
}

function selectGroup(product_id, selectAll) {
  const details = document.querySelectorAll(`#details-${product_id} input[type=checkbox]`);

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
