console.log("scan.js loaded");

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

/*** MAIN LOOKUP FUNCTION ***/
async function lookupBarcode(barcode) {
  const box = document.getElementById("resultBox");

  box.innerHTML = `<p>Looking up product for barcode <strong>${barcode}</strong>...</p>`;

  try {
    const res = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`);

    if (res.status === 404) {
      // Product not found → show form
      renderNewProductForm(barcode);
      return;
    }

    const product = await res.json();
    renderProductFound(product);

  } catch (err) {
    box.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

/*** PRODUCT FOUND VIEW ***/
function renderProductFound(product) {
  const box = document.getElementById("resultBox");

  box.innerHTML = `
    <h3>Product Found</h3>
    <p><strong>${product.brand} ${product.product_code}</strong></p>

    <p>Lot: ${product.lot || "N/A"}</p>
    <p>
      Size: ${product.seed_size || "N/A"} |
      Package: ${product.package_type || "N/A"} |
      Units/Package: ${product.units_per_package || 1}
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
function renderNewProductForm(barcode) {
  const box = document.getElementById("resultBox");

  box.innerHTML = `
    <h3>New Product</h3>
    <p>Barcode (GTIN): <strong>${barcode}</strong></p>

    <label>Brand<br><input id="pBrand"></label><br>
    <label>Product Code / Description<br><input id="pCode"></label><br>
    <label>Lot<br><input id="pLot"></label><br>
    <label>Seed Size<br><input id="pSize"></label><br>
    <label>Package Type<br><input id="pPackage"></label><br>
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
  const brand = document.getElementById("pBrand").value.trim();
  const product_code = document.getElementById("pCode").value.trim();
  const lot = document.getElementById("pLot").value.trim();
  const seed_size = document.getElementById("pSize").value.trim();
  const package_type = document.getElementById("pPackage").value.trim();

  let units_per_package = 1;
// TODO: COntinue adding common package types.
  if (package_type.toUpperCase() === "SP50") units_per_package = 50;
  if (package_type.toUpperCase() === "BOX50") units_per_package = 50;
  if (package_type.toUpperCase() === "50") units_per_package = 50;

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
        lot,
        seed_size,
        package_type
      })
    });

    const data = await res.json();

    if (!res.ok) {
      box.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`;
      return;
    }

    box.innerHTML = `
      <p>Product saved successfully!</p>
      <button onclick="continueReceiving()">Continue Receiving</button>
    `;

  } catch (err) {
    box.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

async function receiveInventory(product_id) {
  const qty = parseInt(document.getElementById("recvQty").value);
  const box = document.getElementById("resultBox");

  if (!qty || qty <= 0) {
    box.innerHTML = `<p style="color:red;">Invalid quantity.</p>`;
    return;
  }

  box.innerHTML = `<p>Receiving ${qty} units...</p>`;

  try {
    const res = await fetch("/api/inventory/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id,
        qty,
        owner: "Keystone"
      })
    });

    const data = await res.json();

    if (!res.ok) {
      box.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`;
      return;
    }

    box.innerHTML = `
      <p>Received ${qty} units of product!</p>
      <button onclick="continueReceiving()">Receive Next</button>
      <button onclick="window.location='/unassigned.html'">View Unassigned</button>
    `;

  } catch (err) {
    box.innerHTML = `<p style='color:red;'>Error: ${err.message}</p>`;
  }
}
