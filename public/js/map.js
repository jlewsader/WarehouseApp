const { createApp } = Vue;

createApp({
  data() {
    return {
      locations: [],
      inventoryByLocation: {},
      inbound: [],
      inboundSort: "newest",
      zones: ["Center", "East Wall", "West Wall"],
      activeZone: "Center",
      selectedLocationId: null,
      selectedInboundId: null
    };
  },

  computed: {
    rows() {
      const rows = {};

      this.grid.forEach(cell => {
        if (!rows[cell.row]) rows[cell.row] = [];
        rows[cell.row].push(cell);
      });

      Object.values(rows).forEach(rowCells => {
        rowCells.sort((a, b) => a.col - b.col);
      });

      return Object.keys(rows)
        .sort((a, b) => a - b)
        .map(r => ({
          row: r,
          cells: rows[r]
        }));
    },

    zoneLocations() {
      return this.locations.filter(loc => loc.zone === this.activeZone);
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

      return Object.values(grid).sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
    },

    inboundGroups() {
      const groups = {};

      this.inbound.forEach(item => {
        const key = `${item.product_id}|${item.lot || ""}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

      const groupArr = Object.entries(groups).map(([key, items]) => ({
        key,
        product: items[0],
        items: [...items].sort((a, b) => b.id - a.id)
      }));

      groupArr.sort((a, b) => {
        const prodA = a.product;
        const prodB = b.product;

        switch (this.inboundSort) {
          case "brand":
            return prodA.brand.localeCompare(prodB.brand);
          case "product_code":
            return prodA.product_code.localeCompare(prodB.product_code);
          case "lot":
            return (prodA.lot || "").localeCompare(prodB.lot || "");
          case "newest":
          default:
            return b.product.id - a.product.id;
        }
      });

      return groupArr;
    },

    selectedInbound() {
      return this.inbound.find(item => item.id === this.selectedInboundId) || null;
    }
  },

  async mounted() {
    await this.loadData();
  },

  methods: {
    async loadData() {
      const [locRes, invRes, inboundRes] = await Promise.all([
        fetch("/api/locations"),
        fetch("/api/inventory"),
        fetch("/api/inventory/unassigned")
      ]);

      this.locations = await locRes.json();
      const inventory = await invRes.json();
      this.setInventory(inventory);

      this.inbound = await inboundRes.json();
      if (this.inbound.length && !this.selectedInboundId) {
        this.selectedInboundId = this.inbound[0].id;
      }
    },

    setInventory(inventory) {
      this.inventoryByLocation = {};
      inventory.forEach(item => {
        if (item.location_id !== 9999) {
          this.inventoryByLocation[item.location_id] = item;
        }
      });
    },

    isOccupied(locationId) {
      return !!this.inventoryByLocation[locationId];
    },

    inventoryAt(locationId) {
      return this.inventoryByLocation[locationId] || null;
    },

    selectLocation(location) {
      if (this.isOccupied(location.id)) {
        alert("This location is already occupied.");
        return;
      }
      this.selectedLocationId = location.id;
    },

    async refreshInventory() {
      const invRes = await fetch("/api/inventory");
      const inventory = await invRes.json();
      this.setInventory(inventory);
    },

    async refreshInbound() {
      const inboundRes = await fetch("/api/inventory/unassigned");
      this.inbound = await inboundRes.json();

      if (!this.inbound.length) {
        this.selectedInboundId = null;
        return;
      }

      if (!this.inbound.some(item => item.id === this.selectedInboundId)) {
        this.selectedInboundId = this.inbound[0].id;
      }
    },

    async confirmMove() {
      if (!this.selectedInboundId || !this.selectedLocationId) return;

      try {
        const res = await fetch("/api/inventory/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventory_id: this.selectedInboundId,
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
        await Promise.all([this.refreshInventory(), this.refreshInbound()]);
      } catch (err) {
        console.error(err);
        alert("Move failed");
      }
    }
  }

}).mount("#app");
