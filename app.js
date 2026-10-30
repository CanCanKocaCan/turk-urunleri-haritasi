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
let areaBounds = null;
let highlightedId = '';

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
function productTags(products, market, reportButtons = false) {
  return products.map(p => { const info = market?.productEvidence?.[p];
    return `<span class="product"><strong>${escapeHtml(p)}</strong><small>${freshnessHtml(info?.lastSeen)}${safeUrl(info?.source) ? ` · <a href="${escapeHtml(safeUrl(info.source))}" target="_blank" rel="noopener">Kaynak</a>` : ""}</small>${reportButtons ? `<button class="seen-product" data-product="${escapeHtml(p)}">Bu ürünü gördüm</button>` : ''}</span>`;
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
  if (!inArea(market)) return false;
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
    open.dataset.id = market.id;
    open.addEventListener('mouseenter', () => highlightMarket(market.id));
    open.addEventListener('mouseleave', () => highlightMarket(selectedId));
    open.addEventListener('focus', () => highlightMarket(market.id));
    open.addEventListener('blur', () => highlightMarket(selectedId));
    open.setAttribute("aria-label", `${market.name}, ${market.city}: ayrıntıları göster`);
    open.innerHTML = `<span class="result-icon" aria-hidden="true">${typeInfo(market).icon}</span><span><strong>${escapeHtml(market.name)}</strong><span class="market-location">${typeInfo(market).label} · ${escapeHtml(market.city)}, ${escapeHtml(market.country)}</span><span class="preview-products">${escapeHtml(market.products.slice(0,3).join(" · "))}</span>${market.products.length ? freshnessHtml(Object.values(market.productEvidence || {}).map(e => e.lastSeen).filter(Boolean).sort().at(-1)) : ""}${hasLocation(market) ? "" : '<span class="market-location">Konum eklenecek</span>'}${position && hasLocation(market) ? `<span class="market-location">${distance(market).toFixed(1)} km</span>` : ""}</span>`;
    open.onclick = () => selectMarket(market, true);
    li.appendChild(open);
    list.appendChild(li);
  }

  resultCount.textContent = `${visible.length} yer · ${visible.filter(hasLocation).length} haritada · ${visible.filter(m => !hasLocation(m)).length} konum bekliyor`;
  document.getElementById("search-summary").textContent = `${visible.length} yer bulundu`;
  document.getElementById('sheet-label').textContent = `${visible.length} sonuç`;
  if (!visible.length) list.innerHTML = '<li>Sonuç bulunamadı. Filtreleri temizleyebilir veya yeni bir yer önerebilirsin.</li>';
  if (!visible.some(m => m.id === selectedId)) selectedId = "";
  showDetail(markets.find(m => m.id === selectedId));
  highlightMarket(selectedId);
  renderActiveFilters();
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
    status.textContent = resultCount.textContent;
    console.error(error);
    return;
  }

  for (const market of markets) {
    if (!hasLocation(market)) continue;
    market.marker = L.marker([market.lat, market.lng], { icon: markerIcon(market), title: `${market.name}, ${market.city}`, alt: `${market.name}, ${market.city}` })
      .on("click", () => selectMarket(market, true))
      .on('mouseover', () => highlightMarket(market.id,true))
      .on('mouseout', () => highlightMarket(selectedId));
  }

  document.getElementById("coverage").textContent = `Kapsam: ${[...new Set(markets.map(m => m.country))].join(", ")}. ${markets.length} kayıt.`;
  for (const country of [...new Set(markets.map(m => m.country))].sort()) countrySelect.add(new Option(country,country));
  restoreUrl();
}


searchInput.addEventListener("input", () => { selectedId = ""; render(); renderSuggestions(); });

function distance(m) {
  if (!hasLocation(m)) return Infinity;
  return map.distance(position, [m.lat,m.lng]) / 1000;
}
function syncUrl() {
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries({q:searchInput.value, country:countrySelect.value, city:citySelect.value, type:selectedType, mode:mode === 'all' ? '' : mode, place:selectedId})) if(v) p.set(k,v);
  if (areaBounds) p.set('bounds', [areaBounds.getSouth(), areaBounds.getWest(), areaBounds.getNorth(), areaBounds.getEast()].join(','));
  history.replaceState(null,'',`${location.pathname}${p.size ? '?'+p : ''}`);
}
function updateCities() {
  const previous = citySelect.value; citySelect.replaceChildren(new Option('Tüm şehirler',''));
  for(const city of [...new Set(markets.filter(m => !countrySelect.value || m.country === countrySelect.value).map(m => m.city))].sort()) citySelect.add(new Option(city,city));
  citySelect.value = [...citySelect.options].some(o => o.value === previous) ? previous : '';
}
function restoreUrl() {
  const p = new URLSearchParams(location.search);
  areaBounds = parseAreaBounds(p.get('bounds'));
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
  document.getElementById('filter-toggle').setAttribute('aria-expanded', String(open && document.getElementById('advanced-filters').open));
  if (!open && document.getElementById('sidebar').contains(document.activeElement)) toggle.focus();
}
function showDetail(m) {
  const detail = document.getElementById('place-detail');
  detail.hidden = !m; list.hidden = !!m;
  document.getElementById('result-count').hidden = !!m;
  if (!m) { detail.replaceChildren(); return; }
  detail.innerHTML = `<button id="back-results">← Sonuçlara dön</button><div class="place-hero" aria-hidden="true">${typeInfo(m).icon}</div><h2 tabindex="-1">${escapeHtml(m.name)}</h2><p class="market-location">${typeInfo(m).label} · ${escapeHtml(m.city)}, ${escapeHtml(m.country)}</p>${links(m)}<p>${escapeHtml(m.address || 'Açık adres henüz eklenmedi.')}</p>${hasLocation(m) ? '' : '<p>Harita konumu henüz eklenmedi. Yol tarifi adres aramasıyla açılır.</p>'}${warningHtml(m)}<h3>Ürünler ve güncellik</h3><div class="products">${productTags(m.products,m,true)}</div><p class="stock-note">Görülme tarihi stok garantisi değildir. Gitmeden önce işletmeyle kontrol et.</p><div class="detail-tools"><button id="detail-share">Paylaş</button><button id="detail-report">Bilgi düzelt / ürün bildir</button></div>`;
  document.getElementById('back-results').onclick = () => { selectedId=''; syncUrl(); showDetail(); highlightMarket(''); list.querySelector('button')?.focus(); };
  detail.querySelectorAll('.seen-product').forEach(button => button.onclick = () => openSeenForm(m, button.dataset.product));
  document.getElementById('detail-share').onclick = shareUrl;
  document.getElementById('detail-report').onclick = () => openForm(m);
}
function selectMarket(m, focus) {
  selectedId = m.id; syncUrl(); setPanel(true); showDetail(m);
  closeSuggestions(); setSheetExpanded(false);
  if(hasLocation(m)) cluster.zoomToShowLayer(m.marker, () => { highlightMarket(m.id); map.panTo([m.lat,m.lng],{animate:false}); map.panInside?.([m.lat,m.lng],{...mapPadding(),animate:false}); });
  else highlightMarket('');
  if(focus) document.querySelector('#place-detail h2').focus();
}
const advancedFilters = document.getElementById('advanced-filters');
const filterToggle = document.getElementById('filter-toggle');
filterToggle.onclick = () => {
  const open = document.body.classList.contains('panel-closed') || !advancedFilters.open;
  setPanel(true);
  advancedFilters.open = open;
  if(open) setSheetExpanded(true);
  if (open) advancedFilters.scrollIntoView({block:'nearest'});
};
advancedFilters.addEventListener('toggle', () => filterToggle.setAttribute('aria-expanded', String(advancedFilters.open && !document.body.classList.contains('panel-closed'))));
document.getElementById('search-form').onsubmit = e => {
  e.preventDefault();
  closeSuggestions(); selectedId = ''; render(); fitResults();
};
document.getElementById('panel-toggle').onclick = () => setPanel(document.body.classList.contains('panel-closed'));
function fitResults() {
  const points = markets.filter(m => matches(m, searchInput.value.trim()) && hasLocation(m)).map(m => [m.lat,m.lng]);
  if(points.length) map.fitBounds(points,{...mapPadding(),maxZoom:13});
}
function renderModes() {
  document.querySelectorAll('[data-mode]').forEach(b => { b.setAttribute('aria-pressed',String(b.dataset.mode===mode)); b.classList.toggle('active',b.dataset.mode===mode); });
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode=b.dataset.mode; selectedType=null; selectedId=''; renderModes(); renderTypeFilters(); render(); fitResults(); });
countrySelect.onchange = () => { selectedId=''; areaBounds=null; status.textContent=''; updateCities(); render(); fitResults(); };
citySelect.onchange = () => { selectedId=''; areaBounds=null; status.textContent=''; render(); fitResults(); };
document.getElementById('reset').onclick = () => { searchInput.value=''; countrySelect.value=''; updateCities(); citySelect.value=''; selectedType=null; selectedId=''; mode='all'; position=null; areaBounds=null; closeSuggestions(); status.textContent=''; renderModes(); renderTypeFilters(); render(); fitResults(); };
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
    position=[p.coords.latitude,p.coords.longitude]; selectedId=''; areaBounds=null; countrySelect.value=''; updateCities(); citySelect.value='';
    render(); const closest=markets.filter(m => matches(m,searchInput.value.trim()) && hasLocation(m)).sort((a,b)=>distance(a)-distance(b))[0];
    if(closest) map.fitBounds([position,[closest.lat,closest.lng]],{...mapPadding(),maxZoom:13});
    status.textContent='Sonuçlar kuş uçuşu mesafeye göre sıralandı. Konumun kaydedilmez veya katkı sunucusuna gönderilmez.';
  }, () => { status.textContent='Konum alınamadı. Şehir filtresini kullanabilirsin.'; }, {timeout:10000,maximumAge:60000});
};
const dialog=document.getElementById('contribution'), form=document.getElementById('contribution-form');
function openForm(m) {
  closeSuggestions();
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
// Product observations are evidence dates, never live inventory claims.
function freshnessHtml(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(`${value}T00:00:00Z`) : null;
  const today = new Date();
  const age = date ? (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - date.getTime()) / 86400000 : NaN;
  if (!date || !Number.isFinite(age) || age < 0 || date.toISOString().slice(0,10) !== value) return '<span class="freshness unknown">Görülme tarihi bilinmiyor</span>';
  const label = new Intl.DateTimeFormat('tr', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  return `<span class="freshness ${age <= 90 ? 'recent' : 'older'}">Son görülme: <time datetime="${value}">${label}</time>${age > 90 ? ' · 90 günden eski' : ''}</span>`;
}
function openSeenForm(m, product) {
  openForm(m);
  form.elements.kind.value = 'seen';
  form.elements.details.value = product;
  const now = new Date();
  form.elements.observedAt.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function highlightMarket(id, fromMap = false) {
  highlightedId = id || '';
  document.querySelectorAll('.is-highlighted').forEach(el => el.classList.remove('is-highlighted'));
  for (const card of list.querySelectorAll('.result-card')) {
    const active = card.dataset.id === highlightedId;
    card.classList.toggle('is-highlighted', active);
    if (active && fromMap && !list.hidden && !document.body.classList.contains('panel-closed')) card.scrollIntoView({block:'nearest'});
  }
  markets.forEach(m => m.marker?.setZIndexOffset?.(m.id === highlightedId ? 1000 : 0));
  const marker = markets.find(m => m.id === highlightedId)?.marker;
  if (!marker) return;
  const parent = cluster.getVisibleParent?.(marker) || marker;
  parent.getElement?.()?.classList.add('is-highlighted');

}
function renderActiveFilters() {
  const container = document.getElementById('active-filters');
  container.replaceChildren();
  const add = (label, clear) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = `${label} ×`;
    button.setAttribute('aria-label', `${label} filtresini kaldır`);
    button.onclick = () => { selectedId=''; clear(); closeSuggestions(); renderModes(); renderTypeFilters(); render(); fitResults(); };
    container.appendChild(button);
  };
  if (searchInput.value.trim()) add(`Arama: ${searchInput.value.trim()}`, () => searchInput.value='');
  if (countrySelect.value) add(countrySelect.value, () => {countrySelect.value='';updateCities();});
  if (citySelect.value) add(citySelect.value, () => citySelect.value='');
  if (selectedType) add(TYPES[selectedType].label, () => selectedType=null);
  if (mode !== 'all') add(mode === 'product' ? 'Ürün bul' : 'Mekân bul', () => mode='all');
  if (position) add('Yakınımdakiler', () => position=null);
  if (areaBounds) add('Haritadaki bölge', () => {areaBounds=null;status.textContent='';});
}

// Suggestions share the current geographic/type constraints and use real data only.
const suggestions = document.getElementById('suggestions');
let suggestionItems = [], activeSuggestion = -1;
function closeSuggestions() {
  suggestions.hidden = true; searchInput.setAttribute('aria-expanded','false');
  searchInput.removeAttribute('aria-activedescendant'); activeSuggestion = -1;
}
function renderSuggestions() {
  const query = normalize(searchInput.value.trim());
  suggestions.replaceChildren(); suggestionItems=[]; activeSuggestion=-1;
  if (query.length < 2) { closeSuggestions(); return; }
  const pool = markets.filter(m => matches(m,''));
  const includes = value => normalize(value).includes(query);
  const groups = [
    ['Ürünler', [...new Set(pool.filter(m => ['market','firin'].includes(m.type)).flatMap(m => m.products))].filter(includes).slice(0,4).map(label => ({kind:'product',label}))],
    ['Mekânlar', pool.filter(m => includes(m.name)).slice(0,4).map(m => ({kind:'place',label:m.name,description:`${m.city}, ${m.country}`,market:m}))],
    ['Şehirler', [...new Map(pool.map(m => [`${m.country}/${m.city}`,{kind:'city',label:m.city,country:m.country}])).values()].filter(x => includes(x.label)).slice(0,4)]
  ];
  for (const [label, items] of groups) {
    if (!items.length) continue;
    const group=document.createElement('div');group.setAttribute('role','group');group.setAttribute('aria-label',label);
    const heading=document.createElement('div');heading.className='suggestion-heading';heading.textContent=label;group.appendChild(heading);
    for (const item of items) {
      const index=suggestionItems.push(item)-1;
      const option=document.createElement('div');option.id=`suggestion-${index}`;option.setAttribute('role','option');option.setAttribute('aria-selected','false');
      const title=document.createElement('strong');title.textContent=item.label;option.appendChild(title);
      const small=document.createElement('small');small.textContent=item.description || item.country || 'Ürünü bul';option.appendChild(small);
      option.onmousedown=e=>e.preventDefault();
      option.onclick=()=>chooseSuggestion(index);
      group.appendChild(option);
    }
    suggestions.appendChild(group);
  }
  suggestions.hidden=!suggestionItems.length;
  searchInput.setAttribute('aria-expanded',String(!suggestions.hidden));
  searchInput.removeAttribute('aria-activedescendant');
}
function chooseSuggestion(index) {
  const item=suggestionItems[index];if(!item)return;
  selectedId='';
  if(item.kind==='city') {
    areaBounds=null;countrySelect.value=item.country;updateCities();citySelect.value=item.label;
    searchInput.value='';mode='all';
  } else {searchInput.value=item.label;mode=item.kind==='product'?'product':'place';}
  closeSuggestions();renderModes();renderTypeFilters();render();fitResults();
  if(item.market)selectMarket(item.market,true);
}
searchInput.addEventListener('focus',renderSuggestions);
searchInput.addEventListener('blur',closeSuggestions);
searchInput.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeSuggestions();return;}
  if(suggestions.hidden)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp') {
    e.preventDefault();
    activeSuggestion=activeSuggestion<0 ? (e.key==='ArrowDown'?0:suggestionItems.length-1) : (activeSuggestion+(e.key==='ArrowDown'?1:-1)+suggestionItems.length)%suggestionItems.length;
    suggestions.querySelectorAll('[role="option"]').forEach((el,i)=>el.setAttribute('aria-selected',String(i===activeSuggestion)));
    const option=document.getElementById(`suggestion-${activeSuggestion}`);
    searchInput.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});
  } else if(e.key==='Enter'&&activeSuggestion>=0) {e.preventDefault();chooseSuggestion(activeSuggestion);}
});
document.addEventListener('pointerdown',e=>{if(!document.getElementById('map-search').contains(e.target))closeSuggestions();});

function parseAreaBounds(value) {
  if(!value)return null;
  const parts=value.split(',').map(Number);
  if(parts.length!==4||!parts.every(Number.isFinite))return null;
  const [s,w,n,e]=parts;
  if(s < -90 || n > 90 || s>=n || w>=e || Math.abs(w)>1080 || Math.abs(e)>1080)return null;
  return L.latLngBounds([[s,w],[n,e]]);
}
function inArea(m) {
  if(!areaBounds)return true;
  if(!hasLocation(m)||m.lat<areaBounds.getSouth()||m.lat>areaBounds.getNorth())return false;
  const west=areaBounds.getWest(),east=areaBounds.getEast();
  const lng=((m.lng-west)%360+360)%360+west;
  return east-west>=360 || lng<=east;
}
const areaButton=document.getElementById('search-area');
map.on('moveend',()=>{areaButton.hidden=false;highlightMarket(selectedId);});
document.getElementById('search-area').onclick=()=>{
  areaBounds=map.getBounds();selectedId='';closeSuggestions();render();areaButton.hidden=true;
  status.textContent='Yalnızca seçtiğin harita bölgesindeki konumlu yerler gösteriliyor.';
};

const sheetHandle=document.getElementById('sheet-handle');
const sidebar=document.getElementById('sidebar');
let sheetDrag=null;
function setSheetExpanded(expanded) {
  sidebar.style.removeProperty('--sheet-height');
  document.body.classList.toggle('sheet-expanded',expanded);
  sheetHandle.setAttribute('aria-expanded',String(expanded));
  sheetHandle.setAttribute('aria-label',expanded?'Sonuç panelini küçült':'Sonuç panelini büyüt');
}
sheetHandle.onclick=()=>{if(!sheetHandle.dataset.dragged)setSheetExpanded(!document.body.classList.contains('sheet-expanded'));delete sheetHandle.dataset.dragged;};
sheetHandle.onpointerdown=e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  sheetDrag={y:e.clientY,height:sidebar.getBoundingClientRect().height,moved:false};
  document.body.classList.add('sheet-dragging');
  sheetHandle.setPointerCapture(e.pointerId);
};
sheetHandle.onpointermove=e=>{
  if(!sheetDrag)return;
  const delta=sheetDrag.y-e.clientY;
  if(Math.abs(delta)>5)sheetDrag.moved=true;
  if(sheetDrag.moved) {
    sheetDrag.targetHeight=Math.max(150,sheetDrag.height+delta);
    sidebar.style.setProperty('--sheet-height',`${sheetDrag.targetHeight}px`);
  }
};
function endSheetDrag() {
  if(!sheetDrag)return;
  if(sheetDrag.moved) {
    sheetHandle.dataset.dragged='true';
    const expanded=sheetDrag.targetHeight>window.innerHeight*.55;
    setSheetExpanded(expanded);
  }
  sheetDrag=null;
  document.body.classList.remove('sheet-dragging');
}
sheetHandle.onpointerup=endSheetDrag;
sheetHandle.onpointercancel=()=>{sheetDrag=null;document.body.classList.remove('sheet-dragging');sidebar.style.removeProperty('--sheet-height');};
sheetHandle.onkeydown=e=>{
  if(e.key==='ArrowUp'||e.key==='ArrowDown') {e.preventDefault();setSheetExpanded(e.key==='ArrowUp');}
};
if(window.ResizeObserver) new ResizeObserver(()=>{
  const search=document.getElementById('map-search');
  document.documentElement.style.setProperty('--drawer-top',`${search.offsetTop+search.offsetHeight+12}px`);
}).observe(document.getElementById('map-search'));
init();
function mapPadding() {
  const mobile=window.innerWidth<=700;
  const panelOpen=!document.body.classList.contains('panel-closed');
  const searchBottom=document.getElementById('map-search').getBoundingClientRect().bottom;
  return {
    paddingTopLeft:[mobile?24:(panelOpen?sidebar.getBoundingClientRect().width+40:24),Math.min(searchBottom+16,window.innerHeight*.35)],
    paddingBottomRight:[24,mobile?(panelOpen?Math.min(sidebar.getBoundingClientRect().height+92,window.innerHeight*.55):92):30]
  };
}
