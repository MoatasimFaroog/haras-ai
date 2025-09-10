// backend/server.js
'use strict';

const express    = require('express');
const path       = require('path');
const { Client } = require('pg');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const helmet     = require('helmet');          // حماية الرؤوس HTTP:contentReference[oaicite:3]{index=3}
const rateLimit  = require('express-rate-limit'); // وضع حد للطلبات:contentReference[oaicite:4]{index=4}
const cors       = require('cors');
const cookieParser = require('cookie-parser');
const morgan     = require('morgan');
const { z }      = require('zod');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 5000;

// — إعدادات الأمان —
app.disable('x-powered-by'); // تقليل fingerprinting:contentReference[oaicite:5]{index=5}
app.use(helmet());           // تعيين رؤوس أمان إفتراضية:contentReference[oaicite:6]{index=6}
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true }));
app.use(rateLimit({
  windowMs: 15 * 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// — خدمة ملفات ثابتة —
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// — الاتصال بقاعدة البيانات —
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
});
client.connect().then(() => {
  console.log('📦 Connected to PostgreSQL');
  return client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(160) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}).catch((err) => console.error(err));

// — أدوات التشفير —
const PWD_PEPPER        = process.env.PWD_PEPPER || '';
const BCRYPT_ROUNDS     = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'changeme-access';
const JWT_REFRESH_SECRET= process.env.JWT_REFRESH_SECRET || 'changeme-refresh';
const ACCESS_TTL        = process.env.ACCESS_TTL  || '15m';
const REFRESH_TTL       = process.env.REFRESH_TTL || '7d';

// — مصادقة JWT —
function signAccess(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}
function signRefresh(user) {
  return jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}
function setAuthCookies(res, access, refresh) {
  const common = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
  res.cookie('haras_access', access, { ...common, maxAge: 60 * 60 * 1000 });       // ساعة
  res.cookie('haras_refresh', refresh, { ...common, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/auth' }); // أسبوع
}
function clearAuthCookies(res) {
  res.clearCookie('haras_access', { path: '/' });
  res.clearCookie('haras_refresh', { path: '/api/auth' });
}

// — Middleware للتحقق من الجلسة —
async function auth(req, res, next) {
  try {
    const token = req.cookies.haras_access;
    if (!token) return res.status(401).json({ success: false, message: 'الرجاء تسجيل الدخول' });
    const payload = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'الجلسة غير صالحة أو انتهت' });
  }
}

// — التحقق من الإدخال باستخدام Zod —
const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(160),
  password: z.string().min(8).max(100),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// — الصفحات —
app.get('/', (_, res)  => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/pricing', (_, res)  => res.sendFile(path.join(publicDir, 'pricing.html')));

// — تسجيل مستخدم —
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = signupSchema.parse(req.body);
    const normalized = email.trim().toLowerCase();
    const hash = await bcrypt.hash(password + PWD_PEPPER, BCRYPT_ROUNDS);
    const q = await client.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, role, name`,
      [name.trim(), normalized, hash]
    );
    const user   = { id: q.rows[0].id, role: q.rows[0].role, name: q.rows[0].name };
    const access = signAccess(user);
    const refresh= signRefresh(user);
    setAuthCookies(res, access, refresh);
    res.json({ success: true, message: 'تم إنشاء الحساب بنجاح', userId: user.id, role: user.role });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقاً' });
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: err.errors[0].message });
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
  }
});

// — تسجيل الدخول —
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const normalized = email.trim().toLowerCase();
    const q = await client.query(`SELECT id, name, role, password_hash FROM users WHERE email=$1`, [normalized]);
    if (q.rowCount === 0) return res.status(401).json({ success: false, message: 'البريد أو كلمة المرور غير صحيحة' });
    const user = q.rows[0];
    const ok   = await bcrypt.compare(password + PWD_PEPPER, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, message: 'البريد أو كلمة المرور غير صحيحة' });
    const access  = signAccess(user);
    const refresh = signRefresh(user);
    setAuthCookies(res, access, refresh);
    res.json({ success: true, message: `مرحباً ${user.name}`, userId: user.id, role: user.role });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: err.errors[0].message });
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
  }
});

// — تحديث التوكن —
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const rt = req.cookies.haras_refresh;
    if (!rt) return res.status(401).json({ success: false, message: 'لا يوجد توكن تحديث' });
    const payload = jwt.verify(rt, JWT_REFRESH_SECRET);
    const q = await client.query(`SELECT id, name, role FROM users WHERE id=$1`, [payload.sub]);
    if (q.rowCount === 0) return res.status(401).json({ success: false, message: 'المستخدم غير موجود' });
    const user = q.rows[0];
    setAuthCookies(res, signAccess(user), signRefresh(user));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(401).json({ success: false, message: 'فشل تحديث الجلسة' });
  }
});

// — تسجيل الخروج —
app.post('/api/logout', (_, res) => {
  clearAuthCookies(res);
  res.json({ success: true, message: 'تم تسجيل الخروج' });
});

// — ملف شخصي (يتطلب تسجيل دخول) —
app.get('/api/me', auth, async (req, res) => {
  const q = await client.query(`SELECT id,name,email,role,created_at FROM users WHERE id=$1`, [req.user.id]);
  res.json({ success: true, user: q.rows[0] });
});

// — نقطة الحالة (health check) —
app.get('/api/status', async (_, res) => {
  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS users FROM users');
    res.json({ status: 'operational', usersCount: rows[0].users, service: 'Haras AI' });
  } catch (err) {
    res.json({ status: 'degraded', message: 'تعذر الاتصال بقاعدة البيانات' });
  }
});

// — معالج 404 —
app.use((req, res) => {
  res.status(404).send(`
    <div style="text-align:center;margin-top:100px;color:#fff;font-family:'Tajawal',sans-serif;">
      <h1>🛑 الصفحة غير موجودة</h1>
      <p><a href="/login" style="color:#4d90fe;">العودة إلى الصفحة الرئيسية</a></p>
    </div>
  `);
});

// — معالج أخطاء عام —
app.use((err, req, res, next) => {
  console.error('GlobalError:', err);
  res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
});

// — تشغيل الخادم —
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️ Haras web on port ${PORT}`);
});
