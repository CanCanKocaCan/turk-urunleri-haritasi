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
  "id": "ulke-sehir-benzersiz-ad",
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

## Keşif ve paylaşım

Ürün bul modu market ve fırınlardaki ürünleri arar; Mekân bul modu işletme adı,
şehir, ülke ve türü arar. Ülke, şehir, tür ve arama birlikte filtrelenir.
Yakınımdakiler yalnızca kullanıcı düğmeye bastığında konum ister; konum URL'ye,
katkı servisine veya kalıcı depolamaya yazılmaz. Mesafeler kuş uçuşudur.
Paylaş bağlantıları filtreleri veya seçili mekânın kalıcı `id` değerini taşır.
Kayıtları yeniden sıralarken `id` alanını değiştirmeyin.

İsteğe bağlı mekân alanları: `website` (http/https) ve `phone` (uluslararası telefon).
Ürün bilgileri mevcut `products` listesiyle geriye uyumludur:

```json
"productEvidence": {
  "Beypazarı maden suyu": {
    "lastSeen": "2026-10-01",
    "source": "https://example.com/product-evidence"
  }
}
```

Bu örnek gerçek gözlem değildir. Tarih ve kaynak yalnızca doğrulanmış gözlem
olduğunda girilir. Eksik veride arayüz tarihi bilinmiyor gösterir; işletmenin
`source` alanı ürünün stok kanıtı olarak kullanılmaz.

## Hesapsız katkı servisi (ilk kurulum)

GitHub Pages sunucu kodu çalıştırmaz. `community/worker.mjs` anonim formları
GitHub issue olarak incelemeye alır; yayınlanan veriyi değiştirmez. Gönderilen
bilgiler açık depoda herkese görünür olabilir; kişisel bilgi toplamayın.

1. Cloudflare Workers hesabında `community/` dizininden Wrangler ile deploy edin.
2. Yalnızca bu depoya Issues yazma yetkisi olan fine-grained GitHub token'ını
   `npx wrangler secret put GITHUB_TOKEN` ile secret olarak kaydedin.
3. `wrangler.toml` içindeki origin, depo ve rate limit binding'ini kontrol edip
   `npx wrangler deploy` çalıştırın. IP başına dakikada 3 istek sınırı vardır;
   IP yalnızca edge hız sınırı anahtarıdır, issue gövdesine eklenmez.
4. Dönen HTTPS adresini `config.js` içindeki `contributionEndpoint` alanına yazın.
5. Gerçek bir deneme gönderisini kontrol edin; gelen issue'ları doğruladıktan
   sonra veriye PR ile aktarın. Kapandı/yok bildirimlerini de doğrulayın.

Servis yapılandırılmamışsa arayüz bunu açıkça söyler ve raporu JSON olarak
indirmeyi sunar. Token kesinlikle istemci dosyalarına konulmaz. Origin kontrolü
kimlik doğrulama değildir; edge hız sınırı ve insan incelemesi zorunludur.

Kontroller: `node scripts/validate-markets.js`, `node --test tests/*.test.mjs`.
