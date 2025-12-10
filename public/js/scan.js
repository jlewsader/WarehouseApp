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

/*** GS1 PARSER ***/
function parseGS1(raw) {
  if (!raw) return { raw: raw || "", gtin: null, lot: null };

  // normalize: remove parentheses and spaces, keep ASCII GS (\x1D) if present
  let s = String(raw).replace(/[\(\)\s]/g, "");

  // If there are GS separators, split into tokens for easier parsing
  const GS = "\x1D";
  const tokens = s.includes(GS) ? s.split(GS).filter(Boolean) : null;

  let gtin = null;
  let lot = null;

  // helper: try to extract lot from a tail string (stop at next AI or end)
  const extractLotFromTail = (tail) => {
    if (!tail) return null;
    // stop at next known AI start: 01(14), 17(6), 21(variable), 00(18)
    const aiPattern = /(01\d{14}|17\d{6}|00\d{18}|21\d{1,20})/;
    const m = tail.match(aiPattern);
    if (m) {
      return tail.substring(0, m.index);
    }
    return tail;
  };

  // If tokens exist (scanner emitted GS separators), parse tokens individually
  if (tokens) {
    for (const t of tokens) {
      // AI may be two digits or three — handle common ones
      if (/^01\d{14}/.test(t)) {
        gtin = t.match(/^01(\d{14})/)[1];
      } else if (/^10/.test(t)) {
        const val = t.replace(/^10/, "");
        lot = (val === "" ? null : val);
      } else {
        // other tokens ignored for now
      }
    }
    if (!lot && tokens.length > 0) {
      // fallback: if last token doesn't start with known AI, consider it lot
      const last = tokens[tokens.length - 1];
      if (!/^0\d/.test(last)) lot = last;
    }
    // final trim
    if (typeof lot === "string") lot = lot.trim();
    return { raw, gtin, lot };
  }

  // No GS tokens: attempt to find AI(01) explicitly
  const m01 = s.match(/01(\d{14})/);
  if (m01) {
    gtin = m01[1];
    const afterGtinIndex = m01.index + 2 + 14;
    // look for '10' after the GTIN
    const pos10 = s.indexOf("10", afterGtinIndex);
    if (pos10 >= 0) {
      // candidate lot text after '10'
      let candidate = s.substring(pos10 + 2);
      // if candidate contains '01' + 14 digits etc, trim before that
      candidate = extractLotFromTail(candidate);
      lot = candidate.replace(/\x1D/g, "").trim();
      return { raw, gtin, lot };
    } else {
      // no explicit '10' found; maybe lot immediately follows GTIN w/o AI tag
      let tail = s.substring(afterGtinIndex);
      tail = extractLotFromTail(tail);
      if (tail && tail.length > 0) {
        lot = tail.replace(/\x1D/g, "").trim();
      }
      return { raw, gtin, lot };
    }
  }

  // No explicit AI(01) — fallback: if string starts with 14 digits, treat as GTIN
  const start14 = s.match(/^(\d{14})(.*)$/);
  if (start14) {
    gtin = start14[1];
    const tail = start14[2] || "";
    // look for '10' at start of tail
    if (tail.startsWith("10")) {
      let candidate = tail.substring(2);
      candidate = extractLotFromTail(candidate);
      lot = candidate.replace(/\x1D/g, "").trim();
    } else {
      // otherwise treat tail as lot
      const candidate = extractLotFromTail(tail);
      if (candidate && candidate.length > 0) lot = candidate.replace(/\x1D/g, "").trim();
    }
    return { raw, gtin, lot };
  }

  // Last-resort: find '10' anywhere and take remainder as lot
  const pos10any = s.indexOf("10");
  if (pos10any >= 0) {
    let candidate = s.substring(pos10any + 2);
    candidate = extractLotFromTail(candidate);
    lot = candidate.replace(/\x1D/g, "").trim();
  }

  return { raw, gtin, lot };
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
function renderNewProductForm(barcode, parsedLot) {
  const box = document.getElementById("resultBox");

  box.innerHTML = `
    <h3>New Product</h3>
    <p>Barcode (GTIN): <strong>${barcode}</strong></p>

    <label>Brand<br><input id="pBrand"></label><br>
    <label>Product Code / Description<br><input id="pCode"></label><br>
    <label>Lot<br><input id="pLot" value="${escapeHtml(parsedLot || "")}"></label><br>
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
  // TODO: Continue adding common package types.
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
        package_type,
        units_per_package
      })
    });

    const data = await res.json();

    if (!res.ok) {
      box.innerHTML = `<p style="color:red;">Error: ${data.error || data.message}</p>`;
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
    // If there's a lot value, attempt to save it on the product first (PUT /api/products/:id)
    if (newLot) {
      await fetch(`/api/products/${product_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lot: newLot })
      });
      // ignore response errors here — receive can still proceed; UI will surface server errors if needed
    }

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
      box.innerHTML = `<p style="color:red;">Error: ${data.error || data.message}</p>`;
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

/*** SMALL HELPERS ***/
function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
