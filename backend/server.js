const express = require('express');
const path = require('path');
const app = express();

// تحديد مجلد الملفات الثابتة (public)
app.use(express.static(path.join(__dirname, '../public')));

// تفعيل معالجة JSON
app.use(express.json());

// --- توجيه الصفحات ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'pricing.html'));
});

app.get('/pricing.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'pricing.html'));
});

// --- API ---
app.get('/api/status', (req, res) => {
  res.json({ 
    success: true, 
    service: 'Haras AI', 
    version: '1.0.0',
    message: 'النظام يعمل بنجاح 🛡️'
  });
});

// --- معالجة الأخطاء (404) ---
app.get('*', (req, res) => {
  res.status(404).send(`
    <h1 style="text-align: center; margin-top: 50px; color: #fff; font-family: 'Tajawal', sans-serif;">
      🛑 الصفحة غير موجودة
    </h1>
    <p style="text-align: center; color: #ccc; font-family: 'Tajawal', sans-serif;">
      تحقق من الرابط أو عد إلى <a href="/login" style="color: #4d90fe;">الصفحة الرئيسية</a>
    </p>
  `);
});

// --- تشغيل الخادم ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️  حارس يعمل على المنفذ ${PORT}`);
  console.log(`🌐 الجذر: ${__dirname}`);
  console.log(`📄 الملفات العامة من: ${path.join(__dirname, '../public')}`);
});
