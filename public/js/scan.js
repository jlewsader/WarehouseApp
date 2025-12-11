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

// Common dropdown options for new-product form
const BRANDS = ["Keystone", "Dekalb", "Croplan", "Brevant", "Asgrow", "Armor", "Agrigold", "NK", "Xitavo"];
const SEED_SIZES = ["MP", "MF", "MR", "LP", "AF", "AF2", "AR", "AR2", "CPR2", "CPF2", "CPR", "CPF", "CPP", "F1", "F2", "R1", "R2"];
const PACKAGE_TYPES = ["SP50", "SP45", "SP40", "SP35", "SP30", "MB45", "MB40", "80M", "140M"];

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
  // Read dropdowns (allow 'Other' input fields)
  const brandSel = document.getElementById("pBrandSelect");
  const brand = (brandSel.value === "__OTHER__") ? document.getElementById("pBrandOther").value.trim() : brandSel.value.trim();

  const product_code = document.getElementById("pCode").value.trim();

  const lot = document.getElementById("pLot").value.trim();

  const sizeSel = document.getElementById("pSizeSelect");
  const seed_size = (sizeSel.value === "__OTHER__") ? document.getElementById("pSizeOther").value.trim() : sizeSel.value.trim();

  const pkgSel = document.getElementById("pPackageSelect");
  const package_type = (pkgSel.value === "__OTHER__") ? document.getElementById("pPackageOther").value.trim() : pkgSel.value.trim();

  // Determine units per package
  let units_per_package = 1;
  const pkg = (package_type || "").toUpperCase();
  const manualMap = { MB45: 45, MB40: 40, PB80: 1, "80M": 1, PB140: 1, "140M": 1 };

  if (manualMap[pkg] !== undefined) units_per_package = manualMap[pkg];
  else {
    const match = pkg.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if ([50, 45, 40, 35, 30, 25, 20].includes(num)) units_per_package = num;
      else if ([80, 140].includes(num)) units_per_package = 1;
      else units_per_package = 1;
    }
  }

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
        package_type,
        units_per_package
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
      // Use the lot value currently in the form as parsed/prefill
      const parsedLot = document.getElementById("pLot").value.trim();
      renderProductFound(created, parsedLot);
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
