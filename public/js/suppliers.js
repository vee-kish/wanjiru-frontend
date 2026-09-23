/* ============================================================
   suppliers.js — Supplier CRUD & directory rendering
   ============================================================ */

if (!Auth.guard()) {
  // redirected
} else {
  initSuppliers();
}

let SUPPLIERS = [];
let ORDERS = [];

function initSuppliers() {
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

  document.getElementById("addSupplierBtn").addEventListener("click", () => openSupplierModal());
  document.getElementById("saveSupplierBtn").addEventListener("click", saveSupplier);
  document.getElementById("confirmDeleteSupplierBtn").addEventListener("click", confirmDeleteSupplier);
  document.getElementById("supplierSearch").addEventListener("input", renderSuppliers);

  loadSuppliers();
}

async function loadSuppliers() {
  try {
    [SUPPLIERS, ORDERS] = await Promise.all([SuppliersAPI.list(), OrdersAPI.list()]);
    renderSuppliers();
  } catch (err) {
    showToast(err.message || "Failed to load suppliers.", "error");
    document.getElementById("supplierGrid").innerHTML =
      `<div class="text-muted">Could not load suppliers.</div>`;
  }
}

function activeOrderCount(supplierId, supplierName) {
  return ORDERS.filter((o) => {
    const active = o.status === "pending" || o.status === "confirmed";
    return active && ((o.supplier_id && String(o.supplier_id) === String(supplierId)) ||
      (supplierName && o.supplier_name === supplierName));
  }).length;
}

function renderSuppliers() {
  const q = document.getElementById("supplierSearch").value.trim().toLowerCase();
  const grid = document.getElementById("supplierGrid");

  const filtered = SUPPLIERS.filter((s) => {
    const hay = `${s.name} ${s.category} ${s.email}`.toLowerCase();
    return !q || hay.includes(q);
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon"><i class="fa-solid fa-truck-ramp-box"></i></div>
        <h3>No suppliers found</h3>
        <p>${q ? "Try a different search term." : "Add your first supplier to get started."}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((s) => {
    const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const count = activeOrderCount(s.id, s.name);
    return `
      <div class="supplier-card" data-id="${s.id}">
        <div class="sup-top">
          <div class="sup-avatar">${initials}</div>
          <div>
            <div class="sup-name">${escapeHtml(s.name)}</div>
            <div class="sup-cat">${escapeHtml(s.category || "—")}</div>
          </div>
        </div>
        <div class="sup-meta">
          ${s.phone ? `<div><i class="fa-solid fa-phone"></i> <a href="tel:${escapeHtml(s.phone)}">${escapeHtml(s.phone)}</a></div>` : ""}
          ${s.email ? `<div><i class="fa-solid fa-envelope"></i> <a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a></div>` : ""}
        </div>
        <div class="sup-foot">
          <span class="sup-orders-count"><i class="fa-solid fa-clipboard-list"></i> ${count} active order${count === 1 ? "" : "s"}</span>
          <div class="sup-actions">
            <button class="btn btn-secondary btn-sm act-edit"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-danger btn-sm act-delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".supplier-card").forEach((card) => {
    const id = Number(card.dataset.id);
    const supplier = SUPPLIERS.find((s) => s.id === id);
    card.querySelector(".act-edit").addEventListener("click", () => openSupplierModal(supplier));
    card.querySelector(".act-delete").addEventListener("click", () => openDeleteSupplierModal(supplier));
  });
}

/* ---------- Add / Edit modal ---------- */
function openSupplierModal(supplier) {
  document.getElementById("supplierId").value = supplier ? supplier.id : "";
  document.getElementById("s_name").value = supplier ? supplier.name : "";
  document.getElementById("s_phone").value = supplier ? supplier.phone : "";
  document.getElementById("s_email").value = supplier ? supplier.email : "";
  document.getElementById("s_category").value = supplier ? supplier.category : "";
  document.getElementById("supplierModalTitle").textContent = supplier ? "Edit Supplier" : "Add Supplier";
  document.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  openModal("supplierModal");
}

async function saveSupplier() {
  const id = document.getElementById("supplierId").value;
  const name = document.getElementById("s_name").value.trim();
  const phone = document.getElementById("s_phone").value.trim();
  const email = document.getElementById("s_email").value.trim();
  const category = document.getElementById("s_category").value.trim();

  let valid = true;
  const checks = [
    { id: "s_name", ok: name.length > 0 },
    { id: "s_phone", ok: phone.length > 0 },
    { id: "s_category", ok: category.length > 0 },
    { id: "s_email", ok: !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) }
  ];
  checks.forEach((c) => {
    const el = document.getElementById(c.id);
    if (c.ok) el.classList.remove("is-invalid");
    else { el.classList.add("is-invalid"); valid = false; }
  });

  if (!valid) { showToast("Please fix the highlighted fields.", "warning"); return; }

  const btn = document.getElementById("saveSupplierBtn");
  btn.disabled = true; btn.classList.add("is-loading");
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  const payload = { name, phone, email, category };
  try {
    if (id) await SuppliersAPI.update(Number(id), payload);
    else await SuppliersAPI.create(payload);
    closeModal("supplierModal");
    showToast(`Supplier ${id ? "updated" : "added"} successfully.`, "success");
    await loadSuppliers();
    if (window.refreshSupplierSelect) window.refreshSupplierSelect();
  } catch (err) {
    showToast(err.message || "Failed to save supplier.", "error");
  } finally {
    btn.disabled = false; btn.classList.remove("is-loading");
    btn.textContent = "Save Supplier";
  }
}

/* ---------- Delete ---------- */
function openDeleteSupplierModal(supplier) {
  document.getElementById("deleteSupplierName").textContent = supplier.name;
  document.getElementById("deleteSupplierId").value = supplier.id;
  openModal("deleteSupplierModal");
}

async function confirmDeleteSupplier() {
  const id = Number(document.getElementById("deleteSupplierId").value);
  const btn = document.getElementById("confirmDeleteSupplierBtn");
  btn.disabled = true; btn.classList.add("is-loading");
  btn.innerHTML = '<span class="spinner"></span> Removing…';

  try {
    await SuppliersAPI.remove(id);
    closeModal("deleteSupplierModal");
    showToast("Supplier removed.", "success");
    await loadSuppliers();
  } catch (err) {
    showToast(err.message || "Failed to remove supplier.", "error");
  } finally {
    btn.disabled = false; btn.classList.remove("is-loading");
    btn.textContent = "Remove";
  }
}

/* ---------- Shared utils ---------- */
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
