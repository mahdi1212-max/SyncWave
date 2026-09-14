<div align="center">

# 🎵 SyncWave

**موزیک پلیر لوکال با پخش هم‌زمان بین چند نفر**

هر کی هر جا هست، همه با هم همون آهنگ رو همون لحظه می‌شنون.

[![Bun](https://img.shields.io/badge/Bun-1.x-000?style=flat-square&logo=bun)](https://bun.sh)
[![WebSocket](https://img.shields.io/badge/WebSocket-realtime-7c5cff?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![License](https://img.shields.io/badge/license-MIT-22d3ee?style=flat-square)](#license)

</div>

---

## ✨ ویژگی‌ها

| | |
|---|---|
| 🎧 **سینک زنده** | پخش، توقف و Seek بین همه‌ی کلاینت‌ها همگام می‌شه |
| 👥 **حضور آنی** | می‌بینی کی آنلاینه، چی گوش می‌ده، دقیقه‌ی چندم |
| 🎯 **حالت Follow** | روی اسم رضا بزن، از همون ثانیه‌ای که رضاست ادامه بده |
| 💾 **کش آفلاین** | بار دوم آهنگ از حافظه پخش می‌شه، حتی بدون اینترنت |
| 📱 **UI موبایل** | مینی‌پلیر چسبیده به پایین با سوایپ و ویبره |
| 🎨 **ویژوالایزر** | نمایش موج صدا روی Canvas |
| ⚡ **Bun + WebSocket** | سرور سبک و سریع |
| 🗂 **آپلود از مرورگر** | Drag & drop کن، می‌ره روی سرور |

---

## 🚀 نصب و اجرا

### پیش‌نیاز

- [Bun](https://bun.sh) نسخه ۱.۳.۵ یا بالاتر

```bash
curl -fsSL https://bun.sh/install | bash
```

### کلون و اجرا

```bash
git clone https://github.com/mahdi1212-max/SyncWave.git
cd SyncWave

# پوشه موزیک رو بساز
mkdir -p music

# سرور رو بالا بیار
bun run server.ts
```

بعد برو:

```
http://localhost:3990
```

### دسترسی از دستگاه‌های دیگه

```bash
# IP سرورت رو پیدا کن
ipconfig        # ویندوز
ip addr         # لینوکس
ifconfig        # مک
```

بعد از دستگاه دیگه (موبایل، لپ‌تاپ) روی همون Wi-Fi:

```
http://<your-ip>:3990
```

**نکته:** روی ویندوز باید پورت `3990` رو توی Firewall باز کنی:

```powershell
New-NetFirewallRule -DisplayName "SyncWave" -Direction Inbound -Protocol TCP -LocalPort 3990 -Action Allow
```

---

## 🎮 طریقه استفاده

1. **بار اول** اسمت رو وارد کن → توی `localStorage` ذخیره می‌شه
2. **آهنگ آپلود کن** — فایل‌های mp3 رو بکش روی صفحه، یا دکمه «آپلود» رو بزن
3. **پخش کن** — روی آهنگ توی لیست کلیک کن
4. **با رفقا سینک شو:**
   - توی مرورگر دوستت، سایت رو باز کنه
   - بالای لیست پخش، چیپ اسم‌ها ظاهر می‌شه
   - روی چیپ هر کی بزنی → همون لحظه دقیقاً همون آهنگ رو می‌شنوی
   - تا وقتی follow هستی، **خودکار سینک می‌مونی**

---

## ⌨️ کلیدهای میانبر

| کلید | کار |
|---|---|
| `Space` | پخش / توقف |
| `←` / `→` | ۵ ثانیه عقب / جلو |
| `↑` / `↓` | کم / زیاد کردن صدا |
| `N` | آهنگ بعدی |
| `P` | آهنگ قبلی |
| `Esc` | بستن پلیر تمام‌صفحه (موبایل) |

---

## 🏗️ معماری

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│  Browser (A)    │◄──────────────────►│                 │
│  رضا             │                    │                 │
└─────────────────┘                    │   Bun Server    │
                                       │   (server.ts)   │
┌─────────────────┐     WebSocket      │                 │
│  Browser (B)    │◄──────────────────►│  پورت ۳۹۹۰      │
│  سارا            │                    │                 │
└─────────────────┘                    └────────┬────────┘
                                                │
                                       ┌────────▼────────┐
                                       │   music/        │
                                       │   *.mp3         │
                                       └─────────────────┘
```

**جریان سینک:**

1. هر کلاینت هر ۲.۵ ثانیه وضعیت خودش (`track`, `time`, `playing`) رو با `presence` می‌فرسته
2. سرور timestamp سرور (`ts`) رو بهش می‌چسبونه و بلافاصله برای همه broadcast می‌کنه
3. وقتی کسی follow می‌کنه، از فرمول زیر استفاده می‌شه:
   ```
   targetTime = user.time + (Date.now() - user.ts) / 1000
   ```
   یعنی latency شبکه جبران می‌شه و دقیقاً همون لحظه پلی می‌شه

---

## 📁 ساختار پروژه

```
SyncWave/
├── server.ts          # سرور Bun + WebSocket
├── sw.js              # Service Worker (کش آفلاین)
├── index.html         # UI کامل کلاینت
├── README.md
├── .gitignore
└── music/             # فایل‌های صوتی (git ignore شده)
    └── *.mp3
```

---

## 🔌 API

| متد | مسیر | توضیح |
|---|---|---|
| `GET` | `/` | صفحه اصلی |
| `GET` | `/api/tracks` | لیست آهنگ‌ها |
| `POST` | `/api/upload` | آپلود فایل (multipart) |
| `DELETE` | `/api/track?name=X` | حذف آهنگ |
| `GET` | `/stream/<name>` | استریم با پشتیبانی Range |
| `WS` | `/ws` | اتصال WebSocket |

**پیام‌های WebSocket:**

```ts
// از کلاینت به سرور
{ type: "hello",    name: "رضا" }
{ type: "presence", track: "song.mp3", time: 123.4, playing: true }
{ type: "tracks_changed" }

// از سرور به کلاینت
{ type: "presence_list", users: [...] }
{ type: "tracks_changed" }
```

---

## 🐛 عیب‌یابی

### Bun روی CPUهای قدیمی کرش می‌کنه (`Illegal instruction`)

اگه خطای `CPU lacks AVX support` گرفتی، نسخه ۱.۳.۵ نصب کن:

```bash
rm -rf ~/.bun
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.5"
```

اگه بازم کرش کرد، برگرد به ۱.۲.۰:

```bash
rm -rf ~/.bun
curl -fsSL https://bun.sh/install | bash -s "bun-v1.2.0"
```

### از دستگاه دیگه وصل نمی‌شه

1. سرور باید روی `0.0.0.0` گوش بده (توی کد `hostname: "0.0.0.0"` هست)
2. فایروال پورت `3990` رو باز کن
3. هر دو دستگاه روی یه شبکه باشن
4. IP رو با `ipconfig` / `ip addr` چک کن

### آهنگ کش نمی‌شه

- Service Worker فقط روی `localhost` یا `https` کار می‌کنه
- اگه روی IP لوکال (`http://192.168.x.x`) هستی، SW کار نمی‌کنه
- برای HTTPS محلی، از [mkcert](https://github.com/FiloSottile/mkcert) یا [Caddy](https://caddyserver.com) استفاده کن

---

## 🗺️ نقشه راه

- [ ] نمایش کاور آلبوم از ID3 tags
- [ ] لیست پخش مشترک (Playlist همگام)
- [ ] چت کنار پلیر
- [ ] لیریک هم‌زمان
- [ ] پارتی مود (اجبار سینک برای همه)
- [ ] PWA نصب‌شدنی
- [ ] احراز هویت با رمز اتاق

---

## 🤝 مشارکت

پول ریکوئست‌ها خوش‌آمدن. برای تغییرات بزرگ، اول یه issue باز کن تا درباره‌ش حرف بزنیم.

---

## 📄 لایسنس

MIT — هر کاری خواستی باهاش بکن.

---

<div align="center">

ساخته شده با ❤️ و [Bun](https://bun.sh)

</div>
