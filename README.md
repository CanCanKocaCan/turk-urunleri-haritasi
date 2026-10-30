# 🇹🇷 Türk Ürünleri Haritası

Yurt dışında Türk ürünlerini (Beypazarı, Ülker, Pınar, sucuk, simit…) nerede bulabileceğini gösteren açık kaynak, interaktif bir harita.

Örnek: Avustralya'nın Adelaide şehrinde Beypazarı maden suyu mu arıyorsun? Haritada "Beypazarı" yaz, Saray Market'i gör.

## Teknolojiler

- Düz HTML, CSS ve JavaScript (derleme adımı yok)
- [Leaflet](https://leafletjs.com) ve [OpenStreetMap](https://www.openstreetmap.org) haritası
- Veriler: [`data/`](data) klasöründe, ülke ve şehre göre ayrılmış (`data/avustralya/adelaide.json` gibi)

## Yerelde çalıştırma

Sayfa verileri `fetch` ile yüklediği için `index.html` dosyasına çift tıklayarak açılmaz, küçük bir yerel sunucu gerekir.

1. VS Code'da **Live Server** eklentisini kur.
2. `index.html` dosyasına sağ tıkla ve **Open with Live Server** seçeneğini seç.

## Market ekleme (katkıda bulun)

1. Bu repoyu fork'la.
2. Yerin şehrinin dosyasına (`data/<ülke>/<şehir>.json`, ör. `data/avustralya/adelaide.json`) yeni bir kayıt ekle:

```json
{
  "name": "Market adı",
  "type": "market",
  "city": "Şehir",
  "country": "Ülke",
  "address": "Açık adres (isteğe bağlı)",
  "lat": 0.0,
  "lng": 0.0,
  "products": ["Ürün 1", "Ürün 2"],
  "source": "Bilginin kaynağı, ör. işletmenin web sitesi (isteğe bağlı)"
}
```

   `type` şunlardan biri olmalı: `market` 🛒, `restoran` 🍽️, `kafe` ☕, `firin` 🥖, `berber` 💈 (berberler için yalnızca Türk sahipli dükkanlar eklenir; `products` alanına verdikleri hizmetler yazılır)

   Şehrin dosyası yoksa oluştur ve `data/index.json` içindeki ülkenin listesine ekle (ülke klasörü de yoksa o da eklenir). Ülke ve şehir adları küçük harfli, Türkçe karaktersiz yazılır, boşluk yerine `-` kullanılır: `data/avustralya/gold-coast.json`.
3. Koordinatları bulmak için Google Maps'te markete sağ tıkla; ilk satırdaki sayılar `lat, lng` değerleridir.
4. Pull Request aç. GitHub, dosyanın doğru formatta olduğunu otomatik olarak kontrol eder (`scripts/validate-markets.js`).

## Otomatik yer bulucu

Haftada bir çalışan bir Claude agent'ı yeni yerler arar, doğrular ve PR açar. Talimatları: [`agent/YER-BULUCU.md`](agent/YER-BULUCU.md). Agent'ın açtığı PR'lar da diğer PR'lar gibi incelenip onaylanır.

> Lütfen yalnızca bizzat gördüğün veya doğrulayabildiğin marketleri ekle.

## Lisans

[MIT](LICENSE)
