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
};
const UNKNOWN_TYPE = { label: "Diğer", icon: "📍" };

function typeInfo(market) {
  return TYPES[market.type] || UNKNOWN_TYPE;
}

let markets = [];
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

function productTags(products) {
  return products.map((p) => `<span class="product">${escapeHtml(p)}</span>`).join("");
}

function popupHtml(market) {
  const type = typeInfo(market);
  return `
    <strong>${escapeHtml(market.name)}</strong><br>
    <small>${type.icon} ${type.label}</small><br>
    ${escapeHtml(market.city)}, ${escapeHtml(market.country)}<br>
    ${market.address ? `<small>${escapeHtml(market.address)}</small><br>` : ""}
    <div class="products">${productTags(market.products)}</div>
  `;
}

// Koordinatı henüz girilmemiş kayıtlar ("lat": null) listede görünür ama haritada işaret almaz
function hasLocation(market) {
  return typeof market.lat === "number" && typeof market.lng === "number";
}

function matches(market, query) {
  if (selectedType && market.type !== selectedType) return false;
  if (!query) return true;
  const haystack = normalize(
    [market.name, market.city, market.country, typeInfo(market).label, ...market.products].join(" ")
  );
  return haystack.includes(normalize(query));
}

function render() {
  const query = searchInput.value.trim();
  const visible = markets.filter((m) => matches(m, query));

  list.innerHTML = "";
  for (const market of markets) {
    if (!market.marker) continue;
    const isVisible = visible.includes(market);
    if (isVisible) {
      market.marker.addTo(map);
    } else {
      market.marker.remove();
    }
  }

  for (const market of visible) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="market-name">${typeInfo(market).icon} ${escapeHtml(market.name)}</div>
      <div class="market-location">${escapeHtml(market.city)}, ${escapeHtml(market.country)}${hasLocation(market) ? "" : " (konum eklenecek)"}</div>
      <div class="products">${productTags(market.products)}</div>
    `;
    if (hasLocation(market)) {
      li.addEventListener("click", () => {
        map.flyTo([market.lat, market.lng], 14);
        market.marker.openPopup();
      });
    }
    list.appendChild(li);
  }

  resultCount.textContent = `${visible.length} yer bulundu`;
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
    button.classList.toggle("active", option.key === selectedType);
    button.addEventListener("click", () => {
      selectedType = option.key;
      renderTypeFilters();
      render();
    });
    typeFilters.appendChild(button);
  }
}

function markerIcon(market) {
  return L.divIcon({
    className: "type-marker",
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
    markets = (await Promise.all(files.map(fetchJson))).flat();
  } catch (error) {
    resultCount.textContent = "Veriler yüklenemedi. Sayfayı Live Server ile açtığından emin ol.";
    console.error(error);
    return;
  }

  for (const market of markets) {
    if (!hasLocation(market)) continue;
    market.marker = L.marker([market.lat, market.lng], { icon: markerIcon(market) }).bindPopup(popupHtml(market));
  }

  renderTypeFilters();
  render();
}

searchInput.addEventListener("input", render);
init();
