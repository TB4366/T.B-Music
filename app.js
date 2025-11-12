// Agar.io skins viewer + demo-betaling (frontend-only)
const app = document.getElementById('app');

app.innerHTML = `
  <h2>Agar.io Skins Demo — Frontend versie</h2>
  <p>Voer je player UID in, selecteer een skin en klik op <strong>Accepteer & Betaal</strong>. 
  Dit opent Xsolla in een nieuw tabblad met je gegevens, maar doet géén echte aankoop of koppeling.</p>
  
  <label>Player UID:</label>
  <input id="uid" type="text" placeholder="bijv. player-12345" style="width:300px;padding:6px;">
  
  <button id="load" style="margin-left:10px;">Laad Skins</button>
  <div id="viewer" style="margin-top:20px;"></div>
  <button id="buy" style="margin-top:20px;">Accepteer & Betaal</button>
  <p id="status" style="color:#444;"></p>
`;

const configUrl = "https://configs-web.agario.miniclippt.com/live/v15/10850/GameConfiguration.json";
const xsollaBase =
  "https://secure.xsolla.com/paystation3/desktop/list/?access_token=ryolz2LhiI7Zeb0G0BliTvHwx9Si0LiA_lc_en&preferences=eyJpdGVtUHJvbW90aW9ucyI6IltdIn0-&sessional=eyJoaXN0b3J5IjpbWyJzYXZlZG1ldGhvZCJdLFsibGlzdCIsdHJ1ZV1dfQ--";

let skins = [];
let selected = null;

document.getElementById("load").addEventListener("click", async () => {
  const viewer = document.getElementById("viewer");
  viewer.innerHTML = "<p>Laden…</p>";

  try {
    const res = await fetch(configUrl, { cache: "no-store" });
    const json = await res.json();
    skins = findSkins(json);
    renderSkins(viewer, skins);
  } catch (err) {
    viewer.innerHTML = `<p style="color:red">Fout bij laden: ${err.message}</p>`;
  }
});

document.getElementById("buy").addEventListener("click", () => {
  const uid = document.getElementById("uid").value.trim();
  const status = document.getElementById("status");

  if (!uid) return (status.textContent = "Vul eerst je UID in.");
  if (!selected) return (status.textContent = "Selecteer een skin eerst.");

  const metadata = encodeURIComponent(
    JSON.stringify({
      uid: uid,
      productId: selected.productId,
      gameplayId: selected.gameplayId,
      price: selected.price || "2.99",
    })
  );

  const sep = xsollaBase.includes("?") ? "&" : "?";
  const payUrl = xsollaBase + sep + "metadata=" + metadata;
  window.open(payUrl, "_blank");

  status.textContent =
    "Xsolla geopend in nieuw tabblad (demoversie, geen echte toekenning).";
});

function findSkins(obj) {
  const found = [];
  (function recurse(o) {
    if (!o || typeof o !== "object") return;
    if (o.productId || o.skinType || o.image) {
      found.push({
        productId: o.productId,
        gameplayId: o.gameplayId,
        image: o.image,
        skinType: o.skinType,
        price: o.price || 2.99,
      });
    }
    for (const k of Object.keys(o)) recurse(o[k]);
  })(obj);
  return found;
}

function renderSkins(viewer, list) {
  viewer.innerHTML = "";
  if (!list.length) {
    viewer.textContent = "Geen skins gevonden.";
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexWrap = "wrap";
  wrap.style.gap = "10px";

  list.forEach((s) => {
    const div = document.createElement("div");
    div.style.border = "1px solid #ccc";
    div.style.padding = "8px";
    div.style.borderRadius = "8px";
    div.style.width = "160px";
    div.style.textAlign = "center";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <div style="height:80px;display:flex;align-items:center;justify-content:center;">
        ${s.image ? `<img src="${fixImg(s.image)}" style="max-width:100%;max-height:100%;">` : "(geen afbeelding)"}
      </div>
      <div><strong>${s.productId || "onbekend"}</strong></div>
      <div>${s.skinType || "?"}</div>
      <div>€${Number(s.price).toFixed(2)}</div>
    `;
    div.addEventListener("click", () => {
      document.querySelectorAll(".selected").forEach((el) => (el.style.outline = ""));
      div.style.outline = "3px solid #0078d7";
      div.classList.add("selected");
      selected = s;
      document.getElementById("status").textContent = `Geselecteerd: ${s.productId}`;
    });
    wrap.appendChild(div);
  });
  viewer.appendChild(wrap);
}

function fixImg(src) {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  return `https://configs-web.agario.miniclippt.com/live/v15/10850/${src}`;
}
