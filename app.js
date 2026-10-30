const map = L.map("map").setView([30, 20], 2);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const searchInput = document.getElementById("search");
const list = document.getElementById("market-list");
const resultCount = document.getElementById("result-count");
const typeFilters = document.getElementById("type-filters");

// data/ altındaki kayıtların "type" alanının alabileceği değerler
const TYPES = {
  market: { label: "Market", icon: "🛒" },
  restoran: { label: "Restoran", icon: "🍽️" },
  kafe: { label: "Kafe", icon: "☕" },
  firin: { label: "Fırın", icon: "🥖" },
  berber: { label: "Berber", icon: "💈" },
};
const UNKNOWN_TYPE = { label: "Diğer", icon: "📍" };

function typeInfo(market) {
  return TYPES[market.type] || UNKNOWN_TYPE;
}

let markets = [];
const cluster = L.markerClusterGroup().addTo(map);
const countrySelect = document.getElementById("country");
const citySelect = document.getElementById("city");
const status = document.getElementById("status");
let mode = "all", selectedId = "", position = null;
let selectedType = null; // null = hepsi

// Türkçe karakterleri de doğru küçültüp "Beypazarı" ile "beypazari" eşleşsin diye sadeleştiriyoruz
function normalize(text) {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function safeUrl(value) { try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } }
function productTags(products, market) {
  return products.map(p => { const info = market?.productEvidence?.[p];
    return `<span class="product">${escapeHtml(p)}<small> · ${info?.lastSeen ? escapeHtml(info.lastSeen) : "Görülme tarihi bilinmiyor"}${safeUrl(info?.source) ? ` · <a href="${escapeHtml(safeUrl(info.source))}" target="_blank" rel="noopener">Kaynak</a>` : ""}</small></span>`;
  }).join("");
}
function links(m) {
  const destination = hasLocation(m) ? `${m.lat},${m.lng}` : [m.name,m.address,m.city,m.country].filter(Boolean).join(", ");
  return `<div class="actions"><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}">Yol tarifi al</a>${safeUrl(m.website) ? ` <a target="_blank" rel="noopener" href="${escapeHtml(safeUrl(m.website))}">Web sitesi</a>` : ""}${m.phone && /^\+?[0-9 ()-]{5,30}$/.test(m.phone) ? ` <a href="tel:${escapeHtml(m.phone.replace(/[^+0-9]/g,""))}">Ara</a>` : ""}</div>`;
}

// "verified": false olan kayıtların bilgileri tam doğrulanamadı; sitede uyarı gösterilir
function isUnverified(market) {
  return market.verified === false;
}

function warningHtml(market) {
  if (!isUnverified(market)) return "";
  const note = market.note ? ` ${escapeHtml(market.note)}` : "";
  return `<details class="warning"><summary>⚠️ Doğrulama gerekiyor</summary><p>Gitmeden önce kontrol et.${note}</p></details>`;
}

function popupHtml(market) {
  const type = typeInfo(market);
  return `
    <strong>${escapeHtml(market.name)}</strong><br>
    <small>${type.icon} ${type.label}</small><br>
    ${escapeHtml(market.city)}, ${escapeHtml(market.country)}<br>
    ${market.address ? `<small>${escapeHtml(market.address)}</small><br>` : ""}
    ${warningHtml(market)}
    <div class="products">${productTags(market.products, market)}</div>${links(market)}
  `;
}

// Koordinatı henüz girilmemiş kayıtlar ("lat": null) listede görünür ama haritada işaret almaz
function hasLocation(market) {
  return typeof market.lat === "number" && typeof market.lng === "number";
}

function matches(market, query) {
  if (selectedType && market.type !== selectedType) return false;
  if (countrySelect.value && market.country !== countrySelect.value) return false;
  if (citySelect.value && market.city !== citySelect.value) return false;
  if (mode === "product" && !["market", "firin"].includes(market.type)) return false;
  if (!query) return true;
  const haystack = normalize(
    (mode === "product" ? market.products : mode === "place" ? [market.name, market.city, market.country, typeInfo(market).label] : [market.name, market.city, market.country, typeInfo(market).label, ...market.products]).join(" ")
  );
  return haystack.includes(normalize(query));
}

function render() {
  const query = searchInput.value.trim();
  const visible = markets.filter((m) => matches(m, query));

  list.innerHTML = "";
  cluster.clearLayers();
  cluster.addLayers(visible.filter(hasLocation).map(m => m.marker));
  if (position) visible.sort((a,b) => distance(a)-distance(b));
  for (const market of visible) {
    const li = document.createElement("li");
    const open = document.createElement("button");
    open.className = "result-card";
    open.setAttribute("aria-label", `${market.name}, ${market.city}: ayrıntıları göster`);
    open.innerHTML = `<span class="result-icon" aria-hidden="true">${typeInfo(market).icon}</span><span><strong>${escapeHtml(market.name)}</strong><span class="market-location">${typeInfo(market).label} · ${escapeHtml(market.city)}, ${escapeHtml(market.country)}</span><span class="preview-products">${escapeHtml(market.products.slice(0,3).join(" · "))}</span>${hasLocation(market) ? "" : '<span class="market-location">Konum eklenecek</span>'}${position && hasLocation(market) ? `<span class="market-location">${distance(market).toFixed(1)} km</span>` : ""}</span>`;
    open.onclick = () => selectMarket(market, true);
    li.appendChild(open);
    list.appendChild(li);
  }

  resultCount.textContent = `${visible.length} yer · ${visible.filter(hasLocation).length} haritada · ${visible.filter(m => !hasLocation(m)).length} konum bekliyor`;
  if (!visible.length) list.innerHTML = '<li>Sonuç bulunamadı. Filtreleri temizleyebilir veya yeni bir yer önerebilirsin.</li>';
  if (!visible.some(m => m.id === selectedId)) selectedId = "";
  showDetail(markets.find(m => m.id === selectedId));
  syncUrl();
}

function renderTypeFilters() {
  // Sadece veride gerçekten bulunan türler için buton göster
  const usedTypes = Object.keys(TYPES).filter((key) => markets.some((m) => m.type === key));
  const options = [{ key: null, label: "Tümü", icon: "" }, ...usedTypes.map((key) => ({ key, ...TYPES[key] }))];

  typeFilters.innerHTML = "";
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${option.icon} ${option.label}`.trim();
    button.setAttribute("aria-pressed", String(option.key === selectedType));
    button.classList.toggle("active", option.key === selectedType);
    button.addEventListener("click", () => {
      selectedType = option.key; selectedId = "";
      renderTypeFilters();
      render();
    });
    typeFilters.appendChild(button);
  }
}

function markerIcon(market) {
  return L.divIcon({
    className: isUnverified(market) ? "type-marker unverified" : "type-marker",
    html: typeInfo(market).icon,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} yüklenemedi (${response.status})`);
  return response.json();
}

async function init() {
  try {
    // data/index.json { "ülke": ["şehir", ...] } -> her şehir data/<ülke>/<şehir>.json dosyasında
    const index = await fetchJson("data/index.json");
    const files = Object.entries(index).flatMap(([country, cities]) =>
      cities.map((city) => `data/${country}/${city}.json`)
    );
    markets = (await Promise.all(files.map(async file => (await fetchJson(file)).map((m,i) => ({...m,id:m.id || `${file}:${i}`}))))).flat();
  } catch (error) {
    resultCount.textContent = "Veriler yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.";
    console.error(error);
    return;
  }

  for (const market of markets) {
    if (!hasLocation(market)) continue;
    market.marker = L.marker([market.lat, market.lng], { icon: markerIcon(market), title: `${market.name}, ${market.city}`, alt: `${market.name}, ${market.city}` }).on("click", () => selectMarket(market, false));
  }

  document.getElementById("coverage").textContent = `Kapsam: ${[...new Set(markets.map(m => m.country))].join(", ")}. ${markets.length} kayıt.`;
  for (const country of [...new Set(markets.map(m => m.country))].sort()) countrySelect.add(new Option(country,country));
  restoreUrl();
}


searchInput.addEventListener("input", () => { selectedId = ""; render(); });
init();

function distance(m) {
  if (!hasLocation(m)) return Infinity;
  return map.distance(position, [m.lat,m.lng]) / 1000;
}
function syncUrl() {
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries({q:searchInput.value, country:countrySelect.value, city:citySelect.value, type:selectedType, mode:mode === 'all' ? '' : mode, place:selectedId})) if(v) p.set(k,v);
  history.replaceState(null,'',`${location.pathname}${p.size ? '?'+p : ''}`);
}
function updateCities() {
  const previous = citySelect.value; citySelect.replaceChildren(new Option('Tüm şehirler',''));
  for(const city of [...new Set(markets.filter(m => !countrySelect.value || m.country === countrySelect.value).map(m => m.city))].sort()) citySelect.add(new Option(city,city));
  citySelect.value = [...citySelect.options].some(o => o.value === previous) ? previous : '';
}
function restoreUrl() {
  const p = new URLSearchParams(location.search);
  searchInput.value = p.get('q') || ''; countrySelect.value = p.get('country') || ''; updateCities(); citySelect.value = p.get('city') || '';
  selectedType = TYPES[p.get('type')] ? p.get('type') : null;
  mode = ['product','place'].includes(p.get('mode')) ? p.get('mode') : 'all'; selectedId = p.get('place') || '';
  renderModes(); renderTypeFilters(); render();
  const selected = markets.find(m => m.id === selectedId);
  if(selected) selectMarket(selected, false);
  else fitResults();
}
function setPanel(open) {
  document.body.classList.toggle('panel-closed', !open);
  document.getElementById('sidebar').inert = !open;
  const toggle = document.getElementById('panel-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Yan paneli kapat' : 'Yan paneli aç');
  toggle.textContent = open ? '‹' : '›';
}
function showDetail(m) {
  const detail = document.getElementById('place-detail');
  detail.hidden = !m; list.hidden = !!m;
  document.getElementById('result-count').hidden = !!m;
  if (!m) { detail.replaceChildren(); return; }
  detail.innerHTML = `<button id="back-results">← Sonuçlara dön</button><div class="place-hero" aria-hidden="true">${typeInfo(m).icon}</div><h2 tabindex="-1">${escapeHtml(m.name)}</h2><p class="market-location">${typeInfo(m).label} · ${escapeHtml(m.city)}, ${escapeHtml(m.country)}</p>${links(m)}<p>${escapeHtml(m.address || 'Açık adres henüz eklenmedi.')}</p>${hasLocation(m) ? '' : '<p>Harita konumu henüz eklenmedi. Yol tarifi adres aramasıyla açılır.</p>'}${warningHtml(m)}<h3>Ürünler ve güncellik</h3><div class="products">${productTags(m.products,m)}</div><div class="detail-tools"><button id="detail-share">Paylaş</button><button id="detail-report">Bilgi düzelt / ürün bildir</button></div>`;
  document.getElementById('back-results').onclick = () => { selectedId=''; syncUrl(); showDetail(); list.querySelector('button')?.focus(); };
  document.getElementById('detail-share').onclick = shareUrl;
  document.getElementById('detail-report').onclick = () => openForm(m);
}
function selectMarket(m, focus) {
  selectedId = m.id; syncUrl(); setPanel(true); showDetail(m);
  if(hasLocation(m)) cluster.zoomToShowLayer(m.marker, () => {});
  if(focus) document.querySelector('#place-detail h2').focus();
}
document.getElementById('panel-toggle').onclick = () => setPanel(document.body.classList.contains('panel-closed'));
function fitResults() {
  const points = markets.filter(m => matches(m, searchInput.value.trim()) && hasLocation(m)).map(m => [m.lat,m.lng]);
  if(points.length) map.fitBounds(points,{padding:[30,30],maxZoom:13});
}
function renderModes() {
  document.querySelectorAll('[data-mode]').forEach(b => { b.setAttribute('aria-pressed',String(b.dataset.mode===mode)); b.classList.toggle('active',b.dataset.mode===mode); });
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode=b.dataset.mode; selectedType=null; selectedId=''; renderModes(); renderTypeFilters(); render(); fitResults(); });
countrySelect.onchange = () => { selectedId=''; updateCities(); render(); fitResults(); };
citySelect.onchange = () => { selectedId=''; render(); fitResults(); };
document.getElementById('reset').onclick = () => { searchInput.value=''; countrySelect.value=''; updateCities(); citySelect.value=''; selectedType=null; selectedId=''; mode='all'; position=null; status.textContent=''; renderModes(); renderTypeFilters(); render(); fitResults(); };
window.addEventListener('popstate', restoreUrl);
async function shareUrl() {
  try { await navigator.clipboard.writeText(location.href); status.textContent='Bağlantı kopyalandı.'; }
  catch { status.textContent=`Paylaşılacak bağlantı: ${location.href}`; }
}
document.getElementById('share').onclick = () => { selectedId=''; syncUrl(); shareUrl(); };
document.getElementById('nearby').onclick = () => {
  if(!navigator.geolocation) { status.textContent='Bu tarayıcı konumu desteklemiyor. Şehir filtresini kullanabilirsin.'; return; }
  status.textContent='Konum izni bekleniyor…';
  navigator.geolocation.getCurrentPosition(p => {
    position=[p.coords.latitude,p.coords.longitude]; selectedId=''; countrySelect.value=''; updateCities(); citySelect.value='';
    render(); const closest=markets.filter(m => matches(m,searchInput.value.trim()) && hasLocation(m)).sort((a,b)=>distance(a)-distance(b))[0];
    if(closest) map.fitBounds([position,[closest.lat,closest.lng]],{padding:[30,30],maxZoom:13});
    status.textContent='Sonuçlar kuş uçuşu mesafeye göre sıralandı. Konumun kaydedilmez veya katkı sunucusuna gönderilmez.';
  }, () => { status.textContent='Konum alınamadı. Şehir filtresini kullanabilirsin.'; }, {timeout:10000,maximumAge:60000});
};
const dialog=document.getElementById('contribution'), form=document.getElementById('contribution-form');
function openForm(m) {
  form.reset(); form.elements.place.value=m?.name || ''; form.elements.location.value=m ? `${m.city}, ${m.country}` : '';
  form.elements.observedAt.max=new Date().toLocaleDateString('en-CA');
  document.getElementById('form-status').textContent=window.APP_CONFIG?.contributionEndpoint ? '' : 'Çevrimiçi gönderim henüz yapılandırılmadı. Önerini dosya olarak indirebilirsin.';
  dialog.showModal();
}
document.getElementById('contribute').onclick=()=>openForm();
document.getElementById('close-form').onclick=()=>dialog.close();
function reportData() { return Object.fromEntries(new FormData(form)); }
document.getElementById('download-report').onclick=()=>{
  if(!form.reportValidity()) return;
  const u=URL.createObjectURL(new Blob([JSON.stringify(reportData(),null,2)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=u; a.download='yer-urun-onerisi.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
};
form.onsubmit=async e=>{
  e.preventDefault(); const message=document.getElementById('form-status'); const endpoint=safeUrl(window.APP_CONFIG?.contributionEndpoint);
  if(!endpoint){message.textContent='Çevrimiçi gönderim henüz yapılandırılmadı. Öneriyi indir seçeneğini kullanabilirsin.';return;}
  const button=form.querySelector('[type=submit]'); button.disabled=true; message.textContent='Gönderiliyor…';
  try { const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reportData())}); if(!response.ok) throw Error(); message.textContent='Önerin incelemeye alındı. Teşekkürler!'; form.reset(); }
  catch {message.textContent='Gönderilemedi. Yeniden deneyebilir veya öneriyi indirebilirsin.';}
  finally {button.disabled=false;}
};
