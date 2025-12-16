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
      selectedDestinationId: null,
      selectedInboundId: null,
      selectedSourceInventoryId: null,
      selectedSourceLocationId: null,
      selectedLocationId: null,
      search: {
        brand: "",
        product: "",
        seed_size: "",
        package_type: "",
        lot: "",
        barcode: ""
      },
      searchResults: [],
      highlightedLocationIds: [],
      searchMessage: "Search by brand, product, seed size, package, or lot.",
      searching: false
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
    },

    selectedMoveInventoryId() {
      return this.selectedSourceInventoryId || this.selectedInboundId || null;
    },

    selectedMoveSummary() {
      if (this.selectedSourceInventoryId && this.selectedSourceLocationId) {
        const item = this.inventoryAt(this.selectedSourceLocationId);
        if (!item) return "";
        return `Inventory ID ${item.id} — ${item.brand} ${item.product_code}`;
      }

      if (this.selectedInbound) {
        return `Inbound ID ${this.selectedInbound.id} — ${this.selectedInbound.brand} ${this.selectedInbound.product_code}`;
      }

      return "";
    },

    highlightedLocationSet() {
      return new Set(this.highlightedLocationIds);
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

    isSearchHit(locationId) {
      return this.highlightedLocationSet.has(locationId);
    },

    selectLocation(location) {
      this.selectedLocationId = location.id;
      const inventory = this.inventoryAt(location.id);

      if (inventory) {
        if (this.selectedSourceLocationId === location.id) {
          this.selectedSourceLocationId = null;
          this.selectedSourceInventoryId = null;
        } else {
          this.selectedSourceLocationId = location.id;
          this.selectedSourceInventoryId = inventory.id;
          this.selectedInboundId = null;
        }

        if (this.selectedDestinationId === location.id) {
          this.selectedDestinationId = null;
        }

        return;
      }

      if (this.selectedDestinationId === location.id) {
        this.selectedDestinationId = null;
        return;
      }

      this.selectedDestinationId = location.id;
      this.selectedSourceInventoryId = null;
      this.selectedSourceLocationId = null;
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
      if (!this.selectedMoveInventoryId) {
        alert("Select an inventory item to move.");
        return;
      }

      if (!this.selectedDestinationId) {
        alert("Choose an empty destination location.");
        return;
      }

      try {
        const res = await fetch("/api/inventory/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventory_id: this.selectedMoveInventoryId,
            location_id: this.selectedDestinationId
          })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || "Move failed");
          return;
        }

        alert("Move successful!");

        this.selectedDestinationId = null;
        this.selectedSourceInventoryId = null;
        this.selectedSourceLocationId = null;

        await Promise.all([this.refreshInventory(), this.refreshInbound()]);
      } catch (err) {
        console.error(err);
        alert("Move failed");
      }
    },

    buildSearchParams() {
      const params = new URLSearchParams();
      const brand = (this.search.brand || "").trim();
      const product = (this.search.product || "").trim();
      const size = (this.search.seed_size || "").trim();
      const pkg = (this.search.package_type || "").trim();
      const lot = (this.search.lot || "").trim();

      if (brand) params.append("brand", brand);
      if (product) params.append("product", product);
      if (size) params.append("size", size);
      if (pkg) params.append("package_type", pkg);
      if (lot) params.append("lot", lot);

      return params;
    },

    async runSearch() {
      const params = this.buildSearchParams();
      if (!params.toString()) {
        this.searchMessage = "Enter at least one filter or parse a barcode.";
        this.searchResults = [];
        this.highlightedLocationIds = [];
        return;
      }

      this.searching = true;
      try {
        const res = await fetch(`/api/inventory/search?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Search failed");
        }

        this.searchResults = Array.isArray(data) ? data : [];
        this.highlightedLocationIds = this.searchResults
          .filter(r => r.location_id && r.location_id !== 9999)
          .map(r => r.location_id);

        this.searchMessage = this.searchResults.length
          ? "Results highlighted on the map."
          : "No inventory matched those filters.";
      } catch (err) {
        this.searchMessage = `Error: ${err.message}`;
        this.searchResults = [];
        this.highlightedLocationIds = [];
      } finally {
        this.searching = false;
      }
    },

    async prefillFromBarcode() {
      const raw = (this.search.barcode || "").trim();
      if (!raw) {
        this.searchMessage = "Enter a barcode to parse.";
        return;
      }

      if (typeof parseGS1 !== "function") {
        this.searchMessage = "Barcode parser unavailable.";
        return;
      }

      const parsed = parseGS1(raw);
      if (parsed.lot) {
        this.search.lot = parsed.lot;
      }

      const lookupCode = parsed.gtin || raw;

      try {
        const res = await fetch(`/api/products/barcode/${encodeURIComponent(lookupCode)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          this.searchMessage = data.message === "NOT_FOUND"
            ? "No product found for that barcode. Lot captured if present."
            : (data.error || "Unable to look up barcode.");
          await this.runSearch();
          return;
        }

        const product = await res.json();
        this.search.brand = product.brand || "";
        this.search.product = product.product_code || "";
        this.search.seed_size = product.seed_size || "";
        this.search.package_type = product.package_type || "";
        if (parsed.lot) {
          this.search.lot = parsed.lot;
        }

        this.searchMessage = "Product details prefilled from barcode.";
        await this.runSearch();
      } catch (err) {
        this.searchMessage = `Error reading barcode: ${err.message}`;
      }
    },

    clearSearch() {
      this.search = {
        brand: "",
        product: "",
        seed_size: "",
        package_type: "",
        lot: "",
        barcode: ""
      };
      this.searchResults = [];
      this.highlightedLocationIds = [];
      this.searchMessage = "";
    }
  },

  watch: {
    selectedInboundId(newVal) {
      if (newVal) {
        this.selectedSourceInventoryId = null;
        this.selectedSourceLocationId = null;
      }
    }
  }

}).mount("#app");
