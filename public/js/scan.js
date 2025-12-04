async function lookupBarcode() {
  const barcode = document.getElementById("barcodeInput").value.trim();
  const statusDiv = document.getElementById("scanStatus");
  const formDiv = document.getElementById("productForm");

  formDiv.style.display = "none";
  formDiv.innerHTML = "";

  if (!barcode) {
    statusDiv.innerHTML = "<p>Please enter or scan a barcode.</p>";
    return;
  }

  statusDiv.innerHTML = `<p>Looking up barcode: <strong>${barcode}</strong>...</p>`;

  try {
    const res = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`);

    if (res.status === 404) {
      // Product not found – show add product form
      statusDiv.innerHTML = `<p>Product not found. Add it to the product database.</p>`;
      showNewProductForm(barcode);
      return;
    }

    if (!res.ok) {
      const msg = await res.text();
      statusDiv.innerHTML = `<p>Error looking up product: ${msg}</p>`;
      return;
    }

    const product = await res.json();

    statusDiv.innerHTML = `
      <p>Product found:</p>
      <p><strong>${product.brand || "Unknown Brand"} ${product.product_code}</strong><br>
      Lot: ${product.lot || "N/A"}<br>
      Size: ${product.seed_size || "N/A"} | Package: ${product.package_type || "N/A"}</p>
      <button id="addUnassignedBtn">Add 1 to UNASSIGNED</button>
    `;

    document.getElementById("addUnassignedBtn").onclick = () =>
      addToUnassigned(product.id, 1);

  } catch (err) {
    statusDiv.innerHTML = `<p>Error: ${err.message}</p>`;
  }
}

function showNewProductForm(barcode) {
  const formDiv = document.getElementById("productForm");
  formDiv.style.display = "block";
  formDiv.innerHTML = `
    <h3>New Product Details</h3>
    <p>Barcode: <strong>${barcode}</strong></p>
    <label>Brand<br><input id="npBrand" type="text" /></label><br>
    <label>Product Code / Description<br><input id="npCode" type="text" /></label><br>
    <label>Lot<br><input id="npLot" type="text" /></label><br>
    <label>Seed Size<br><input id="npSize" type="text" placeholder="e.g. M, SF" /></label><br>
    <label>Package Type<br><input id="npPackage" type="text" placeholder="e.g. 50, 80, bulk" /></label><br><br>
    <button id="saveProductBtn">Save Product & Add to UNASSIGNED</button>
  `;

  document.getElementById("saveProductBtn").onclick = async () => {
    const brand = document.getElementById("npBrand").value.trim();
    const product_code = document.getElementById("npCode").value.trim();
    const lot = document.getElementById("npLot").value.trim();
    const seed_size = document.getElementById("npSize").value.trim();
    const package_type = document.getElementById("npPackage").value.trim();

    const statusDiv = document.getElementById("scanStatus");
    statusDiv.innerHTML = "<p>Saving new product...</p>";

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
          package_type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        statusDiv.innerHTML = `<p>Error saving product: ${data.error || "Unknown error"}</p>`;
        return;
      }

      const newProductId = data.id;
      statusDiv.innerHTML = "<p>Product saved. Adding 1 to UNASSIGNED...</p>";

      await addToUnassigned(newProductId, 1);

    } catch (err) {
      statusDiv.innerHTML = `<p>Error: ${err.message}</p>`;
    }
  };
}

async function addToUnassigned(product_id, qty) {
  const statusDiv = document.getElementById("scanStatus");

  try {
    const res = await fetch("/api/inventory/unassigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id, qty, owner: "Keystone" }),
    });

    const data = await res.json();
    if (!res.ok) {
      statusDiv.innerHTML = `<p>Error adding inventory: ${data.error || "Unknown error"}</p>`;
      return;
    }

    statusDiv.innerHTML = `
      <p>✅ Added ${qty} to UNASSIGNED for product ID ${product_id}.</p>
      <p><a href="/scan.html">Scan next</a> | <a href="/unassigned.html">View Unassigned (future)</a></p>
    `;
  } catch (err) {
    statusDiv.innerHTML = `<p>Error: ${err.message}</p>`;
  }
}

document.getElementById("lookupBtn").addEventListener("click", lookupBarcode);
document.getElementById("barcodeInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") lookupBarcode();
});
