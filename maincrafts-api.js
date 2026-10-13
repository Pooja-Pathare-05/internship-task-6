/* ==========================================================================
   MAINCRAFTS TECHNOLOGY — maincrafts-api.js (Task 6)
   SERVICE LAYER. Every network call in the project lives in this file.
   UI code (maincrafts-catalog.js) only calls the exported functions below —
   it never calls fetch() itself.

   Supported back ends (switchable from the catalog page):
     • FakeStoreAPI — https://fakestoreapi.com  (hosted, writes are simulated)
     • JSON Server  — http://localhost:3000     (local, writes persist to db.json)

   Data shaping also happens here, so the rest of the app always sees one
   consistent product object:
     { id, source, title, price (in ₹), category, description, image,
       rating (number | null), ratingCount (number | null) }
   ========================================================================== */

const REQUEST_TIMEOUT_MS = 10000;
const SOURCE_STORAGE_KEY = 'maincraftsApiSource';

/* usdToInr: FakeStoreAPI prices are in US dollars. The site shows rupees, so
   they are converted with a fixed display rate (not a live exchange rate).
   The same rate is used in reverse when sending a new product, so a price
   entered as ₹830 is sent as $10 and comes back as ₹830. */
const SOURCES = {
  fakestore: {
    id: 'fakestore',
    label: 'FakeStoreAPI',
    baseUrl: 'https://fakestoreapi.com',
    usdToInr: 83,
    persistent: false
  },
  jsonserver: {
    id: 'jsonserver',
    label: 'JSON Server (localhost:3000)',
    baseUrl: 'http://localhost:3000',
    usdToInr: 1,
    persistent: true
  }
};

/* ---- Typed error so the UI can show a helpful message ---- */
export class ApiError extends Error {
  constructor(message, { status = null, kind = 'unknown' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP status code, if the server answered
    this.kind = kind;     // 'network' | 'timeout' | 'client' | 'server' | 'format'
  }
}

/* ==========================================================================
   Source selection (remembered in LocalStorage)
   ========================================================================== */
export function listSources() {
  return Object.values(SOURCES);
}

export function getSource() {
  try {
    const saved = localStorage.getItem(SOURCE_STORAGE_KEY);
    if (saved && SOURCES[saved]) return SOURCES[saved];
  } catch (e) { /* storage unavailable — fall through to default */ }
  return SOURCES.fakestore;
}

export function setSource(id) {
  if (!SOURCES[id]) return;
  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, id);
  } catch (e) { /* ignore */ }
}

/* ==========================================================================
   Public API — these are the only functions the UI calls
   ========================================================================== */

/** GET /products — returns an array of normalized products. */
export async function fetchProducts() {
  const source = getSource();
  const data = await request(source, '/products');

  if (!Array.isArray(data)) {
    throw new ApiError('The server sent data in an unexpected format.', { kind: 'format' });
  }
  return data.map((raw) => fromApi(raw, source));
}

/** POST /products — sends a new product, returns it normalized (with its new id). */
export async function addProduct(product) {
  const source = getSource();
  const payload = toApi(product, source);

  const response = await request(source, '/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  /* FakeStoreAPI only echoes back { id }, JSON Server echoes the full object.
     Merging the payload with the response handles both. */
  const created = fromApi({ ...payload, ...(response || {}) }, source);
  if (created.id === undefined || created.id === null) {
    created.id = 'local-' + Date.now();
  }
  return created;
}

/** DELETE /products/:id — resolves when the server confirms the delete. */
export async function deleteProduct(id) {
  const source = getSource();
  try {
    await request(source, '/products/' + encodeURIComponent(id), { method: 'DELETE' });
  } catch (err) {
    /* A 404 means the product is already gone, which is the outcome we
       wanted — treat it as success instead of bouncing the card back. */
    if (err instanceof ApiError && err.status === 404) return;
    throw err;
  }
}

/* ==========================================================================
   Internals
   ========================================================================== */

/* One place for fetch + timeout + status checking + JSON parsing. */
async function request(source, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(source.baseUrl + path, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('The server took too long to respond.', { kind: 'timeout' });
    }
    throw new ApiError(
      'Could not reach ' + source.label + '. Check your internet connection' +
      (source.persistent ? ' and that JSON Server is running.' : '.'),
      { kind: 'network' }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new ApiError(
      'The server answered with an error (HTTP ' + res.status + ').',
      { status: res.status, kind: res.status >= 500 ? 'server' : 'client' }
    );
  }

  // Some endpoints (DELETE) reply with an empty body or "null" — don't crash on that.
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new ApiError('The server sent data in an unexpected format.', { kind: 'format' });
  }
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function toTitleCase(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
}

/* Server object -> app product */
function fromApi(raw, source) {
  const ratingValue = raw.rating && typeof raw.rating === 'object' ? raw.rating.rate : raw.rating;
  const ratingCount = raw.rating && typeof raw.rating === 'object' ? raw.rating.count : null;
  const price = roundMoney(Number(raw.price) * source.usdToInr);

  return {
    id: raw.id,
    source: source.id,
    title: String(raw.title || 'Untitled product'),
    price: Number.isFinite(price) ? price : 0,
    category: toTitleCase(raw.category) || 'Uncategorized',
    description: String(raw.description || ''),
    image: raw.image ? String(raw.image) : '',
    rating: Number.isFinite(Number(ratingValue)) && ratingValue !== null && ratingValue !== undefined && ratingValue !== ''
      ? Number(ratingValue) : null,
    ratingCount: Number.isFinite(Number(ratingCount)) && ratingCount !== null ? Number(ratingCount) : null
  };
}

/* App product (from the Add Product form) -> object sent to the server */
function toApi(product, source) {
  return {
    title: product.title,
    price: roundMoney(Number(product.price) / source.usdToInr),
    description: product.description || '',
    category: product.category,
    image: product.image || ''
  };
}
