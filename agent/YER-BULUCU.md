# Yer Bulucu Agent Talimatları

Bu dosya, haftalık çalışan Claude agent'ının talimatlarıdır. Agent'ın davranışını değiştirmek için bu dosyayı düzenle.

## Görev

Yurt dışında Türk ürünleri satan **marketleri**, Türk **restoranlarını**, **kafelerini** ve **fırınlarını** bul, doğrula, `data/markets.json` dosyasına ekle ve bir Pull Request aç.

**Bu çalışmada en fazla 10 yer ekle.** Daha azı tamamen kabul edilebilir. Az ama doğru veri, çok ama hatalı veriden iyidir.

## Bölge

Şu an sadece **Avustralya**. Bu listeden `data/markets.json` içinde **en az kaydı olan** şehri seç (eşitlikte listede önce geleni). O şehirde 10 yer bulamazsan, listedeki bir sonraki şehre geçebilirsin.

1. Melbourne
2. Sydney
3. Adelaide
4. Brisbane
5. Perth
6. Canberra
7. Gold Coast
8. Hobart
9. Darwin

## Öncelikli adaylar (geçici, PR'dan sonra silinecek)

Proje sahibi bu çalışma için şu yerleri özellikle istedi. **Adelaide** için ara ve önce bunları dene: **Umay**, **Ottoman Grill**, **Hatun**, **Yiros Central**.

- Bunlar sadece **aday**. Adres, tür, Türk bağlantısı ve açık olup olmadığını aşağıdaki kurallarla **sen doğrula**; kuralları gevşetme. İsimler Adelaide'de başka işletmelerle karışabilir, doğru olanı bul (ad ve semt uyuşmalı).
- Doğrulanamayanı ekleme, PR'daki "Eklenmeyen adaylar" bölümüne nedeniyle yaz.
- Bunlar 10 yer sınırına dahildir. Kalan hakla Adelaide'de başka yer de arayabilirsin.

## Adımlar

### 1. Mevcut durumu öğren
- `data/markets.json` dosyasını oku. Zaten var olan yerleri tekrar ekleme.
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
- **Hâlâ açık:** "Permanently closed", "kalıcı olarak kapandı" gibi işaretler yok. Son 2 yılda aktif olduğuna dair bir iz var (web sitesi, sosyal medya paylaşımı, güncel yorum).
- **Tam adres biliniyor:** Sokak ve numara düzeyinde.
- **Güvenilir bir kaynak var.** Şu iki yoldan biri yeterli:
  - **A) Resmî kaynak:** İşletmenin kendi web sitesi, resmî sosyal medya hesabı ya da OpenStreetMap kaydı.
  - **B) İki bağımsız üçüncü taraf kaynak:** Birbirinden bağımsız **en az iki** sitede (ör. Yelp, TripAdvisor, Zomato, Uber Eats, DoorDash, Menulog, yerel rehberler, haber yazıları) **aynı sokak ve numara** geçiyor, ve bunlardan en az birinde **son 2 yıla ait** bir iz var (yorum, menü, sipariş sayfası). Aynı şirketin siteleri (ör. TripAdvisor ve onun alt siteleri) bağımsız sayılmaz. Adresler çelişiyorsa ekleme.
  - `source` alanına resmî kaynak varsa onu, yoksa en güncel üçüncü taraf sayfanın linkini yaz. B yoluyla eklediğin yerleri PR tablosundaki notta "2 bağımsız kaynak: <site 1>, <site 2>" diye belirt.

İşletmenin kendi sitesi açılmazsa (403 hatası veya boş sayfa) adayı hemen eleme. OSM kaydı ya da B yolu ile doğrulamayı dene. Türk bağlantısını ve açık olduğunu da bu kaynaklardan doğrula.

Emin olmadığın bir yeri **ekleme**. Bunun yerine PR açıklamasındaki "Eklenmeyen adaylar" bölümüne kısa bir notla yaz.

### 4. Koordinatları bul
- OpenStreetMap kaydı varsa oradaki koordinatı kullan.
- Yoksa **işletmenin adını değil, sokak adresini** Nominatim (`https://nominatim.openstreetmap.org/search`) ile koordinata çevir. Küçük işletmelerin çoğu OSM'de kayıtlı değildir, ama sokak adresleri neredeyse her zaman kayıtlıdır. Yapılandırılmış arama daha iyi sonuç verir, örneğin: `https://nominatim.openstreetmap.org/search?street=496+King+St&city=Newtown&state=NSW&country=Australia&format=json&limit=1`. Saniyede en fazla 1 istek gönder ve açıklayıcı bir User-Agent kullan.
- Nominatim cevap vermezse yedek olarak Photon'u dene: `https://photon.komoot.io/api/?q=<adres>&limit=1`.
- Sonuç sadece sokağı gösteriyorsa (kapı numarası eşleşmiyorsa) koordinatı yine kullanabilirsin, ama PR notuna "koordinat sokak düzeyinde" yaz.
- **Koordinat hiçbir şekilde bulunamazsa yeri eleme.** Diğer tüm doğrulamaları geçiyorsa kaydı `"lat": null, "lng": null` ile ekle. Koordinatı **asla tahmin etme** ve şehir merkezini yazma. Sahibi bu koordinatları elle dolduracak. PR tablosundaki notta "⚠️ KOORDİNAT EKSİK" yaz, ve PR açıklamasının en üstünde bu yerleri ayrı bir "Koordinatı elle girilecek yerler" listesinde topla (ad ve adres ile).
- Koordinat **binanın kendisini** göstermeli, şehir merkezini değil. Virgülden sonra 5 basamağa yuvarla.

### 5. Ürünleri yaz
- **Sadece kaynakta açıkça geçen ürünleri yaz. Asla tahmin etme.**
- Marketlerde markaları tercih et (ör. "Ülker çikolata", "Pınar peynir", "Beypazarı maden suyu", "Torku", "Eti").
- Restoran, kafe ve fırınlarda menüdeki Türk yemeklerini ve tatlılarını yaz (ör. "Künefe", "Lahmacun", "Simit", "Baklava").
- En fazla 8 ürün. Hiçbir ürün bulamazsan boş liste (`[]`) bırakabilirsin.
- Ürün adlarını Türkçe yaz.

### 6. Kaydı ekle
Her yeri `data/markets.json` listesinin sonuna bu formatta ekle:

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
- Mevcut kayıtlara ve diğer dosyalara **dokunma**.

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
