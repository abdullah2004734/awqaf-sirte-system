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
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

const PUBLIC_DIR = __dirname;
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');

app.use(express.static(PUBLIC_DIR));

// 1. الاتصال بقاعدة البيانات MongoDB السحابية
const MONGO_URI = "mongodb+srv://abdo2004102030_db_user:w4jkUGMTPnIa1hT7@cluster0.y7usojc.mongodb.net/awqaf_db?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB السحابية بنجاح!'))
    .catch(err => console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err));

// 2. تجهيز هيكل البيانات
const DataSchema = new mongoose.Schema({
    docId: { type: String, default: "main_db" },
    centers: { type: Array, default: [] },
    teachers: { type: Array, default: [] },
    students: { type: Array, default: [] }
});

const AppData = mongoose.model('AppData', DataSchema);

const initDB = async () => {
    try {
        const doc = await AppData.findOne({ docId: "main_db" });
        if (!doc) {
            await AppData.create({ docId: "main_db", centers: [], teachers: [], students: [] });
            console.log("✅ تم إنشاء خزنة البيانات الأساسية");
        }
    } catch (err) {}
};
initDB();

app.get('/', (req, res) => {
    const fs = require('fs');
    if (fs.existsSync(INDEX_FILE)) {
        res.sendFile(INDEX_FILE);
    } else {
        res.status(404).send(`<h1>❌ لم يتم العثور على ملف index.html</h1>`);
    }
});

// 3. تسجيل الدخول
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (username === 'admin' && password === 'admin') {
            const token = jwt.sign({ username, role: 'admin' }, SECRET_KEY, { expiresIn: '72h' });
            return res.json({ success: true, token, role: 'admin' });
        }
        
        if (username === 'entry' && password === 'entry') {
            const token = jwt.sign({ username, role: 'entry' }, SECRET_KEY, { expiresIn: '72h' });
            return res.json({ success: true, token, role: 'entry' });
        }

        const db = await AppData.findOne({ docId: "main_db" });
        if(db) {
            const teacher = db.teachers.find(t => t.username === username && t.password === password);
            if (teacher) {
                const token = jwt.sign({ username: teacher.username, role: 'teacher', centerId: teacher.centerId, teacherId: teacher.id }, SECRET_KEY, { expiresIn: '72h' });
                return res.json({ success: true, token, role: 'teacher', centerId: teacher.centerId });
            }
        }
        res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
    }
});

const verifyToken = (req, res, next) => {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const token = bearerHeader.split(' ')[1];
        jwt.verify(token, SECRET_KEY, (err, authData) => {
            if (err) return res.sendStatus(403);
            req.user = authData;
            next();
        });
    } else {
        res.sendStatus(403);
    }
};

// 4. جلب البيانات
app.get('/api/data', verifyToken, async (req, res) => {
    try {
        let db = await AppData.findOne({ docId: "main_db" });
        
        // حماية: إذا لم يجد القاعدة عند بدء التشغيل، ينشئها فوراً
        if (!db) {
            db = await AppData.create({ docId: "main_db", centers: [], teachers: [], students: [] });
        }
        
        const dbData = { centers: db.centers, teachers: db.teachers, students: db.students };

        if (req.user.role === 'admin' || req.user.role === 'entry') {
            return res.json(dbData);
        }

        if (req.user.role === 'teacher') {
            const myCenterId = req.user.centerId;
            const filteredData = {
                centers: dbData.centers.filter(c => c.id === myCenterId),
                teachers: dbData.teachers.filter(t => t.id === req.user.teacherId || t.centerId === myCenterId),
                students: dbData.students.filter(s => s.centerId === myCenterId)
            };
            return res.json(filteredData);
        }
    } catch (err) {
        res.status(500).json({ error: "خطأ في السيرفر" });
    }
});

// 5. حفظ البيانات (السر هنا)
app.post('/api/data', verifyToken, async (req, res) => {
    try {
        let db = await AppData.findOne({ docId: "main_db" });
        if (!db) {
            db = await AppData.create({ docId: "main_db", centers: [], teachers: [], students: [] });
        }

        const incomingData = req.body;

        if (req.user.role === 'admin' || req.user.role === 'entry') {
            db.centers = incomingData.centers || [];
            db.teachers = incomingData.teachers || [];
            db.students = incomingData.students || [];
            
            // السر: إجبار القاعدة على ملاحظة التغيير والحفظ
            db.markModified('centers');
            db.markModified('teachers');
            db.markModified('students');

            await db.save();
            return res.json({ success: true });
        }

        if (req.user.role === 'teacher') {
            const myCenterId = req.user.centerId;
            const otherStudents = db.students.filter(s => s.centerId !== myCenterId);
            const myIncomingStudents = (incomingData.students || [])
                .filter(s => s.centerId === myCenterId)
                .map(s => ({ ...s, centerId: myCenterId }));

            db.students = [...otherStudents, ...myIncomingStudents];
            db.markModified('students');
            await db.save();
            return res.json({ success: true });
        }
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).json({ error: "خطأ في الحفظ" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل بنجاح الآن!`);
});
