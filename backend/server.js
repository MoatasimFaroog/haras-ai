const express = require('express');
const path = require('path');
const app = express();

// تفعيل الملفات الثابتة من مجلد public
app.use(express.static('public'));

// توجيه الجذر إلى صفحة الدخول
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// توجيه /pricing إلى صفحة الأسعار
app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
});

// توجيه /pricing.html إلى نفس الصفحة (للتوافق)
app.get('/pricing.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
});

// API بسيطة
app.get('/api/status', (req, res) => {
  res.json({ 
    success: true, 
    service: 'Haras AI', 
    version: '1.0.0',
    message: 'النظام يعمل بنجاح 🛡️'
  });
});

// معالجة جميع المسارات غير المعروفة
app.get('*', (req, res) => {
  res.status(404).send('صفحة غير موجودة');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️  حارس يعمل على المنفذ ${PORT}`);
});
