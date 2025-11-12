// app.js — Agar.io skins viewer + frontend-only Xsolla redirect (Nederlands)
// Gebruik: open index.html die dit script laadt.
// Let op: dit is een demo / read-only flow — geen automatische toekenning naar Miniclip!

/**
 * CONFIG
 * Pas deze Xsolla-base URL aan als je een andere paystation link of token wilt gebruiken.
 * Als je een andere config-URL wilt laden, verander CONFIG_URL.
 */
const CONFIG_URL = 'https://configs-web.agario.miniclippt.com/live/v15/10850/GameConfiguration.json';
// Publice Xsolla URL (door gebruiker verstrekt eerder). Vervang door jouw officiële link/token indien nodig.
const XSOLLA_BASE = 'https://secure.xsolla.com/paystation3/desktop/list/?access_token=ryolz2LhiI7Zeb0G0BliTvHwx9Si0LiA_lc_en&preferences=eyJpdGVtUHJvbW90aW9ucyI6IltdIn0-&sessional=eyJoaXN0b3J5IjpbWyJzYXZlZG1ldGhvZCJdLFsibGlzdCIsdHJ1ZV1dfQ--';

// ======= UI BOILERPLATE (dynamisch in #app) =======
const app = document.getElementById('app');
app.innerHTML = `
  <div style="max-width:980px;margin:12px auto;font-family:system-ui,Segoe UI,Roboto,Arial">
    <h2>Agar.io skins — demo (frontend-only)</h2>
    <p style="color:#374151">Voer je player UID in, laad skins en kies er één. De knop "Accepteer & Betaal" opent Xsolla in een nieuw tabblad met metadata (UID, productId, gameplayId, price).</p>

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
      <div style="flex:1;min-width:220px">
        <label style="font-weight:600">Player UID (verplicht)</label><br/>
        <input id="uid" type="text" placeholder="bijv. player-12345" style="width:100%;padding:8px;border-radius:6px;border:1px solid #d1d5db"/>
      </div>
      <div style="width:460px;min-width:220px">
        <label style="font-weight:600">Config URL</label><br/>
        <input id="configUrl" type="text" value="${CONFIG_URL}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #d1d5db"/>
      </div>
    </div>

    <div style="margin-top:10px">
      <button id="loadBtn" style="padding:10px 14px;border-radius:8px;border:0;background:#2563eb;color:white;cursor:pointer;font-weight:700">Laad skins</button>
      <span style="margin-left:12px;color:#6b7280">Als directe fetch faalt (CORS), gebruikt de demo een proxy (alleen voor test).</span>
    </div>

    <div id="viewer" style="margin-top:18px"></div>

    <div style="margin-top:16px">
      <button id="buyBtn" style="padding:10px 14px;border-radius:8px;border:0;background:#10b981;color:white;cursor:pointer;font-weight:700">Accepteer & Betaal</button>
      <div id="status" style="margin-top:8px;color:#374151"></div>
    </div>

    <hr style="margin-top:18px"/>
    <details style="color:#374151">
      <summary style="font-weight:700">Technische notes (klik)</summary>
      <ul>
        <li>De demo probeert eerst rechtstreeks te fetchen. Als CORS blokkeert, gebruikt hij <code>https://api.allorigins.win/raw?url=...</code> als fallback.</li>
        <li>Xsolla wordt geopend met queryparam <code>metadata</code> (URI-encoded JSON: uid, productId, gameplayId, price).</li>
        <li>Deze client kent geen skins toe — toekenning moet server-side gebeuren en alleen met officiële Miniclip API & credentials.</li>
      </ul>
    </details>

    <h4 style="margin-top:12px">Debug JSON (kort)</h4>
    <pre id="jsonRaw" style="background:#0b1220;color:#e6eef8;padding:10px;border-radius:8px;max-height:260px;overflow:auto">Geen config geladen.</pre>
  </div>
`;

// ======= State =======
let skins = [];      // array met huidig gevonden skins
let selected = null; // huidig geselecteerde skin object

// ======= Element references =======
const loadBtn = document.getElementById('loadBtn');
const buyBtn = document.getElementById('buyBtn');
const viewer = document.getElementById('viewer');
const statusEl = document.getElementById('status');
const jsonRaw = document.getElementById('jsonRaw');
const uidInput = document.getElementById('uid');
const configUrlInput = document.getElementById('configUrl');

// ======= Handlers =======
loadBtn.addEventListener('click', async () => {
  clearStatus();
  viewer.innerHTML = '<p>Laden…</p>';
  jsonRaw.textContent = 'Laden…';
  selected = null;
  skins = [];

  const url = configUrlInput.value.trim();
  if (!url) {
    showError('Voer een geldige Config URL in.');
    return;
  }

  // Probeer directe fetch, en fallback naar proxy als dat faalt
  try {
    const cfg = await fetchJsonWithFallback(url);
    // Toon beknopte debug JSON
    jsonRaw.textContent = JSON.stringify(cfg, null, 2).slice(0, 100000);
    // Zoek skins
    skins = findSkins(cfg);
    // Normaliseer en dedupe
    skins = normalizeSkins(skins);
    renderSkins();
    if (!skins.length) {
      viewer.innerHTML = '<p>Geen skins gevonden in de config.</p>';
    }
  } catch (err) {
    showError('Kon config niet laden: ' + err.message);
    jsonRaw.textContent = 'Kon JSON niet laden: ' + err.message;
  }
});

buyBtn.addEventListener('click', () => {
  clearStatus();
  const uid = uidInput.value.trim();
  if (!uid) return showError('Vul eerst je player UID in.');
  if (!selected) return showError('Selecteer eerst een skin.');

  // Bouw metadata
  const metadataObj = {
    uid: uid,
    productId: selected.productId,
    gameplayId: selected.gameplayId,
    price: selected.price
  };
  const metadata = encodeURIComponent(JSON.stringify(metadataObj));

  // Voeg metadata toe aan Xsolla base-url
  const sep = XSOLLA_BASE.includes('?') ? '&' : '?';
  const finalUrl = XSOLLA_BASE + sep + 'metadata=' + metadata;

  // Open in nieuw tabblad (gebruik window.open zodat popup blockers minder gevoelig zijn)
  const w = window.open(finalUrl, '_blank');
  if (!w) {
    showError('Popup geblokkeerd — sta popups toe of klik met de rechtermuisknop en open link in nieuw tabblad.');
    return;
  }

  statusEl.innerHTML = 'Xsolla geopend in nieuw tabblad. Voltooi betaling daar. (Deze demo kent geen skins toe.)';
  console.log('Xsolla URL geopend:', finalUrl);
});

// ======= Functies =======

/**
 * Probeer eerst rechtstreeks te fetchen; als dat faalt of CORS blokkeert, gebruik een publieke proxy (AllOrigins).
 * returned: parsed JSON
 */
async function fetchJsonWithFallback(url) {
  // helper: probeer fetch direct
  async function tryDirect(u) {
    const resp = await fetch(u, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Direct fetch gaf status ' + resp.status);
    return await resp.json();
  }

  // helper: proxy fetch via allorigins
  async function tryProxy(u) {
    const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u);
    const resp = await fetch(proxy, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Proxy fetch gaf status ' + resp.status);
    return await resp.json();
  }

  try {
    return await tryDirect(url);
  } catch (err) {
    console.warn('Direct fetch failed, proberen proxy:', err.message);
    // fallback naar proxy
    return await tryProxy(url);
  }
}

/**
 * Recursieve zoekfunctie: zoekt naar objecten met productId / skinType / image
 * Geeft ruwe gevonden objecten terug.
 */
function findSkins(obj) {
  const found = [];
  (function recurse(o) {
    if (!o || typeof o !== 'object') return;
    if (o.productId || o.skinType || o.image) {
      found.push({
        productId: o.productId,
        gameplayId: o.gameplayId,
        image: o.image,
        skinType: o.skinType,
        price: o.price,
        cellColor: o.cellColor
      });
    }
    for (const k of Object.keys(o)) recurse(o[k]);
  })(obj);
  return found;
}

/**
 * Normaliseer: dedupe op productId en vul fallback-waarde voor prijs
 */
function normalizeSkins(list) {
  const out = [];
  const seen = new Set();
  for (const s of list) {
    const key = s.productId || JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      productId: s.productId || null,
      gameplayId: s.gameplayId || null,
      image: s.image || null,
      skinType: s.skinType || null,
      price: (s.price != null ? Number(s.price) : (s.defaultPrice != null ? Number(s.defaultPrice) : 2.99)),
      cellColor: s.cellColor || null
    });
  }
  return out;
}

/**
 * Render skins grid
 */
function renderSkins() {
  viewer.innerHTML = '';
  if (!skins.length) {
    viewer.innerHTML = '<p>Geen skins gevonden.</p>';
    return;
  }

  const grid = document.createElement('div');
  grid.style.display = 'flex';
  grid.style.flexWrap = 'wrap';
  grid.style.gap = '12px';

  skins.forEach((s, idx) => {
    const card = document.createElement('div');
    card.style.width = '200px';
    card.style.border = '1px solid #e6eef8';
    card.style.background = '#fff';
    card.style.padding = '10px';
    card.style.borderRadius = '10px';
    card.style.cursor = 'pointer';
    card.style.boxShadow = '0 2px 8px rgba(2,6,23,0.04)';
    card.dataset.index = idx;

    // thumbnail area
    const imgWrap = document.createElement('div');
    imgWrap.style.height = '88px';
    imgWrap.style.display = 'flex';
    imgWrap.style.alignItems = 'center';
    imgWrap.style.justifyContent = 'center';
    imgWrap.style.marginBottom = '8px';
    if (s.image) {
      const img = document.createElement('img');
      img.src = fixImageUrl(s.image);
      img.alt = s.productId || '';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      imgWrap.appendChild(img);
    } else {
      imgWrap.textContent = 'geen afbeelding';
      imgWrap.style.color = '#9ca3af';
    }

    const title = document.createElement('div');
    title.innerHTML = `<strong>${escapeHtml(s.productId || 'onbekend')}</strong>`;

    const meta = document.createElement('div');
    meta.style.fontSize = '0.9rem';
    meta.style.color = '#6b7280';
    meta.textContent = `gameplayId: ${s.gameplayId ?? '-'} — ${s.skinType ?? '-'}`;

    const price = document.createElement('div');
    price.style.marginTop = '6px';
    price.style.fontSize = '0.95rem';
    price.style.color = '#374151';
    price.textContent = `€${Number(s.price).toFixed(2)}`;

    card.appendChild(imgWrap);
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(price);

    card.addEventListener('click', () => {
      // deselecteer anderen
      document.querySelectorAll('[data-index]').forEach(el => el.style.outline = '');
      card.style.outline = '3px solid rgba(59,130,246,0.9)';
      selected = s;
      statusEl.textContent = `Geselecteerd: ${s.productId || 'onbekend'} — €${Number(s.price).toFixed(2)}`;
    });

    grid.appendChild(card);
  });

  viewer.appendChild(grid);
}

/**
 * Maak van relatieve image path een absolute path gebaseerd op de configUrl,
 * of fallback naar bekende locatie.
 */
function fixImageUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  try {
    const cfgUrl = new URL(configUrlInput.value.trim());
    const basePath = cfgUrl.origin + cfgUrl.pathname.substring(0, cfgUrl.pathname.lastIndexOf('/') + 1);
    return basePath + src;
  } catch (e) {
    // fallback: probeer bekende live path
    return 'https://configs-web.agario.miniclippt.com/live/v15/10850/' + src;
  }
}

/** Helpers **/
function showError(msg) {
  statusEl.style.color = '#b91c1c';
  statusEl.textContent = msg;
}
function clearStatus() {
  statusEl.style.color = '#374151';
  statusEl.textContent = '';
}
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
