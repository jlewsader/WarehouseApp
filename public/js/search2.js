async function searchProducts() {
  const query = document.getElementById("searchInput").value.trim();
  const lot = document.getElementById("lotInput").value.trim();
  const resultsDiv = document.getElementById("results");

  if (!query && !lot) {
    resultsDiv.innerHTML = "<p>Please enter a search term or lot.</p>";
    return;
  }

  try {
    // If lot is provided, use inventory lot search
    if (lot) {
      // If query provided, narrow by product id where possible
      let product_id = null;
      if (query) {
        const pRes = await fetch(`/api/products?brand=${encodeURIComponent(query)}&product=${encodeURIComponent(query)}`);
        const pl = await pRes.json();
        if (Array.isArray(pl) && pl.length > 0) product_id = pl[0].id;
      }

      let searchUrl = `/api/inventory/search?lot=${encodeURIComponent(lot)}`;
      if (product_id) searchUrl += `&product_id=${encodeURIComponent(product_id)}`;

      const response = await fetch(searchUrl);
      const rows = await response.json();

      if (!Array.isArray(rows) || rows.length === 0) {
        resultsDiv.innerHTML = "<p>No inventory found for that lot.</p>";
        return;
      }

      resultsDiv.innerHTML = rows
        .map(r => `
          <div class="result-card" onclick="window.location='/product.html?id=${r.product_id}'">
            <strong>${r.brand}</strong> – ${r.product_code}<br>
            Lot: ${r.lot || 'N/A'} | Qty: ${r.qty} | Location: ${r.location_label || 'UNASSIGNED'}
          </div>
        `).join("");

      return;
    }

    // Product search
    const url = `/api/products?brand=${encodeURIComponent(query)}&product=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const products = await response.json();

    if (!Array.isArray(products) || products.length === 0) {
      resultsDiv.innerHTML = "<p>No products found.</p>";
      return;
    }

    resultsDiv.innerHTML = products
      .map(
        (p) => `
        <div class="result-card" onclick="window.location='/product.html?id=${p.id}'">
          <strong>${p.brand || "Unknown Brand"}</strong> – ${p.product_code}<br>
          On Hand: ${p.on_hand}
        </div>
      `
      )
      .join("");

  } catch (err) {
    resultsDiv.innerHTML = `<p>Error: ${err.message}</p>`;
  }
}

document.getElementById("searchBtn").addEventListener("click", searchProducts);

document.getElementById("searchInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchProducts();
});

document.getElementById("lotInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchProducts();
});
