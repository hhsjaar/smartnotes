# SmartNotes Assistant: Android Voice Assistant Wrapper

Project Android ini berfungsi sebagai pembungkus native (*wrapper*) menggunakan **Kotlin** dan **WebView** agar aplikasi web Catatan Pintar dapat didaftarkan langsung sebagai **Default Device Assistant** di sistem operasi Android.

Hal ini memampukan pemanggilan Asisten Suara langsung menggunakan tombol fisik perangkat HP (seperti menahan tombol Home, menahan tombol Power, atau melakukan gestur usap sudut bawah layar) layaknya Google Assistant dan Siri.

---

## Persyaratan
1. **Android Studio** (Koala atau versi lebih baru) terinstal di komputer Anda.
2. Handphone Android dengan versi Android 8.0 (API 26) ke atas.
3. Kabel USB data untuk debugging/instalasi aplikasi dari komputer ke HP.

---

## Langkah-Langkah Integrasi & Instalasi

### 1. Ubah URL Target Aplikasi Anda
Secara default, aplikasi akan mengarah ke deployment Vercel. Jika Anda ingin mengujinya menggunakan IP komputer lokal Anda (misal `http://192.168.1.10:3000`), silakan ubah konstanta `BASE_URL` di dalam file:
👉 [AssistantActivity.kt](src/main/java/com/smartnotes/assistant/AssistantActivity.kt)

```kotlin
companion object {
    // Ubah URL ini sesuai alamat IP local komputer Anda atau domain web production Anda
    private const val BASE_URL = "https://smart-voice-notes.vercel.app"
}
```

### 2. Buka Project di Android Studio
1. Buka aplikasi **Android Studio**.
2. Pilih **Open** atau **Import Project**.
3. Arahkan ke folder `android-assistant/` yang ada di dalam repository ini, lalu klik **OK**.
4. Tunggu beberapa saat hingga Android Studio selesai melakukan sinkronisasi Gradle (*Gradle Sync*).

### 3. Kompilasi dan Instal di Handphone Anda
1. Hubungkan handphone Android Anda ke komputer via kabel USB.
2. Pastikan opsi **Developer Options** (Pilihan Pengembang) dan **USB Debugging** (Mendebug USB) telah aktif di handphone Anda.
3. Pilih perangkat HP Anda di bar atas Android Studio, lalu klik tombol **Run** (ikon Play segitiga hijau) untuk melakukan instalasi langsung.
4. Atau, jika ingin membuat file mentah APK:
   * Pilih menu **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   * Setelah selesai, klik **Locate** untuk mengambil file `app-debug.apk`, lalu kirim dan instal file tersebut secara manual di handphone Anda.

---

## Cara Aktivasi sebagai Asisten Utama HP (Siri/Google Assistant Replacement)

Setelah aplikasi **SmartNotes Assistant** sukses terinstal di handphone Anda, ikuti langkah berikut untuk mengaktifkannya pada tombol fisik:

1. Buka menu **Pengaturan (Settings)** di handphone Anda.
2. Cari menu **Aplikasi Default** (biasanya berada di bawah sub-menu *Aplikasi* atau *Aplikasi & Notifikasi*).
3. Cari opsi **Aplikasi Asisten Digital** (atau *Aplikasi Asisten & Input Suara*).
4. Klik pada pilihan asisten default (yang saat ini biasanya diisi oleh *Google*), lalu ubah dengan memilih **SmartNotes Assistant**.
5. Konfirmasi persetujuan izin akses asisten yang muncul di layar.

---

## Cara Menggunakan
* **Trigger Fisik**: Tahan tombol **Home** Anda (atau tahan tombol **Power** jika HP Anda dikonfigurasi untuk memicu asisten lewat tombol Power, atau usap dari sudut kiri/kanan bawah layar ke arah tengah jika menggunakan navigasi gestur).
* Aplikasi **SmartNotes Assistant** akan langsung terbuka dalam mode fullscreen dan secara otomatis mengaktifkan microphone asisten suara untuk mendengarkan perintah Anda!
* **Izin Akses**: Pastikan Anda menyetujui izin akses **Mikrofon** dan **Lokasi (GPS)** saat aplikasi meminta persetujuan pertama kali, agar deteksi suara dan verifikasi absen 100m toko dapat berjalan dengan lancar.
