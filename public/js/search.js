async function searchProducts() {
  const query = document.getElementById("searchInput").value.trim();
  const resultsDiv = document.getElementById("results");

  if (!query) {
    resultsDiv.innerHTML = "<p>Please enter a search term.</p>";
    return;
  }

const url = `/api/products?brand=${encodeURIComponent(query)}&product=${encodeURIComponent(query)}`;
  try {
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
