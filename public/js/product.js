// Read ?id=123 from URL
function getProductId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// Load product info and locations
async function loadProduct() {
  const id = getProductId();
  const productInfoDiv = document.getElementById("productInfo");
  const locationsList = document.getElementById("locationsList");

  if (!id) {
    productInfoDiv.innerHTML = "<p>Error: No product ID specified.</p>";
    return;
  }

  try {
    // 1. Get product list (we'll filter by ID)
    const productResponse = await fetch(`/api/products`);
    const products = await productResponse.json();
    const product = products.find((p) => p.id == id);

    if (!product) {
      productInfoDiv.innerHTML = "<p>Product not found.</p>";
      return;
    }

    document.getElementById("productTitle").innerText =
      product.brand + " " + product.product_code;

    // Render product info
    productInfoDiv.innerHTML = `
      <strong>Brand:</strong> ${product.brand}<br>
      <strong>Product Code:</strong> ${product.product_code}<br>
      <strong>Seed Size:</strong> ${product.seed_size}<br>
      <strong>Package:</strong> ${product.package_type}<br>
      <strong>Total On-Hand:</strong> ${product.on_hand}
    `;

    // 2. Load locations containing this product
    const invResponse = await fetch(`/api/inventory/product/${id}`);
    const inventory = await invResponse.json();

    if (inventory.length === 0) {
      locationsList.innerHTML = "<p>No locations found.</p>";
      return;
    }

    // Render each location card
    locationsList.innerHTML = inventory
      .map(
        (row) => `
        <div class="location-card">
          <strong>${row.location_label}</strong> (${row.zone})<br>
          Lot: ${row.lot || "N/A"}<br>
          Qty: ${row.qty}<br>
          Owner: ${row.owner || "N/A"}
        </div>
      `
      )
      .join("");

  } catch (error) {
    productInfoDiv.innerHTML = `<p>Error loading product: ${error.message}</p>`;
  }
}

// Initialize
loadProduct();
