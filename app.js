let db = { centers: [], teachers: [], students: [], messages: [], assistants: [] };
let currentUserRole = localStorage.getItem('awqaf_auth') || 'guest'; 
let editModes = { centerId: null, teacherId: null, studentId: null };
let myCharts = {};
const ITEMS_PER_PAGE = 10;
let currentPage = { centers: 1, teachers: 1, students: 1 };

const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
const quranSurahs = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const getAuthHeaders = () => { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('awqaf_token') }; };

function toggleDarkMode() {
    if (document.documentElement.classList.contains('dark')) { document.documentElement.classList.remove('dark'); localStorage.theme = 'light'; } 
    else { document.documentElement.classList.add('dark'); localStorage.theme = 'dark'; }
}

function calculateAge(dobString) {
    if(!dobString) return '-'; const diff = Date.now() - new Date(dobString).getTime(); const age = Math.abs(new Date(diff).getUTCFullYear() - 1970); return age ? age + ' سنة' : '-';
}

function filterCentersByGender(dropdownId, genderType) {
    const dropdown = document.getElementById(dropdownId); if(!dropdown) return; const currentVal = dropdown.value;
    let html = '<option value="">-- يرجى الاختيار --</option>';
    db.centers.filter(c => c.type === genderType).forEach(c => { html += `<option value="${c.id}">${c.name} (${c.type})</option>`; });
    dropdown.innerHTML = html; if(db.centers.find(c => c.id === currentVal && c.type === genderType)) { dropdown.value = currentVal; }
}

async function fetchDB() {
    try {
        const response = await fetch('/api/data', { method: 'GET', headers: getAuthHeaders() });
        if (response.status === 401 || response.status === 403) { if(currentUserRole !== 'guest') { logout(); Swal.fire({ icon: 'warning', title: 'انتهت الجلسة', confirmButtonColor: '#047857' }); } return; }
        if (!response.ok) throw new Error('السيرفر قيد التهيئة');
        db = await response.json(); renderAll();
    } catch (error) { Toast.fire({ icon: 'info', title: 'جاري الاتصال بالسحابة..' }); }
}

async function saveDB() {
    populateCenterDropdowns(); renderCenters(); renderTeachers(); renderStudents(); renderArchive(); if(document.getElementById('dashboard').classList.contains('active')) renderDashboard(); if(document.getElementById('permissions').classList.contains('active')) renderPermissions();
    try {
        const response = await fetch('/api/data', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(db) });
        if (response.status === 401 || response.status === 403) { logout(); return Swal.fire({ icon: 'warning', title: 'انتهت الجلسة' }); }
    } catch(error) { Toast.fire({ icon: 'info', title: 'يتم الحفظ في الخلفية..' }); }
}

function updateUIRoleDisplay() {
    let roleText = 'مدير النظام'; if(currentUserRole === 'entry') roleText = 'مساعد مدير'; if(currentUserRole === 'teacher') roleText = 'معلم حلقة';
    document.getElementById('user-role-badge').innerText = roleText;
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = (currentUserRole === 'admin' || currentUserRole === 'entry') ? '' : 'none');
    document.querySelectorAll('.strict-admin-only').forEach(el => el.style.display = (currentUserRole === 'admin') ? '' : 'none');
}

window.onload = async () => {
    if (currentUserRole !== 'guest' && localStorage.getItem('awqaf_token')) {
        await fetchDB(); document.getElementById('login-screen').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden'); updateUIRoleDisplay(); initApp();
    } else { document.getElementById('login-screen').classList.remove('hidden'); }
};

async function login() {
    const u = document.getElementById('username').value.trim(); const p = document.getElementById('password').value.trim();
    if(!u || !p) return Toast.fire({ icon: 'warning', title: 'يرجى إدخال البيانات' });
    try {
        const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        const data = await response.json();
        if(data.success) {
            localStorage.setItem('awqaf_token', data.token); localStorage.setItem('awqaf_auth', data.role);
            if(data.role === 'teacher') { localStorage.setItem('awqaf_center_id', data.centerId); const tInfo = jwt_decode_teacher_id(data.token); if(tInfo) localStorage.setItem('awqaf_teacher_id', tInfo); } 
            else { localStorage.removeItem('awqaf_center_id'); localStorage.removeItem('awqaf_teacher_id'); }
            currentUserRole = data.role; document.getElementById('login-screen').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden');
            updateUIRoleDisplay(); await fetchDB(); initApp(); Toast.fire({ icon: 'success', title: 'مرحباً بك' });
        } else { Swal.fire({ icon: 'error', title: 'خطأ', text: 'بيانات الدخول غير صحيحة!' }); }
    } catch(err) { Swal.fire({ icon: 'error', title: 'خطأ', text: 'تأكد من الاتصال بالإنترنت' }); }
}

function jwt_decode_teacher_id(token) { try { return JSON.parse(atob(token.split('.')[1])).teacherId; } catch(e) { return null; } }

function logout() {
    localStorage.removeItem('awqaf_token'); localStorage.removeItem('awqaf_auth'); localStorage.removeItem('awqaf_current_tab'); localStorage.removeItem('awqaf_center_id'); localStorage.removeItem('awqaf_teacher_id'); 
    currentUserRole = 'guest'; document.getElementById('main-app').classList.add('hidden'); document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('password').value = '';
}

function initApp() {
    document.querySelectorAll('.surah-dropdown').forEach(dropdown => {
        dropdown.innerHTML = '<option value="">-- يرجى اختيار السورة --</option>' + quranSurahs.map(s => `<option value="${s}">سورة ${s}</option>`).join('');
    });
    if (currentUserRole === 'teacher') { ['nav-centers', 'nav-teachers', 'nav-archive', 'nav-dashboard'].forEach(id => document.getElementById(id).style.display = 'none'); }
    renderAll();
    const lastTab = localStorage.getItem('awqaf_current_tab');
    if(currentUserRole === 'teacher') showTab('students'); else if (lastTab && document.getElementById(lastTab)) showTab(lastTab); else showTab('dashboard');
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content, .nav-btn').forEach(el => el.classList.remove('active'));
    if(document.getElementById(tabId)) document.getElementById(tabId).classList.add('active'); 
    if(document.getElementById('nav-' + tabId)) document.getElementById('nav-' + tabId).classList.add('active');
    localStorage.setItem('awqaf_current_tab', tabId);
    if(tabId === 'dashboard') renderDashboard(); if(tabId === 'attendance') renderAttendanceTable();
}

function renderAll() { 
    populateCenterDropdowns(); renderCenters(); renderTeachers(); renderStudents(); renderArchive(); 
    if(document.getElementById('dashboard').classList.contains('active')) renderDashboard(); 
    if(document.getElementById('permissions').classList.contains('active')) renderPermissions();
    renderMessageContacts(); if(currentUserRole === 'teacher') selectChatUser('admin', 'الإدارة المركزية'); 
}

function populateCenterDropdowns() {
    document.querySelectorAll('.center-dropdown').forEach(dropdown => {
        const currentVal = dropdown.value;
        dropdown.innerHTML = '<option value="">-- عرض الكل / يرجى الاختيار --</option>' + db.centers.map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`).join('');
        if(currentVal) dropdown.value = currentVal; 
    });
    filterCentersByGender('t-center', document.getElementById('t-type').value === 'معلم' ? 'ذكور' : 'إناث');
    filterCentersByGender('s-center', document.getElementById('s-gender').value === 'ذكر' ? 'ذكور' : 'إناث');
}

function changePage(type, step) { currentPage[type] += step; if(type === 'centers') renderCenters(); else if(type === 'teachers') renderTeachers(); else if(type === 'students') renderStudents(); }

function renderPaginationControls(type, current, total, totalItems, start, end) {
    const container = document.getElementById(`${type}-pagination`);
    if(total <= 1 || totalItems === 0) { container.innerHTML = ''; return; }
    container.innerHTML = `<div class="flex items-center justify-between border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"><div class="flex flex-1 justify-between sm:hidden"><button onclick="changePage('${type}', -1)" ${current === 1 ? 'disabled' : ''} class="btn btn-outline text-sm">السابق</button><button onclick="changePage('${type}', 1)" ${current === total ? 'disabled' : ''} class="btn btn-outline text-sm">التالي</button></div><div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between"><div><p class="text-sm text-gray-700 dark:text-slate-300">عرض <span class="font-bold">${start + 1}</span> إلى <span class="font-bold">${end}</span> من <span class="font-bold">${totalItems}</span></p></div><div><nav class="isolate inline-flex -space-x-px rounded-md shadow-sm"><button onclick="changePage('${type}', -1)" ${current === 1 ? 'disabled' : ''} class="relative inline-flex items-center rounded-r-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50">السابق</button><span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-slate-600">صفحة ${current} من ${total}</span><button onclick="changePage('${type}', 1)" ${current === total ? 'disabled' : ''} class="relative inline-flex items-center rounded-l-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50">التالي</button></nav></div></div></div>`;
}

function renderDashboard() {
    const activeStudents = db.students.filter(s => !s.archived);
    document.getElementById('stat-centers').innerText = db.centers.length; document.getElementById('stat-teachers').innerText = db.teachers.length; document.getElementById('stat-students').innerText = activeStudents.length;
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let inactiveList = activeStudents.filter(s => !s.date || new Date(s.date) < thirtyDaysAgo);
    const alertsContainer = document.getElementById('alerts-container'); const inactiveListDiv = document.getElementById('inactive-students-list');
    if(inactiveList.length > 0 && currentUserRole === 'admin') {
        document.getElementById('inactive-count-msg').innerText = `(${inactiveList.length}) طالب مسجل يتطلب تحديث متابعة الحفظ.`;
        inactiveListDiv.innerHTML = inactiveList.map(s => `<div class="border-b border-orange-100 py-2 flex justify-between"><span class="font-bold text-slate-700 dark:text-slate-200">${s.name} <span class="text-xs text-slate-500">(${db.centers.find(x => x.id === s.centerId)?.name || ''})</span></span><span dir="ltr" class="text-xs bg-orange-100 px-2 rounded">${s.date || 'غير مسجل'}</span></div>`).join('');
        alertsContainer.classList.remove('hidden');
    } else { alertsContainer.classList.add('hidden'); }
    
    if(myCharts.gender) myCharts.gender.destroy();
    myCharts.gender = new Chart(document.getElementById('genderChart'), { type: 'doughnut', data: { labels: ['ذكور', 'إناث'], datasets: [{ data: [activeStudents.filter(s=>s.gender==='ذكر').length, activeStudents.filter(s=>s.gender==='أنثى').length], backgroundColor: ['#047857', '#fbbf24'] }] }, options: { cutout: '60%', maintainAspectRatio: false } });
    
    let centerCounts = {}; activeStudents.forEach(s => { centerCounts[s.centerId] = (centerCounts[s.centerId] || 0) + 1; });
    let sortedCenters = Object.keys(centerCounts).map(id => ({ name: db.centers.find(x => x.id === id)?.name || 'غير محدد', count: centerCounts[id] })).sort((a,b) => b.count - a.count).slice(0, 5); 
    if(myCharts.centers) myCharts.centers.destroy();
    myCharts.centers = new Chart(document.getElementById('centersChart'), { type: 'bar', data: { labels: sortedCenters.map(x => x.name), datasets: [{ data: sortedCenters.map(x => x.count), backgroundColor: '#3b82f6' }] }, options: { plugins:{legend:{display:false}}, maintainAspectRatio: false } });
}

function openCenterModal() { cancelEditCenter(); document.getElementById('center-modal-title').innerHTML = 'تسجيل مركز جديد'; document.getElementById('centerModal').classList.remove('hidden'); }
function closeCenterModal() { document.getElementById('centerModal').classList.add('hidden'); }
function saveCenter() {
    const name = document.getElementById('center-name').value.trim(); const type = document.getElementById('center-type').value;
    if(!name) return Toast.fire({ icon: 'warning', title: 'يرجى إدخال اسم المركز' });
    if (editModes.centerId) { const c = db.centers.find(c => c.id === editModes.centerId); if(c) { c.name = name; c.type = type; } } 
    else { db.centers.unshift({ id: Date.now().toString(), name, type }); currentPage.centers = 1; }
    closeCenterModal(); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحفظ' });
}
function editCenter(id) {
    const c = db.centers.find(c => c.id === id); if(!c) return;
    document.getElementById('center-name').value = c.name; document.getElementById('center-type').value = c.type || 'ذكور'; editModes.centerId = id;
    document.getElementById('center-modal-title').innerHTML = 'تعديل بيانات المركز'; document.getElementById('centerModal').classList.remove('hidden');
}
function cancelEditCenter() { editModes.centerId = null; document.getElementById('center-name').value = ''; }
function deleteCenter(id) { Swal.fire({ title: 'تأكيد الحذف', icon: 'warning', showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء' }).then((result) => { if (result.isConfirmed) { db.centers = db.centers.filter(c => c.id !== id); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحذف' }); } }); }
function renderCenters() {
    const search = document.getElementById('search-center').value; const tbody = document.getElementById('centers-list'); const pagination = document.getElementById('centers-pagination');
    let filtered = db.centers.filter(c => c.name.includes(search));
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8">لا توجد مراكز مسجلة</td></tr>`; pagination.innerHTML = ''; return; }
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE); if(currentPage.centers > totalPages) currentPage.centers = totalPages;
    const startIdx = (currentPage.centers - 1) * ITEMS_PER_PAGE; const pagedData = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    tbody.innerHTML = pagedData.map((c, i) => {
        const stdCount = db.students.filter(s => s.centerId === c.id && !s.archived).length;
        const btnHtml = currentUserRole === 'admin' ? `<button onclick="editCenter('${c.id}')" class="text-blue-500 mx-2"><i class="fas fa-edit"></i></button><button onclick="deleteCenter('${c.id}')" class="text-red-500 mx-2"><i class="fas fa-trash"></i></button>` : '-';
        return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700"><td class="text-center py-3">${startIdx + i + 1}</td><td class="font-bold text-right">${c.name}</td><td class="text-center">${c.type}</td><td class="text-center text-emerald-600 font-bold">${stdCount}</td><td class="text-center">${btnHtml}</td></tr>`;
    }).join('');
    renderPaginationControls('centers', currentPage.centers, totalPages, filtered.length, startIdx, startIdx + pagedData.length);
}

function openTeacherModal() { cancelEditTeacher(); document.getElementById('teacher-modal-title').innerHTML = 'تسجيل معلم جديد'; document.getElementById('teacherModal').classList.remove('hidden'); }
function closeTeacherModal() { document.getElementById('teacherModal').classList.add('hidden'); }
function saveTeacher() {
    const t = { id: editModes.teacherId || Date.now().toString(), name: document.getElementById('t-name').value.trim(), nid: document.getElementById('t-nid').value, dob: document.getElementById('t-dob').value, type: document.getElementById('t-type').value, certified: document.getElementById('t-certified').value, payment: document.getElementById('t-payment').value, username: document.getElementById('t-username').value.trim(), password: document.getElementById('t-password').value.trim(), phone: document.getElementById('t-phone').value, period: document.getElementById('t-period').value, centerId: document.getElementById('t-center').value };
    if(!t.name || !t.centerId) return Toast.fire({ icon: 'warning', title: 'يجب إدخال الاسم واختيار المركز' });
    if (editModes.teacherId) { const idx = db.teachers.findIndex(x => x.id === editModes.teacherId); db.teachers[idx] = t; } else { db.teachers.unshift(t); currentPage.teachers = 1; }
    closeTeacherModal(); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحفظ' });
}
function editTeacher(id) {
    const t = db.teachers.find(x => x.id === id); if(!t) return;
    ['name','nid','dob','type','certified','payment','username','password','phone','period'].forEach(k => { if(document.getElementById(`t-${k}`)) document.getElementById(`t-${k}`).value = t[k] || ''; });
    filterCentersByGender('t-center', t.type === 'معلم' ? 'ذكور' : 'إناث'); document.getElementById('t-center').value = t.centerId;
    editModes.teacherId = id; document.getElementById('teacher-modal-title').innerHTML = 'تعديل بيانات المعلم'; document.getElementById('teacherModal').classList.remove('hidden');
}
function cancelEditTeacher() { editModes.teacherId = null; ['t-name','t-nid','t-dob','t-phone','t-username','t-password'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value=''; }); document.getElementById('t-type').value='معلم'; filterCentersByGender('t-center', 'ذكور'); }
function deleteTeacher(id) { Swal.fire({ title: 'تأكيد الحذف', icon: 'warning', showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء' }).then((result) => { if (result.isConfirmed) { db.teachers = db.teachers.filter(x => x.id !== id); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحذف' }); } }); }
function renderTeachers() {
    const sName = document.getElementById('search-teacher').value; const sCenter = document.getElementById('filter-t-center').value; const tbody = document.getElementById('teachers-list'); const pagination = document.getElementById('teachers-pagination');
    let filtered = db.teachers.filter(t => t.name.includes(sName)); if(sCenter) filtered = filtered.filter(t => t.centerId === sCenter);
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8">لا يوجد سجلات</td></tr>`; pagination.innerHTML = ''; return; }
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE); if(currentPage.teachers > totalPages) currentPage.teachers = totalPages;
    const startIdx = (currentPage.teachers - 1) * ITEMS_PER_PAGE; const pagedData = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    tbody.innerHTML = pagedData.map(t => {
        const center = db.centers.find(c => c.id === t.centerId)?.name || 'غير محدد';
        const adminBtns = currentUserRole === 'admin' ? `<button onclick="editTeacher('${t.id}')" class="text-blue-500 mx-2"><i class="fas fa-edit"></i></button><button onclick="deleteTeacher('${t.id}')" class="text-red-500 mx-2"><i class="fas fa-trash"></i></button>` : '-';
        return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700 py-2"><td class="font-bold text-right">${t.name} <div class="text-xs text-gray-400">يوزر: ${t.username || '-'}</div></td><td class="text-right">${t.dob||'-'}</td><td class="text-center">${t.type}</td><td class="text-center">${t.certified||'-'}</td><td class="text-right" dir="ltr">${t.phone || '-'}</td><td class="font-bold text-right">${center}</td><td class="text-center">${adminBtns}</td></tr>`;
    }).join('');
    renderPaginationControls('teachers', currentPage.teachers, totalPages, filtered.length, startIdx, startIdx + pagedData.length);
}

window.makeEditable = function(el, id, field) {
    if(el.querySelector('input') || currentUserRole === 'teacher') return;
    const oldVal = el.innerText.trim();
    el.innerHTML = `<input type="text" class="form-input text-sm px-2 w-full dark:bg-slate-800" value="${oldVal}" onblur="cancelInline(this, '${oldVal}')" onkeydown="if(event.key === 'Enter') saveInline(this, '${id}', '${field}')" onclick="event.stopPropagation()">`;
    el.querySelector('input').focus();
};
window.cancelInline = function(input, oldVal) { input.parentElement.innerHTML = oldVal; };
window.saveInline = function(input, id, field) {
    const newVal = input.value.trim(); if(!newVal) return cancelInline(input, '');
    const std = db.students.find(s => s.id === id); if(std) { std[field] = newVal; saveDB(); input.parentElement.innerHTML = newVal; }
};

function openStudentModal() { 
    cancelEditStudent(); document.getElementById('student-modal-title').innerHTML = 'تسجيل طالب جديد'; 
    const cd = document.getElementById('s-center');
    if (currentUserRole === 'teacher') { cd.value = localStorage.getItem('awqaf_center_id'); cd.disabled = true; } else { cd.disabled = false; }
    document.getElementById('studentModal').classList.remove('hidden'); 
}
function closeStudentModal() { document.getElementById('studentModal').classList.add('hidden'); }
function saveStudent() {
    const surah = document.getElementById('s-surah').value; const date = document.getElementById('s-date').value || new Date().toISOString().split('T')[0];
    let cid = document.getElementById('s-center').value; if(currentUserRole === 'teacher') cid = localStorage.getItem('awqaf_center_id');
    let s = { id: editModes.studentId || Date.now().toString(), name: document.getElementById('s-name').value.trim(), dob: document.getElementById('s-dob').value, gender: document.getElementById('s-gender').value, centerId: cid, riwaya: document.getElementById('s-riwaya').value, surah, date, archived: false, completionDate: '', history: [] };
    if(!s.name || !s.centerId) return Toast.fire({ icon: 'warning', title: 'يجب إدخال الاسم واختيار المركز' });
    if (editModes.studentId) { const idx = db.students.findIndex(x => x.id === editModes.studentId); const old = db.students[idx]; s.archived = old.archived; s.completionDate = old.completionDate; s.history = old.history || []; if(surah) s.history.push({ surah, date }); db.students[idx] = s; } 
    else { if(surah) s.history.push({ surah, date }); db.students.unshift(s); currentPage.students = 1; }
    closeStudentModal(); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحفظ' });
}
function editStudent(id) {
    const s = db.students.find(x => x.id === id); if(!s) return;
    ['name','dob','gender','riwaya','surah','date'].forEach(k => { if(document.getElementById(`s-${k}`)) document.getElementById(`s-${k}`).value = s[k] || ''; });
    filterCentersByGender('s-center', s.gender === 'ذكر' ? 'ذكور' : 'إناث'); document.getElementById('s-center').value = s.centerId;
    editModes.studentId = id; document.getElementById('student-modal-title').innerHTML = 'تحديث الطالب'; document.getElementById('studentModal').classList.remove('hidden');
}
function cancelEditStudent() { editModes.studentId = null; ['s-name','s-dob','s-surah','s-date'].forEach(id => document.getElementById(id).value=''); document.getElementById('s-gender').value='ذكر'; filterCentersByGender('s-center', 'ذكور'); }
function graduateStudent(id) {
    const s = db.students.find(x => x.id === id); if(!s) return;
    if(!s.archived) { Swal.fire({ title: 'تتويج بالختم', input: 'date', inputValue: new Date().toISOString().split('T')[0], showCancelButton: true, confirmButtonText: 'حفظ بالأرشيف' }).then((res) => { if(res.isConfirmed && res.value) { s.archived = true; s.completionDate = res.value; saveDB(); Toast.fire({ icon: 'success', title: 'تم النقل للأرشيف' }); } }); } 
    else { Swal.fire({ title: 'إلغاء الختم', showCancelButton: true, confirmButtonText: 'نعم' }).then((res) => { if (res.isConfirmed) { s.archived = false; s.completionDate = ''; saveDB(); Toast.fire({ icon: 'success', title: 'تم الاسترجاع' }); } }); }
}
function deleteStudentFinal(id) { Swal.fire({ title: 'تأكيد الحذف', icon: 'error', showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء' }).then((res) => { if (res.isConfirmed) { db.students = db.students.filter(x => x.id !== id); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحذف' }); } }); }
function renderStudents() {
    const sName = document.getElementById('search-student').value; const sCenter = document.getElementById('filter-s-center').value; const tbody = document.getElementById('students-list'); const pagination = document.getElementById('students-pagination');
    let filtered = db.students.filter(s => !s.archived && s.name.includes(sName)); if(sCenter) filtered = filtered.filter(s => s.centerId === sCenter);
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8">لا يوجد طلاب</td></tr>`; pagination.innerHTML = ''; return; }
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE); if(currentPage.students > totalPages) currentPage.students = totalPages;
    const startIdx = (currentPage.students - 1) * ITEMS_PER_PAGE; const pagedData = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    tbody.innerHTML = pagedData.map(s => {
        const center = db.centers.find(c => c.id === s.centerId)?.name || 'غير محدد';
        return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700"><td class="font-bold py-3 text-right" ondblclick="makeEditable(this, '${s.id}', 'name')">${s.name}</td><td class="text-right">${calculateAge(s.dob)}</td><td class="font-bold text-emerald-700 text-right">${center}</td><td class="font-bold text-blue-700 text-right">${s.surah ? 'سورة '+s.surah : '-'}</td><td class="text-center whitespace-nowrap"><button onclick="printIDCard('${s.id}')" class="text-teal-500 mx-1"><i class="fas fa-id-card"></i></button><button onclick="printCertificate('${s.id}')" class="text-yellow-500 mx-1"><i class="fas fa-award"></i></button><button onclick="editStudent('${s.id}')" class="text-blue-500 mx-1"><i class="fas fa-edit"></i></button>${currentUserRole === 'admin' ? `<button onclick="graduateStudent('${s.id}')" class="text-orange-500 mx-1"><i class="fas fa-graduation-cap"></i></button><button onclick="deleteStudentFinal('${s.id}')" class="text-red-500 mx-1"><i class="fas fa-trash"></i></button>` : ''}</td></tr>`;
    }).join('');
    renderPaginationControls('students', currentPage.students, totalPages, filtered.length, startIdx, startIdx + pagedData.length);
}

function renderArchive() {
    const container = document.getElementById('archive-container'); container.innerHTML = ''; const sCid = document.getElementById('filter-archive-center').value;
    let archStudents = db.students.filter(s => s.archived); if(sCid) archStudents = archStudents.filter(s => s.centerId === sCid);
    if(archStudents.length === 0) { container.innerHTML = '<div class="text-center p-10">لا توجد سجلات.</div>'; return; }
    const groups = {}; archStudents.forEach(s => { if(!groups[s.centerId]) groups[s.centerId] = []; groups[s.centerId].push(s); });
    for(const cid in groups) {
        const cName = db.centers.find(x => x.id === cid)?.name || 'غير محدد';
        let html = `<div class="card mb-6 shadow-sm dark:bg-slate-800"><div class="bg-emerald-800 text-white p-3 font-bold flex justify-between"><span>${cName}</span><span>${groups[cid].length} خاتم</span></div><div class="overflow-x-auto w-full"><table class="min-w-full text-sm whitespace-nowrap"><thead class="bg-emerald-50"><tr><th class="p-2 text-right">الخاتم</th><th class="p-2 text-right">العمر</th><th class="p-2 text-right">تاريخ الختم</th><th class="p-2 text-center">الإجراءات</th></tr></thead><tbody>`;
        groups[cid].forEach(s => { html += `<tr class="border-t py-2"><td class="font-bold p-2 text-right">${s.name}</td><td class="p-2 text-right">${calculateAge(s.dob)}</td><td class="p-2 text-right" dir="ltr">${s.completionDate||'-'}</td><td class="text-center"><button onclick="printCertificate('${s.id}')" class="text-yellow-500 mx-1"><i class="fas fa-award"></i></button><button onclick="editStudent('${s.id}')" class="text-blue-500 mx-1"><i class="fas fa-edit"></i></button><button onclick="graduateStudent('${s.id}')" class="text-gray-400 mx-1"><i class="fas fa-undo"></i></button><button onclick="deleteStudentFinal('${s.id}')" class="text-red-500 mx-1"><i class="fas fa-trash"></i></button></td></tr>`; });
        container.innerHTML += html + `</tbody></table></div></div>`;
    }
}

function printCustomReport() {
    const cid = document.getElementById('rep-custom-center').value; const minAge = parseInt(document.getElementById('rep-age-min').value)||0; const maxAge = parseInt(document.getElementById('rep-age-max').value)||100;
    let filtered = db.students.filter(s => !s.archived); if(cid) filtered = filtered.filter(s => s.centerId === cid);
    filtered = filtered.filter(s => { if(!s.dob) return false; const age = parseInt(calculateAge(s.dob)); return age >= minAge && age <= maxAge; });
    if(filtered.length === 0) return Swal.fire({icon:'info', title:'لا توجد نتائج'});
    let html = `<h3 style="text-align:center;">تقرير مخصص</h3><table border="1" width="100%" dir="rtl"><tr><th>اسم الطالب</th><th>المركز</th></tr>`;
    filtered.forEach(s => html += `<tr><td>${s.name}</td><td>${db.centers.find(x=>x.id===s.centerId)?.name||'-'}</td></tr>`);
    openPrintView(html + '</table>');
}

function exportToExcel(tableId, sheetName) {
    let table = document.getElementById(tableId); if(!table) return; let clone = table.cloneNode(true); clone.querySelectorAll('tr').forEach(r => { if(r.children.length > 0) r.removeChild(r.lastElementChild); });
    let ws = XLSX.utils.table_to_sheet(clone); ws['!dir'] = 'rtl'; let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}.xlsx`);
}

function exportData() { const d = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db)); const a = document.createElement('a'); a.href = d; a.download = "Backup.json"; a.click(); }
function importData(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = function(ev) { db = JSON.parse(ev.target.result); saveDB(); window.location.reload(); }; r.readAsText(f); }

function openPrintView(content, skipHeader = false) {
    const p = document.getElementById('print-area'); p.innerHTML = skipHeader ? content : `<div style="text-align:center;"><h2>مكتب أوقاف سرت</h2></div>` + content; 
    p.classList.remove('hidden'); window.print(); p.classList.add('hidden');
}
function printCenters(type) { openPrintView(`<h3 style="text-align:center;">كشف مراكز (${type})</h3><table border="1" width="100%" dir="rtl">` + db.centers.filter(c=>c.type===type).map(c=>`<tr><td>${c.name}</td></tr>`).join('') + `</table>`); }
function printSingleCenter() {
    const cid = document.getElementById('report-center').value; if(!cid) return; const center = db.centers.find(c=>c.id===cid);
    openPrintView(`<h3 style="text-align:center;">${center.name}</h3><table border="1" width="100%" dir="rtl">` + db.students.filter(s=>s.centerId===cid).map(s=>`<tr><td>${s.name}</td></tr>`).join('') + `</table>`);
}
function printTeachers(type) { openPrintView(`<h3 style="text-align:center;">الكادر (${type})</h3><table border="1" width="100%" dir="rtl">` + db.teachers.filter(t=>t.type===type).map(t=>`<tr><td>${t.name}</td><td>${db.centers.find(c=>c.id===t.centerId)?.name||'-'}</td></tr>`).join('') + `</table>`); }
function printArchive() { openPrintView(`<h3 style="text-align:center;">الأرشيف</h3><table border="1" width="100%" dir="rtl">` + db.students.filter(s=>s.archived).map(s=>`<tr><td>${s.name}</td><td>${s.completionDate}</td></tr>`).join('') + `</table>`); }
function printCertificate(id) {
    const s = db.students.find(x => x.id === id); if(!s) return;
    openPrintView(`<div style="text-align:center; padding:50px;"><h1>شهادة</h1><h2>${s.name}</h2></div>`, true); 
}
function printIDCard(id) {
    const s = db.students.find(x => x.id === id); if(!s) return;
    openPrintView(`<div style="text-align:center; padding:20px; border:1px solid #000; width:300px;"><h3>بطاقة</h3><p>${s.name}</p></div>`, true);
}

document.addEventListener("DOMContentLoaded", () => {
    const t = new Date().toISOString().slice(0, 7); if(document.getElementById('attendance-month')) document.getElementById('attendance-month').value = t;
});

function renderAttendanceTable() {
    const month = document.getElementById('attendance-month').value || new Date().toISOString().slice(0, 7);
    const cid = document.getElementById('attendance-center') ? document.getElementById('attendance-center').value : '';
    const tbody = document.getElementById('attendance-list');
    let stds = db.students.filter(s => !s.archived);
    if (currentUserRole === 'teacher') stds = stds.filter(s => s.centerId === localStorage.getItem('awqaf_center_id')); else if (cid) stds = stds.filter(s => s.centerId === cid); else { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8">الرجاء اختيار المركز</td></tr>`; return; }
    if(stds.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8">لا يوجد طلاب</td></tr>`; return; }
    tbody.innerHTML = stds.map(s => {
        if(!s.attendance) s.attendance = {}; if(!s.attendance[month]) s.attendance[month] = { present: 0, absent: 0, excused: 0 };
        const att = s.attendance[month]; const p = Math.round((att.present / ((att.present+att.absent+att.excused)||1)) * 100);
        return `<tr><td class="font-bold py-2 text-right">${s.name}</td><td class="text-center"><input type="number" min="0" value="${att.present}" class="form-input w-16 text-center mx-auto" onchange="updateAttendance('${s.id}', '${month}', 'present', this.value)"></td><td class="text-center"><input type="number" min="0" value="${att.absent}" class="form-input w-16 text-center mx-auto" onchange="updateAttendance('${s.id}', '${month}', 'absent', this.value)"></td><td class="text-center"><input type="number" min="0" value="${att.excused}" class="form-input w-16 text-center mx-auto" onchange="updateAttendance('${s.id}', '${month}', 'excused', this.value)"></td><td class="text-center text-emerald-600 font-bold">${p}%</td></tr>`;
    }).join('');
}
function updateAttendance(id, m, f, v) { const s = db.students.find(x=>x.id===id); if(s) { s.attendance[m][f] = parseInt(v)||0; saveDB(); Toast.fire({ icon: 'success', title: 'تم الحفظ' }); } }
function printAttendanceSheet() { openPrintView(`<h3 style="text-align:center;">كشف الحضور</h3>`, false); }

// =================== الصلاحيات والمساعدين ===================
function renderPermissions() {
    if(currentUserRole !== 'admin') return;
    document.getElementById('perm-teachers-list').innerHTML = db.teachers.map(t => `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700"><td class="p-3 font-bold text-right">${t.name}</td><td class="p-3 text-right">${t.username||'-'}</td><td class="p-3 text-red-500 text-right">${t.password||'-'}</td></tr>`).join('');
    document.getElementById('perm-assistants-list').innerHTML = (db.assistants || []).map(a => `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700"><td class="p-3 font-bold text-right">${a.name}</td><td class="p-3 text-emerald-600 text-right">${a.username}</td><td class="p-3 text-center"><button onclick="deleteAssistant('${a.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}
function saveAssistant() {
    const name = document.getElementById('ast-name').value.trim(); const userPass = document.getElementById('ast-user').value.trim();
    if(!name || !userPass) return Toast.fire({ icon: 'warning', title: 'يرجى تعبئة الحقول' });
    if(!db.assistants) db.assistants = []; db.assistants.push({ id: Date.now().toString(), name, username: userPass, password: userPass });
    document.getElementById('ast-name').value = ''; document.getElementById('ast-user').value = '';
    renderPermissions(); saveDB(); Toast.fire({ icon: 'success', title: 'تمت الإضافة' });
}
function deleteAssistant(id) { db.assistants = db.assistants.filter(a => a.id !== id); renderPermissions(); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحذف' }); }

// =================== المراسلة الداخلية ===================
let activeChatUserId = null;
function renderMessageContacts() {
    if(currentUserRole === 'teacher') return;
    const cf = document.getElementById('msg-center-filter'); if(cf.options.length <= 1) cf.innerHTML = '<option value="">-- كل المراكز --</option>' + db.centers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const list = cf.value ? db.teachers.filter(t => t.centerId === cf.value) : db.teachers;
    document.getElementById('msg-contacts').innerHTML = list.map(t => `<div onclick="selectChatUser('${t.id}', '${t.name}')" class="p-3 bg-white hover:bg-blue-50 dark:bg-slate-800 rounded-lg cursor-pointer border mb-1 ${activeChatUserId===t.id?'ring-2 ring-blue-500':''}"><div class="font-bold">${t.name}</div><div class="text-xs text-gray-500">${db.centers.find(c=>c.id===t.centerId)?.name||''}</div></div>`).join('');
}
function selectChatUser(id, name) {
    activeChatUserId = id; document.getElementById('chat-title').innerText = name;
    if(document.getElementById('chat-overlay')) document.getElementById('chat-overlay').style.display = 'none';
    renderChatBox();
}
function renderChatBox() {
    if(!activeChatUserId && currentUserRole !== 'teacher') return;
    const box = document.getElementById('chat-box');
    const myId = currentUserRole === 'teacher' ? localStorage.getItem('awqaf_teacher_id') || 'teacher' : 'admin';
    const targetId = currentUserRole === 'teacher' ? 'admin' : activeChatUserId;
    
    const msgs = (db.messages || []).filter(m => (m.senderId === activeChatUserId && m.receiverId === 'admin') || (m.senderId === 'admin' && m.receiverId === activeChatUserId) || (currentUserRole === 'teacher' && (m.senderId === myId || m.receiverId === myId)));
    
    box.innerHTML = msgs.map(m => {
        const isMe = m.senderId === myId;
        const align = isMe ? 'self-end bg-blue-500 text-white rounded-br-none' : 'self-start bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-bl-none';
        return `<div class="max-w-[85%] md:max-w-[75%] p-3 rounded-2xl shadow-sm ${align} flex flex-col"><span class="font-bold">${m.text}</span><span class="text-[10px] mt-1 opacity-70" dir="ltr">${m.date}</span></div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}
function sendMessage() {
    const input = document.getElementById('msg-input'); const text = input.value.trim(); if(!text) return;
    if(currentUserRole !== 'teacher' && !activeChatUserId) return Toast.fire({ icon: 'warning', title: 'اختر معلماً أولاً' });
    let senderId = 'admin'; let receiverId = activeChatUserId;
    if(currentUserRole === 'teacher') { senderId = localStorage.getItem('awqaf_teacher_id') || 'teacher'; receiverId = 'admin'; activeChatUserId = 'admin'; }
    if(!db.messages) db.messages = []; db.messages.push({ id: Date.now().toString(), text, senderId, receiverId, date: new Date().toLocaleString('ar-LY', {hour: '2-digit', minute:'2-digit'}) });
    input.value = ''; renderChatBox(); saveDB();
}
