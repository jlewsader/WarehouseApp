console.log("move.js loaded");

let selectedIds = [];

window.onload = async () => {
  const data = localStorage.getItem("moveSelection");
  if (!data) return alert("No items selected.");

  selectedIds = JSON.parse(data);

  const listDiv = document.getElementById("selectedList");

  // Display selected items
  selectedIds.forEach(id => {
    const p = document.createElement("p");
    p.textContent = `Inventory ID: ${id}`;
    listDiv.appendChild(p);
  });

  setupZone();
};

function setupZone() {
  const zoneSelect = document.getElementById("zoneSelect");
  const rowSelect = document.getElementById("rowSelect");
  const stackSelect = document.getElementById("stackSelect");

  function populate() {
    const zone = zoneSelect.value;

    rowSelect.innerHTML = "";
    stackSelect.innerHTML = "";

    let rows = 1, stacks = 1;

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
      let opt = document.createElement("option");
      opt.value = r;
      opt.innerText = r;
      rowSelect.appendChild(opt);
    }

    for (let s = 1; s <= stacks; s++) {
      let opt = document.createElement("option");
      opt.value = s;
      opt.innerText = s;
      stackSelect.appendChild(opt);
    }
  }

  zoneSelect.onchange = populate;
  populate();
}

async function moveInventory() {
  const zone = document.getElementById("zoneSelect").value;
  const row = document.getElementById("rowSelect").value;
  const stack = document.getElementById("stackSelect").value;
  const level = document.getElementById("levelSelect").value;

  // Construct location label: C-R1-S1-T
  const label = `${zone[0]}-R${row}-C${stack}-${level}`;

  // Fetch that location ID
  const locRes = await fetch(`/api/locations/by-label/${label}`);
  const location = await locRes.json();

  if (!location.id) return alert("Location not found in DB!");

  // Move items
  const res = await fetch("/api/inventory/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ids: selectedIds,
      location_id: location.id
    })
  });

  if (res.ok) {
    alert("Items moved successfully!");
    localStorage.removeItem("moveSelection");
    window.location = "/unassigned.html";
  } else {
    alert("Move failed");
  }
}

function cancelMove() {
  window.location = "/unassigned.html";
}
