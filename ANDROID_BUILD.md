# NOXIS Android APK Oluşturma Rehberi

Bu rehber, NOXIS uygulamasını Android APK olarak nasıl derleyeceğinizi açıklar.

## Gereksinimler

### Seçenek 1: Capgo Cloud Build (Önerilen - Kurulum Gerektirmez)
Hiçbir yerel kurulum gerektirmez. Tamamen bulutta APK oluşturur.

```bash
# Capgo CLI'yi yükleyin
npm install -g @capgo/cli

# APK oluşturun
capgo cloud-build android
```

### Seçenek 2: Yerel Build (Java JDK Gerektirir)

#### Gerekli Yazılımlar
- Java JDK 17+ 
- Android SDK Command-line Tools
- Node.js 18+

## APK Oluşturma Adımları

### 1. Web Uygulamasını Derleyin
```bash
npm run build
```

### 2. Capacitor'ı Senkronize Edin
```bash
npx cap sync android
```

### 3. Debug APK Oluşturun
```bash
cd android
./gradlew assembleDebug
```

**APK Konumu:** `android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Release APK Oluşturun (Opsiyonel)
```bash
cd android
./gradlew assembleRelease
```

**APK Konumu:** `android/app/build/outputs/apk/release/app-release-unsigned.apk`

## Tek Komutla Build

```bash
# Debug APK
npm run cap:build

# Release APK
npm run cap:build:release
```

## APK'yı Telefona Yükleme

1. APK dosyasını telefonunuza aktarın (USB, Google Drive, vb.)
2. Dosya yöneticisinden APK'yı bulun
3. "Bilinmeyen kaynaklardan yükleme"ye izin verin (ayarlardan)
4. APK'yı yükleyin

## Özellikler

Bu APK'da:
- ✅ CORS sorunu yok (Native HTTP kullanılır)
- ✅ Türkçe kaynak (hdfilmizle) tam çalışır
- ✅ Telefon IP'si kullanılır (engellenmez)
- ✅ Sunucu maliyeti yok
- ✅ Offline çalışabilir (önbellek)

## Sorun Giderme

### Gradle bulunamadı
```bash
chmod +x android/gradlew
```

### Java bulunamadı
Java JDK 17+'yı yükleyin ve JAVA_HOME ortam değişkenini ayarlayın.

### Build başarısız
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

## Alternatif: PWA Olarak Yükleme

APK oluşturmadan da uygulamayı kullanabilirsiniz:

1. Chrome'dan uygulamayı açın
2. Menü > "Ana ekrana ekle"
3. PWA olarak yüklenir

**Not:** PWA'da Türkçe kaynak çalışmaz (CORS engeli).
