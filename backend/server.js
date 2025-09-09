const express = require('express');
const path = require('path');
const { Client } = require('pg');

const app = express();

// تفعيل معالجة JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, '../public')));

// --- اتصال بقاعدة البيانات ---
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // مطلوب لـ Render
  }
});

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('✅ اتصال ناجح بقاعدة البيانات');

    // إنشاء جدول المستخدمين (مرة واحدة)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ جدول users جاهز');
  } catch (err) {
    console.error('❌ خطأ في قاعدة البيانات:', err.message);
  }
}

// استدعاء الدالة عند التشغيل
connectToDatabase();

// --- توجيه الصفحات ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'signup.html'));
});

app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'pricing.html'));
});

app.get('/pricing.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'pricing.html'));
});

// --- API: تسجيل مستخدم جديد ---
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const result = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [name, email, password] // في الإصدار الحقيقي: استخدم bcrypt لتشفير كلمة المرور
    );
    res.json({ 
      success: true, 
      message: 'تم إنشاء الحساب بنجاح', 
      userId: result.rows[0].id 
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقًا' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
  }
});

// --- API: تسجيل الدخول ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'البريد أو كلمة المرور غير صحيحة' });
    }
    // في الإصدار الحقيقي: تحقق من كلمة المرور باستخدام bcrypt
    res.json({ 
      success: true, 
      message: `مرحبًا ${result.rows[0].name}`, 
      userId: result.rows[0].id 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
  }
});

// --- API: حالة النظام ---
app.get('/api/status', async (req, res) => {
  try {
    const result = await client.query('SELECT COUNT(*) FROM users');
    res.json({ 
      status: 'operational', 
      usersCount: parseInt(result.rows[0].count),
      service: 'Haras AI'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// --- صفحة غير موجودة ---
app.get('*', (req, res) => {
  res.status(404).send(`
    <div style="text-align: center; margin-top: 100px; color: #fff; font-family: 'Tajawal', sans-serif;">
      <h1>🛑 الصفحة غير موجودة</h1>
      <p><a href="/login" style="color: #4d90fe;">العودة إلى الصفحة الرئيسية</a></p>
    </div>
  `);
});

// --- تشغيل الخادم ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️  حارس يعمل على المنفذ ${PORT}`);
});
