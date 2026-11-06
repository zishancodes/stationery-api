const token = sessionStorage.getItem("token");

// Pagination state
let currentPage = 1;
const productsPerPage = 10;

// Stock history pagination state
let currentHistoryPage = 1;
const historyPerPage = 5;

const storedUser = sessionStorage.getItem("user");

// If the user hasn't logged in, send them to the login page.
if (!token || !storedUser) {
  window.location.replace("/login.html");
} else {
  try {
    const user = JSON.parse(storedUser);

    // Update the top header with logged-in user details.
    document.getElementById("headerUserName").textContent =
      user.name || user.email || "User";

    document.getElementById("topBarUser").textContent =
      user.name || user.email || "User";

    // Display the signed-in user's name and role.
    document.getElementById("sidebarUser").textContent =
      user.name || user.email || "Signed in";

    document.getElementById("sidebarUserRole").textContent =
      user.role || "staff";

    // Only show the Add Product button for admins.
    if (user.role === "admin") {
      document.getElementById("addProductButton").hidden = false;
    }

    const addProductButton = document.getElementById("addProductButton");
    const addProductForm = document.getElementById("addProductForm");
    const cancelProductButton = document.getElementById("cancelProductButton");

    addProductButton.addEventListener("click", () => {
      // Clear the previous dashboard message.
      const dashboardMessage = document.getElementById("dashboardMessage");
      dashboardMessage.textContent = "";
      dashboardMessage.className = "";

      // Clear any previous form message.
      productFormMessage.textContent = "";
      productFormMessage.className = "";

      // Show the Add Product form.
      addProductForm.hidden = false;
      addProductButton.hidden = true;
    });
    cancelProductButton.addEventListener("click", () => {
      addProductForm.reset();
      addProductForm.hidden = true;

      if (user.role === "admin") {
        addProductButton.hidden = false;
      }
    });
  } catch (error) {
    // Invalid session data: clear it and return to login.
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.replace("/login.html");
  }
}

// Log out by clearing this tab's session.
document.getElementById("logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  window.location.replace("/login.html");
});

// Charts Related........

let categoryChartInstance = null;
let statusChartInstance = null;

async function renderCharts() {
  try {
    // 1. Fetch all products without pagination to calculate chart metrics
    const response = await fetch("/api/products?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    if (!response.ok || !result.success) return;

    const products = result.data || [];

    // 2. Process Category Breakdown data
    const categoryTotals = {};
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      const cat = p.category || "Uncategorized";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(p.stock || 0);

      const stock = Number(p.stock || 0);
      if (stock === 0) outOfStockCount++;
      else if (stock <= 5) lowStockCount++;
      else inStockCount++;
    });

    const categoryLabels = Object.keys(categoryTotals);
    const categoryData = Object.values(categoryTotals);

    // 3. Render Category Bar Chart
    const categoryCtx = document
      .getElementById("categoryChart")
      .getContext("2d");
    if (categoryChartInstance) categoryChartInstance.destroy();

    categoryChartInstance = new Chart(categoryCtx, {
      type: "bar",
      data: {
        labels: categoryLabels,
        datasets: [
          {
            label: "Units in Stock",
            data: categoryData,
            backgroundColor: "#7c3aed",
            borderRadius: 8,
            barThickness: 32,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: "#f1f5f9" }, beginAtZero: true },
        },
      },
    });

    // 4. Render Premium Donut Chart
    const statusCtx = document.getElementById("statusChart").getContext("2d");
    if (statusChartInstance) statusChartInstance.destroy();

    const totalStatusItems = inStockCount + lowStockCount + outOfStockCount;

    // Custom plugin to draw text inside the center hole of the doughnut chart
    const centerTextPlugin = {
      id: "centerText",
      beforeDraw(chart) {
        const { width, height, ctx } = chart;
        ctx.save();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Draw Subtitle / Label
        ctx.font = "600 12px Inter, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText("Total Items", width / 2, height / 2 - 10);

        // Draw Main Counter Value
        ctx.font = "800 22px Inter, sans-serif";
        ctx.fillStyle = "#0f172a";
        ctx.fillText(totalStatusItems, width / 2, height / 2 + 12);

        ctx.restore();
      },
    };

    statusChartInstance = new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: ["In Stock", "Low Stock", "Out of Stock"],
        datasets: [
          {
            data: [inStockCount, lowStockCount, outOfStockCount],
            backgroundColor: ["#22C55E", "#f59e0b", "#ef4444"],
            hoverBackgroundColor: ["#16a34a", "#d97706", "#dc2626"],
            borderWidth: 2,
            borderColor: "#ffffff",
            borderRadius: 6, // Rounded edges on chart segments
            spacing: 3, // Slight gap between slices
          },
        ],
      },
      plugins: [centerTextPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 16,
              boxWidth: 8,
              font: {
                family: "Inter",
                size: 12,
                weight: "600",
              },
              color: "#475569",
            },
          },
          tooltip: {
            backgroundColor: "#0f172a",
            padding: 10,
            cornerRadius: 10,
            titleFont: { family: "Inter", size: 12, weight: "700" },
            bodyFont: { family: "Inter", size: 12 },
          },
        },
        cutout: "76%", // Make ring thinner for a sleek modern outline
      },
    });
  } catch (error) {
    console.error("Error rendering charts:", error);
  }
}

async function loadProducts() {
  const productTableBody = document.getElementById("productTableBody");
  const dashboardMessage = document.getElementById("dashboardMessage");

  try {
    const searchTerm = productSearch.value.trim();
    const sortOption = productSort.value;

    const sortMap = {
      "name-asc": { sortBy: "name", order: "asc" },
      "name-desc": { sortBy: "name", order: "desc" },
      "price-asc": { sortBy: "price", order: "asc" },
      "price-desc": { sortBy: "price", order: "desc" },
      "stock-asc": { sortBy: "stock", order: "asc" },
      "stock-desc": { sortBy: "stock", order: "desc" },
    };

    const selectedSort = sortMap[sortOption] || {
      sortBy: "_id",
      order: "asc",
    };

    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(productsPerPage),
      sortBy: selectedSort.sortBy,
      order: selectedSort.order,
    });

    const categoryOption = document.getElementById("productCategory").value;

    if (categoryOption !== "all") {
      params.set("category", categoryOption);
    }

    if (searchTerm) {
      params.set("search", searchTerm);
    }

    const response = await fetch(`/api/products?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load products");
    }

    console.log("Products API response:", result);

    window.products = result.data;
    const products = window.products;

    const lowStockResponse = await fetch(
      "/api/products/low-stock",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const lowStockResult = await lowStockResponse.json();
    if (!lowStockResponse.ok || !lowStockResult.success) {
      throw new Error("Unable to load low-stock products.");
    }

    // Filter out products with exactly 0 stock for "Out of Stock", and 1-5 for "Low Stock"
    const allLowStockProducts = lowStockResult.data || [];
    const outOfStockCount = allLowStockProducts.filter(
      (p) => p.stock === 0,
    ).length;
    const lowStockCount = allLowStockProducts.filter(
      (p) => p.stock > 0 && p.stock <= 5,
    ).length;

    document.getElementById("totalProducts").textContent =
      result.pagination.totalProducts;

    document.getElementById("totalUnits").textContent =
      result.pagination.totalUnits;

    document.getElementById("lowStockCount").textContent = lowStockCount;
    document.getElementById("outOfStockCount").textContent = outOfStockCount;

    const pagination = result.pagination;

    const startProduct =
      pagination.totalProducts === 0
        ? 0
        : (pagination.page - 1) * pagination.limit + 1;

    const endProduct = Math.min(
      pagination.page * pagination.limit,
      pagination.totalProducts,
    );

    document.getElementById("paginationInfo").textContent =
      `Showing ${startProduct}–${endProduct} of ${pagination.totalProducts} products`;

    document.getElementById("currentPageInfo").textContent =
      `Page ${pagination.page} of ${Math.max(pagination.totalPages, 1)}`;

    document.getElementById("previousPageButton").disabled =
      !pagination.hasPreviousPage;

    document.getElementById("nextPageButton").disabled =
      !pagination.hasNextPage;

    if (!Array.isArray(products)) {
      throw new Error("Invalid products data received from server");
    }

    renderProducts(products);
    renderCharts();
  } catch (error) {
    console.error("Error loading products:", error);
    productTableBody.innerHTML = `
      <tr>
        <td colspan="5">Unable to load products.</td>
      </tr>
    `;
    dashboardMessage.textContent = error.message;
  }
}

function renderProducts(products) {
  const productTableBody = document.getElementById("productTableBody");

  const isAdmin = JSON.parse(sessionStorage.getItem("user")).role === "admin";

  productTableBody.replaceChildren();

  if (products.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 5;
    cell.textContent = "No products found.";

    row.appendChild(cell);
    productTableBody.appendChild(row);
    return;
  }

  products.forEach((product) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = product.name ?? "";

    const categoryCell = document.createElement("td");
    categoryCell.textContent = product.category || "Uncategorized";

    const priceCell = document.createElement("td");
    priceCell.textContent = `₹${Number(product.price).toFixed(2)}`;

    const stockCell = document.createElement("td");

    const stockQuantity = Number(product.stock ?? 0);
    stockCell.textContent = String(stockQuantity);

    const stockBadge = document.createElement("span");

    if (stockQuantity === 0) {
      stockBadge.className = "stock-badge out-of-stock";
      stockBadge.textContent = "Out of Stock";
    } else if (stockQuantity <= 5) {
      stockBadge.className = "stock-badge low-stock";
      stockBadge.textContent = "Low Stock";
    } else {
      stockBadge.className = "stock-badge in-stock";
      stockBadge.textContent = "In Stock";
    }
    stockCell.appendChild(document.createElement("br"));
    stockCell.appendChild(stockBadge);

    const actionsCell = document.createElement("td");

    if (isAdmin) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "edit-product-button";
      editButton.dataset.id = product._id;
      editButton.textContent = "Edit";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-product-button";
      deleteButton.dataset.id = product._id;
      deleteButton.textContent = "Delete";

      actionsCell.append(editButton, deleteButton);
    } else {
      actionsCell.textContent = "—";
    }

    row.append(nameCell, categoryCell, priceCell, stockCell, actionsCell);

    productTableBody.appendChild(row);
  });
}

if (token) {
  populateCategoryFilter().then(() => {
    loadProducts();
  });
}

const productSearch = document.getElementById("productSearch");
const productSort = document.getElementById("productSort");

function applyProductFilters() {
  const searchTerm = productSearch.value.trim().toLowerCase();
  const sortOption = productSort.value;
  const categoryOption = document.getElementById("productCategory").value;

  // First, filter by search term and category.
  const filteredProducts = (window.products || []).filter((product) => {
    const name = String(product.name || "").toLowerCase();
    const category = String(product.category || "").toLowerCase();

    const matchesSearch =
      name.includes(searchTerm) || category.includes(searchTerm);

    const matchesCategory =
      categoryOption === "all" || category === categoryOption.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  // Next, sort the filtered products.
  filteredProducts.sort((a, b) => {
    switch (sortOption) {
      case "name-asc":
        return String(a.name || "").localeCompare(String(b.name || ""));

      case "name-desc":
        return String(b.name || "").localeCompare(String(a.name || ""));

      case "price-asc":
        return Number(a.price) - Number(b.price);

      case "price-desc":
        return Number(b.price) - Number(a.price);

      case "stock-asc":
        return Number(a.stock) - Number(b.stock);

      case "stock-desc":
        return Number(b.stock) - Number(a.stock);

      default:
        return 0;
    }
  });

  renderProducts(filteredProducts);
}

async function populateCategoryFilter() {
  const categoryFilter = document.getElementById("productCategory");
  const selectedCategory = categoryFilter.value;

  try {
    const response = await fetch("/api/products/categories", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load categories");
    }

    const categories = result.data;

    categoryFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All categories";
    categoryFilter.appendChild(allOption);

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });

    if (categories.includes(selectedCategory)) {
      categoryFilter.value = selectedCategory;
    } else {
      categoryFilter.value = "all";
    }
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

// Reapply filtering and sorting whenever the search changes.
productSearch.addEventListener("input", () => {
  currentPage = 1;
  loadProducts();
});

// Reapply filtering and sorting whenever the sort option changes.
productSort.addEventListener("change", () => {
  currentPage = 1;
  loadProducts();
});

const previousPageButton = document.getElementById("previousPageButton");
const nextPageButton = document.getElementById("nextPageButton");

previousPageButton.addEventListener("click", async () => {
  if (currentPage > 1) {
    currentPage--;
    await loadProducts();
  }
});

nextPageButton.addEventListener("click", async () => {
  currentPage++;
  await loadProducts();
});

document.getElementById("productCategory").addEventListener("change", () => {
  currentPage = 1;
  loadProducts();
});

const addProductForm = document.getElementById("addProductForm");
const productFormMessage = document.getElementById("productFormMessage");
const saveProductButton = document.getElementById("saveProductButton");

addProductForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  productFormMessage.textContent = "";
  saveProductButton.disabled = true;
  saveProductButton.textContent = "Saving...";

  const product = {
    name: document.getElementById("productName").value.trim(),
    category: document.getElementById("newProductCategory").value.trim(),
    price: Number(document.getElementById("productPrice").value),
    stock: Number(document.getElementById("productStock").value),
  };

  try {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(product),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Could not create product");
    }

    // Show success message on the dashboard.
    const dashboardMessage = document.getElementById("dashboardMessage");

    dashboardMessage.textContent = "Product added successfully!";
    dashboardMessage.className = "success";

    // Clear the form and close it.
    addProductForm.reset();
    addProductForm.hidden = true;
    document.getElementById("addProductButton").hidden = false;

    await loadProducts();
  } catch (error) {
    console.error("Add product failed:", error);

    productFormMessage.textContent = error.message;
    productFormMessage.className = "error";
  } finally {
    saveProductButton.disabled = false;
    saveProductButton.textContent = "Save product";
  }
});

document
  .getElementById("productTableBody")
  .addEventListener("click", async (event) => {
    const button = event.target.closest(".delete-product-button");

    if (!button) return;

    const productId = button.dataset.id;

    const confirmed = confirm("Are you sure you want to delete this product?");

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Deleting...";

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete product");
      }

      await loadProducts();

      const dashboardMessage = document.getElementById("dashboardMessage");

      dashboardMessage.textContent = "Product deleted successfully!";
      dashboardMessage.className = "success";
    } catch (error) {
      console.error("Delete product failed:", error);

      const dashboardMessage = document.getElementById("dashboardMessage");

      dashboardMessage.textContent = error.message;
      dashboardMessage.className = "error";
    }
  });

document
  .getElementById("productTableBody")
  .addEventListener("click", (event) => {
    const button = event.target.closest(".edit-product-button");

    if (!button) return;

    const productId = button.dataset.id;

    const product = window.products.find((item) => item._id === productId);

    if (!product) {
      document.getElementById("dashboardMessage").textContent =
        "Could not find this product.";
      return;
    }

    document.getElementById("editProductId").value = product._id;
    document.getElementById("editProductName").value = product.name;
    document.getElementById("editProductCategory").value =
      product.category || "";
    document.getElementById("editProductPrice").value = product.price;
    document.getElementById("editProductStock").value = product.stock;

    document.getElementById("editProductMessage").textContent = "";
    document.getElementById("editProductForm").hidden = false;
    document.getElementById("addProductForm").hidden = true;
    document.getElementById("addProductButton").hidden = true;

    document.getElementById("editProductForm").scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  });

const editProductForm = document.getElementById("editProductForm");
const editProductMessage = document.getElementById("editProductMessage");
const updateProductButton = document.getElementById("updateProductButton");

editProductForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  editProductMessage.textContent = "";
  updateProductButton.disabled = true;
  updateProductButton.textContent = "Updating...";

  const productId = document.getElementById("editProductId").value;

  const updatedProduct = {
    name: document.getElementById("editProductName").value.trim(),
    category: document.getElementById("editProductCategory").value.trim(),
    price: Number(document.getElementById("editProductPrice").value),
    stock: Number(document.getElementById("editProductStock").value),
  };

  try {
    const response = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updatedProduct),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to update product");
    }

    editProductForm.reset();
    editProductForm.hidden = true;

    await loadProducts();

    const dashboardMessage = document.getElementById("dashboardMessage");

    dashboardMessage.textContent = "Product updated successfully!";
    dashboardMessage.className = "success";

    document.getElementById("addProductButton").hidden =
      JSON.parse(sessionStorage.getItem("user")).role !== "admin";

  } catch (error) {
    console.error("Update product failed:", error);

    editProductMessage.textContent = error.message;
    editProductMessage.className = "error";
  } finally {
    updateProductButton.disabled = false;
    updateProductButton.textContent = "Update product";
  }
});

document.getElementById("cancelEditButton").addEventListener("click", () => {
  editProductForm.reset();
  editProductForm.hidden = true;
  editProductMessage.textContent = "";

  const user = JSON.parse(sessionStorage.getItem("user"));

  if (user.role === "admin") {
    document.getElementById("addProductButton").hidden = false;
  }
});

async function loadStockHistory() {
  const stockHistoryTableBody = document.getElementById(
    "stockHistoryTableBody",
  );
  const stockHistoryMessage = document.getElementById("stockHistoryMessage");

  try {
    const params = new URLSearchParams({
      page: String(currentHistoryPage),
      limit: String(historyPerPage),
    });

    const response = await fetch(`/api/stock-history?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load stock history");
    }

    stockHistoryTableBody.replaceChildren();

    if (result.data.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 7;
      cell.textContent = "No stock history found.";

      row.appendChild(cell);
      stockHistoryTableBody.appendChild(row);

      document.getElementById("stockHistoryPaginationInfo").textContent =
        "Showing 0 of 0 records";
      document.getElementById("currentHistoryPageInfo").textContent =
        "Page 1 of 1";
      document.getElementById("previousHistoryPageButton").disabled = true;
      document.getElementById("nextHistoryPageButton").disabled = true;
      return;
    }

    result.data.forEach((item) => {
      const row = document.createElement("tr");

      const values = [
        item.product?.name || "Deleted product",
        item.previousStock,
        item.newStock,
        item.quantityChanged > 0
          ? `+${item.quantityChanged}`
          : String(item.quantityChanged),
        item.reason || "—",
        item.performedBy?.name || "Unknown user",
        new Date(item.createdAt).toLocaleString(),
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.appendChild(cell);
      });

      stockHistoryTableBody.appendChild(row);
    });

    const pagination = result.pagination;
    const startRecord =
      pagination.totalRecords === 0
        ? 0
        : (pagination.page - 1) * pagination.limit + 1;
    const endRecord = Math.min(
      pagination.page * pagination.limit,
      pagination.totalRecords,
    );

    document.getElementById("stockHistoryPaginationInfo").textContent =
      `Showing ${startRecord}–${endRecord} of ${pagination.totalRecords} records`;

    document.getElementById("currentHistoryPageInfo").textContent =
      `Page ${pagination.page} of ${Math.max(pagination.totalPages, 1)}`;

    document.getElementById("previousHistoryPageButton").disabled =
      !pagination.hasPreviousPage;

    document.getElementById("nextHistoryPageButton").disabled =
      !pagination.hasNextPage;
  } catch (error) {
    console.error("Error loading stock history:", error);
    stockHistoryMessage.textContent = error.message;
    stockHistoryMessage.className = "error";
  }
}

const previousHistoryPageButton = document.getElementById(
  "previousHistoryPageButton",
);
const nextHistoryPageButton = document.getElementById("nextHistoryPageButton");

previousHistoryPageButton.addEventListener("click", async () => {
  if (currentHistoryPage > 1) {
    currentHistoryPage--;
    await loadStockHistory();
  }
});

nextHistoryPageButton.addEventListener("click", async () => {
  currentHistoryPage++;
  await loadStockHistory();
});

loadStockHistory();


// Safe Event Listener for Global Search
const globalSearchInput = document.getElementById("globalSearchInput");
if (globalSearchInput) {
  globalSearchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const mainSearchInput = document.getElementById("productSearch");
    if (mainSearchInput) {
      mainSearchInput.value = searchTerm;
      mainSearchInput.dispatchEvent(new Event("input"));
    }
  });
}