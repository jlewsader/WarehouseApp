let allLocations = [];

// Fetch all locations once
async function loadAllLocations() {
  const res = await fetch("/api/locations");
  allLocations = await res.json();
}

// Build grid for a selected zone
function loadZone(zoneName) {
  const container = document.getElementById("mapContainer");
  container.innerHTML = "Loading...";

  // Filter locations by zone
  const zoneLocations = allLocations.filter((loc) => loc.zone === zoneName);

  if (zoneLocations.length === 0) {
    container.innerHTML = "<p>No locations for this zone.</p>";
    return;
  }

  // Determine grid size dynamically
  const maxRow = Math.max(...zoneLocations.map((l) => l.row_index));
  const maxCol = Math.max(...zoneLocations.map((l) => l.col_index));

  // Set CSS grid columns
  container.style.gridTemplateColumns = `repeat(${maxCol}, 1fr)`;

  // Build grid
  container.innerHTML = "";

  // Create empty grid first
  const grid = new Array(maxRow * maxCol).fill(null);

  // Insert locations
  zoneLocations.forEach((loc) => {
    const idx = (loc.row_index - 1) * maxCol + (loc.col_index - 1);
    if (!grid[idx]) grid[idx] = [];
    grid[idx].push(loc);
  });

  // Render each grid cell
  grid.forEach((stack, index) => {
    const cellDiv = document.createElement("div");
    cellDiv.classList.add("map-cell");

    if (!stack) {
      cellDiv.classList.add("map-empty");
      cellDiv.innerHTML = "(empty)";
      container.appendChild(cellDiv);
      return;
    }

    // Sort by level: T, M, B
    stack.sort((a, b) => {
      const order = { T: 1, M: 2, B: 3 };
      return order[a.level] - order[b.level];
    });

    // Combine stack labels
    cellDiv.innerHTML = stack.map((s) => s.label).join("<br>");

    cellDiv.onclick = () => {
      alert("Clicked: " + stack.map((s) => s.label).join(", "));
    };

    container.appendChild(cellDiv);
  });
}

// Initialize
(async () => {
  await loadAllLocations();
  loadZone("Center"); // Default zone
})();
