# NOXIS

Apple TV+ benzeri modern bir film ve dizi izleme uygulaması (Türkçe).

## Proje Yapısı

```
├── src/
│   ├── components/
│   │   ├── HomeWidgets.jsx    # Hero carousel ve satır bileşenleri
│   │   ├── IntroAnimation.jsx # Sinematik açılış animasyonu (The Genesis Sequence)
│   │   ├── Modals.jsx         # Detay modal ve video oynatıcı
│   │   └── Shared.jsx         # Ortak bileşenler (NavBar, MobileNav, Card, SmartImage)
│   ├── hooks/
│   │   └── useAppLogic.js     # TV navigasyon, API ve depolama hook'ları
│   ├── assets/                # Statik görsel dosyaları
│   ├── App.jsx                # Ana uygulama bileşeni
│   ├── main.jsx               # React giriş noktası
│   └── index.css              # Responsive CSS stilleri
├── public/
│   ├── icons/                 # PWA ikonları (72x72 - 512x512)
│   ├── manifest.json          # PWA manifest dosyası
│   ├── sw.js                  # Service Worker
│   └── favicon.ico            # Site ikonu
├── index.html                 # HTML şablonu (PWA meta tag'leri)
├── vite.config.js             # Vite yapılandırması
└── package.json               # Proje bağımlılıkları
```

## Özellikler

### Temel Özellikler
- Apple TV+ esintili Liquid Glass/Frosted Glass tasarım
- TMDB API entegrasyonu (film ve dizi verileri)
- TV uzaktan kumanda ve gamepad desteği
- Akıllı fare kontrolü (otomatik gizleme)
- İzleme geçmişi ve devam etme özelliği
- Çoklu video kaynağı desteği
- Duyarlı animasyonlar (Framer Motion)
- Türkçe arayüz

### Responsive Tasarım
- **Mobil (≤768px)**: Alt navigasyon barı, optimize edilmiş kartlar, touch-friendly UI
- **Tablet (769-1024px)**: Orta boyut kartlar, üst navigasyon
- **Masaüstü (1025-1600px)**: Tam boyut UI, üst navigasyon
- **TV (>1600px)**: vw-based font boyutları, TV optimizasyonu

### PWA (Progressive Web App)
- Cihaza yüklenebilir uygulama
- Offline önbellek desteği
- iOS ve Android ana ekran ikonu
- Standalone uygulama modu
- Service Worker ile dinamik önbellekleme

## Teknolojiler

- React 18
- Vite 5
- Framer Motion
- Font Awesome
- TMDB API
- PWA (Service Worker, Web App Manifest)

## Kullanım

1. Uygulamayı başlatın
2. TMDB API anahtarınızı girin (themoviedb.org'dan alınabilir)
3. Film ve dizi içeriklerini keşfedin
4. Mobilde: Alt navigasyon çubuğunu kullanın
5. PWA: Tarayıcıdan "Ana Ekrana Ekle" ile yükleyin

## Tasarım

### Responsive Breakpoints
- Mobil: max-width 768px (16px base font)
- Tablet: 769-1024px (14px base font)
- Masaüstü: 1025-1600px (15px base font)
- TV: 1601px+ (0.85vw base font)

### Bileşenler
- Navbar: Masaüstünde üstte, mobilde gizli
- MobileNav: Mobilde altta, masaüstünde gizli
- Kartlar: Responsive genişlik (140px mobil → 14rem TV)
- Hero: 50vh mobil → 70vh TV

### Renk Paleti
- Arka plan: #000000
- Metin: #f5f5f7
- Vurgu: #0a84ff (mavi), #30d158 (yeşil)
- Glass: rgba(255, 255, 255, 0.08-0.15)

## Son Değişiklikler (1 Aralık 2025)

### TV Uzaktan Kumanda ve Klavye Kontrolleri
- TV uzaktan kumanda tuş desteği geliştirildi:
  - Ok tuşları (keyCode 37-40) ile navigasyon
  - Geri tuşu desteği genişletildi (Samsung: 10009, LG: 461, XF86Back, BrowserBack)
  - Enter/Select tuşları (keyCode 13, 195)
  - Input alanlarında çalışırken tuş çakışması önlendi
- Klavye ok tuşları ile tam navigasyon desteği
- Space tuşu ile seçim (input alanları hariç)

### HDFilmizle Scraper İyileştirmeleri
- Vidrame iframe algılama kapsamlı şekilde geliştirildi
- Desteklenen video kaynakları: vidrame, vidframe, rapid, vidmoly, closeload, fastload, hdplayer, videoseyred, supervideo, vidsrc, streamtape, mixdrop
- Çoklu regex pattern desteği ile daha güvenilir iframe bulma
- Script tag'leri içinde gömülü URL algılama
- data-src, data-player, data-video attribute desteği
- Lazy-load iframe desteği

## Önceki Değişiklikler (30 Kasım 2025)

### NOXIS Sinematik İntro Animasyonu (The Genesis Sequence)
- Yeni sinematik açılış sekansı eklendi (~12 saniye)
- 4 aşamalı animasyon:
  - Aşama 1 (0-2s): Karanlık ekranda leylak rengi neon kıvılcım
  - Aşama 2 (2-5s): Glassmorphism geometrik şekiller DNA gibi birleşiyor
  - Aşama 3 (5-10s): N-O-X-I-S harfleri tek tek impact efektiyle beliriyor
    - Her harfin altında anlık olarak beliren İngilizce kelimeler (New, Ocular, eXperience, Is, Starting)
  - Aşama 4 (10-12s): Final logo gösterimi parlak hale efekti ile
- Leylak/mor renk teması (Lilac, Violet, Purple)
- Framer Motion ile akıcı animasyonlar
- Atla butonu ile intro'yu geçebilme
- sessionStorage ile intro sadece ilk ziyarette gösterilir
- Yeni bileşen: src/components/IntroAnimation.jsx
- Yeni CSS animasyonları: pulse-glow, float-up, shimmer

## Önceki Değişiklikler (28 Kasım 2025)

### NOXIS Rebrand ve MultiEmbed Kaynağı
- Tüm StreamHub referansları NOXIS olarak güncellendi
- package.json, manifest.json ve sw.js dosyaları güncellendi
- Yeni NOXIS logosu ile PWA ikonları oluşturuldu (72x72 - 512x512)
- Service Worker cache isimleri noxis- prefix'i ile güncellendi
- MultiEmbed video kaynağı eklendi (varsayılan kaynak olarak ayarlandı)
- Video kaynakları: MultiEmbed, VidSrc CC, VSrc SU, VidSrc Me, VidSrc Embed

### Filtreleme Sistemi
- Keşfet sayfasına kapsamlı filtreleme sistemi eklendi
- İçerik türü filtresi (Tümü, Film, Dizi)
- Tür (Genre) filtresi - TMDB'den dinamik olarak çekiliyor
- Minimum IMDB puanı filtresi (6, 7, 8, 9 ve üzeri)
- Yıl aralığı filtresi
- Sıralama seçenekleri (popülerlik, puan, tarih - artan/azalan)
- Liquid glass tasarımıyla uyumlu filtre UI

### Benzer İçerikler
- Benzer içerikler bölümü düzeltildi - TMDB API'den gerçek benzer içerikler
- Tıklandığında detay sayfası açılıyor (otomatik oynatma yerine)
- media_type düzgün şekilde aktarılıyor

### Önceki Güncellemeler (28 Kasım 2025)
- Çıkış butonu liquid glass efekti ile yeniden tasarlandı
- Mobil navigasyon barına çıkış butonu eklendi
- Mobil navbar liquid glass efekti ile güncellendi (masaüstü ile uyumlu)
- Aktif sekme için glassmorphism stil efektleri eklendi

## Önceki Değişiklikler (27 Kasım 2025)

- Responsive CSS eklendi (mobil, tablet, PC, TV desteği)
- Mobil için alt navigasyon barı eklendi
- PWA desteği eklendi (manifest.json, Service Worker)
- PWA ikonları oluşturuldu (72x72 - 512x512)
- index.html PWA meta tag'leri ile güncellendi
- Tüm bileşenler mobil uyumlu hale getirildi
- CSS medya sorguları ile cihaz bazlı stil optimizasyonu
