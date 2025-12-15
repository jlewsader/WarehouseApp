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
    this.inventoryByLocation[item.location_id] = item;
  });
},

methods: {
  isOccupied(locationId) {
    return !!this.inventoryByLocation[locationId];
  },

  inventoryAt(locationId) {
    return this.inventoryByLocation[locationId] || null;
  }
}

}).mount("#app");