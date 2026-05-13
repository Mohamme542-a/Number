# IVASMS Public Telegram Bot (v2)

بوت تلجرام عام يقدم خدمة استقبال رموز التحقق من أرقام **Telegram / WhatsApp / Facebook** عبر سحب الأرقام والرسائل من لوحة IVASMS تلقائياً.

## الميزات
- ✅ بوت عام: أي مستخدم يضغط `/start` ويختار اللغة (عربي / English)
- ✅ قائمة خدمات: Telegram / WhatsApp / Facebook
- ✅ زر "رقم جديد 🔄" لتدوير الأرقام
- ✅ تحديث قائمة الأرقام كل ساعة (قابل للتعديل عبر CRON)
- ✅ إرسال OTP فوراً لكل المستخدمين الذين يحجزون الرقم
- ✅ تخزين كل البيانات في SQLite
- ✅ سكرابينغ Playwright مع جلسة دائمة وإعادة تسجيل دخول تلقائية

## التشغيل السريع (Ubuntu VPS)
```bash
git clone <this-folder>
cd ivasms-public-bot
cp .env.example .env
nano .env   # املأ البيانات
npm install
npm start
```

أو عبر Docker:
```bash
docker compose up -d
```

أو PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

## الاستخدام
1. افتح بوتك في تلجرام واضغط `/start`
2. اختر اللغة
3. اختر الخدمة (Telegram / WhatsApp / Facebook)
4. سيظهر لك رقم — استخدمه في الخدمة المطلوبة
5. اضغط 🔄 لرقم جديد إذا لم يعمل الأول
6. عند وصول OTP لذلك الرقم سيتم إرساله تلقائياً

## كيف يصنّف البوت الأرقام؟
يعتمد على اسم المرسل (Sender / CLI) في IVASMS:
- يحوي `Telegram` → خدمة Telegram
- يحوي `WhatsApp` أو `WA` → WhatsApp
- يحوي `Facebook` أو `FB` → Facebook
- غير ذلك → يصنف ضمن "أخرى" ولا يظهر في القوائم الثلاث

عدّل التصنيف في `utils/classify.js` حسب حسابك.

## التخصيص
- **سلكتورات IVASMS**: `automation/scraper.js` → الدالتان `_login()` و `_scrapeRows()`. أي تغيير في تصميم الموقع يحتاج تحديث هنا فقط.
- **اللغات**: `locales/ar.json` و `locales/en.json`
- **تكرار التحديث**: متغير `NUMBERS_REFRESH_CRON` في `.env`

## ملاحظات
- لا تشارك ملف `.env` مع أحد
- سكرابينغ IVASMS قد يخالف شروطهم — المسؤولية على المالك
- الرمز يمر فوراً لمستخدم البوت عبر التتبع في جدول `reservations`
