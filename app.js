const map = L.map("map").setView([30, 20], 2);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const searchInput = document.getElementById("search");
const list = document.getElementById("market-list");
const resultCount = document.getElementById("result-count");

let markets = [];

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
  return `
    <strong>${escapeHtml(market.name)}</strong><br>
    ${escapeHtml(market.city)}, ${escapeHtml(market.country)}<br>
    ${market.address ? `<small>${escapeHtml(market.address)}</small><br>` : ""}
    <div class="products">${productTags(market.products)}</div>
  `;
}

function matches(market, query) {
  if (!query) return true;
  const haystack = normalize(
    [market.name, market.city, market.country, ...market.products].join(" ")
  );
  return haystack.includes(normalize(query));
}

function render() {
  const query = searchInput.value.trim();
  const visible = markets.filter((m) => matches(m, query));

  list.innerHTML = "";
  for (const market of markets) {
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
      <div class="market-name">${escapeHtml(market.name)}</div>
      <div class="market-location">${escapeHtml(market.city)}, ${escapeHtml(market.country)}</div>
      <div class="products">${productTags(market.products)}</div>
    `;
    li.addEventListener("click", () => {
      map.flyTo([market.lat, market.lng], 14);
      market.marker.openPopup();
    });
    list.appendChild(li);
  }

  resultCount.textContent = `${visible.length} market bulundu`;
}

async function init() {
  try {
    const response = await fetch("data/markets.json");
    markets = await response.json();
  } catch (error) {
    resultCount.textContent = "Veriler yüklenemedi. Sayfayı Live Server ile açtığından emin ol.";
    console.error(error);
    return;
  }

  for (const market of markets) {
    market.marker = L.marker([market.lat, market.lng]).bindPopup(popupHtml(market));
  }

  render();
}

searchInput.addEventListener("input", render);
init();
