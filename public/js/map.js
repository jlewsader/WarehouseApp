const LEVELS = ["T", "M", "B"];
let allLocations = [];
let inventoryByLocation = new Map();

function getLocationKey(locationId) {
  return String(locationId ?? "");
}

function normalizeLabel(label) {
  return String(label ?? "").trim().toUpperCase();
}

function parseLevel(label) {
  const match = label?.match(/-(T|M|B)$/);
  return match ? match[1] : "";
}

async function loadAllData() {
  const statusEl = document.getElementById("mapStatus");
  statusEl.textContent = "Loading map data...";

  try {
    const [locRes, invRes] = await Promise.all([
      fetch("/api/locations"),
      fetch("/api/inventory"),
    ]);

    if (!locRes.ok) throw new Error(`Locations request failed (${locRes.status})`);
    if (!invRes.ok) throw new Error(`Inventory request failed (${invRes.status})`);

    allLocations = await locRes.json();
    const inventory = await invRes.json();

    inventoryByLocation = new Map();
    inventory.forEach((item) => {
      const idKey = getLocationKey(item.location_id);
      const labelKey = normalizeLabel(item.location_label);

      const idList = inventoryByLocation.get(idKey) || [];
      idList.push(item);
      inventoryByLocation.set(idKey, idList);

      if (labelKey) {
        const labelList = inventoryByLocation.get(labelKey) || [];
        labelList.push(item);
        inventoryByLocation.set(labelKey, labelList);
      }
    });

    loadZone("Center");
  } catch (err) {
    console.error("Failed to load map data", err);
    statusEl.textContent = `Error loading map: ${err.message}`;
  }
}

function buildStacks(locations) {
  const stacks = new Map();

  locations.forEach((loc) => {
    const key = `${loc.row_index}-${loc.col_index}`;
    const level = parseLevel(loc.label) || "";
    const stack = stacks.get(key) || {};
    stack[level] = loc;
    stacks.set(key, stack);
  });

  return stacks;
}

function getItemsForLocation(location) {
  const locationKey = getLocationKey(location?.id);
  const labelKey = normalizeLabel(location?.label);

  return (
    inventoryByLocation.get(locationKey) ||
    inventoryByLocation.get(labelKey) ||
    []
  );
}

function createTier(levelLabel, location) {
  const tier = document.createElement("div");
  tier.className = "tier";

  if (!location) {
    tier.classList.add("tier-missing");
    tier.innerHTML = `
      <div class="tier-row">
        <span class="tier-label">${levelLabel}</span>
        <span class="tier-status">No slot</span>
      </div>
      <div class="tier-code">Not available</div>
    `;
    return tier;
  }

  const locationKey = getLocationKey(location.id);
  const items = getItemsForLocation(location);
  const occupied = items.length > 0;
  tier.classList.add(occupied ? "tier-occupied" : "tier-empty");

  tier.innerHTML = `
    <div class="tier-row">
      <span class="tier-label">${levelLabel}</span>
      <span class="tier-status">${occupied ? "Has item" : "Empty"}</span>
    </div>
    <div class="tier-code">${location.label}</div>
  `;

  tier.addEventListener("click", () => {
    const itemsInSlot = getItemsForLocation(location);
    const message = itemsInSlot.length
      ? `Items in ${location.label}: ${itemsInSlot.length}`
      : `No items in ${location.label}`;
    alert(message);
  });

  return tier;
}

function createStackCell(stackLevels) {
  const stack = document.createElement("div");
  stack.className = "location-stack";

  LEVELS.forEach((level) => {
    stack.appendChild(createTier(level, stackLevels?.[level]));
  });

  return stack;
}

function loadZone(zoneName) {
  const container = document.getElementById("mapContainer");
  const statusEl = document.getElementById("mapStatus");

  container.innerHTML = "";
  statusEl.textContent = "Building map...";

  const zoneLocations = allLocations.filter(
    (loc) => (loc.zone || "").toLowerCase() === zoneName.toLowerCase()
  );

  if (zoneLocations.length === 0) {
    container.innerHTML = "<p>No locations for this zone.</p>";
    statusEl.textContent = `No locations found for ${zoneName}.`;
    return;
  }

  const maxRow = Math.max(...zoneLocations.map((l) => l.row_index));
  const maxCol = Math.max(...zoneLocations.map((l) => l.col_index));
  const stacks = buildStacks(zoneLocations);

  const zoneTable = document.createElement("table");
  zoneTable.className = "map-table";

  const headerRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "row-label";
  corner.textContent = "Row/Col";
  headerRow.appendChild(corner);

  for (let col = 1; col <= maxCol; col++) {
    const th = document.createElement("th");
    th.textContent = `Col ${col}`;
    headerRow.appendChild(th);
  }
  zoneTable.appendChild(headerRow);

  for (let row = 1; row <= maxRow; row++) {
    const tr = document.createElement("tr");
    const rowHeader = document.createElement("th");
    rowHeader.className = "row-label";
    rowHeader.textContent = `Row ${row}`;
    tr.appendChild(rowHeader);

    for (let col = 1; col <= maxCol; col++) {
      const td = document.createElement("td");
      const stackLevels = stacks.get(`${row}-${col}`);

      if (!stackLevels) {
        td.className = "map-empty";
        td.innerHTML = "<div class=\"empty-stack\">No stack</div>";
      } else {
        td.appendChild(createStackCell(stackLevels));
      }

      tr.appendChild(td);
    }

    zoneTable.appendChild(tr);
  }

  container.appendChild(zoneTable);

  const occupiedCount = zoneLocations.filter((loc) =>
    getItemsForLocation(loc).length > 0
  ).length;
  statusEl.textContent = `${zoneName} — ${zoneLocations.length} locations, ${occupiedCount} occupied`;
}

loadAllData();