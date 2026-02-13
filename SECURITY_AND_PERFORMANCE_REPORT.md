# Güvenlik ve Performans Analizi Raporu

Bu rapor, `wg-mesh-config` projesi üzerinde yapılan inceleme sonucunda tespit edilen güvenlik ve performans sorunlarını içermektedir.

## 🛡️ Güvenlik Sorunları (Security Issues)

### 1. Deterministik PSK Üretimi (Kritik)
- **Dosya:** `lib/psk.ts`
- **Sorun:** WireGuard Pre-Shared Key (PSK) üretimi, sadece node isimlerine ve sabit bir "seed" değerine (`wg-mesh-psk::...`) dayanmaktadır.
- **Risk:** Node isimlerini bilen bir saldırgan, tüm ağın PSK'larını kolayca hesaplayabilir. Bu durum, PSK'nın sağladığı ek güvenlik katmanını (Quantum Resistance) tamamen etkisiz hale getirir.
- **Öneri:** PSK üretimi için kriptografik olarak güvenli rastgele sayı üreteci (CSPRNG) kullanılmalı ve her çift için benzersiz olmalıdır.

### 2. Korumasız API Endpoint (Yüksek)
- **Dosya:** `app/api/generate/route.ts`
- **Sorun:** `/api/generate` endpoint'i üzerinde herhangi bir kimlik doğrulama (Authentication), yetkilendirme (Authorization) veya hız sınırlaması (Rate Limiting) bulunmamaktadır.
- **Risk:** Yetkisiz kişiler API'yi kullanarak sunucuyu yorabilir (DoS) veya ağ konfigürasyonları üretebilir.
- **Öneri:** Endpoint'e authentication eklenmeli ve `express-rate-limit` gibi bir middleware ile istek sayısı sınırlandırılmalıdır.

### 3. Input Validasyon Eksikliği (Orta)
- **Dosya:** `app/api/generate/route.ts`
- **Sorun:** Gelen istek gövdesi (body) doğrudan `GeneratePayload` tipine dönüştürülmektedir. `zod` kütüphanesi projede bulunmasına rağmen, bu endpoint'te runtime validasyonu yapılmamaktadır.
- **Risk:** Hatalı veya kötü niyetli veri (örneğin çok büyük sayılar, eksik alanlar) uygulamanın çökmesine veya beklenmedik davranışlara yol açabilir.
- **Öneri:** `zod` şemaları kullanılarak gelen veri doğrulanmalıdır.

### 4. Docker Güvenlik Yapılandırması (Orta)
- **Dosya:** `Dockerfile`, `docker-compose.yml`
- **Sorunlar:**
    - Container varsayılan olarak `root` kullanıcısı ile çalışmaktadır.
    - `.dockerignore` dosyası eksik olduğu için `node_modules`, `.git` ve `.env` gibi gereksiz/hassas dosyalar image içine kopyalanmaktadır.
    - `network_mode: host` ve `CAP_NET_ADMIN` yetkileri container'a çok geniş erişim sağlamaktadır.
    - `/etc/wireguard` dizini container içine mount edilmiştir.
- **Risk:** Container ele geçirilirse, saldırgan host sistemi üzerinde geniş yetkilere sahip olabilir ve WireGuard anahtarlarına erişebilir.
- **Öneri:** Mümkünse root olmayan bir kullanıcı (örneğin `node`) kullanılmalı ve `.dockerignore` eklenmelidir.

### 5. Şüpheli Bağımlılık Sürümleri (Düşük)
- **Dosya:** `package.json`
- **Sorun:** `zod` sürümü `^4.3.6` ve `tailwindcss` sürümü `^4.x` olarak belirtilmiştir. Standart sürümlerden farklıdır.
- **Risk:** Kararlılık sorunları veya beklenmedik buglar oluşabilir.

---

## 🚀 Performans Sorunları (Performance Issues)

### 1. Senkron Bloklayan İşlemler (Kritik)
- **Dosya:** `app/api/generate/route.ts`, `lib/generate.ts`
- **Sorun:** Anahtar üretimi (`x25519`) ve ZIP sıkıştırma işlemleri, Node.js ana thread'i üzerinde senkron (blocking) olarak çalışmaktadır.
- **Risk:** Bu işlem sırasında sunucu diğer isteklere cevap veremez (Event Loop Blocking). Yoğun kullanımda sunucu kilitlenir.
- **Öneri:** Bu işlemler Worker Thread'lere taşınmalı veya asenkron versiyonları kullanılmalıdır.

### 2. Sınırsız Payload (Yüksek)
- **Dosya:** `app/api/generate/route.ts`
- **Sorun:** API'ye gönderilen node/client sayısında bir üst sınır yoktur.
- **Risk:** Büyük bir payload (örneğin 10.000 node) sunucuda bellek taşmasına (Out-Of-Memory) neden olabilir.
- **Öneri:** Maksimum node/client sayısı sınırlandırılmalıdır.

### 3. Client-Side Render Performansı (Orta)
- **Dosya:** `components/features/TopologyView.tsx`, `NodeTable.tsx`
- **Sorun:**
    - `TopologyView`: SVG ve `framer-motion` animasyonları büyük ağlarda (100+ node) tarayıcıyı yavaşlatacaktır.
    - `NodeTable`: Her klavye girişinde tüm tablo yeniden render edilmektedir. Sanallaştırma (virtualization) yoktur.
- **Risk:** Kullanıcı deneyimi büyük ağlarda ciddi şekilde düşecektir.
- **Öneri:** `react-window` gibi kütüphanelerle sanallaştırma yapılmalı ve `memo` kullanılarak gereksiz renderlar önlenmelidir.

### 4. LocalStorage Senkron Yazma (Düşük)
- **Dosya:** `lib/store.ts`
- **Sorun:** `zustand` persist middleware'i her state değişiminde senkron olarak `localStorage`'a yazmaktadır.
- **Risk:** Büyük veri setlerinde arayüzde takılmalara (jank) neden olabilir.
