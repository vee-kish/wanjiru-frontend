/* ============================================================
   orders.js — Order CRUD, search, filter, modals
   ============================================================ */

if (!Auth.guard()) {
  // redirected
} else {
  initOrders();
}

let ALL_ORDERS = [];

function initOrders() {
  const user = Auth.getUser();
  if (user && user.name) document.getElementById("greeting").textContent = `Hello, ${user.name}`;
  document.getElementById("dateDisplay").textContent = new Date().toLocaleDateString("en-KE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  document.getElementById("hamburger").addEventListener("click", () => {
    sidebar.classList.add("open"); overlay.classList.add("open");
  });
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open"); overlay.classList.remove("open");
  });

  // Toolbar wiring
  document.getElementById("searchInput").addEventListener("input", renderOrders);
  document.getElementById("dateFrom").addEventListener("change", renderOrders);
  document.getElementById("dateTo").addEventListener("change", renderOrders);

  document.querySelectorAll("#statusTabs .filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#statusTabs .filter-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      renderOrders();
    });
  });

  // Modal button bindings
  document.getElementById("saveStatusBtn").addEventListener("click", saveStatus);
  document.getElementById("confirmDeleteBtn").addEventListener("click", confirmDelete);

  loadOrders();
}

async function loadOrders() {
  try {
    ALL_ORDERS = await OrdersAPI.list();
    renderOrders();
  } catch (err) {
    showToast(err.message || "Failed to load orders.", "error");
    document.getElementById("ordersBody").innerHTML =
      `<tr><td colspan="8" class="text-muted">Could not load orders.</td></tr>`;
  }
}

function getFilters() {
  return {
    search: document.getElementById("searchInput").value.trim().toLowerCase(),
    status: document.querySelector("#statusTabs .filter-tab.active").dataset.status,
    from: document.getElementById("dateFrom").value,
    to: document.getElementById("dateTo").value
  };
}

function renderOrders() {
  const { search, status, from, to } = getFilters();

  const filtered = ALL_ORDERS.filter((o) => {
    const hay = `${o.supplier_name} ${o.item}`.toLowerCase();
    if (search && !hay.includes(search)) return false;
    if (status !== "all" && o.status !== status) return false;

    const placed = String(o.created_at || o.expected_date || "").slice(0, 10);
    if (from && placed < from) return false;
    if (to && placed > to) return false;
    return true;
  });

  const body = document.getElementById("ordersBody");

  if (!filtered.length) {
    body.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
            <h3>No orders match your filters</h3>
            <p>Try clearing the search or selecting a different status tab.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  body.innerHTML = filtered.map(orderRow).join("");
  bindRowActions();
}

function orderRow(o) {
  return `
    <tr data-status="${o.status}" data-id="${o.id}">
      <td class="cell-mono" data-label="Order ID">#ORD-${o.id}</td>
      <td data-label="Supplier">${escapeHtml(o.supplier_name || "—")}</td>
      <td data-label="Item & Qty">${escapeHtml(o.item)} <span class="text-muted">(${o.quantity} ${escapeHtml(o.unit || "")})</span></td>
      <td class="nowrap" data-label="Date Placed">${formatDate(o.created_at)}</td>
      <td class="nowrap" data-label="Expected">${formatDate(o.expected_date)}</td>
      <td class="cell-cost" data-label="Cost">${money(o.cost)}</td>
      <td data-label="Status">${statusBadge(o.status)}</td>
      <td data-label="Actions">
        <div class="d-flex gap-1 flex-wrap">
          <button class="btn btn-secondary btn-sm act-status" title="Update status">
            <i class="fa-solid fa-arrows-rotate"></i>
          </button>
          <button class="btn btn-secondary btn-sm act-view" title="View details">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn btn-danger btn-sm act-delete" title="Cancel / Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

function bindRowActions() {
  document.querySelectorAll("#ordersBody tr").forEach((tr) => {
    const id = Number(tr.dataset.id);
    const order = ALL_ORDERS.find((o) => o.id === id);
    if (!order) return;

    tr.querySelector(".act-status").addEventListener("click", () => openStatusModal(order));
    tr.querySelector(".act-view").addEventListener("click", () => openDetailsModal(order));
    tr.querySelector(".act-delete").addEventListener("click", () => openDeleteModal(order));
  });
}

/* ---------- Status modal ---------- */
function openStatusModal(order) {
  document.getElementById("statusOrderId").value = order.id;
  document.getElementById("statusSelect").value = order.status;
  document.getElementById("deliveryNotes").value = order.notes || "";
  document.getElementById("statusModalSub").textContent =
    `Order #ORD-${order.id} · ${order.supplier_name}`;
  openModal("statusModal");
}

async function saveStatus() {
  const id = Number(document.getElementById("statusOrderId").value);
  const status = document.getElementById("statusSelect").value;
  const deliveryNotes = document.getElementById("deliveryNotes").value.trim();

  const btn = document.getElementById("saveStatusBtn");
  btn.disabled = true; btn.classList.add("is-loading");
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    await OrdersAPI.updateStatus(id, status, deliveryNotes);
    closeModal("statusModal");
    showToast(`Order #${id} successfully updated to ${status.charAt(0).toUpperCase() + status.slice(1)}`, "success");
    await loadOrders();
  } catch (err) {
    showToast(err.message || "Failed to update status.", "error");
  } finally {
    btn.disabled = false; btn.classList.remove("is-loading");
    btn.textContent = "Save Status";
  }
}

/* ---------- Details modal ---------- */
function openDetailsModal(order) {
  const rows = [
    ["Order ID", `#ORD-${order.id}`],
    ["Supplier", order.supplier_name],
    ["Item", order.item],
    ["Quantity", `${order.quantity} ${order.unit || ""}`],
    ["Date Placed", formatDate(order.created_at)],
    ["Expected Delivery", formatDate(order.expected_date)],
    ["Estimated Cost", money(order.cost)],
    ["Status", ""],
    ["Notes", order.notes || "—"]
  ];
  document.getElementById("detailsBody").innerHTML = `
    <table class="data-table">
      <tbody>
        ${rows.map(([k, v]) => `<tr><td style="font-weight:700;color:var(--color-brown);width:42%;">${k}</td><td>${k === "Status" ? statusBadge(order.status) : escapeHtml(v)}</td></tr>`).join("")}
      </tbody>
    </table>`;
  openModal("detailsModal");
}

/* ---------- Delete modal ---------- */
function openDeleteModal(order) {
  document.getElementById("deleteOrderId").textContent = `#ORD-${order.id}`;
  document.getElementById("deleteOrderIdVal").value = order.id;
  openModal("deleteModal");
}

async function confirmDelete() {
  const id = Number(document.getElementById("deleteOrderIdVal").value);
  const btn = document.getElementById("confirmDeleteBtn");
  btn.disabled = true; btn.classList.add("is-loading");
  btn.innerHTML = '<span class="spinner"></span> Deleting…';

  try {
    await OrdersAPI.remove(id);
    closeModal("deleteModal");
    showToast(`Order #${id} deleted.`, "success");
    await loadOrders();
  } catch (err) {
    showToast(err.message || "Failed to delete order.", "error");
  } finally {
    btn.disabled = false; btn.classList.remove("is-loading");
    btn.textContent = "Delete";
  }
}

/* ---------- Shared utils ---------- */
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}
