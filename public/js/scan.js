console.log("scan.js loaded");

// Common dropdown options for new-product form (loaded from API)
let BRANDS = [];
let SEED_SIZES = [];
let PACKAGE_TYPES = [];

// Load dropdown options from API
async function loadDropdownOptions() {
  try {
    const response = await fetch('/api/dropdowns/options');
    const options = await response.json();
    
    BRANDS = options.brand || [];
    SEED_SIZES = options.seed_size || [];
    PACKAGE_TYPES = options.package_type || [];
  } catch (error) {
    console.error('Failed to load dropdown options:', error);
    // Fallback to empty arrays - admin panel allows adding options
  }
}

// Load options on page load
loadDropdownOptions();

document.getElementById("lookupBtn").onclick = () => {
  const barcode = document.getElementById("barcodeInput").value.trim();
  if (barcode.length === 0) return;

  lookupBarcode(barcode);
};

document.getElementById("barcodeInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const barcode = e.target.value.trim();
    if (barcode.length > 0) lookupBarcode(barcode);
  }
});

function onSelectOther(prefix) {
  const sel = document.getElementById(prefix + "Select");
  const other = document.getElementById(prefix + "Other");
  if (!sel || !other) return;
  other.style.display = sel.value === "__OTHER__" ? "inline-block" : "none";
}

/*** MAIN LOOKUP FUNCTION ***/
async function lookupBarcode(barcode) {
  const box = document.getElementById("resultBox");

  box.innerHTML = `<p>Looking up product for barcode <strong>${barcode}</strong>...</p>`;

  // parse GS1 if present
  const parsed = parseGS1(barcode);
  const lookupCode = parsed.gtin || barcode;

  try {
    const res = await fetch(`/api/products/barcode/${encodeURIComponent(lookupCode)}`);

    if (res.status === 404) {
      // Product not found → show form (prefill lot if parsed)
      renderNewProductForm(lookupCode, parsed.lot);
      return;
    }

    const product = await res.json();
    renderProductFound(product, parsed.lot);

  } catch (err) {
    box.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

/*** PRODUCT FOUND VIEW ***/
function renderProductFound(product, parsedLot) {
  const box = document.getElementById("resultBox");
  const prefillLot = parsedLot || product.lot || "";

  box.innerHTML = `
    <h3>Product Found</h3>
    <p><strong>${product.brand} ${product.product_code}</strong></p>

    <label>Lot<br>
      <input id="recvLot" type="text" value="${escapeHtml(prefillLot)}">
    </label>
    <p>
      Size: ${product.seed_size || "N/A"} |
      Package: ${product.package_type || "N/A"}
    </p>

    <label>Quantity Received<br>
      <input id="recvQty" type="number" min="1" value="1">
    </label>
    <br><br>

    <button onclick="receiveInventory(${product.id})">Receive Inventory</button>
    <button onclick="continueReceiving()">Cancel</button>
  `;
}

function continueReceiving() {
  const box = document.getElementById("resultBox");
  box.innerHTML = `<p>Ready for next barcode.</p>`;
  document.getElementById("barcodeInput").value = "";
  document.getElementById("barcodeInput").focus();
}

/*** PRODUCT NOT FOUND → SHOW CREATION FORM ***/
function renderNewProductForm(barcode, parsedLot) {
  const box = document.getElementById("resultBox");

  // build options HTML
  const brandOptions = BRANDS.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  const sizeOptions = SEED_SIZES.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  const pkgOptions = PACKAGE_TYPES.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");

  box.innerHTML = `
    <h3>New Product</h3>
    <p>Barcode (GTIN): <strong>${barcode}</strong></p>

    <label>Brand<br>
      <select id="pBrandSelect" onchange="onSelectOther('pBrand')">
        <option value="">-- Select Brand --</option>
        ${brandOptions}
        <option value="__OTHER__">Other...</option>
      </select>
      <input id="pBrandOther" placeholder="Type brand" style="display:none; margin-left:8px;">
    </label><br>

    <label>Product Code / Description<br><input id="pCode"></label><br>

    <label>Lot<br><input id="pLot" value="${escapeHtml(parsedLot || "")}"></label><br>

    <label>Seed Size<br>
      <select id="pSizeSelect" onchange="onSelectOther('pSize')">
        <option value="">-- Select Size --</option>
        ${sizeOptions}
        <option value="__OTHER__">Other...</option>
      </select>
      <input id="pSizeOther" placeholder="Type size" style="display:none; margin-left:8px;">
    </label><br>

    <label>Package Type<br>
      <select id="pPackageSelect" onchange="onSelectOther('pPackage')">
        <option value="">-- Select Package --</option>
        ${pkgOptions}
        <option value="__OTHER__">Other...</option>
      </select>
      <input id="pPackageOther" placeholder="Type package" style="display:none; margin-left:8px;">
    </label><br>

    <br>

    <button onclick="saveNewProduct('${barcode}')">Save Product</button>
    <button onclick="cancelNewProduct()">Cancel</button>
  `;
}

function cancelNewProduct() {
  document.getElementById("resultBox").innerHTML = `<p>Ready for next barcode.</p>`;
}

/*** SAVE PRODUCT ***/
async function saveNewProduct(barcode) {
  // Read ALL form values BEFORE clearing the HTML (important!)
  const brandSel = document.getElementById("pBrandSelect");
  const brand = (brandSel.value === "__OTHER__") ? document.getElementById("pBrandOther").value.trim() : brandSel.value.trim();

  const product_code = document.getElementById("pCode").value.trim();

  const lot = document.getElementById("pLot").value.trim();

  const sizeSel = document.getElementById("pSizeSelect");
  const seed_size = (sizeSel.value === "__OTHER__") ? document.getElementById("pSizeOther").value.trim() : sizeSel.value.trim();

  const pkgSel = document.getElementById("pPackageSelect");
  const package_type = (pkgSel.value === "__OTHER__") ? document.getElementById("pPackageOther").value.trim() : pkgSel.value.trim();

  const box = document.getElementById("resultBox");
  box.innerHTML = `<p>Saving product...</p>`;

  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barcode,
        brand,
        product_code,
        seed_size,
        package_type
      })
    });

    const data = await res.json();

    if (!res.ok) {
      box.innerHTML = `<p style="color:red;">Error: ${data.error || data.message}</p>`;
      return;
    }

    // After creating the product, load the product by barcode and render the product-found view
    const lookupRes = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`);
    if (lookupRes.ok) {
      const created = await lookupRes.json();
      // Use the lot value we captured earlier
      renderProductFound(created, lot);
    } else {
      // fallback: show continue button
      box.innerHTML = `
        <p>Product saved successfully!</p>
        <button onclick="continueReceiving()">Continue Receiving</button>
      `;
    }

  } catch (err) {
    box.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

/*** RECEIVE INVENTORY ***/
async function receiveInventory(product_id) {
  const qty = parseInt(document.getElementById("recvQty").value);
  const box = document.getElementById("resultBox");

  if (!qty || qty <= 0) {
    box.innerHTML = `<p style="color:red;">Invalid quantity.</p>`;
    return;
  }

  // read lot from field (editable)
  const lotInputEl = document.getElementById("recvLot");
  const newLot = lotInputEl ? lotInputEl.value.trim() : null;

  box.innerHTML = `<p>Receiving ${qty} units...</p>`;

  try {
      const res = await fetch("/api/inventory/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id,
        qty,
        owner: "Keystone",
        lot: newLot || null
      })
    });

    const data = await res.json();

    if (!res.ok) {
      box.innerHTML = `<p style="color:red;">Error: ${data.error || data.message}</p>`;
      return;
    }

    box.innerHTML = `
      <p>Received ${qty} units of product!</p>
      <button onclick="continueReceiving()">Receive Next</button>
      <button onclick="window.location='/map.html#inbound'">View Inbound</button>
    `;

  } catch (err) {
    box.innerHTML = `<p style='color:red;'>Error: ${err.message}</p>`;
  }
}

/*** SMALL HELPERS ***/
function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
