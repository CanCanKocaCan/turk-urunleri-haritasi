# Yer Bulucu Agent Talimatları

Bu dosya, haftalık çalışan Claude agent'ının talimatlarıdır. Agent'ın davranışını değiştirmek için bu dosyayı düzenle.

## Görev

Yurt dışında Türk ürünleri satan **marketleri**, Türk **restoranlarını**, **kafelerini** ve **fırınlarını** bul, doğrula, şehrinin `data/<ülke>/<şehir>.json` dosyasına ekle ve bir Pull Request aç.

**Bu çalışmada en fazla 10 yer ekle.** Daha azı tamamen kabul edilebilir. Az ama doğru veri, çok ama hatalı veriden iyidir.

## Bölge

Şu an **Avustralya** ve **Yeni Zelanda**. Bu listelerden `data/` klasöründe (tüm şehir dosyalarında) **en az kaydı olan** şehri seç. Dosyası olmayan şehrin kaydı 0 sayılır (eşitlikte listede önce geleni). O şehirde 10 yer bulamazsan, listedeki bir sonraki şehre geçebilirsin.

**Avustralya** (`country`: "Avustralya", klasör: `data/avustralya/`)
1. Melbourne
2. Sydney
3. Adelaide
4. Brisbane
5. Perth
6. Canberra
7. Gold Coast
8. Hobart
9. Darwin

**Yeni Zelanda** (`country`: "Yeni Zelanda", klasör: `data/yeni-zelanda/`, dosya örneği: `data/yeni-zelanda/auckland.json`)
1. Auckland
2. Wellington
3. Christchurch
4. Hamilton
5. Tauranga
6. Dunedin
7. Queenstown

Yeni Zelanda için `data/index.json` içine `"yeni-zelanda": [...]` anahtarını ekle (yoksa). Adres biçimi: "Sokak, numara, semt, şehir, posta kodu" (Yeni Zelanda'da eyalet yok). Nominatim aramalarında ülke olarak `New Zealand` kullan. Semt bazlı market aramasında şehirdeki Türk topluluğuna göre semtleri sen bul (ör. `Turkish grocery Auckland`, `Turkish community Wellington`).

## Bu çalışma için geçici özel istek (PR'dan sonra silinecek)

Proje sahibi bu çalışmada **Avustralya ve Yeni Zelanda genelinde en az 20 yer** istiyor. **Adelaide'de arama yapma** (Adelaide zaten yeterli). Yeni Zelanda ilk kez ekleniyor ve henüz hiç kaydı yok, bu yüzden oradan başla.

- Normal "en az kaydı olan şehir" kuralı yerine, önce **Yeni Zelanda** şehirlerini (Auckland, Wellington, Christchurch, Hamilton, Tauranga, Dunedin, Queenstown), sonra kayıt sayısı en az olandan başlayarak Avustralya'daki **Adelaide dışındaki** şehirleri (Melbourne, Sydney, Brisbane, Perth, Canberra, Gold Coast, Hobart, Darwin) sırayla tara ve toplam hedefe ulaşana kadar devam et. Yeni Zelanda'da en az 10 yer bulmaya çalış.
- Bu çalışmada 10 yer sınırı **yok**; en fazla **30** yer ekle. Hedef 20. Her yer kendi şehrinin dosyasına gider.
- **Doğrulama kuralları proje sahibinin onayıyla gevşetildi** (Adım 3'teki C yolu ve gevşetilmiş aktiflik kuralı). Kaynak, adres, koordinat veya ürün **uydurma** (Adım 3'teki değişmeyen kurallar geçerli). 20'ye ulaşamazsan bulduğun kadarını ekle ve PR'da kaç yer bulunduğunu, hangi şehirlerin ve semtlerin tarandığını açıkça yaz.
- **Önce eski adayları yeniden dene.** #1'den bugüne kadar tüm PR'ların "Eklenmeyen adaylar" bölümlerini oku (`gh pr list --state all` ya da GitHub aracı). Oradaki her adayı, gevşetilmiş kurallarla önce değerlendir, sonra yeni aday ara. Adelaide'dekileri atla.
- Tek PR aç. Commit mesajı: `Yeni Zelanda ve Avustralya: <N> yeni yer eklendi`. PR açıklamasında şehirleri ayrı başlıklar altında listele.

## Adımlar

### 1. Mevcut durumu öğren
- `data/index.json` dosyasını ve listelediği tüm şehir dosyalarını (`data/<ülke>/<şehir>.json`) oku. Zaten var olan yerleri tekrar ekleme.
- Daha önceki PR'ların (kapanmış olanlar dahil) "Eklenmeyen adaylar" bölümüne bak. Oradaki adayları bu çalışmada yeniden dene, çünkü belki bu sefer doğrulayabilirsin.
- Repoda açık bekleyen, `claude/yeni-yerler-` ile başlayan PR'lar varsa, onlardaki yerleri de tekrar ekleme.

### 2. Aday bul
- Web araması yap. İngilizce ve Türkçe aramalar dene, örneğin: `Turkish grocery Melbourne`, `Turkish restaurant Melbourne`, `Turkish bakery Melbourne`, `Türk marketi Melbourne`, `Turkish cafe künefe Melbourne`.
- **Marketleri, fırınları ve kasapları ayrıca semt semt ara.** Bunlar şehir adıyla yapılan aramalarda restoranların altında kaybolur. Türklerin yoğun yaşadığı semtleri kullan, örneğin:
  - Melbourne: Broadmeadows, Coburg, Brunswick, Roxburgh Park, Campbellfield, Meadow Heights, Dandenong, Sunshine
  - Sydney: Auburn, Lakemba, Granville, Bankstown, Prestons, Liverpool
  - Adelaide: Torrensville, Thebarton, Hindmarsh
  - Diğer şehirlerde önce "Turkish community <şehir>" diye arayıp semtleri bul.
  - Örnek aramalar: `Turkish grocery Auburn`, `Turkish butcher Lakemba`, `Turkish bakery Broadmeadows`, `pide salonu Coburg`, `Türk kasabı Auburn`, `Ülker Pınar Torku <semt>`.
- Bu şehirde market, fırın veya kasap bulamadıysan, bunu PR'da hangi semtleri aradığınla birlikte yaz.
- OpenStreetMap'i kullanabilirsin. Overpass API'de `cuisine=turkish` ve `shop=*` + `name~"Turk|Türk|Istanbul|Anatolia|Ankara|Izmir"` gibi aramalar işe yarar. Kullanım kurallarına uy (makul istek sayısı, açıklayıcı User-Agent).
- **Overpass sık sık zaman aşımına uğrar.** İsteklere en fazla 30 saniye süre ver, tek bir deneme yap ve cevap gelmezse beklemeden devam et.
- **Nominatim ile tek tek ara.** Web aramasında bulduğun **her adayın adını** Nominatim'de şehirle birlikte ara (ör. `https://nominatim.openstreetmap.org/search?q=Marmara+Melbourne&format=json&addressdetails=1&extratags=1&limit=3`). Ayrıca `Turkish restaurant <şehir>`, `Turkish bakery <şehir>`, `Turkish grocery <şehir>` gibi genel aramalar yap. Saniyede en fazla 1 istek gönder. Sonuç doğru işletmeyse (ad ve semt uyuşuyorsa), OSM kaydı adres, koordinat ve kaynak olarak yeterlidir. Kaynak olarak `https://www.openstreetmap.org/<node|way>/<id>` linkini kullan.
- **Google Maps sayfalarını çekmeye çalışma** (kullanım şartları buna izin vermiyor). Arama sonuçlarında görünen bilgileri ipucu olarak kullanabilirsin, ama kaynak olarak başka bir yer göstermelisin.

### 3. Her adayı doğrula
Bir yeri ancak bunların **hepsi** sağlanıyorsa ekle:
- **Türk bağlantısı açık:** Türk mutfağı sunuyor, Türk işletmesi olduğunu belirtiyor ya da açıkça Türk ürünleri satıyor. Sadece "Orta Doğu" veya "Akdeniz" yazan yerleri, Türk ürünü sattığına dair açık kanıt yoksa ekleme.
- **Hâlâ açık:** "Permanently closed", "kalıcı olarak kapandı" gibi işaretler yok. Son 2 yılda aktif olduğuna dair bir iz tercih edilir (web sitesi, sosyal medya paylaşımı, güncel yorum), ama **bulamazsan eleme**: kapandığına dair hiçbir işaret yoksa ve işletme bir listede ya da sipariş platformunda hâlâ görünüyorsa ekle, notta "⚠️ aktiflik doğrulanamadı" yaz.
- **Adres biliniyor:** Tercihen sokak ve numara düzeyinde. **Kapı numarası bulunamıyorsa yeri eleme.** OSM kaydı (ad, tür ve semt uyuşuyor, Türk bağlantısı ve aktiflik diğer kurallardan geçiyor) varsa numarasız ekle: `address` alanına sokak, semt, eyalet ve posta kodunu yaz, numarayı **uydurma**. Koordinatı OSM düğümünden/binasından al. PR tablosundaki notta "⚠️ KAPI NUMARASI EKSİK" yaz ve PR açıklamasının en üstündeki "Elle kontrol edilecek yerler" listesine ekle. Üçüncü taraf kaynaklar numarayı farklı yazıyorsa (ör. 293 ve 297) yine ekleyebilirsin, ama notta çelişkiyi belirt.
- **Güvenilir bir kaynak var.** Şu üç yoldan biri yeterli:
  - **A) Resmî kaynak:** İşletmenin kendi web sitesi, resmî sosyal medya hesabı ya da OpenStreetMap kaydı.
  - **B) İki bağımsız üçüncü taraf kaynak:** Birbirinden bağımsız **en az iki** sitede (ör. Yelp, TripAdvisor, Zomato, Uber Eats, DoorDash, Menulog, yerel rehberler, haber yazıları) **aynı sokak ve numara** geçiyor, ve bunlardan en az birinde **son 2 yıla ait** bir iz var (yorum, menü, sipariş sayfası). Aynı şirketin siteleri (ör. TripAdvisor ve onun alt siteleri) bağımsız sayılmaz. Adresler çelişiyorsa ekleme.
  - **C) Tek kaynak (gevşetilmiş kural):** A ve B sağlanamıyorsa, **tek** bir üçüncü taraf sayfada (Yelp, TripAdvisor, Uber Eats, DoorDash, Zabihah, yerel rehber vb.) işletmenin adı ve adresi tutarlıysa yine ekle. Bunu PR tablosundaki notta "⚠️ TEK KAYNAK: <site>" diye belirt ve yeri PR'ın en üstündeki "Elle kontrol edilecek yerler" listesine ekle.
  - `source` alanına resmî kaynak varsa onu, yoksa en güncel üçüncü taraf sayfanın linkini yaz. B yoluyla eklediğin yerleri PR tablosundaki notta "2 bağımsız kaynak: <site 1>, <site 2>" diye belirt.

İşletmenin kendi sitesi açılmazsa (403 hatası veya boş sayfa) adayı hemen eleme. OSM kaydı ya da B yolu ile doğrulamayı dene. Türk bağlantısını ve açık olduğunu da bu kaynaklardan doğrula.

**Gevşetmelere rağmen değişmeyen kurallar** (bunlardan biri sağlanmıyorsa yeri ekleme, "Eklenmeyen adaylar" bölümüne nedeniyle yaz):
- Türk bağlantısı açık olmalı: Türk mutfağı/ürünü sunduğu kaynakta yazıyor ya da adında Türk/İstanbul/Anadolu gibi bir ifade geçip Türk yemeği (kebap, pide, gözleme, baklava, simit vb.) sunuyor. Kaynakta "Middle Eastern", "Lebanese", "Greek" gibi tanımlanan ve Türk olduğuna dair kanıt olmayan yerleri ekleme.
- "Kalıcı olarak kapandı" gibi bir işaret olan yeri ekleme.
- Adres, koordinat ve ürünleri asla uydurma ya da tahmin etme. Adres tutarsızsa notta belirt.
- Google Maps sayfalarını çekme.

Bunların dışında emin olmadığın bir yeri eklemek yerine, PR notunda ⚠️ ile işaretleyerek ekleyebilirsin.

### 4. Koordinatları bul
- OpenStreetMap kaydı varsa oradaki koordinatı kullan.
- Yoksa **işletmenin adını değil, sokak adresini** Nominatim (`https://nominatim.openstreetmap.org/search`) ile koordinata çevir. Küçük işletmelerin çoğu OSM'de kayıtlı değildir, ama sokak adresleri neredeyse her zaman kayıtlıdır. Yapılandırılmış arama daha iyi sonuç verir, örneğin: `https://nominatim.openstreetmap.org/search?street=496+King+St&city=Newtown&state=NSW&country=Australia&format=json&limit=1`. Saniyede en fazla 1 istek gönder ve açıklayıcı bir User-Agent kullan.
- Nominatim cevap vermezse yedek olarak Photon'u dene: `https://photon.komoot.io/api/?q=<adres>&limit=1`.
- Sonuç sadece sokağı gösteriyorsa (kapı numarası eşleşmiyorsa) koordinatı yine kullanabilirsin, ama PR notuna "koordinat sokak düzeyinde" yaz. OSM kaydında kapı numarası yoksa bu bir eleme sebebi değildir, kaydın kendi koordinatını kullan.
- **Koordinat hiçbir şekilde bulunamazsa yeri eleme.** Diğer tüm doğrulamaları geçiyorsa kaydı `"lat": null, "lng": null` ile ekle. Koordinatı **asla tahmin etme** ve şehir merkezini yazma. Sahibi bu koordinatları elle dolduracak. PR tablosundaki notta "⚠️ KOORDİNAT EKSİK" yaz, ve PR açıklamasının en üstünde bu yerleri ayrı bir "Koordinatı elle girilecek yerler" listesinde topla (ad ve adres ile).
- Koordinat **binanın kendisini** göstermeli, şehir merkezini değil. Virgülden sonra 5 basamağa yuvarla.

### 5. Ürünleri yaz
- **Sadece kaynakta açıkça geçen ürünleri yaz. Asla tahmin etme.**
- Marketlerde markaları tercih et (ör. "Ülker çikolata", "Pınar peynir", "Beypazarı maden suyu", "Torku", "Eti").
- Restoran, kafe ve fırınlarda menüdeki Türk yemeklerini ve tatlılarını yaz (ör. "Künefe", "Lahmacun", "Simit", "Baklava").
- En fazla 8 ürün. Hiçbir ürün bulamazsan boş liste (`[]`) bırakabilirsin.
- Ürün adlarını Türkçe yaz.

### 6. Kaydı ekle
Her yeri **kendi şehrinin dosyasındaki** listenin sonuna bu formatta ekle (ör. Adelaide için `data/avustralya/adelaide.json`):

```json
{
  "name": "İşletmenin resmî adı",
  "type": "market",
  "city": "Melbourne",
  "country": "Avustralya",
  "address": "Sokak, numara, semt, eyalet, posta kodu",
  "lat": -37.81234,
  "lng": 144.96123,
  "products": ["Ürün 1", "Ürün 2"],
  "source": "https://..."
}
```

- Koordinatı bulunamayan yerde `lat` ve `lng` birlikte `null` olur (biri sayı, diğeri null olamaz). Doğrulama betiği buna izin verir.
- `type`: `market` (market, kasap, şarküteri), `restoran`, `kafe` (kafe, tatlıcı, kahveci) veya `firin` (fırın, pastane, börekçi).
- `country`: Türkçe ülke adı (ör. "Avustralya").
- **Şehrin dosyası henüz yoksa** oluştur (liste biçiminde `[ ... ]`) ve `data/index.json` içinde ülkenin listesine ekle (ülke yoksa ekle). Dosya adları küçük harfli, Türkçe karaktersiz, boşluk yerine `-` olur: `data/avustralya/gold-coast.json`. `index.json`'da listelenmeyen şehir dosyası sitede görünmez ve kontrol hata verir.
- Mevcut kayıtlara ve `data/` dışındaki dosyalara **dokunma**.

### 7. Kontrol et
`node scripts/validate-markets.js` komutunu çalıştır. Hata varsa düzelt ve tekrar çalıştır. ✅ çıkmadan PR açma.

### 8. Pull Request aç
- Yeni bir branch oluştur: `claude/yeni-yerler-YYYY-AA-GG` (bugünün tarihi). Aynı isimde bir branch zaten varsa (`git ls-remote --heads origin`) sonuna `-2`, `-3` ekle. Var olan bir branch'in üzerine yazma.
- Commit mesajı: `<Şehir>: <N> yeni yer eklendi`
- Branch'i push et ve `main` branch'ine bir PR aç.
- **PR açıklaması** (Türkçe):
  - Hangi şehirde arandığı
  - Eklenen her yer için bir tablo satırı: ad, tür, adres, kaynak linki, varsa kısa bir not
  - **Eklenmeyen adaylar:** Bulunan ama emin olunamadığı için eklenmeyen yerler ve nedenleri
- Hiç yeni yer bulamadıysan PR açma. Sadece neden bulamadığını özetle.
