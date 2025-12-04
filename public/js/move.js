console.log("move.js loaded");

let selectedIds = [];

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

  setupZone();
};

// Build zone / row / stack dropdowns based on your warehouse layout
function setupZone() {
  const zoneSelect = document.getElementById("zoneSelect");
  const rowSelect = document.getElementById("rowSelect");
  const stackSelect = document.getElementById("stackSelect");

  function populate() {
    const zone = zoneSelect.value;

    rowSelect.innerHTML = "";
    stackSelect.innerHTML = "";

    let rows = 1;
    let stacks = 1;

    if (zone === "Center") {
      rows = 25;
      stacks = 5;
    } else if (zone === "East") {
      rows = 23;
      stacks = 2;
    } else if (zone === "West") {
      rows = 24;
      stacks = 3;
    }

    for (let r = 1; r <= rows; r++) {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      rowSelect.appendChild(opt);
    }

    for (let s = 1; s <= stacks; s++) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      stackSelect.appendChild(opt);
    }
  }

  zoneSelect.onchange = populate;
  populate();
}

async function moveInventory() {
  try {
    if (!selectedIds || selectedIds.length === 0) {
      alert("No inventory selected.");
      return;
    }

    const zone = document.getElementById("zoneSelect").value;
    const row = document.getElementById("rowSelect").value;
    const stack = document.getElementById("stackSelect").value;
    const level = document.getElementById("levelSelect").value;

    // Map zone to label prefix: Center -> C, East -> E, West -> W
    let prefix = "C";
    if (zone === "East") prefix = "E";
    if (zone === "West") prefix = "W";

    const label = `${prefix}-R${row}-C${stack}-${level}`;
    console.log("Target label:", label);

    // Look up the location_id from label
    const locRes = await fetch(`/api/locations/by-label/${encodeURIComponent(label)}`);
    if (!locRes.ok) {
      const txt = await locRes.text();
      alert(`Location lookup failed (${locRes.status}): ${txt}`);
      return;
    }
    const location = await locRes.json();
    console.log("Location row:", location);

    // Call inventory/move
    const moveRes = await fetch("/api/inventory/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedIds,
        location_id: location.id
      })
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
