// data/ klasörünü kontrol eder. Kullanım: node scripts/validate-markets.js
// Yapı: data/index.json + data/<ülke>/<şehir>.json (ülke ve şehir adları küçük harf, Türkçe karaktersiz, boşluk yerine "-")
const fs = require("fs");
const path = require("path");

// app.js içindeki TYPES ile aynı tutulmalı
const TYPES = ["market", "restoran", "kafe", "firin", "berber"];
const REQUIRED_TEXT = ["name", "type", "city", "country"];
const DUPLICATE_DISTANCE_METERS = 30;

const dataDir = path.join(__dirname, "..", "data");
const errors = [];

function normalize(text) {
  return String(text)
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9ğüşöç]/g, "");
}

// "Gold Coast" -> "gold-coast", "İzmir" -> "izmir"
function slug(text) {
  return String(text)
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`❌ ${path.relative(dataDir, file)} okunamadı: ${error.message}`);
    process.exit(1);
  }
}

const index = readJson(path.join(dataDir, "index.json"));
if (typeof index !== "object" || index === null || Array.isArray(index)) {
  console.error('❌ index.json { "ülke": ["şehir", ...] } biçiminde olmalı');
  process.exit(1);
}

const markets = [];
const indexed = new Set();
for (const [country, cities] of Object.entries(index)) {
  if (!Array.isArray(cities)) {
    errors.push(`index.json: "${country}" şehir listesi olmalı`);
    continue;
  }
  for (const city of cities) {
    const rel = `${country}/${city}.json`;
    indexed.add(rel);
    const file = path.join(dataDir, country, `${city}.json`);
    if (!fs.existsSync(file)) {
      errors.push(`index.json: ${rel} dosyası yok`);
      continue;
    }
    const list = readJson(file);
    if (!Array.isArray(list)) {
      errors.push(`${rel}: bir liste ([ ... ]) olmalı`);
      continue;
    }
    list.forEach((m, i) => {
      // Dosya yolu ile kaydın kendi şehir/ülke alanı uyuşmalı
      if (slug(m.country) !== country || slug(m.city) !== city) {
        errors.push(`${rel} #${i + 1} (${m.name || "isimsiz"}): "${m.city}, ${m.country}" bu dosyaya ait değil`);
      }
      markets.push({ ...m, _file: rel });
    });
  }
}

// data/ altındaki her şehir dosyası index.json'da listelenmiş olmalı, yoksa sitede görünmez
for (const country of fs.readdirSync(dataDir, { withFileTypes: true })) {
  if (!country.isDirectory()) continue;
  for (const file of fs.readdirSync(path.join(dataDir, country.name))) {
    if (file.endsWith(".json") && !indexed.has(`${country.name}/${file}`)) {
      errors.push(`${country.name}/${file} index.json'da listelenmemiş`);
    }
  }
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
  const where = `${m._file} (${m.name || "isimsiz"})`;

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
  if (m.verified !== undefined && typeof m.verified !== "boolean") {
    errors.push(`${where}: "verified" true ya da false olmalı`);
  }
  if (m.note !== undefined && (typeof m.note !== "string" || !m.note.trim())) {
    errors.push(`${where}: "note" boş olmayan bir yazı olmalı`);
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
      errors.push(`${a._file} (${a.name}) ve ${b._file} (${b.name}) aynı yer olabilir`);
    }
  }
}

if (errors.length) {
  console.error(`❌ ${errors.length} sorun bulundu:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`✅ ${markets.length} yer kontrol edildi, sorun yok`);
