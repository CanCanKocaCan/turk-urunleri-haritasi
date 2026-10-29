// data/markets.json dosyasını kontrol eder. Kullanım: node scripts/validate-markets.js
const fs = require("fs");
const path = require("path");

// app.js içindeki TYPES ile aynı tutulmalı
const TYPES = ["market", "restoran", "kafe", "firin"];
const REQUIRED_TEXT = ["name", "type", "city", "country"];
const DUPLICATE_DISTANCE_METERS = 30;

const file = path.join(__dirname, "..", "data", "markets.json");
const errors = [];

let markets;
try {
  markets = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (error) {
  console.error(`❌ markets.json okunamadı: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(markets)) {
  console.error("❌ markets.json bir liste ([ ... ]) olmalı");
  process.exit(1);
}

function normalize(text) {
  return String(text)
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9ğüşöç]/g, "");
}

function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

markets.forEach((m, i) => {
  const where = `#${i + 1} (${m.name || "isimsiz"})`;

  for (const field of REQUIRED_TEXT) {
    if (typeof m[field] !== "string" || !m[field].trim()) {
      errors.push(`${where}: "${field}" boş olamaz`);
    }
  }
  if (m.type && !TYPES.includes(m.type)) {
    errors.push(`${where}: "type" şunlardan biri olmalı: ${TYPES.join(", ")} (şu an: "${m.type}")`);
  }
  // Koordinat bulunamadıysa ikisi birlikte null olabilir; sahibi sonradan elle doldurur
  const noLocation = m.lat === null && m.lng === null;
  if (!noLocation) {
    if (typeof m.lat !== "number" || m.lat < -90 || m.lat > 90) {
      errors.push(`${where}: "lat" -90 ile 90 arasında bir sayı olmalı (ya da lat ve lng birlikte null)`);
    }
    if (typeof m.lng !== "number" || m.lng < -180 || m.lng > 180) {
      errors.push(`${where}: "lng" -180 ile 180 arasında bir sayı olmalı (ya da lat ve lng birlikte null)`);
    }
  }
  if (!Array.isArray(m.products) || !m.products.every((p) => typeof p === "string" && p.trim())) {
    errors.push(`${where}: "products" yazılardan oluşan bir liste olmalı`);
  }
  if (m.address !== undefined && typeof m.address !== "string") {
    errors.push(`${where}: "address" yazı olmalı`);
  }
  if (m.source !== undefined && !/^https?:\/\/\S+$/.test(m.source)) {
    errors.push(`${where}: "source" http:// veya https:// ile başlayan bir link olmalı`);
  }
});

for (let i = 0; i < markets.length; i++) {
  for (let j = i + 1; j < markets.length; j++) {
    const a = markets[i];
    const b = markets[j];
    const sameName = normalize(a.name) === normalize(b.name) && normalize(a.city) === normalize(b.city);
    const tooClose =
      typeof a.lat === "number" && typeof b.lat === "number" &&
      distanceMeters(a, b) < DUPLICATE_DISTANCE_METERS;
    if (sameName || tooClose) {
      errors.push(`#${i + 1} (${a.name}) ve #${j + 1} (${b.name}) aynı yer olabilir`);
    }
  }
}

if (errors.length) {
  console.error(`❌ ${errors.length} sorun bulundu:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`✅ ${markets.length} yer kontrol edildi, sorun yok`);
