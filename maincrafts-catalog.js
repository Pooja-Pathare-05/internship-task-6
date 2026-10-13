/* ==========================================================================
   MAINCRAFTS TECHNOLOGY — maincrafts-catalog.js (Task 6)
   UI layer for the Product Catalog and the Cart page.

   Task 5 -> Task 6 change: products no longer come from a local JSON file.
   They are fetched through the service layer (maincrafts-api.js). This file
   contains NO raw fetch() calls — it only calls fetchProducts(),
   addProduct() and deleteProduct().

   Loaded as an ES module (<script type="module">), so it must be served over
   http:// (Live Server, json-server, etc.), not opened as a file:// URL.

   Relies on getCart() / saveCart() / updateCartBadge() / escapeHtml() /
   setFieldError() / clearFieldError() from maincrafts-script.js (a classic
   script loaded before this one).
   ========================================================================== */

import {
  fetchProducts,
  addProduct,
  deleteProduct,
  getSource,
  setSource,
  listSources
} from './maincrafts-api.js';

const PRODUCTS_PER_PAGE = 8;
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_COUNT = 8;

/* Category -> icon + accent color. Used as the thumbnail fallback when a
   product has no image (or its image fails to load). */
const CATEGORY_META = {
  'Electronics':       { icon: 'fa-microchip',         color: 'var(--cat-electronics)' },
  'Fashion':           { icon: 'fa-shirt',             color: 'var(--cat-fashion)' },
  'Home & Kitchen':    { icon: 'fa-kitchen-set',       color: 'var(--cat-home)' },
  'Grocery':           { icon: 'fa-basket-shopping',   color: 'var(--cat-grocery)' },
  'Books':             { icon: 'fa-book',              color: 'var(--cat-books)' },
  'Beauty':            { icon: 'fa-spray-can-sparkles', color: 'var(--cat-beauty)' },
  "Men's Clothing":    { icon: 'fa-shirt',             color: 'var(--cat-fashion)' },
  "Women's Clothing":  { icon: 'fa-person-dress',      color: 'var(--cat-beauty)' },
  'Jewelery':          { icon: 'fa-gem',               color: 'var(--cat-grocery)' }
};
const DEFAULT_META = { icon: 'fa-box', color: 'var(--ink)' };

function getCategoryMeta(category) {
  return CATEGORY_META[category] || DEFAULT_META;
}

function formatPrice(amount) {
  return '\u20B9' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const catalogState = {
  all: [],          // every product fetched from the API (the source of truth for the UI)
  search: '',
  category: 'all',
  sort: 'default',
  page: 1,
  perPage: PRODUCTS_PER_PAGE
};

let loadToken = 0; // lets us ignore a slow response that arrives after a newer request

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  initCatalogPage(); // no-op if this page has no product grid
  initCartPage();    // no-op if this page has no cart list
});

/* ==========================================================================
   CATALOG PAGE — setup
   ========================================================================== */
function initCatalogPage() {
  if (!$('productGrid')) return; // not the catalog page

  initSearchAndSort();
  initSourceSelect();
  initModal();
  initAddProductForm();

  // Retry button lives inside the error banner, which is rebuilt on every error.
  $('errorMsg').addEventListener('click', (e) => {
    if (e.target.closest('[data-action="retry"]')) loadProducts();
  });

  loadProducts();
}

function initSearchAndSort() {
  const searchBox = $('catalogSearch');
  const sortSelect = $('catalogSort');

  // Debounced: filtering only runs 300ms after the user stops typing.
  if (searchBox) {
    searchBox.addEventListener('input', debounce(() => {
      catalogState.search = searchBox.value.trim().toLowerCase();
      catalogState.page = 1;
      renderCatalog();
    }, SEARCH_DEBOUNCE_MS));
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      catalogState.sort = sortSelect.value;
      renderCatalog();
    });
  }
}

function initSourceSelect() {
  const select = $('apiSource');
  if (!select) return;

  listSources().forEach((source) => {
    const opt = document.createElement('option');
    opt.value = source.id;
    opt.textContent = source.label;
    select.appendChild(opt);
  });
  select.value = getSource().id;
  updateSourceNote();

  select.addEventListener('change', () => {
    setSource(select.value);
    updateSourceNote();
    catalogState.category = 'all';
    catalogState.page = 1;
    loadProducts();
  });
}

function updateSourceNote() {
  const note = $('sourceNote');
  if (!note) return;
  const source = getSource();
  note.textContent = source.persistent
    ? 'Connected to JSON Server. Products you add or delete are saved to db.json.'
    : 'FakeStoreAPI only simulates writes: added or deleted products are not stored on the server and reset when you reload. Switch to JSON Server to keep changes.';
}

function initModal() {
  const closeBtn = $('modalClose');
  const overlay = $('productModal');
  if (closeBtn) closeBtn.addEventListener('click', closeProductModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeProductModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProductModal();
  });
}

/* ==========================================================================
   GET — load products, with loading + error states
   ========================================================================== */
async function loadProducts() {
  const token = ++loadToken;

  showSpinner(true);
  hideError();
  catalogState.all = [];
  $('catalogEmpty').style.display = 'none';
  $('pagination').innerHTML = '';
  $('categoryPills').innerHTML = '';
  $('catalogMeta').textContent = 'Loading products\u2026';
  renderSkeletons();

  try {
    const products = await fetchProducts();
    if (token !== loadToken) return; // a newer request replaced this one
    catalogState.all = products;
    renderCategoryPills();
    renderCatalog();
  } catch (err) {
    if (token !== loadToken) return;
    console.error(err);
    $('productGrid').innerHTML = '';
    $('catalogMeta').textContent = '';
    showError('Unable to load products. ' + (err.message || 'Please try again later.'));
  } finally {
    if (token === loadToken) showSpinner(false);
  }
}

function showSpinner(visible) {
  const spinner = $('spinner');
  if (!spinner) return;
  spinner.style.display = visible ? 'flex' : 'none';
  const text = $('spinnerText');
  if (text) text.textContent = 'Loading products from ' + getSource().label + '\u2026';
}

function showError(message) {
  const el = $('errorMsg');
  if (!el) return;
  el.innerHTML =
    '<i class="fa-solid fa-triangle-exclamation"></i>' +
    '<span class="error-text"></span>' +
    '<button type="button" class="btn btn-outline error-retry" data-action="retry">' +
      '<i class="fa-solid fa-rotate-right"></i> Try again' +
    '</button>';
  el.querySelector('.error-text').textContent = message;
  el.style.display = 'flex';
}

function hideError() {
  const el = $('errorMsg');
  if (el) el.style.display = 'none';
}

function renderSkeletons() {
  const grid = $('productGrid');
  grid.innerHTML = '';
  for (let i = 0; i < SKELETON_COUNT; i++) {
    const card = document.createElement('div');
    card.className = 'product-card skeleton-card';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML =
      '<div class="skeleton skeleton-thumb"></div>' +
      '<div class="product-body">' +
        '<div class="skeleton skeleton-line skeleton-line--short"></div>' +
        '<div class="skeleton skeleton-line"></div>' +
        '<div class="skeleton skeleton-line skeleton-line--medium"></div>' +
      '</div>';
    grid.appendChild(card);
  }
}

/* ==========================================================================
   Category pills, filtering, sorting, pagination (Task 5 logic, now running
   on the fetched data)
   ========================================================================== */
function renderCategoryPills() {
  const wrap = $('categoryPills');
  if (!wrap) return;

  const categories = ['all'];
  catalogState.all.forEach((p) => {
    if (!categories.includes(p.category)) categories.push(p.category);
  });

  // If the active category vanished (e.g. its last product was deleted), reset.
  if (!categories.includes(catalogState.category)) catalogState.category = 'all';

  wrap.innerHTML = '';
  categories.forEach((cat) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'filter-pill' + (cat === catalogState.category ? ' is-active' : '');
    pill.textContent = cat === 'all' ? 'All Categories' : cat;
    pill.addEventListener('click', () => {
      catalogState.category = cat;
      catalogState.page = 1;
      wrap.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('is-active'));
      pill.classList.add('is-active');
      renderCatalog();
    });
    wrap.appendChild(pill);
  });

  // Keep the Add Product form's category suggestions in sync with the data.
  const list = $('apCategoryList');
  if (list) {
    list.innerHTML = '';
    categories.filter((c) => c !== 'all').forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      list.appendChild(opt);
    });
  }
}

function applyFilters() {
  let results = catalogState.all.slice();

  if (catalogState.search) {
    results = results.filter((p) => p.title.toLowerCase().includes(catalogState.search));
  }
  if (catalogState.category !== 'all') {
    results = results.filter((p) => p.category === catalogState.category);
  }

  if (catalogState.sort === 'price-asc') {
    results.sort((a, b) => a.price - b.price);
  } else if (catalogState.sort === 'price-desc') {
    results.sort((a, b) => b.price - a.price);
  } else if (catalogState.sort === 'name-asc') {
    results.sort((a, b) => a.title.localeCompare(b.title));
  } else if (catalogState.sort === 'name-desc') {
    results.sort((a, b) => b.title.localeCompare(a.title));
  }
  return results;
}

function renderCatalog() {
  const gridEl = $('productGrid');
  const emptyEl = $('catalogEmpty');
  const metaEl = $('catalogMeta');
  if (!gridEl) return;

  const results = applyFilters();
  const total = results.length;

  const totalPages = Math.max(1, Math.ceil(total / catalogState.perPage));
  if (catalogState.page > totalPages) catalogState.page = totalPages;

  const start = (catalogState.page - 1) * catalogState.perPage;
  const pageItems = results.slice(start, start + catalogState.perPage);

  gridEl.innerHTML = '';

  if (metaEl) {
    if (total === 0) {
      metaEl.textContent = 'No products match your search.';
    } else {
      metaEl.innerHTML = 'Showing <strong>' + (start + 1) + '&ndash;' +
        Math.min(start + catalogState.perPage, total) + '</strong> of <strong>' + total + '</strong> products';
    }
  }

  if (total === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    renderPagination(0);
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  pageItems.forEach((product) => gridEl.appendChild(buildProductCard(product)));
  renderPagination(total);
}

/* Fill a thumbnail with the product image, falling back to the category icon. */
function fillThumb(thumbEl, product) {
  const meta = getCategoryMeta(product.category);

  const showIcon = () => {
    thumbEl.classList.remove('has-image');
    thumbEl.style.background = meta.color;
    thumbEl.innerHTML = '<i class="fa-solid ' + meta.icon + '"></i>';
  };

  if (!product.image) {
    showIcon();
    return;
  }

  thumbEl.classList.add('has-image');
  thumbEl.style.background = '';
  thumbEl.innerHTML = '';
  const img = document.createElement('img');
  img.src = product.image;
  img.alt = product.title;
  img.loading = 'lazy';
  img.addEventListener('error', showIcon);
  thumbEl.appendChild(img);
}

function ratingHtml(product, withLabel) {
  if (product.rating === null) return 'No ratings yet';
  let html = '<i class="fa-solid fa-star"></i>' + product.rating.toFixed(1);
  if (product.ratingCount !== null) html += ' (' + product.ratingCount + ')';
  if (withLabel) html += ' rating';
  return html;
}

function buildProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.id = String(product.id);

  // DELETE button
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'product-delete-btn';
  delBtn.title = 'Delete product';
  delBtn.setAttribute('aria-label', 'Delete ' + product.title);
  delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  delBtn.addEventListener('click', () => handleDelete(product));
  card.appendChild(delBtn);

  const thumb = document.createElement('div');
  thumb.className = 'product-thumb';
  fillThumb(thumb, product);
  thumb.addEventListener('click', () => openProductModal(product));
  card.appendChild(thumb);

  const body = document.createElement('div');
  body.className = 'product-body';

  const tag = document.createElement('span');
  tag.className = 'product-cat-tag';
  tag.textContent = product.category;
  body.appendChild(tag);

  const title = document.createElement('h3');
  title.className = 'product-title';
  title.textContent = product.title;
  title.addEventListener('click', () => openProductModal(product));
  body.appendChild(title);

  const rating = document.createElement('div');
  rating.className = 'product-rating';
  rating.innerHTML = ratingHtml(product, false);
  body.appendChild(rating);

  const footer = document.createElement('div');
  footer.className = 'product-footer';

  const price = document.createElement('span');
  price.className = 'product-price';
  price.textContent = formatPrice(product.price);
  footer.appendChild(price);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'product-add-btn';
  addBtn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Add';
  addBtn.addEventListener('click', () => {
    addToCart(product, 1);
    addBtn.classList.add('is-added');
    addBtn.innerHTML = '<i class="fa-solid fa-check"></i> Added';
    window.setTimeout(() => {
      addBtn.classList.remove('is-added');
      addBtn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Add';
    }, 1200);
  });
  footer.appendChild(addBtn);

  body.appendChild(footer);
  card.appendChild(body);
  return card;
}

function renderPagination(totalItems) {
  const pagEl = $('pagination');
  if (!pagEl) return;

  const totalPages = Math.ceil(totalItems / catalogState.perPage);
  pagEl.innerHTML = '';
  if (totalPages <= 1) return;

  const makeBtn = (html, onClick, { active = false, disabled = false } = {}) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'page-btn' + (active ? ' is-active' : '');
    btn.innerHTML = html;
    btn.disabled = disabled;
    btn.addEventListener('click', onClick);
    pagEl.appendChild(btn);
  };

  makeBtn('<i class="fa-solid fa-chevron-left"></i>',
    () => goToPage(catalogState.page - 1), { disabled: catalogState.page === 1 });

  for (let i = 1; i <= totalPages; i++) {
    makeBtn(String(i), () => goToPage(i), { active: i === catalogState.page });
  }

  makeBtn('<i class="fa-solid fa-chevron-right"></i>',
    () => goToPage(catalogState.page + 1), { disabled: catalogState.page === totalPages });
}

function goToPage(pageNum) {
  catalogState.page = pageNum;
  renderCatalog();
  const gridEl = $('productGrid');
  if (gridEl) gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ==========================================================================
   DELETE — optimistic: the card disappears immediately and comes back if the
   server rejects the request.
   ========================================================================== */
async function handleDelete(product) {
  if (!window.confirm('Remove "' + product.title + '"?')) return;

  const index = catalogState.all.findIndex((p) => String(p.id) === String(product.id));
  if (index === -1) return;

  const [removed] = catalogState.all.splice(index, 1);
  refreshAfterDataChange();

  try {
    await deleteProduct(product.id);
    showToast('Product removed.', 'success');
  } catch (err) {
    console.error(err);
    catalogState.all.splice(index, 0, removed); // put it back where it was
    refreshAfterDataChange();
    showToast('Delete failed. ' + (err.message || 'Please try again.'), 'error');
  }
}

function refreshAfterDataChange() {
  renderCategoryPills();
  renderCatalog();
}

/* ==========================================================================
   POST — Add Product form
   ========================================================================== */
function initAddProductForm() {
  const form = $('addProductForm');
  if (!form) return;

  // Clear a field's error as soon as the user edits it.
  form.querySelectorAll('input, textarea').forEach((input) => {
    input.addEventListener('input', () => clearFieldError(input.closest('.field')));
  });

  form.addEventListener('submit', handleAddProduct);
}

function validateAddProduct(values) {
  let valid = true;
  const check = (inputId, ok, message) => {
    const wrap = $(inputId).closest('.field');
    if (ok) {
      clearFieldError(wrap);
    } else {
      setFieldError(wrap, message);
      valid = false;
    }
  };

  check('apTitle', values.title.length >= 3, 'Enter a product name (3+ characters).');
  check('apPrice', Number.isFinite(values.price) && values.price > 0, 'Enter a price greater than 0.');
  check('apCategory', values.category.length > 0, 'Enter or pick a category.');
  check('apImage', values.image === '' || /^https?:\/\//i.test(values.image),
    'Image must be a full URL starting with http:// or https://.');
  return valid;
}

async function handleAddProduct(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const submitBtn = $('apSubmit');

  const values = {
    title: $('apTitle').value.trim(),
    price: parseFloat($('apPrice').value),
    category: $('apCategory').value.trim(),
    image: $('apImage').value.trim(),
    description: $('apDescription').value.trim()
  };

  if (!validateAddProduct(values)) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner spinner--inline"></span> Saving\u2026';

  try {
    const created = await addProduct(values);

    // FakeStoreAPI always answers with the same new id, so make sure ours is unique.
    if (catalogState.all.some((p) => String(p.id) === String(created.id))) {
      created.id = nextLocalId();
    }

    catalogState.all.unshift(created); // add to the top of the local array

    // Reset filters so the new card is actually visible at the top of the grid.
    catalogState.search = '';
    catalogState.category = 'all';
    catalogState.sort = 'default';
    catalogState.page = 1;
    $('catalogSearch').value = '';
    $('catalogSort').value = 'default';

    refreshAfterDataChange();
    form.reset();
    showToast('"' + created.title + '" added.', 'success');
    $('productGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    showToast('Could not add product. ' + (err.message || 'Check your connection.'), 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Product';
  }
}

function nextLocalId() {
  const numericIds = catalogState.all.map((p) => Number(p.id)).filter(Number.isFinite);
  return numericIds.length ? Math.max(...numericIds) + 1 : 'local-' + Date.now();
}

/* ==========================================================================
   Product detail modal
   ========================================================================== */
function openProductModal(product) {
  const overlay = $('productModal');
  const body = $('modalBody');
  if (!overlay || !body) return;

  body.innerHTML =
    '<div class="modal-thumb" id="modalThumb"></div>' +
    '<div class="modal-body">' +
      '<span class="product-cat-tag">' + escapeHtml(product.category) + '</span>' +
      '<h3>' + escapeHtml(product.title) + '</h3>' +
      '<div class="product-rating">' + ratingHtml(product, true) + '</div>' +
      '<p class="modal-desc">' + escapeHtml(product.description || 'No description provided.') + '</p>' +
      '<div class="modal-price-row">' +
        '<span class="product-price">' + formatPrice(product.price) + '</span>' +
        '<button type="button" class="btn btn-primary" id="modalAddBtn"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>' +
      '</div>' +
    '</div>';

  fillThumb($('modalThumb'), product);

  $('modalAddBtn').addEventListener('click', () => {
    addToCart(product, 1);
    closeProductModal();
  });

  overlay.classList.add('is-open');
}

function closeProductModal() {
  const overlay = $('productModal');
  if (overlay) overlay.classList.remove('is-open');
}

/* ==========================================================================
   Toast notifications
   ========================================================================== */
function showToast(message, type) {
  let root = $('toastRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toastRoot';
    root.className = 'toast-root';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast--' + (type || 'success');
  toast.textContent = message;
  root.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4000);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ==========================================================================
   CART (LocalStorage) — unchanged behaviour from Task 5, now working with
   fetched products.

   Cart lines are matched on source + id. FakeStoreAPI, JSON Server and the
   old Task 5 JSON file all number their products from 1, so id alone would
   mix up different products.
   ========================================================================== */
function cartKey(item) {
  return (item.source || 'legacy') + ':' + item.id;
}

function addToCart(product, qty) {
  const cart = getCart();
  const key = cartKey(product);
  const idx = cart.findIndex((item) => cartKey(item) === key);

  if (idx !== -1) {
    cart[idx].qty += qty;
  } else {
    cart.push({
      id: product.id,
      source: product.source,
      title: product.title,
      price: product.price,
      category: product.category,
      image: product.image || '',
      qty: qty
    });
  }

  saveCart(cart);
  updateCartBadge();
  renderCart(); // safe no-op if the cart list isn't on this page
}

function initCartPage() {
  if (!$('cartList')) return; // not the cart page
  renderCart();
}

function renderCart() {
  const listEl = $('cartList');
  const emptyEl = $('cartEmpty');
  const summaryEl = $('cartSummary');
  if (!listEl) return;

  const cart = getCart();
  listEl.innerHTML = '';

  if (cart.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    if (summaryEl) summaryEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (summaryEl) summaryEl.style.display = 'block';

  let subtotal = 0;
  let totalQty = 0;

  cart.forEach((item) => {
    const lineTotal = item.price * item.qty;
    subtotal += lineTotal;
    totalQty += item.qty;

    const row = document.createElement('div');
    row.className = 'cart-row';

    const thumb = document.createElement('div');
    thumb.className = 'cart-thumb';
    fillThumb(thumb, item);
    row.appendChild(thumb);

    const main = document.createElement('div');
    main.className = 'cart-row-main';
    main.innerHTML =
      '<div class="cart-row-title">' + escapeHtml(item.title) + '</div>' +
      '<div class="cart-row-cat">' + escapeHtml(item.category) + '</div>' +
      '<div class="cart-row-unit">' + formatPrice(item.price) + ' each</div>';
    row.appendChild(main);

    const rest = document.createElement('div');
    rest.innerHTML =
      '<div class="qty-stepper">' +
        '<button type="button" data-action="dec" aria-label="Decrease quantity">&minus;</button>' +
        '<span>' + item.qty + '</span>' +
        '<button type="button" data-action="inc" aria-label="Increase quantity">+</button>' +
      '</div>' +
      '<div class="cart-row-total">' + formatPrice(lineTotal) + '</div>' +
      '<button type="button" class="cart-row-remove" title="Remove" aria-label="Remove item"><i class="fa-solid fa-trash"></i></button>';

    rest.querySelector('[data-action="dec"]').addEventListener('click', () => changeCartQty(cartKey(item), -1));
    rest.querySelector('[data-action="inc"]').addEventListener('click', () => changeCartQty(cartKey(item), 1));
    rest.querySelector('.cart-row-remove').addEventListener('click', () => removeCartItem(cartKey(item)));

    // Move the controls straight into the row so the Task 5 cart layout CSS still applies.
    while (rest.firstChild) row.appendChild(rest.firstChild);

    listEl.appendChild(row);
  });

  const subtotalEl = $('cartSubtotal');
  const qtyEl = $('cartItemCount');
  const totalEl = $('cartTotal');
  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (qtyEl) qtyEl.textContent = totalQty;
  if (totalEl) totalEl.textContent = formatPrice(subtotal);
}

function changeCartQty(key, delta) {
  const cart = getCart();
  const idx = cart.findIndex((item) => cartKey(item) === key);
  if (idx === -1) return;

  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);

  saveCart(cart);
  updateCartBadge();
  renderCart();
}

function removeCartItem(key) {
  saveCart(getCart().filter((item) => cartKey(item) !== key));
  updateCartBadge();
  renderCart();
}
