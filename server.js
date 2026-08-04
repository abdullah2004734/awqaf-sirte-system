const express = require('express');
const fs = require('fs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

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

// تقديم الملفات الأساسية
app.use(express.static(PUBLIC_DIR));

// المسار الرئيسي للواجهة
app.get('/', (req, res) => {
    if (fs.existsSync(INDEX_FILE)) {
        res.sendFile(INDEX_FILE);
    } else {
        res.status(404).send(`
            <div style="font-family:sans-serif; text-align:center; padding:50px;">
                <h1 style="color:red;">❌ لم يتم العثور على ملف index.html</h1>
                <p>السيرفر يعمل بنجاح، ولكنه يبحث عن ملف index.html في هذا المسار ولا يجده:</p>
                <code style="background:#eee; padding:5px; border-radius:5px;">${INDEX_FILE}</code>
                <p>تأكد من وجود ملف index.html في نفس المجلد مع server.js بنفس هذا الاسم تماماً.</p>
            </div>
        `);
    }
});

const DB_FILE = path.join(PUBLIC_DIR, 'database.json');

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ centers: [], teachers: [], students: [] }, null, 2));
}

// 1. تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    if (username === 'admin' && password === 'admin') {
        const token = jwt.sign({ username, role: 'admin' }, SECRET_KEY, { expiresIn: '72h' });
        return res.json({ success: true, token, role: 'admin' });
    }
    
    if (username === 'entry' && password === 'entry') {
        const token = jwt.sign({ username, role: 'entry' }, SECRET_KEY, { expiresIn: '72h' });
        return res.json({ success: true, token, role: 'entry' });
    }

    const teacher = db.teachers.find(t => t.username === username && t.password === password);
    if (teacher) {
        const token = jwt.sign({ username: teacher.username, role: 'teacher', centerId: teacher.centerId, teacherId: teacher.id }, SECRET_KEY, { expiresIn: '72h' });
        return res.json({ success: true, token, role: 'teacher', centerId: teacher.centerId });
    }

    res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
});

// حارس الأمان
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
// 2. جلب البيانات (مصحح)
app.get('/api/data', verifyToken, (req, res) => {
    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

        if (req.user.role === 'admin' || req.user.role === 'entry') {
            res.setHeader('Content-Type', 'application/json');
            return res.send(JSON.stringify(db));
        }

        if (req.user.role === 'teacher') {
            const myCenterId = req.user.centerId;
            const filteredData = {
                centers: db.centers.filter(c => c.id === myCenterId),
                teachers: db.teachers.filter(t => t.id === req.user.teacherId || t.centerId === myCenterId),
                students: db.students.filter(s => s.centerId === myCenterId),
                // إصلاح: جلب الرسائل الخاصة بالمعلم والمدير لكي لا تختفي المحادثات
                messages: (db.messages || []).filter(m => m.senderId === req.user.teacherId || m.receiverId === req.user.teacherId || m.senderId === 'admin' || m.receiverId === 'admin')
            };
            res.setHeader('Content-Type', 'application/json');
            return res.send(JSON.stringify(filteredData));
        }
    } catch (err) {
        res.status(500).json({ error: "خطأ في السيرفر" });
    }
});

// 3. حفظ البيانات (مصحح لمنع حذف البيانات وحل مشكلة Overwrite)
app.post('/api/data', verifyToken, (req, res) => {
    try {
        const fullDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        const incomingData = req.body;

        if (req.user.role === 'admin' || req.user.role === 'entry') {
            // دمج آمن للبيانات بدلاً من الاستبدال الأعمى لمنع مسح بيانات المعلمين
            fullDB.centers = incomingData.centers || fullDB.centers;
            fullDB.teachers = incomingData.teachers || fullDB.teachers;
            fullDB.assistants = incomingData.assistants || fullDB.assistants;
            
            // تحديث الطلاب بأمان
            if (incomingData.students) {
                fullDB.students = incomingData.students;
            }

            // دمج الرسائل الجديدة فقط لكي لا يمسح المدير رسائل المعلمين
            const existingMsgIds = new Set((fullDB.messages || []).map(m => m.id));
            const newMsgs = (incomingData.messages || []).filter(m => !existingMsgIds.has(m.id));
            fullDB.messages = [...(fullDB.messages || []), ...newMsgs];

            fs.writeFileSync(DB_FILE, JSON.stringify(fullDB, null, 2));
            return res.json({ success: true });
        }

        if (req.user.role === 'teacher') {
            const myCenterId = req.user.centerId;
            
            // تحديث طلاب المعلم فقط دون المساس بطلاب المراكز الأخرى
            const otherStudents = fullDB.students.filter(s => s.centerId !== myCenterId);
            const myIncomingStudents = (incomingData.students || [])
                .filter(s => s.centerId === myCenterId)
                .map(s => ({ ...s, centerId: myCenterId }));

            fullDB.students = [...otherStudents, ...myIncomingStudents];

            // إصلاح: السماح للمعلم بحفظ رسائله في قاعدة البيانات
            if (incomingData.messages) {
                const existingMsgIds = new Set((fullDB.messages || []).map(m => m.id));
                const newMsgs = incomingData.messages.filter(m => !existingMsgIds.has(m.id));
                fullDB.messages = [...(fullDB.messages || []), ...newMsgs];
            }

            fs.writeFileSync(DB_FILE, JSON.stringify(fullDB, null, 2));
            return res.json({ success: true });
        }
    } catch (err) {
        res.status(500).json({ error: "خطأ في الحفظ" });
    }
});

// التشغيل على المنفذ 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`✅ السيرفر يعمل بنجاح الآن على الرابط التالي:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`==================================================\n`);
});
