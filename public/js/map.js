const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      showSearch: false,
      showInbound: false,
      locations: [],
      inventoryByLocation: {},
      inbound: [],
      inboundSort: "newest",
      zones: ["East Wall", "Center", "West Wall"],
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
      searching: false,
      isDragging: false,
      draggedItemId: null,
      draggedItemType: null,
      validDropZones: new Set(),
      longPressTimer: null,
      touchStartX: 0,
      touchStartY: 0,
      // Multi-select and staging state
      multiSelectMode: false,
      selectedInventoryIds: [],
      customerFilter: "",
      // Multi-move state
      multiMoveMode: false,
      multiMoveDestinations: [], // Array of {inventoryId, locationId} pairs
      scan: {
        barcode: "",
        parsedLot: "",
        view: "idle", // idle | product-found | new-product | message
        message: "Enter or scan a barcode to begin.",
        product: null,
        receivingQty: 1,
        receivingLot: "",
        newProduct: {
          barcode: "",
          brand: "",
          brandOther: "",
          product_code: "",
          lot: "",
          seed_size: "",
          seed_size_other: "",
          package_type: "",
          package_type_other: "",
          units_per_package: 1
        }
      },
      scanOptions: {
        brands: ["Keystone", "Dekalb", "Croplan", "Brevant", "Asgrow", "Armor", "Agrigold", "NK", "Xitavo"],
        seedSizes: ["MP", "MF", "MR", "LP", "AF", "AF2", "AR", "AR2", "CPR2", "CPF2", "CPR", "CPF", "CPP", "F1", "F2", "R1", "R2"],
        packageTypes: ["SP50", "SP45", "SP40", "SP35", "SP30", "MB45", "MB40", "80M", "140M"]
      }
    };
  },

  computed: {
    rows() {
      const rows = {};

      // Use the first zone's grid for backwards compatibility
      const firstZone = this.zones[0];
      const grid = this.gridByZone[firstZone] || [];

      grid.forEach(cell => {
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

    gridByZone() {
      const result = {};

      this.zones.forEach(zone => {
        const zoneLocations = this.locations.filter(loc => loc.zone === zone);
        const grid = {};

        zoneLocations.forEach(loc => {
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

        result[zone] = Object.values(grid).sort((a, b) => {
          if (a.row !== b.row) return a.row - b.row;
          return a.col - b.col;
        });
      });

      return result;
    },

    rowsByZone() {
      const result = {};

      this.zones.forEach(zone => {
        const grid = this.gridByZone[zone];
        const rows = {};

        grid.forEach(cell => {
          if (!rows[cell.row]) rows[cell.row] = [];
          rows[cell.row].push(cell);
        });

        Object.values(rows).forEach(rowCells => {
          rowCells.sort((a, b) => a.col - b.col);
        });

        result[zone] = Object.keys(rows)
          .sort((a, b) => a - b)
          .map(r => ({
            row: r,
            cells: rows[r]
          }));
      });

      return result;
    },

    zoneLocationCounts() {
      const result = {};
      this.zones.forEach(zone => {
        result[zone] = this.locations.filter(loc => loc.zone === zone).length;
      });
      return result;
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
    },

    uniqueCustomers() {
      const customers = new Set();
      Object.values(this.inventoryByLocation).forEach(item => {
        if (item.staged && item.owner) {
          customers.add(item.owner);
        }
      });
      return Array.from(customers).sort();
    },

    filteredInventoryByLocation() {
      if (!this.customerFilter) {
        return this.inventoryByLocation;
      }

      const filtered = {};
      Object.entries(this.inventoryByLocation).forEach(([locationId, item]) => {
        if (this.customerFilter === '__STAGED__') {
          // Show only staged items
          if (item.staged) {
            filtered[locationId] = item;
          }
        } else {
          // Show items for specific customer
          if (item.staged && item.owner === this.customerFilter) {
            filtered[locationId] = item;
          }
        }
      });
      return filtered;
    },

    hasAnyStagedItems() {
      return Object.values(this.inventoryByLocation).some(item => item.staged);
    }
  },

  async mounted() {
    await this.loadData();
  },

  methods: {
    // UI Toggle methods
    toggleSearch() {
      this.showSearch = !this.showSearch;
      if (this.showSearch && this.showInbound) {
        this.showInbound = false;
      }
    },

    toggleInbound() {
      this.showInbound = !this.showInbound;
      if (this.showInbound && this.showSearch) {
        this.showSearch = false;
      }
    },

    // Camera scanner integration
    openCameraScanner(mode) {
      if (typeof window.openCameraScanner === 'function') {
        window.openCameraScanner(mode);
      } else {
        console.error('Camera scanner not available');
      }
    },

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
      if (this.customerFilter) {
        return !!this.filteredInventoryByLocation[locationId];
      }
      return !!this.inventoryByLocation[locationId];
    },

    inventoryAt(locationId) {
      if (this.customerFilter) {
        return this.filteredInventoryByLocation[locationId] || null;
      }
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

    onTierTap(location) {
      const isEmpty = !this.isOccupied(location.id);

      // Multi-move mode: selecting destinations
      if (this.multiMoveMode && isEmpty) {
        this.addMultiMoveDestination(location.id);
        return;
      }

      // Multi-select mode: toggle selection on occupied tiers
      if (this.multiSelectMode && !isEmpty) {
        const inv = this.inventoryAt(location.id);
        if (inv) {
          this.toggleInventorySelection(inv.id);
        }
        return;
      }

      if (!isEmpty) {
        // If already selected as source, toggle off
        if (this.selectedSourceLocationId === location.id) {
          this.clearSelections();
          return;
        }

        // Select source from occupied tier
        this.selectedSourceLocationId = location.id;
        const inv = this.inventoryAt(location.id);
        this.selectedSourceInventoryId = inv ? inv.id : null;
        this.selectedInboundId = null;
        this.selectedLocationId = location.id;
        // Clear prior destination highlight when choosing a new source
        this.selectedDestinationId = null;
        return;
      }

      // Tapping an empty destination
      if (this.selectedDestinationId === location.id) {
        // Toggle off destination
        this.selectedDestinationId = null;
        this.selectedLocationId = null;
        return;
      }

      if (this.selectedMoveInventoryId) {
        this.selectedDestinationId = location.id;
        this.confirmMove();
        return;
      }

      // No source selected yet, just mark destination
      this.selectedDestinationId = location.id;
      this.selectedLocationId = location.id;
    },

    selectInboundItem(item) {
      if (this.selectedInboundId === item.id) {
        this.clearSelections();
        return;
      }

      this.selectedInboundId = item.id;
      this.selectedSourceInventoryId = item.id;
      this.selectedSourceLocationId = null;
      this.selectedDestinationId = null;
      this.selectedLocationId = null;
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

      const summary = this.selectedMoveSummary || `Item ID ${this.selectedMoveInventoryId}`;
      const proceed = window.confirm(`Confirm move:\n\n${summary}\n\n→ to Location ${this.selectedDestinationId}?`);
      if (!proceed) return;

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
        this.selectedInboundId = null;
        this.selectedLocationId = null;

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
    },

    clearSelections() {
      this.selectedDestinationId = null;
      this.selectedSourceInventoryId = null;
      this.selectedSourceLocationId = null;
      this.selectedInboundId = null;
      this.selectedLocationId = null;
    },

    // ----- Embedded scanning / receiving -----
    resetScanState(message = "Enter or scan a barcode to begin.") {
      this.scan = {
        barcode: "",
        parsedLot: "",
        parsedGtin: "",
        view: "idle",
        message,
        product: null,
        receivingQty: 1,
        receivingLot: "",
        newProduct: {
          barcode: "",
          brand: "",
          brandOther: "",
          product_code: "",
          lot: "",
          seed_size: "",
          seed_size_other: "",
          package_type: "",
          package_type_other: "",
          units_per_package: 1
        }
      };
    },

    async lookupInboundBarcode() {
      const raw = (this.scan.barcode || "").trim();
      if (!raw) {
        this.scan.message = "Enter or scan a barcode.";
        return;
      }

      this.scan.view = "message";
      this.scan.message = `Looking up ${raw}...`;

      const parsed = typeof parseGS1 === "function" ? parseGS1(raw) : { gtin: raw };
      const lookupCode = parsed.gtin || raw;
      
      // Store parsed values for later use
      this.scan.parsedLot = parsed.lot || "";
      this.scan.parsedGtin = lookupCode;

      try {
        const res = await fetch(`/api/products/barcode/${encodeURIComponent(lookupCode)}`);

        if (res.status === 404) {
          this.showNewProductForm(lookupCode, this.scan.parsedLot);
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          this.scan.message = data.error || "Lookup failed.";
          return;
        }

        const product = await res.json();
        this.showProductFound(product, this.scan.parsedLot);
      } catch (err) {
        this.scan.view = "message";
        this.scan.message = `Error: ${err.message}`;
      }
    },

    showProductFound(product, parsedLot) {
      this.scan.product = product;
      this.scan.view = "product-found";
      this.scan.receivingQty = 1;
      this.scan.receivingLot = parsedLot || product.lot || "";
      this.scan.message = "";
    },

    showNewProductForm(barcode, parsedLot) {
      this.scan.view = "new-product";
      this.scan.barcode = barcode;
      this.scan.newProduct = {
        barcode,
        brand: "",
        brandOther: "",
        product_code: "",
        lot: parsedLot || "",
        seed_size: "",
        seed_size_other: "",
        package_type: "",
        package_type_other: "",
        units_per_package: 1
      };
      this.scan.message = "Product not found. Create it below.";
    },

    resolveSelectOrOther(value, other) {
      if (value === "__OTHER__") return (other || "").trim();
      return (value || "").trim();
    },

    computeUnitsFromPackage(pkgRaw) {
      const pkg = (pkgRaw || "").toUpperCase();
      const manualMap = { MB45: 45, MB40: 40, PB80: 1, "80M": 1, PB140: 1, "140M": 1 };
      if (manualMap[pkg] !== undefined) return manualMap[pkg];
      const match = pkg.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if ([50, 45, 40, 35, 30, 25, 20].includes(num)) return num;
        if ([80, 140].includes(num)) return 1;
      }
      return 1;
    },

    async saveNewProduct() {
      const np = this.scan.newProduct;
      const brand = this.resolveSelectOrOther(np.brand, np.brandOther);
      const seed_size = this.resolveSelectOrOther(np.seed_size, np.seed_size_other);
      const package_type = this.resolveSelectOrOther(np.package_type, np.package_type_other);
      const units_per_package = this.computeUnitsFromPackage(package_type || np.units_per_package);

      if (!brand || !np.product_code) {
        this.scan.message = "Brand and product code are required.";
        return;
      }

      this.scan.view = "message";
      this.scan.message = "Saving product...";

      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: np.barcode,
            brand,
            product_code: np.product_code.trim(),
            seed_size,
            package_type,
            units_per_package
          })
        });

        const data = await res.json();
        if (!res.ok) {
          this.scan.message = data.error || data.message || "Unable to save product.";
          return;
        }

        // Show product-found view directly with the saved product and parsed lot
        this.showProductFound(data, this.scan.parsedLot);
      } catch (err) {
        this.scan.message = `Error: ${err.message}`;
      }
    },

    async receiveInventoryFromScan() {
      if (!this.scan.product) {
        this.scan.message = "No product selected.";
        return;
      }

      const qty = parseInt(this.scan.receivingQty, 10);
      if (!qty || qty <= 0) {
        this.scan.message = "Quantity must be at least 1.";
        return;
      }

      this.scan.view = "message";
      this.scan.message = `Receiving ${qty} units...`;

      try {
        const res = await fetch("/api/inventory/receive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: this.scan.product.id,
            qty,
            owner: "Keystone",
            lot: this.scan.receivingLot || null
          })
        });

        const data = await res.json();
        if (!res.ok) {
          this.scan.message = data.error || data.message || "Receive failed.";
          return;
        }

        this.scan.message = `Received ${qty} units. Ready for next.`;
        this.scan.view = "idle";
        this.scan.barcode = "";
        this.scan.product = null;
        this.scan.receivingQty = 1;
        this.scan.receivingLot = "";

        await Promise.all([this.refreshInbound(), this.refreshInventory()]);
      } catch (err) {
        this.scan.message = `Error: ${err.message}`;
      }
    },

         // Drag and drop methods
         startDragLocation(locationId, inventoryId) {
           this.draggedItemId = locationId;
           this.draggedItemType = "location";
           this.isDragging = true;
           this.selectedSourceLocationId = locationId;
           this.selectedSourceInventoryId = inventoryId;
           this.selectedInboundId = null;
         },

         startDragInbound(inboundId) {
           this.draggedItemId = inboundId;
           this.draggedItemType = "inbound";
           this.isDragging = true;
           this.selectedInboundId = inboundId;
           this.selectedSourceInventoryId = inboundId;
           this.selectedSourceLocationId = null;
         },

         endDrag() {
           this.isDragging = false;
           this.draggedItemId = null;
           this.draggedItemType = null;
           this.validDropZones.clear();
         },

         canDropHere(locationId) {
           return !this.isOccupied(locationId);
         },

         dropAtLocation(locationId) {
           if (!this.isDragging || !this.draggedItemId) {
             this.endDrag();
             return;
           }

           if (!this.canDropHere(locationId)) {
             this.endDrag();
             return;
           }

           this.selectedDestinationId = locationId;
           this.endDrag();
           this.confirmMove();
         },

         // Long-press detection for mobile
         onTouchStart(event, locationId, inventoryId) {
           this.touchStartX = event.touches[0].clientX;
           this.touchStartY = event.touches[0].clientY;

           this.longPressTimer = setTimeout(() => {
             if (!this.isDragging) {
               this.startDragLocation(locationId, inventoryId);
             }
           }, 500);
         },

         onTouchStartInbound(event, inboundId) {
           this.touchStartX = event.touches[0].clientX;
           this.touchStartY = event.touches[0].clientY;

           this.longPressTimer = setTimeout(() => {
             if (!this.isDragging) {
               this.startDragInbound(inboundId);
             }
           }, 500);
         },

         onTouchMove(event) {
           if (this.longPressTimer && !this.isDragging) {
             const dx = Math.abs(event.touches[0].clientX - this.touchStartX);
             const dy = Math.abs(event.touches[0].clientY - this.touchStartY);
             if (dx > 10 || dy > 10) {
               clearTimeout(this.longPressTimer);
               this.longPressTimer = null;
             }
           }
         },

         onTouchEnd() {
           clearTimeout(this.longPressTimer);
           this.longPressTimer = null;
         },

         onTouchEndDrop(locationId) {
           // If dragging after long-press, attempt drop
           if (this.isDragging) {
             this.dropAtLocation(locationId);
           } else {
             // No drag active; treat as normal touch end
             this.onTouchEnd();
           }
         },

         onDragStart(event, locationId, inventoryId) {
           event.dataTransfer.effectAllowed = "move";
           event.dataTransfer.setData("text/plain", JSON.stringify({
             type: "location",
             locationId,
             inventoryId
           }));
           this.startDragLocation(locationId, inventoryId);
         },

         onDragStartInbound(event, inboundId) {
           event.dataTransfer.effectAllowed = "move";
           event.dataTransfer.setData("text/plain", JSON.stringify({
             type: "inbound",
             inboundId
           }));
           this.startDragInbound(inboundId);
         },

         onDragOver(event) {
           event.preventDefault();
           event.dataTransfer.dropEffect = "move";
         },

         onDragEnd() {
           this.endDrag();
         },

         // Multi-select and staging methods
         toggleMultiSelectMode() {
           this.multiSelectMode = !this.multiSelectMode;
           if (!this.multiSelectMode) {
             this.selectedInventoryIds = [];
           }
           this.clearSelections();
         },

         toggleInventorySelection(inventoryId) {
           const index = this.selectedInventoryIds.indexOf(inventoryId);
           if (index > -1) {
             this.selectedInventoryIds.splice(index, 1);
           } else {
             this.selectedInventoryIds.push(inventoryId);
           }
         },

         isInventorySelected(inventoryId) {
           return this.selectedInventoryIds.includes(inventoryId);
         },

         clearMultiSelect() {
           this.selectedInventoryIds = [];
           this.multiSelectMode = false;
         },

         async stageSelectedItems() {
           if (this.selectedInventoryIds.length === 0) {
             alert("Please select items to stage.");
             return;
           }

           const customer = prompt("Enter customer name:");
           if (!customer || customer.trim() === "") {
             return;
           }

           try {
             const res = await fetch("/api/inventory/stage", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 inventory_ids: this.selectedInventoryIds,
                 customer: customer.trim()
               })
             });

             const data = await res.json();

             if (!res.ok) {
               alert(data.error || "Staging failed");
               return;
             }

             alert(`Successfully staged ${data.staged_count} items for ${data.customer}`);
             this.selectedInventoryIds = [];
             this.multiSelectMode = false;

             await Promise.all([this.refreshInventory(), this.refreshInbound()]);
           } catch (err) {
             console.error(err);
             alert("Staging failed");
           }
         },

         async unstageSelectedItems() {
           if (this.selectedInventoryIds.length === 0) {
             alert("Please select items to unstage.");
             return;
           }

           const proceed = confirm(`Unstage ${this.selectedInventoryIds.length} items?`);
           if (!proceed) return;

           try {
             const res = await fetch("/api/inventory/unstage", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 inventory_ids: this.selectedInventoryIds
               })
             });

             const data = await res.json();

             if (!res.ok) {
               alert(data.error || "Unstaging failed");
               return;
             }

             alert(`Successfully unstaged ${data.unstaged_count} items`);
             this.selectedInventoryIds = [];

             await Promise.all([this.refreshInventory(), this.refreshInbound()]);
           } catch (err) {
             console.error(err);
             alert("Unstaging failed");
           }
         },

         // Multi-move methods
         startMultiMove() {
           if (this.selectedInventoryIds.length === 0) {
             alert("Please select items to move.");
             return;
           }

           this.multiMoveMode = true;
           this.multiMoveDestinations = [];
         },

         addMultiMoveDestination(locationId) {
           // Check if already assigned as destination
           const existing = this.multiMoveDestinations.find(d => d.locationId === locationId);
           if (existing) {
             // Remove it (toggle off)
             this.multiMoveDestinations = this.multiMoveDestinations.filter(d => d.locationId !== locationId);
             return;
           }

           // Check if we've assigned all items
           if (this.multiMoveDestinations.length >= this.selectedInventoryIds.length) {
             alert(`You've already selected ${this.selectedInventoryIds.length} destinations. Deselect a destination first or cancel.`);
             return;
           }

           // Assign next inventory item to this location
           const nextInventoryId = this.selectedInventoryIds[this.multiMoveDestinations.length];
           this.multiMoveDestinations.push({
             inventoryId: nextInventoryId,
             locationId: locationId
           });
         },

         isMultiMoveDestination(locationId) {
           return this.multiMoveDestinations.some(d => d.locationId === locationId);
         },

         getMultiMoveDestinationNumber(locationId) {
           const index = this.multiMoveDestinations.findIndex(d => d.locationId === locationId);
           return index >= 0 ? index + 1 : null;
         },

         cancelMultiMove() {
           this.multiMoveMode = false;
           this.multiMoveDestinations = [];
         },

         async confirmMultiMove() {
           if (this.multiMoveDestinations.length !== this.selectedInventoryIds.length) {
             alert(`Please select ${this.selectedInventoryIds.length} destinations (${this.multiMoveDestinations.length} selected so far).`);
             return;
           }

           const summary = this.multiMoveDestinations.map((dest, idx) => 
             `${idx + 1}. Item ${dest.inventoryId} → Location ${dest.locationId}`
           ).join('\n');

           const proceed = confirm(`Confirm moving ${this.multiMoveDestinations.length} items?\n\n${summary}`);
           if (!proceed) return;

           try {
             // Execute moves sequentially
             let successCount = 0;
             for (const dest of this.multiMoveDestinations) {
               const res = await fetch("/api/inventory/move", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({
                   inventory_id: dest.inventoryId,
                   location_id: dest.locationId
                 })
               });

               if (res.ok) {
                 successCount++;
               } else {
                 const data = await res.json();
                 console.error(`Failed to move item ${dest.inventoryId}:`, data.error);
               }
             }

             alert(`Successfully moved ${successCount} of ${this.multiMoveDestinations.length} items`);

             // Reset state
             this.selectedInventoryIds = [];
             this.multiSelectMode = false;
             this.multiMoveMode = false;
             this.multiMoveDestinations = [];

             await Promise.all([this.refreshInventory(), this.refreshInbound()]);
           } catch (err) {
             console.error(err);
             alert("Multi-move failed");
           }
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

});

// Mount the app and expose it globally for the camera scanner
window.vueApp = app.mount("#app");
