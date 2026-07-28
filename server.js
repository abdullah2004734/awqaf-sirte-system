const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const SECRET_KEY = "Awqaf_Sirte_Secret_Key_2026";

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));
app.use(express.json({ limit: '50mb' }));

const PUBLIC_DIR = __dirname;
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');
app.use(express.static(PUBLIC_DIR));

// الاتصال بـ MongoDB السحابية
const MONGO_URI = "mongodb+srv://abdo2004102030_db_user:w4jkUGMTPnIa1hT7@cluster0.y7usojc.mongodb.net/awqaf_db?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI).then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح')).catch(err => console.error('❌ خطأ في الاتصال:', err));

// هيكل البيانات الجديد
const DataSchema = new mongoose.Schema({
    docId: { type: String, default: "main_db" },
    centers: { type: Array, default: [] },
    teachers: { type: Array, default: [] },
    students: { type: Array, default: [] },
    messages: { type: Array, default: [] },
    assistants: { type: Array, default: [] }
});
const AppData = mongoose.model('AppData', DataSchema);

const initDB = async () => {
    try {
        const doc = await AppData.findOne({ docId: "main_db" });
        if (!doc) await AppData.create({ docId: "main_db", centers: [], teachers: [], students: [], messages: [], assistants: [] });
    } catch (err) {}
};
initDB();

app.get('/', (req, res) => {
    const fs = require('fs');
    if (fs.existsSync(INDEX_FILE)) res.sendFile(INDEX_FILE);
    else res.status(404).send(`<h1>❌ ملف index.html مفقود</h1>`);
});

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (username === 'admin' && password === 'admin') {
            return res.json({ success: true, token: jwt.sign({ username, role: 'admin' }, SECRET_KEY, { expiresIn: '72h' }), role: 'admin' });
        }
        
        const db = await AppData.findOne({ docId: "main_db" }).lean();
        if(db) {
            // دخول المساعدين
            const assistant = (db.assistants || []).find(a => a.username === username && a.password === password);
            if(assistant) {
                return res.json({ success: true, token: jwt.sign({ username: assistant.username, role: 'entry' }, SECRET_KEY, { expiresIn: '72h' }), role: 'entry' });
            }
            // دخول المعلمين
            const teacher = db.teachers.find(t => t.username === username && t.password === password);
            if (teacher) {
                return res.json({ success: true, token: jwt.sign({ username: teacher.username, role: 'teacher', centerId: teacher.centerId, teacherId: teacher.id }, SECRET_KEY, { expiresIn: '72h' }), role: 'teacher', centerId: teacher.centerId });
            }
        }
        res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    } catch (error) { res.status(500).json({ success: false, message: 'خطأ في السيرفر' }); }
});

const verifyToken = (req, res, next) => {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        jwt.verify(bearerHeader.split(' ')[1], SECRET_KEY, (err, authData) => {
            if (err) return res.sendStatus(403);
            req.user = authData; next();
        });
    } else res.sendStatus(403);
};

// جلب البيانات مع منع الكاش
app.get('/api/data', verifyToken, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
    try {
        let db = await AppData.findOne({ docId: "main_db" }).lean();
        if (!db) db = await AppData.create({ docId: "main_db", centers: [], teachers: [], students: [], messages: [], assistants: [] });
        
        if (req.user.role === 'admin' || req.user.role === 'entry') {
            return res.json({ centers: db.centers, teachers: db.teachers, students: db.students, messages: db.messages || [], assistants: db.assistants || [] });
        }
        if (req.user.role === 'teacher') {
            const myCenterId = req.user.centerId;
            return res.json({
                centers: db.centers.filter(c => c.id === myCenterId),
                teachers: db.teachers.filter(t => t.id === req.user.teacherId || t.centerId === myCenterId),
                students: db.students.filter(s => s.centerId === myCenterId),
                messages: (db.messages || []).filter(m => m.senderId === req.user.teacherId || m.receiverId === req.user.teacherId)
            });
        }
    } catch (err) { res.status(500).json({ error: "خطأ" }); }
});

// حفظ البيانات المباشر
app.post('/api/data', verifyToken, async (req, res) => {
    try {
        const incomingData = req.body;
        if (req.user.role === 'admin' || req.user.role === 'entry') {
            await AppData.findOneAndUpdate({ docId: "main_db" }, { $set: { 
                centers: incomingData.centers || [], teachers: incomingData.teachers || [], students: incomingData.students || [], messages: incomingData.messages || [], assistants: incomingData.assistants || []
            }}, { upsert: true });
            return res.json({ success: true });
        }
        if (req.user.role === 'teacher') {
            const myCenterId = req.user.centerId;
            const db = await AppData.findOne({ docId: "main_db" }).lean();
            const otherStudents = db.students.filter(s => s.centerId !== myCenterId);
            const myIncomingStudents = (incomingData.students || []).filter(s => s.centerId === myCenterId).map(s => ({ ...s, centerId: myCenterId }));
            
            const otherMessages = (db.messages || []).filter(m => m.senderId !== req.user.teacherId);
            const myNewMessages = (incomingData.messages || []).filter(m => m.senderId === req.user.teacherId);
            
            await AppData.findOneAndUpdate({ docId: "main_db" }, { $set: { students: [...otherStudents, ...myIncomingStudents], messages: [...otherMessages, ...myNewMessages] } });
            return res.json({ success: true });
        }
    } catch (err) { res.status(500).json({ error: "خطأ في الحفظ" }); }
});

app.listen(process.env.PORT || 10000, () => console.log(`✅ السيرفر يعمل بنجاح!`));
