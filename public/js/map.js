const { createApp } = Vue;

createApp({
data() {
  return {
    locations: [],
    inventoryByLocation: {},
    zones: ["Center", "East Wall", "West Wall"],
    activeZone: "Center",
    selectedLocationId: null
  };
},

computed: {
  rows() {
    const rows = {};

    this.grid.forEach(cell => {
      if (!rows[cell.row]) rows[cell.row] = [];
      rows[cell.row].push(cell);
    });

    // Sort columns within each row
    Object.values(rows).forEach(rowCells => {
      rowCells.sort((a, b) => a.col - b.col);
    });

    // Return ordered rows
    return Object.keys(rows)
      .sort((a, b) => a - b)
      .map(r => ({
        row: r,
        cells: rows[r]
      }));
  },
  zoneLocations() {
    return this.locations.filter(
      loc => loc.zone === this.activeZone
    );
  },

  grid() {
    const grid = {};

    this.zoneLocations.forEach(loc => {
      const key = `${loc.row_index}-${loc.col_index}`;

      if (!grid[key]) {
        grid[key] = {
          row: loc.row_index,
          col: loc.col_index,
          tiers: {}
        };
      }

      grid[key].tiers[loc.tier] = loc;
    });

    // Convert object → array for v-for
    return Object.values(grid).sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
  }
},

async mounted() {
  const [locRes, invRes] = await Promise.all([
    fetch("/api/locations"),
    fetch("/api/inventory")
  ]);

  this.locations = await locRes.json();

  const inventory = await invRes.json();
inventory.forEach(item => {
  if (item.location_id !== 9999) {
    this.inventoryByLocation[item.location_id] = item;
  }
});},

methods: {
  isOccupied(locationId) {
    return !!this.inventoryByLocation[locationId];
  },

  inventoryAt(locationId) {
    return this.inventoryByLocation[locationId] || null;
  },

  selectLocation(location) {
      console.log("Tier clicked:", location);
    if (this.isOccupied(location.id)) {
      alert("This location is already occupied.");
      return;
    }
    this.selectedLocationId = location.id;
  },

async confirmMove() {
  if (!this.selectedLocationId) return;

  const selectedIds = JSON.parse(
    sessionStorage.getItem("moveSelection") || "[]"
  );

  if (selectedIds.length !== 1) {
    alert("Select exactly ONE item to move.");
    return;
  }

  const inventoryId = selectedIds[0];

  try {
    const res = await fetch("/api/inventory/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventory_id: inventoryId,
        location_id: this.selectedLocationId
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Move failed");
      return;
    }

    alert("Move successful!");

    this.selectedLocationId = null;
    sessionStorage.removeItem("moveSelection");

    // Refresh inventory map
    const invRes = await fetch("/api/inventory");
    const inventory = await invRes.json();
    this.inventoryByLocation = {};
    inventory.forEach(i => {
      this.inventoryByLocation[i.location_id] = i;
    });

  } catch (err) {
    console.error(err);
    alert("Move failed");
  }
}
}

}).mount("#app");

