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

app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => {
    if (fs.existsSync(INDEX_FILE)) {
        res.sendFile(INDEX_FILE);
    } else {
        res.status(404).send(`<h1 style="color:red;text-align:center;padding:50px;">❌ لم يتم العثور على ملف index.html</h1>`);
    }
});

const DB_FILE = path.join(PUBLIC_DIR, 'database.json');

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ centers: [], teachers: [], students: [], messages: [], assistants: [] }, null, 2));
}

// 1. تسجيل الدخول المتطور للصلاحيات
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    // المدير العام
    if (username === 'admin' && password === 'admin') {
        const token = jwt.sign({ username, role: 'admin' }, SECRET_KEY, { expiresIn: '72h' });
        return res.json({ success: true, token, role: 'admin' });
    }
    
    // المساعدين (يتم تحديد دورهم من لوحة التحكم: entry أو viewer)
    const assistant = (db.assistants || []).find(a => a.username === username && a.password === password);
    if (assistant) {
        const userRole = assistant.role || 'entry';
        const token = jwt.sign({ username: assistant.username, role: userRole }, SECRET_KEY, { expiresIn: '72h' });
        return res.json({ success: true, token, role: userRole });
    }

    // المعلمين
    const teacher = db.teachers.find(t => t.username === username && t.password === password);
    if (teacher) {
        const token = jwt.sign({ username: teacher.username, role: 'teacher', centerId: teacher.centerId, teacherId: teacher.id }, SECRET_KEY, { expiresIn: '72h' });
        return res.json({ success: true, token, role: 'teacher', centerId: teacher.centerId, teacherId: teacher.id });
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

// 2. جلب البيانات
app.get('/api/data', verifyToken, (req, res) => {
    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

        if (req.user.role === 'admin' || req.user.role === 'entry' || req.user.role === 'viewer') {
            res.setHeader('Content-Type', 'application/json');
            return res.send(JSON.stringify(db));
        }

        if (req.user.role === 'teacher') {
            const myCenterId = req.user.centerId;
            const filteredData = {
                centers: db.centers.filter(c => c.id === myCenterId),
                teachers: db.teachers.filter(t => t.id === req.user.teacherId || t.centerId === myCenterId),
                students: db.students.filter(s => s.centerId === myCenterId),
                messages: db.messages || []
            };
            res.setHeader('Content-Type', 'application/json');
            return res.send(JSON.stringify(filteredData));
        }
    } catch (err) {
        res.status(500).json({ error: "خطأ في السيرفر" });
    }
});

// 3. حفظ البيانات
app.post('/api/data', verifyToken, (req, res) => {
    try {
        if (req.user.role === 'viewer') return res.status(403).json({ error: "قراءة فقط" });

        const fullDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        const incomingData = req.body;

        if (req.user.role === 'admin' || req.user.role === 'entry') {
            fs.writeFileSync(DB_FILE, JSON.stringify(incomingData, null, 2));
            return res.json({ success: true });
        }

        if (req.user.role === 'teacher') {
            const myCenterId = req.user.centerId;
            const otherStudents = fullDB.students.filter(s => s.centerId !== myCenterId);
            const myIncomingStudents = (incomingData.students || []).filter(s => s.centerId === myCenterId).map(s => ({ ...s, centerId: myCenterId }));
            
            fullDB.students = [...otherStudents, ...myIncomingStudents];
            if(incomingData.messages) fullDB.messages = incomingData.messages;

            fs.writeFileSync(DB_FILE, JSON.stringify(fullDB, null, 2));
            return res.json({ success: true });
        }
    } catch (err) {
        res.status(500).json({ error: "خطأ في الحفظ" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل بنجاح على المنفذ ${PORT}`);
});
