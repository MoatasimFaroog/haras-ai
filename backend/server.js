const express = require('express');
const path = require('path');
const app = express();

// تحديد مجلد الملفات الثابتة (public)
app.use(express.static(path.join(__dirname, '../public')));

// تفعيل معالجة JSON للطلبات
app.use(express.json());

// --- توجيه الصفحات ---

// الصفحة الرئيسية → توجّه إلى تسجيل الدخول
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

// صفحة تسجيل الدخول
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

// صفحة إنشاء الحساب (signup)
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'signup.html'));
});

// صفحة خطط الاشتراك
app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'pricing.html'));
});

app.get('/pricing.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'pricing.html'));
});

// --- API بسيطة ---
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
    <div style="text-align: center; margin-top: 100px; color: #fff; font-family: 'Tajawal', sans-serif;">
      <h1>🛑 الصفحة غير موجودة</h1>
      <p>المسار <code>${req.path}</code> غير متوفر.</p>
      <p><a href="/login" style="color: #4d90fe;">العودة إلى الصفحة الرئيسية</a></p>
    </div>
  `);
});

// --- تشغيل الخادم ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️  حارس يعمل على المنفذ ${PORT}`);
  console.log(`📄 الملفات العامة من: ${path.join(__dirname, '../public')}`);
  console.log(`🌐 الجذر: ${__dirname}`);
});
