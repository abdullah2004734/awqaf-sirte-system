let db = { centers: [], teachers: [], students: [] };
let currentUserRole = localStorage.getItem('awqaf_auth') || 'guest'; 
let editModes = { centerId: null, teacherId: null, studentId: null };
let myCharts = {};
const ITEMS_PER_PAGE = 10;
let currentPage = { centers: 1, teachers: 1, students: 1 };

const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
    didOpen: (toast) => { toast.addEventListener('mouseenter', Swal.stopTimer); toast.addEventListener('mouseleave', Swal.resumeTimer); }
});

const quranSurahs = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];

const getAuthHeaders = () => {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('awqaf_token') };
};

function toggleDarkMode() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
}

function calculateAge(dobString) {
    if(!dobString) return '-';
    const diff = Date.now() - new Date(dobString).getTime();
    const age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    return age ? age + ' سنة' : '-';
}

function filterCentersByGender(dropdownId, genderType) {
    const dropdown = document.getElementById(dropdownId);
    if(!dropdown) return;
    const currentVal = dropdown.value;
    let html = '<option value="">-- يرجى الاختيار --</option>';
    
    // التصفية بناءً على نوع المركز حصراً بدون مزدوج
    db.centers.filter(c => c.type === genderType).forEach(c => {
        html += `<option value="${c.id}">${c.name} (${c.type})</option>`;
    });
    
    dropdown.innerHTML = html;
    if(db.centers.find(c => c.id === currentVal && c.type === genderType)) {
        dropdown.value = currentVal; 
    }
}

async function fetchDB() {
    try {
        const response = await fetch('/api/data', { method: 'GET', headers: getAuthHeaders() });
        
        // السيرفر يطرد المستخدم فقط إذا انتهت الصلاحية فعلاً (الخطأ 401 أو 403)
        if (response.status === 401 || response.status === 403) {
            if(currentUserRole !== 'guest') {
                logout();
                Swal.fire({ icon: 'warning', title: 'انتهت الجلسة', text: 'يرجى تسجيل الدخول مجدداً.', confirmButtonColor: '#047857' });
            }
            return;
        }
        
        if (!response.ok) throw new Error('السيرفر قيد التهيئة');
        
        db = await response.json();
        renderAll();
    } catch (error) {
        console.error('خطأ في الاتصال:', error);
        // تم إزالة كود الطرد العشوائي من هنا!
        Toast.fire({ icon: 'info', title: 'جاري الاتصال بالسحابة.. لا تقلق بياناتك آمنة.' });
    }
}

async function saveDB() {
    populateCenterDropdowns(); renderCenters(); renderTeachers(); renderStudents(); renderArchive();
    if(document.getElementById('dashboard').classList.contains('active')) renderDashboard();
    try {
        const response = await fetch('/api/data', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(db) });
        if (response.status === 401 || response.status === 403) {
            logout();
            return Swal.fire({ icon: 'warning', title: 'انتهت الجلسة', text: 'يرجى تسجيل الدخول مجدداً.', confirmButtonColor: '#047857' });
        }
    } catch(error) { 
        Toast.fire({ icon: 'info', title: 'يتم الآن الحفظ في الخلفية..' }); 
    }
}

function updateUIRoleDisplay() {
    let roleText = 'مدير النظام';
    if(currentUserRole === 'entry') roleText = 'مدخل بيانات';
    if(currentUserRole === 'teacher') roleText = 'معلم حلقة';
    document.getElementById('user-role-badge').innerText = roleText;
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = (currentUserRole === 'admin' || currentUserRole === 'entry') ? '' : 'none');
}

window.onload = async () => {
    if (currentUserRole !== 'guest' && localStorage.getItem('awqaf_token')) {
        await fetchDB(); 
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        updateUIRoleDisplay();
        initApp();
    } else { document.getElementById('login-screen').classList.remove('hidden'); }
};

async function login() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if(!u || !p) return Toast.fire({ icon: 'warning', title: 'يرجى إدخال اسم المستخدم وكلمة المرور' });

    try {
        const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        const data = await response.json();
        if(data.success) {
            localStorage.setItem('awqaf_token', data.token);
            localStorage.setItem('awqaf_auth', data.role);
            if(data.role === 'teacher') localStorage.setItem('awqaf_center_id', data.centerId);
            else localStorage.removeItem('awqaf_center_id');
            currentUserRole = data.role;
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            updateUIRoleDisplay();
            await fetchDB();
            initApp();
            Toast.fire({ icon: 'success', title: 'مرحباً بك في المنظومة' });
        } else { Swal.fire({ icon: 'error', title: 'خطأ', text: 'بيانات الدخول غير صحيحة!', confirmButtonColor: '#047857' }); }
    } catch(err) { Swal.fire({ icon: 'error', title: 'خطأ اتصال', text: 'تأكد من تشغيل السيرفر أو الاتصال بالإنترنت', confirmButtonColor: '#047857' }); }
}

function logout() {
    localStorage.removeItem('awqaf_token'); localStorage.removeItem('awqaf_auth'); localStorage.removeItem('awqaf_current_tab'); localStorage.removeItem('awqaf_center_id'); 
    currentUserRole = 'guest'; document.getElementById('main-app').classList.add('hidden'); document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('password').value = '';
}

function initApp() {
    const surahSelects = document.querySelectorAll('.surah-dropdown');
    surahSelects.forEach(dropdown => {
        dropdown.innerHTML = '<option value="">-- يرجى اختيار السورة --</option>';
        quranSurahs.forEach(s => dropdown.innerHTML += `<option value="${s}">سورة ${s}</option>`);
    });

    if (currentUserRole === 'teacher') {
        document.getElementById('nav-centers').style.display = 'none';
        document.getElementById('nav-teachers').style.display = 'none';
        document.getElementById('nav-archive').style.display = 'none';
        document.getElementById('nav-dashboard').style.display = 'none';
    }

    renderAll();
    const lastTab = localStorage.getItem('awqaf_current_tab');
    if(currentUserRole === 'teacher') { showTab('students'); } 
    else if (lastTab && document.getElementById(lastTab)) { showTab(lastTab); } 
    else { showTab('dashboard'); }
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const tabElement = document.getElementById(tabId); const navElement = document.getElementById('nav-' + tabId);
    if(tabElement) tabElement.classList.add('active'); if(navElement) navElement.classList.add('active');
    localStorage.setItem('awqaf_current_tab', tabId);
    if(tabId === 'dashboard') renderDashboard();
    if(tabId === 'attendance') renderAttendanceTable(); // <--- أضف هذا السطر هنا لتحديث الجدول عند فتح التبويب
}

function renderAll() { populateCenterDropdowns(); renderCenters(); renderTeachers(); renderStudents(); renderArchive(); if(document.getElementById('dashboard').classList.contains('active')) renderDashboard(); }

function populateCenterDropdowns() {
    const dropdowns = document.querySelectorAll('.center-dropdown');
    dropdowns.forEach(dropdown => {
        const currentVal = dropdown.value;
        let html = '<option value="">-- عرض الكل / يرجى الاختيار --</option>';
        db.centers.forEach(c => html += `<option value="${c.id}">${c.name} (${c.type})</option>`);
        dropdown.innerHTML = html;
        if(currentVal) dropdown.value = currentVal; 
    });
    filterCentersByGender('t-center', document.getElementById('t-type').value === 'معلم' ? 'ذكور' : 'إناث');
    filterCentersByGender('s-center', document.getElementById('s-gender').value === 'ذكر' ? 'ذكور' : 'إناث');
}

function changePage(type, step) { currentPage[type] += step; if(type === 'centers') renderCenters(); else if(type === 'teachers') renderTeachers(); else if(type === 'students') renderStudents(); }

function renderPaginationControls(type, current, total, totalItems, start, end) {
    const container = document.getElementById(`${type}-pagination`);
    if(total <= 1 && totalItems > 0) { container.innerHTML = ''; return; }
    if(totalItems === 0) return; 
    container.innerHTML = `<div class="flex items-center justify-between border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 sm:px-6"><div class="flex flex-1 justify-between sm:hidden"><button onclick="changePage('${type}', -1)" ${current === 1 ? 'disabled' : ''} class="relative inline-flex items-center rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 ${current === 1 ? 'opacity-50' : ''}">السابق</button><button onclick="changePage('${type}', 1)" ${current === total ? 'disabled' : ''} class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 ${current === total ? 'opacity-50' : ''}">التالي</button></div><div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between"><div><p class="text-sm text-gray-700 dark:text-slate-300">عرض <span class="font-bold">${start + 1}</span> إلى <span class="font-bold">${end}</span> من أصل <span class="font-bold">${totalItems}</span></p></div><div><nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination"><button onclick="changePage('${type}', -1)" ${current === 1 ? 'disabled' : ''} class="relative inline-flex items-center rounded-r-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 focus:z-20 ${current === 1 ? 'opacity-50 cursor-not-allowed' : ''}">السابق</button><span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-slate-600 bg-slate-50 dark:bg-slate-700">صفحة ${current} من ${total}</span><button onclick="changePage('${type}', 1)" ${current === total ? 'disabled' : ''} class="relative inline-flex items-center rounded-l-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 focus:z-20 ${current === total ? 'opacity-50 cursor-not-allowed' : ''}">التالي</button></nav></div></div></div>`;
}

function renderDashboard() {
    const activeStudents = db.students.filter(s => !s.archived);
    document.getElementById('stat-centers').innerText = db.centers.length;
    document.getElementById('stat-teachers').innerText = db.teachers.length;
    document.getElementById('stat-students').innerText = activeStudents.length;

    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let inactiveList = activeStudents.filter(s => !s.date || new Date(s.date) < thirtyDaysAgo);
    const alertsContainer = document.getElementById('alerts-container'); const inactiveListDiv = document.getElementById('inactive-students-list');
    if(inactiveList.length > 0 && currentUserRole === 'admin') {
        document.getElementById('inactive-count-msg').innerText = `(${inactiveList.length}) طالب مسجل يتطلب تحديث متابعة الحفظ.`;
        inactiveListDiv.innerHTML = inactiveList.map(s => {
            const c = db.centers.find(x => x.id === s.centerId)?.name || '';
            return `<div class="border-b border-orange-100 dark:border-orange-900/50 py-2 flex justify-between items-center"><span class="font-bold text-slate-700 dark:text-slate-200">${s.name} <span class="text-xs text-slate-500 dark:text-slate-400 font-normal">(${c})</span></span><span dir="ltr" class="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300 px-2 py-1 rounded">${s.date || 'غير مسجل'}</span></div>`;
        }).join('');
        alertsContainer.classList.remove('hidden');
    } else { alertsContainer.classList.add('hidden'); }

    const mCount = activeStudents.filter(s => s.gender === 'ذكر').length; const fCount = activeStudents.filter(s => s.gender === 'أنثى').length;
    if(myCharts.gender) myCharts.gender.destroy();
    myCharts.gender = new Chart(document.getElementById('genderChart'), { type: 'doughnut', data: { labels: ['ذكور', 'إناث'], datasets: [{ data: [mCount, fCount], backgroundColor: ['#047857', '#fbbf24'], borderWidth: 0 }] }, options: { cutout: '60%', plugins: { legend: { position: 'bottom', labels:{color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#334155'} } }, maintainAspectRatio: false } });

    let centerCounts = {}; activeStudents.forEach(s => { centerCounts[s.centerId] = (centerCounts[s.centerId] || 0) + 1; });
    let sortedCenters = Object.keys(centerCounts).map(id => { return { name: db.centers.find(x => x.id === id)?.name || 'غير محدد', count: centerCounts[id] }; }).sort((a,b) => b.count - a.count).slice(0, 5); 
    if(myCharts.centers) myCharts.centers.destroy();
    myCharts.centers = new Chart(document.getElementById('centersChart'), { type: 'bar', data: { labels: sortedCenters.map(x => x.name), datasets: [{ label: 'عدد الطلبة', data: sortedCenters.map(x => x.count), backgroundColor: '#3b82f6', borderRadius: 4 }] }, options: { plugins: { legend: { display:false } }, scales: { y: { beginAtZero: true, ticks: {stepSize: 1, color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#334155'} }, x: {ticks: {color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#334155'}} }, maintainAspectRatio: false } });
}

function openCenterModal() { cancelEditCenter(); document.getElementById('center-modal-title').innerHTML = '<i class="fas fa-building ml-2 text-emerald-600"></i>تسجيل مركز جديد'; document.getElementById('centerModal').classList.remove('hidden'); }
function closeCenterModal() { document.getElementById('centerModal').classList.add('hidden'); }
function saveCenter() {
    const name = document.getElementById('center-name').value.trim(); const type = document.getElementById('center-type').value;
    if(!name) return Toast.fire({ icon: 'warning', title: 'يرجى إدخال اسم المركز' });
    if (editModes.centerId) { const cIndex = db.centers.findIndex(c => c.id === editModes.centerId); if(cIndex > -1) { db.centers[cIndex].name = name; db.centers[cIndex].type = type; } } 
    else { db.centers.unshift({ id: Date.now().toString(), name, type }); currentPage.centers = 1; }
    closeCenterModal(); saveDB(); Toast.fire({ icon: 'success', title: 'تم حفظ المركز بنجاح' });
}
function editCenter(id) {
    const c = db.centers.find(c => c.id === id); if(!c) return;
    document.getElementById('center-name').value = c.name; document.getElementById('center-type').value = c.type || 'ذكور'; editModes.centerId = id;
    document.getElementById('center-modal-title').innerHTML = '<i class="fas fa-edit ml-2 text-blue-600"></i>تعديل بيانات المركز'; document.getElementById('centerModal').classList.remove('hidden');
}
function cancelEditCenter() { editModes.centerId = null; document.getElementById('center-name').value = ''; }
function deleteCenter(id) { Swal.fire({ title: 'تأكيد الحذف', text: "هل أنت متأكد من الحذف؟", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'نعم', cancelButtonText: 'إلغاء' }).then((result) => { if (result.isConfirmed) { db.centers = db.centers.filter(c => c.id !== id); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحذف' }); } }); }
function renderCenters() {
    const search = document.getElementById('search-center').value; const tbody = document.getElementById('centers-list'); const paginationContainer = document.getElementById('centers-pagination');
    let filtered = db.centers.filter(c => c.name.includes(search));
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12"><i class="fas fa-folder-open text-5xl text-gray-200 dark:text-slate-600 mb-4 block"></i><p class="text-lg font-bold text-gray-500">لا توجد مراكز مسجلة</p></td></tr>`; paginationContainer.innerHTML = ''; return; }
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE); if(currentPage.centers > totalPages) currentPage.centers = totalPages; if(currentPage.centers < 1) currentPage.centers = 1;
    const startIdx = (currentPage.centers - 1) * ITEMS_PER_PAGE; const pagedData = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    
    tbody.innerHTML = '';
    pagedData.forEach((c, i) => {
        const actualIndex = startIdx + i + 1; const studentsCount = db.students.filter(s => s.centerId === c.id && !s.archived).length;
        const typeStyle = c.type === 'إناث' ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
        
        // تحديد الكلمة تلقائياً حسب نوع المركز
        const studentLabel = c.type === 'ذكور' ? 'طالب' : 'طالبة';
        
        const btnHtml = currentUserRole === 'admin' ? `<button onclick="editCenter('${c.id}')" class="text-blue-500 hover:text-blue-700 mx-2 transition-colors"><i class="fas fa-edit"></i></button><button onclick="deleteCenter('${c.id}')" class="text-red-500 hover:text-red-700 mx-2 transition-colors"><i class="fas fa-trash"></i></button>` : '-';
        tbody.innerHTML += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><td class="text-center font-bold text-gray-500 dark:text-slate-400 py-3">${actualIndex}</td><td class="font-bold text-slate-700 dark:text-slate-200">${c.name}</td><td class="text-center"><span class="px-3 py-1 rounded-full text-xs font-bold border ${typeStyle}">${c.type}</span></td><td class="text-center font-bold text-emerald-600 dark:text-emerald-400">${studentsCount} ${studentLabel}</td><td class="text-center text-lg">${btnHtml}</td></tr>`;
    });
    renderPaginationControls('centers', currentPage.centers, totalPages, filtered.length, startIdx, startIdx + pagedData.length);
}

function openTeacherModal() { cancelEditTeacher(); document.getElementById('teacher-modal-title').innerHTML = '<i class="fas fa-user-plus ml-2 text-emerald-600"></i>تسجيل معلم جديد'; document.getElementById('teacherModal').classList.remove('hidden'); }
function closeTeacherModal() { document.getElementById('teacherModal').classList.add('hidden'); }
function saveTeacher() {
    const t_nid = document.getElementById('t-nid').value.trim(); const t_period = document.getElementById('t-period').value;
    if(t_nid && t_period) { const conflict = db.teachers.find(x => x.nid === t_nid && x.period === t_period && x.id !== editModes.teacherId); if(conflict) return Toast.fire({icon: 'error', title: 'هذا المعلم مكلف بمركز آخر في نفس الفترة!'}); }
    const t = { id: editModes.teacherId || Date.now().toString(), name: document.getElementById('t-name').value.trim(), nid: t_nid, dob: document.getElementById('t-dob').value, type: document.getElementById('t-type').value, certified: document.getElementById('t-certified').value, payment: document.getElementById('t-payment').value, username: document.getElementById('t-username').value.trim(), password: document.getElementById('t-password').value.trim(), phone: document.getElementById('t-phone').value, period: t_period, centerId: document.getElementById('t-center').value };
    if(!t.name || !t.centerId) return Toast.fire({ icon: 'warning', title: 'يجب إدخال الاسم واختيار المركز' });
    if (editModes.teacherId) { const index = db.teachers.findIndex(x => x.id === editModes.teacherId); db.teachers[index] = t; } else { db.teachers.unshift(t); currentPage.teachers = 1; }
    closeTeacherModal(); saveDB(); Toast.fire({ icon: 'success', title: 'تم حفظ بيانات المعلم بنجاح' });
}
function editTeacher(id) {
    const t = db.teachers.find(x => x.id === id); if(!t) return;
    document.getElementById('t-name').value = t.name; document.getElementById('t-nid').value = t.nid || ''; document.getElementById('t-dob').value = t.dob || ''; document.getElementById('t-type').value = t.type; document.getElementById('t-certified').value = t.certified || 'مجاز'; document.getElementById('t-payment').value = t.payment || 'مكافأة'; document.getElementById('t-username').value = t.username || ''; document.getElementById('t-password').value = t.password || ''; filterCentersByGender('t-center', t.type === 'معلم' ? 'ذكور' : 'إناث'); document.getElementById('t-center').value = t.centerId; document.getElementById('t-phone').value = t.phone || ''; document.getElementById('t-period').value = t.period || 'صباحي';
    editModes.teacherId = id; document.getElementById('teacher-modal-title').innerHTML = '<i class="fas fa-edit ml-2 text-blue-600"></i>تعديل بيانات المعلم'; document.getElementById('teacherModal').classList.remove('hidden');
}
function cancelEditTeacher() { editModes.teacherId = null; ['t-name','t-nid','t-dob','t-phone','t-username','t-password'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; }); document.getElementById('t-type').value='معلم'; document.getElementById('t-period').value='صباحي'; filterCentersByGender('t-center', 'ذكور'); }
function deleteTeacher(id) { Swal.fire({ title: 'تأكيد الحذف', text: "هل أنت متأكد من حذف السجل نهائياً؟", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'نعم', cancelButtonText: 'إلغاء' }).then((result) => { if (result.isConfirmed) { db.teachers = db.teachers.filter(x => x.id !== id); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحذف' }); } }); }
function renderTeachers() {
    const sName = document.getElementById('search-teacher').value; const sCenter = document.getElementById('filter-t-center').value; const tbody = document.getElementById('teachers-list'); const paginationContainer = document.getElementById('teachers-pagination');
    let filtered = db.teachers.filter(t => t.name.includes(sName)); if(sCenter) filtered = filtered.filter(t => t.centerId === sCenter);
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12"><i class="fas fa-folder-open text-5xl text-gray-200 dark:text-slate-600 mb-4 block"></i><p class="text-lg font-bold text-gray-500">لا يوجد سجلات</p></td></tr>`; paginationContainer.innerHTML = ''; return; }
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE); if(currentPage.teachers > totalPages) currentPage.teachers = totalPages; if(currentPage.teachers < 1) currentPage.teachers = 1;
    const startIdx = (currentPage.teachers - 1) * ITEMS_PER_PAGE; const pagedData = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    tbody.innerHTML = '';
    pagedData.forEach(t => {
        const center = db.centers.find(c => c.id === t.centerId)?.name || '<span class="text-red-400">غير محدد</span>';
        const adminBtns = currentUserRole === 'admin' ? `<button onclick="editTeacher('${t.id}')" class="text-blue-500 hover:text-blue-700 mx-2"><i class="fas fa-edit"></i></button><button onclick="deleteTeacher('${t.id}')" class="text-red-500 hover:text-red-700 mx-2"><i class="fas fa-trash"></i></button>` : '-';
        tbody.innerHTML += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors py-2"><td class="font-bold text-slate-700 dark:text-slate-200">${t.name} <div class="text-xs text-gray-400 font-sans">يوزر: ${t.username || 'غير محدد'}</div></td><td class="font-sans text-gray-500 dark:text-slate-400">${t.dob ? t.dob : '-'}</td><td class="text-center"><span class="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1 font-bold border border-gray-200 dark:border-slate-600 rounded-full text-xs">${t.type}</span></td><td class="text-center text-sm font-bold ${t.certified==='مجاز'?'text-emerald-600':'text-orange-500'}">${t.certified||'-'}</td><td class="font-sans dark:text-slate-300" dir="ltr">${t.phone || '-'}</td><td class="font-bold text-emerald-700 dark:text-emerald-400">${center}<div class="text-xs text-slate-400">${t.period||''}</div></td><td class="text-center text-lg">${adminBtns}</td></tr>`;
    });
    renderPaginationControls('teachers', currentPage.teachers, totalPages, filtered.length, startIdx, startIdx + pagedData.length);
}

window.makeEditable = function(el, id, field) {
    if(el.querySelector('input') || currentUserRole === 'teacher') return;
    const originalText = el.innerText.trim();
    el.innerHTML = `<input type="text" class="form-input text-sm px-2 py-1 m-0 border-blue-500 w-full dark:bg-slate-800 dark:text-white" value="${originalText}" onblur="cancelInline(this, '${originalText}')" onkeydown="if(event.key === 'Enter') saveInline(this, '${id}', '${field}')" onclick="event.stopPropagation()">`;
    const input = el.querySelector('input'); input.focus(); input.select();
};
window.cancelInline = function(input, originalText) { input.parentElement.innerHTML = originalText; };
window.saveInline = function(input, id, field) {
    const newVal = input.value.trim(); if(!newVal) return cancelInline(input, '');
    const student = db.students.find(s => s.id === id);
    if(student) { student[field] = newVal; saveDB(); const td = input.parentElement; td.innerHTML = newVal + ' <i class="fas fa-check-circle text-green-500 text-xs ml-1 animate-pulse absolute mt-1"></i>'; setTimeout(() => { td.innerHTML = newVal; }, 1500); }
};

function openStudentModal() { 
    cancelEditStudent(); 
    document.getElementById('student-modal-title').innerHTML = '<i class="fas fa-book-reader ml-2 text-emerald-600"></i>تسجيل طالب جديد'; 
    const centerDropdown = document.getElementById('s-center');
    if (currentUserRole === 'teacher') {
        const myCenterId = localStorage.getItem('awqaf_center_id');
        centerDropdown.value = myCenterId; centerDropdown.disabled = true; centerDropdown.classList.add('bg-gray-200', 'dark:bg-slate-700', 'cursor-not-allowed', 'opacity-70');
    } else {
        centerDropdown.disabled = false; centerDropdown.classList.remove('bg-gray-200', 'dark:bg-slate-700', 'cursor-not-allowed', 'opacity-70');
    }
    document.getElementById('studentModal').classList.remove('hidden'); 
}
function closeStudentModal() { document.getElementById('studentModal').classList.add('hidden'); }
function saveStudent() {
    const currentSurah = document.getElementById('s-surah').value; const currentDate = document.getElementById('s-date').value || new Date().toISOString().split('T')[0];
    let targetCenterId = document.getElementById('s-center').value;
    if(currentUserRole === 'teacher') targetCenterId = localStorage.getItem('awqaf_center_id'); // تأكيد أمني إضافي للمعلم
    let s = { id: editModes.studentId || Date.now().toString(), name: document.getElementById('s-name').value.trim(), dob: document.getElementById('s-dob').value, gender: document.getElementById('s-gender').value, centerId: targetCenterId, riwaya: document.getElementById('s-riwaya').value, surah: currentSurah, date: currentDate, archived: false, completionDate: '', history: [] };
    if(!s.name || !s.centerId) return Toast.fire({ icon: 'warning', title: 'يجب إدخال اسم الطالب واختيار المركز' });
    if (editModes.studentId) { const index = db.students.findIndex(x => x.id === editModes.studentId); const oldStudent = db.students[index]; s.archived = oldStudent.archived; s.completionDate = oldStudent.completionDate; s.history = oldStudent.history || []; const lastRecord = s.history.length > 0 ? s.history[s.history.length - 1] : null; if (!lastRecord || lastRecord.surah !== currentSurah) { s.history.push({ surah: currentSurah, date: currentDate }); } db.students[index] = s; } 
    else { if(currentSurah) s.history.push({ surah: currentSurah, date: currentDate }); db.students.unshift(s); currentPage.students = 1; }
    closeStudentModal(); saveDB(); Toast.fire({ icon: 'success', title: 'تم حفظ بيانات الطالب بنجاح' });
}
function editStudent(id) {
    const s = db.students.find(x => x.id === id); if(!s) return;
    document.getElementById('s-name').value = s.name; document.getElementById('s-dob').value = s.dob || ''; document.getElementById('s-gender').value = s.gender || 'ذكر'; filterCentersByGender('s-center', s.gender === 'ذكر' ? 'ذكور' : 'إناث'); document.getElementById('s-center').value = s.centerId; document.getElementById('s-riwaya').value = s.riwaya || 'قالون عن نافع'; document.getElementById('s-surah').value = s.surah || ''; document.getElementById('s-date').value = s.date || ''; 
    editModes.studentId = id; document.getElementById('student-modal-title').innerHTML = '<i class="fas fa-edit ml-2 text-blue-600"></i>تحديث بيانات الطالب'; document.getElementById('studentModal').classList.remove('hidden');
}
function cancelEditStudent() { editModes.studentId = null; ['s-name','s-dob','s-surah','s-date'].forEach(id => document.getElementById(id).value=''); document.getElementById('s-gender').value='ذكر'; filterCentersByGender('s-center', 'ذكور'); }
function graduateStudent(id) {
    const s = db.students.find(x => x.id === id); if(!s) return;
    if(!s.archived) { Swal.fire({ title: 'تتويج بختم القرآن', input: 'date', inputLabel: 'تاريخ إتمام الختم', inputValue: new Date().toISOString().split('T')[0], showCancelButton: true, confirmButtonText: 'حفظ بالأرشيف', cancelButtonText: 'إلغاء' }).then((result) => { if(result.isConfirmed && result.value) { s.archived = true; s.completionDate = result.value; saveDB(); Swal.fire({ icon: 'success', title: 'مبارك!', text: 'تم نقل الطالب إلى أرشيف الخاتمين' }); } }); } 
    else { Swal.fire({ title: 'إلغاء صفة الختم', text: "هل تريد إرجاعه للطلاب المستمرين؟", icon: 'question', showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء' }).then((result) => { if (result.isConfirmed) { s.archived = false; s.completionDate = ''; saveDB(); Toast.fire({ icon: 'success', title: 'تم الاسترجاع بنجاح' }); } }); }
}
function deleteStudentFinal(id) { Swal.fire({ title: 'حذف نهائي', text: "تأكيد؟", icon: 'error', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'نعم', cancelButtonText: 'إلغاء' }).then((result) => { if (result.isConfirmed) { db.students = db.students.filter(x => x.id !== id); saveDB(); Toast.fire({ icon: 'success', title: 'تم مسح السجل نهائياً' }); } }); }
function renderStudents() {
    const sName = document.getElementById('search-student').value; const sCenter = document.getElementById('filter-s-center').value; const tbody = document.getElementById('students-list'); const paginationContainer = document.getElementById('students-pagination');
    let filtered = db.students.filter(s => !s.archived && s.name.includes(sName)); if(sCenter) filtered = filtered.filter(s => s.centerId === sCenter);
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12"><i class="fas fa-folder-open text-5xl text-gray-200 dark:text-slate-600 mb-4 block"></i><p class="text-lg font-bold text-gray-500">لا يوجد طلاب مسجلين</p></td></tr>`; paginationContainer.innerHTML = ''; return; }
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE); if(currentPage.students > totalPages) currentPage.students = totalPages; if(currentPage.students < 1) currentPage.students = 1;
    const startIdx = (currentPage.students - 1) * ITEMS_PER_PAGE; const pagedData = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    tbody.innerHTML = '';
    pagedData.forEach(s => {
        const center = db.centers.find(c => c.id === s.centerId)?.name || '<span class="text-red-400">غير محدد</span>';
        tbody.innerHTML += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><td class="font-bold text-slate-800 dark:text-slate-200 py-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 relative" title="انقر مرتين للتعديل السريع" ondblclick="makeEditable(this, '${s.id}', 'name')">${s.name}</td><td class="text-slate-600 dark:text-slate-400">${calculateAge(s.dob)}</td><td class="font-bold text-emerald-700 dark:text-emerald-400">${center}</td><td class="font-bold text-blue-700 dark:text-blue-400"><span class="bg-blue-50 dark:bg-slate-800 px-3 py-1 rounded-full">${s.surah ? 'سورة ' + s.surah : 'بدون'}</span></td><td class="text-center text-lg whitespace-nowrap"><button onclick="printIDCard('${s.id}')" class="text-teal-500 hover:text-teal-700 mx-1" title="بطاقة تعريف"><i class="fas fa-id-card"></i></button><button onclick="printCertificate('${s.id}')" class="text-yellow-500 hover:text-yellow-600 mx-1" title="شهادة"><i class="fas fa-award"></i></button><button onclick="editStudent('${s.id}')" class="text-blue-500 hover:text-blue-700 mx-1" title="تعديل شامل"><i class="fas fa-edit"></i></button>${currentUserRole === 'admin' ? `<button onclick="graduateStudent('${s.id}')" class="text-orange-500 hover:text-orange-700 mx-1" title="ختم القرآن"><i class="fas fa-graduation-cap"></i></button><button onclick="deleteStudentFinal('${s.id}')" class="text-red-500 hover:text-red-700 mx-1" title="حذف"><i class="fas fa-trash"></i></button>` : ''}</td></tr>`;
    });
    renderPaginationControls('students', currentPage.students, totalPages, filtered.length, startIdx, startIdx + pagedData.length);
}

function renderArchive() {
    const container = document.getElementById('archive-container'); container.innerHTML = ''; const selectedCenter = document.getElementById('filter-archive-center').value;
    let archStudents = db.students.filter(s => s.archived); if(selectedCenter) archStudents = archStudents.filter(s => s.centerId === selectedCenter);
    const groups = {}; archStudents.forEach(s => { if(!groups[s.centerId]) groups[s.centerId] = []; groups[s.centerId].push(s); });
    if(Object.keys(groups).length === 0) { container.innerHTML = '<div class="text-center p-10 text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl"><i class="fas fa-folder-open text-4xl mb-3 text-gray-300 dark:text-slate-600 block"></i>لا توجد سجلات لخاتمين.</div>'; return; }
    for(const cid in groups) {
        const c = db.centers.find(x => x.id === cid); const cName = c ? c.name : 'مركز غير محدد';
        let tableHtml = `<div class="card mb-6 shadow-sm dark:bg-slate-800 dark:border-slate-700"><div class="bg-emerald-800 dark:bg-emerald-900 text-white p-4 font-bold flex justify-between items-center rounded-t-xl"><span><i class="fas fa-mosque ml-2 text-emerald-200"></i>${cName}</span><span class="bg-white text-emerald-800 px-3 py-1 rounded-full text-sm shadow-sm">${groups[cid].length} خاتم/ة</span></div><div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200 dark:divide-slate-700"><thead class="bg-emerald-50 dark:bg-slate-700"><tr><th class="text-emerald-900 dark:text-slate-200">الخاتم / الخاتمة</th><th class="text-emerald-900 dark:text-slate-200">العمر</th><th class="text-emerald-900 dark:text-slate-200">تاريخ الختم</th><th class="text-center text-emerald-900 dark:text-slate-200">الإجراءات</th></tr></thead><tbody class="divide-y divide-gray-100 dark:divide-slate-700">`;
        groups[cid].forEach(s => { tableHtml += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700 py-2"><td class="font-bold text-slate-800 dark:text-slate-200">${s.name}</td><td class="text-gray-500 dark:text-slate-400">${calculateAge(s.dob)}</td><td class="font-bold text-emerald-700 dark:text-emerald-400" dir="ltr">${s.completionDate || '-'}</td><td class="text-center text-lg"><button onclick="printCertificate('${s.id}')" class="text-yellow-500 hover:text-yellow-600 mx-1"><i class="fas fa-award"></i></button><button onclick="editStudent('${s.id}')" class="text-blue-500 hover:text-blue-700 mx-1"><i class="fas fa-edit"></i></button><button onclick="graduateStudent('${s.id}')" class="text-gray-400 hover:text-gray-200 mx-1"><i class="fas fa-undo"></i></button><button onclick="deleteStudentFinal('${s.id}')" class="text-red-500 hover:text-red-700 mx-1"><i class="fas fa-trash"></i></button></td></tr>`; });
        tableHtml += `</tbody></table></div></div>`; container.innerHTML += tableHtml;
    }
}

function printCustomReport() {
    const cid = document.getElementById('rep-custom-center').value; const minAge = parseInt(document.getElementById('rep-age-min').value) || 0; const maxAge = parseInt(document.getElementById('rep-age-max').value) || 100;
    let filtered = db.students.filter(s => !s.archived); if(cid) filtered = filtered.filter(s => s.centerId === cid);
    filtered = filtered.filter(s => { if(!s.dob) return false; const ageStr = calculateAge(s.dob); const age = parseInt(ageStr.replace('سنة','')); return age >= minAge && age <= maxAge; });
    if(filtered.length === 0) return Swal.fire({icon:'info', title:'لا توجد نتائج', text:'لم يتم العثور على طلاب بهذه الفئة العمرية', confirmButtonColor: '#047857'});
    let html = `<h3 style="font-size:18px; font-weight:bold; margin-bottom:20px; text-align:center; background:#f1f5f9; padding:10px; border:1px solid #cbd5e1;">تقرير مخصص (الأعمار بين ${minAge} و ${maxAge})</h3><table style="width:100%; border-collapse:collapse; text-align:center; font-size:14px;" border="1"><thead style="background:#e2e8f0;"><tr><th style="padding:8px; border:1px solid #94a3b8; width:40px;">ت</th><th style="padding:8px; border:1px solid #94a3b8;">اسم الطالب</th><th style="padding:8px; border:1px solid #94a3b8;">العمر</th><th style="padding:8px; border:1px solid #94a3b8;">المركز</th><th style="padding:8px; border:1px solid #94a3b8;">أين واصل؟</th></tr></thead><tbody>`;
    filtered.forEach((s, i) => { const c = db.centers.find(x => x.id === s.centerId)?.name || '-'; html += `<tr><td style="padding:8px; border:1px solid #94a3b8;">${i+1}</td><td style="padding:8px; border:1px solid #94a3b8; font-weight:bold;">${s.name}</td><td style="padding:8px; border:1px solid #94a3b8;">${calculateAge(s.dob)}</td><td style="padding:8px; border:1px solid #94a3b8;">${c}</td><td style="padding:8px; border:1px solid #94a3b8;">${s.surah || '-'}</td></tr>`; });
    html += `</tbody></table>`; openPrintView(html);
}

function exportToExcel(tableId, sheetName) {
    let table = document.getElementById(tableId); if(!table) return;
    let clone = table.cloneNode(true); clone.querySelectorAll('tr').forEach(row => { if(row.children.length > 0) row.removeChild(row.lastElementChild); });
    let ws = XLSX.utils.table_to_sheet(clone); ws['!dir'] = 'rtl'; if(ws['!ref']) { ws['!autofilter'] = { ref: ws['!ref'] }; }
    const colWidths = [{ wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 20 }]; ws['!cols'] = colWidths;
    let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `كشف_${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`); Toast.fire({ icon: 'success', title: 'تم التصدير' });
}

function exportData() { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db)); const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", "Awqaf_Sirte_Backup_" + new Date().toISOString().split('T')[0] + ".json"); document.body.appendChild(dl); dl.click(); dl.remove(); }
function importData(event) { const file = event.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = function(e) { try { const imported = JSON.parse(e.target.result); if(imported.centers && imported.students) { db = imported; saveDB(); Swal.fire({ icon: 'success', title: 'استعادة ناجحة', confirmButtonColor: '#047857' }).then(() => window.location.reload()); } else throw new Error('ملف خاطئ'); } catch(err) { Swal.fire({ icon: 'error', title: 'خطأ', text: 'الملف تالف' }); } }; reader.readAsText(file); }

function openPrintView(content, skipHeader = false) {
    const printArea = document.getElementById('print-area'); const dateStr = new Date().toLocaleString('ar-LY');
    const footer = skipHeader ? '' : `<div style="margin-top: 40px; text-align: right; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; font-weight:bold;">طبع بواسطة منظومة شؤون المراكز - تاريخ الطباعة: ${dateStr}</div>`;
    const header = skipHeader ? '' : `<div style="text-align:center; margin-bottom:30px; border-bottom:3px double #1e293b; padding-bottom:15px;"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Emblem_of_Libya.svg/200px-Emblem_of_Libya.svg.png" style="width: 70px; margin: 0 auto 10px; filter: grayscale(100%);"><h2 style="font-size:22px; font-weight:bold; font-family:'Amiri', serif; margin:0 0 5px 0;">وزارة الأوقاف والشؤون الإسلامية</h2><h3 style="font-size:18px; font-weight:bold; margin:0 0 5px 0; color:#334155;">مكتب أوقاف سرت</h3><h4 style="font-size:16px; font-weight:bold; margin:0; color:#475569;">قسم القرآن الكريم والسنة النبوية</h4></div>`;
    printArea.innerHTML = header + content + footer; printArea.classList.remove('hidden'); window.print(); printArea.classList.add('hidden');
}

function printCenters(targetType) {
    const list = db.centers.filter(c => c.type === targetType); if(list.length === 0) return alert('لا توجد مراكز مسجلة.');
    let html = `<h3 style="font-size:18px; font-weight:bold; margin-bottom:20px; text-align:center; background:#f1f5f9; padding:10px; border:1px solid #cbd5e1;">كشف المراكز المعتمدة (${targetType})</h3><table style="width:100%; border-collapse:collapse; text-align:center;" border="1"><thead style="background:#e2e8f0;"><tr><th style="padding:10px; border:1px solid #94a3b8; width:60px;">الرقم</th><th style="padding:10px; border:1px solid #94a3b8;">اسم المركز / المسجد</th><th style="padding:10px; border:1px solid #94a3b8; width:120px;">الطلبة</th></tr></thead><tbody>`;
    list.forEach((c, i) => { const stdCount = db.students.filter(s => s.centerId === c.id && !s.archived).length; html += `<tr><td style="padding:10px; border:1px solid #94a3b8; font-weight:bold;">${i+1}</td><td style="padding:10px; border:1px solid #94a3b8; font-weight:bold; font-size:16px;">${c.name}</td><td style="padding:10px; border:1px solid #94a3b8;">${stdCount}</td></tr>`; });
    html += `</tbody></table>`; openPrintView(html);
}

function printSingleCenter() {
    const cid = document.getElementById('report-center').value; if(!cid) return alert('الرجاء اختيار مركز');
    const center = db.centers.find(c => c.id === cid); 
    const students = db.students.filter(s => s.centerId === cid && !s.archived); 
    const staff = db.teachers.filter(t => t.centerId === cid);
    
    // تحديد المسمى تلقائياً حسب نوع المركز
    const labelSingle = center.type === 'ذكور' ? 'طالب' : 'طالبة';
    const labelPlural = center.type === 'ذكور' ? 'الطلاب' : 'الطالبات';

    let html = `
        <div style="margin-bottom:25px; display:flex; flex-wrap:wrap; gap:15px; font-weight:bold; background:#f8fafc; padding:15px; border:2px solid #047857; border-radius:8px;">
            <div style="flex:1; min-width:45%;">المركز: <span style="color:#047857;">${center.name} (${center.type})</span></div>
            <div style="flex:1; min-width:45%;">عدد ${labelPlural}: <span style="color:#047857;">${students.length} ${labelSingle}</span></div>
            <div style="flex:100%;">الكادر: <span style="color:#047857;">${staff.map(t=>t.name + ' ('+t.type+')').join(' ، ') || 'لا يوجد كادر'}</span></div>
        </div>
        <table style="width:100%; border-collapse:collapse; text-align:center; font-size:14px;" border="1">
            <thead style="background:#e2e8f0;">
                <tr>
                    <th style="padding:8px; border:1px solid #94a3b8; width:40px;">ت</th>
                    <th style="padding:8px; border:1px solid #94a3b8;">اسم الـ${labelSingle}</th>
                    <th style="padding:8px; border:1px solid #94a3b8; width:80px;">العمر</th>
                    <th style="padding:8px; border:1px solid #94a3b8; width:100px;">الرواية</th>
                    <th style="padding:8px; border:1px solid #94a3b8; width:100px;">أين واصل؟</th>
                </tr>
            </thead>
            <tbody>
    `;
    students.forEach((s, i) => { 
        html += `<tr><td style="padding:8px; border:1px solid #94a3b8;">${i+1}</td><td style="padding:8px; border:1px solid #94a3b8; font-weight:bold; text-align:right;">${s.name}</td><td style="padding:8px; border:1px solid #94a3b8;">${calculateAge(s.dob)}</td><td style="padding:8px; border:1px solid #94a3b8;">${s.riwaya || '-'}</td><td style="padding:8px; border:1px solid #94a3b8; font-weight:bold;">${s.surah ? 'سورة ' + s.surah : '-'}</td></tr>`; 
    });
    html += `</tbody></table>`; 
    openPrintView(html);
}

function printTeachers(type) {
    const filtered = db.teachers.filter(t => t.type === type); if(filtered.length === 0) return alert('لا يوجد سجلات.');
    let html = `<h3 style="font-size:18px; font-weight:bold; margin-bottom:20px; text-align:center; background:#f1f5f9; padding:10px; border:1px solid #cbd5e1;">كشف الكادر التعليمي (${type === 'معلم' ? 'الذكور' : 'الإناث'})</h3><table style="width:100%; border-collapse:collapse; text-align:center; font-size:14px;" border="1"><thead style="background:#e2e8f0;"><tr><th style="padding:8px; border:1px solid #94a3b8; width:40px;">ت</th><th style="padding:8px; border:1px solid #94a3b8; width:110px;">الرقم الوطني</th><th style="padding:8px; border:1px solid #94a3b8;">الاسم الرباعي</th><th style="padding:8px; border:1px solid #94a3b8; width:110px;">الهاتف</th><th style="padding:8px; border:1px solid #94a3b8; width:150px;">المركز</th></tr></thead><tbody>`;
    filtered.forEach((t, i) => { const center = db.centers.find(c => c.id === t.centerId)?.name || '-'; html += `<tr><td style="padding:8px; border:1px solid #94a3b8;">${i+1}</td><td style="padding:8px; border:1px solid #94a3b8; font-family:sans-serif;">${t.nid || '-'}</td><td style="padding:8px; border:1px solid #94a3b8; font-weight:bold; text-align:right;">${t.name}</td><td style="padding:8px; border:1px solid #94a3b8;" dir="ltr">${t.phone || '-'}</td><td style="padding:8px; border:1px solid #94a3b8; font-weight:bold;">${center} (${t.period||''})</td></tr>`; });
    html += `</tbody></table>`; openPrintView(html);
}

function printArchive() {
    const selectedCenter = document.getElementById('filter-archive-center').value; let archStudents = db.students.filter(s => s.archived); if(selectedCenter) archStudents = archStudents.filter(s => s.centerId === selectedCenter);
    if(archStudents.length === 0) return alert('لا توجد بيانات لطباعتها.'); const groups = {}; archStudents.forEach(s => { if(!groups[s.centerId]) groups[s.centerId] = []; groups[s.centerId].push(s); });
    let html = '';
    for(const cid in groups) {
        const c = db.centers.find(x => x.id === cid); const cName = c ? c.name : 'مركز غير محدد';
        html += `<div style="page-break-inside: avoid; margin-bottom: 40px;"><h3 style="background:#047857; color:white; padding:10px; text-align:center; font-weight:bold; border-radius:5px; margin-bottom:15px;">كشف الخاتمين - ${cName}</h3><table style="width:100%; border-collapse:collapse; text-align:center; font-size:14px;" border="1"><thead style="background:#f1f5f9;"><tr><th style="padding:10px; border:1px solid #cbd5e1; width:50px;">ت</th><th style="padding:10px; border:1px solid #cbd5e1;">الاسم</th><th style="padding:10px; border:1px solid #cbd5e1; width:120px;">الرواية</th><th style="padding:10px; border:1px solid #cbd5e1; width:150px;">تاريخ الختم</th></tr></thead><tbody>`;
        groups[cid].forEach((s, i) => { html += `<tr><td style="padding:8px; border:1px solid #cbd5e1;">${i+1}</td><td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; text-align:right;">${s.name}</td><td style="padding:8px; border:1px solid #cbd5e1;">${s.riwaya || '-'}</td><td style="padding:8px; border:1px solid #cbd5e1;" dir="ltr">${s.completionDate || '-'}</td></tr>`; });
        html += `</tbody></table></div>`;
    }
    openPrintView(html);
}

function printCertificate(id) {
    const s = db.students.find(x => x.id === id); if(!s) return; const c = db.centers.find(x => x.id === s.centerId);
    let achievementText = s.archived ? `وذلك تقديراً لإتمامه حفظ <strong>القرآن الكريم كاملاً</strong> (برواية ${s.riwaya || 'قالون عن نافع'}) بتاريخ (${s.completionDate}).` : `وذلك تقديراً لاجتهاده ومثابرته في الحفظ ووصوله إلى سورة (<strong>${s.surah || '---'}</strong>).`;
    const html = `<div class="certificate"><img src="assets/images/emblem.png" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Emblem_of_Libya.svg/200px-Emblem_of_Libya.svg.png'" style="width: 80px; margin: 0 auto; filter: sepia(1);"><h1 style="color: #065f46; font-size: 34px; font-weight: bold; margin-top: 25px; font-family: 'Amiri', serif;">شهادة ${s.archived ? 'إتمام حفظ كتاب الله' : 'تقدير وتفوق'}</h1><p style="font-size: 20px; margin-top: 40px; line-height: 2;">يسر قسم القرآن الكريم والسنة النبوية بمكتب أوقاف سرت أن يمنح هذه الشهادة لـ ${s.gender==='أنثى'?'الطالبة':'الطالب'}:<br><strong style="font-size: 30px; color: #1e293b; display: block; margin: 20px 0; text-decoration:underline;">${s.name}</strong></p><p style="font-size: 18px; margin-top: 15px; line-height:1.8;">المقيد بمركز: <strong>${c.name}</strong><br>${achievementText}</p><p style="font-size: 18px; margin-top: 30px;">نسأل الله العظيم أن يجعله من أهل القرآن الذين هم أهل الله وخاصته وأن ينفع به الإسلام والمسلمين.</p><div style="margin-top: 100px; display: flex; justify-content: space-between; padding: 0 60px;"><div style="text-align: center; font-weight: bold; font-size: 18px;">معلم الحلقة<br>..........................</div><div style="text-align: center; font-weight: bold; font-size: 18px;">رئيس قسم القرآن والسنة<br>..........................</div></div></div>`;
    openPrintView(html, true); 
}

function printIDCard(id) {
    const s = db.students.find(x => x.id === id); if(!s) return; const c = db.centers.find(x => x.id === s.centerId);
    const html = `<div style="display:flex; justify-content:center; padding-top: 50px;"><div class="id-card"><div class="id-card-header"><img src="assets/images/emblem.png" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Emblem_of_Libya.svg/200px-Emblem_of_Libya.svg.png'"><h4>وزارة الأوقاف والشؤون الإسلامية</h4><h4 style="color:#000;">مكتب أوقاف سرت</h4></div><div class="id-card-body"><div style="flex:1; padding-left:10px;"><div style="margin-bottom:4px;"><strong>الاسم:</strong> ${s.name}</div><div style="margin-bottom:4px;"><strong>المركز:</strong> ${c.name}</div><div><strong>الرواية:</strong> ${s.riwaya || 'قالون'}</div></div><div class="photo-box">صورة <br>شخصية</div></div><div class="id-card-footer">قسم القرآن الكريم والسنة النبوية</div></div></div>`;
    openPrintView(html, true);
}
// ===================== قسم الحضور والغياب الشهري =====================
document.addEventListener("DOMContentLoaded", () => {
    const today = new Date().toISOString().slice(0, 7); // تنسيق YYYY-MM
    const attMonthInput = document.getElementById('attendance-month');
    const repAttMonthInput = document.getElementById('rep-att-month');
    if(attMonthInput) attMonthInput.value = today;
    if(repAttMonthInput) repAttMonthInput.value = today;
});

function renderAttendanceTable() {
    const month = document.getElementById('attendance-month').value || new Date().toISOString().slice(0, 7);
    const centerSelect = document.getElementById('attendance-center');
    const selectedCenterId = centerSelect ? centerSelect.value : '';
    const tbody = document.getElementById('attendance-list');
    
    let students = db.students.filter(s => !s.archived);
    
    // إذا كان المستخدم معلماً، نجبره على رؤية مركزه فقط
    if (currentUserRole === 'teacher') {
        const myCenterId = localStorage.getItem('awqaf_center_id');
        students = students.filter(s => s.centerId === myCenterId);
    } 
    // أما إذا كان مديراً، فنقوم بفلترة الطلاب حسب المركز الذي اختاره من القائمة
    else if (selectedCenterId) {
        students = students.filter(s => s.centerId === selectedCenterId);
    } else {
        // إذا لم يختار المدير أي مركز بعد
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-gray-400 font-bold"><i class="fas fa-arrow-up text-xl mb-2 block"></i>الرجاء اختيار المركز لعرض طلابه وسجل حضورهم.</td></tr>`;
        return;
    }

    if(students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-gray-400 font-bold">لا توجد بيانات طلاب مسجلة في هذا المركز.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    students.forEach(s => {
        if(!s.attendance) s.attendance = {};
        if(!s.attendance[month]) s.attendance[month] = { present: 0, absent: 0, excused: 0 };

        const att = s.attendance[month];
        const totalDays = (att.present + att.absent + att.excused) || 1;
        const percentage = Math.round((att.present / totalDays) * 100);

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <td class="font-bold text-slate-800 dark:text-slate-200 py-3">${s.name}</td>
                <td class="text-center">
                    <input type="number" min="0" value="${att.present}" class="form-input w-24 text-center mx-auto dark:bg-slate-900 dark:border-slate-600 dark:text-white" onchange="updateAttendance('${s.id}', '${month}', 'present', this.value)">
                </td>
                <td class="text-center">
                    <input type="number" min="0" value="${att.absent}" class="form-input w-24 text-center mx-auto dark:bg-slate-900 dark:border-slate-600 dark:text-white" onchange="updateAttendance('${s.id}', '${month}', 'absent', this.value)">
                </td>
                <td class="text-center">
                    <input type="number" min="0" value="${att.excused}" class="form-input w-24 text-center mx-auto dark:bg-slate-900 dark:border-slate-600 dark:text-white" onchange="updateAttendance('${s.id}', '${month}', 'excused', this.value)">
                </td>
                <td class="text-center font-bold text-emerald-600 dark:text-emerald-400">
                    <span class="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">${percentage}%</span>
                </td>
            </tr>
        `;
    });
}

function updateAttendance(studentId, month, field, value) {
    const student = db.students.find(s => s.id === studentId);
    if(student) {
        if(!student.attendance) student.attendance = {};
        if(!student.attendance[month]) student.attendance[month] = { present: 0, absent: 0, excused: 0 };
        
        student.attendance[month][field] = parseInt(value) || 0;
        saveDB(); // حفظ تلقائي في قاعدة البيانات والسيرفر
        Toast.fire({ icon: 'success', title: 'تم تحديث وحفظ السجل' });
    }
}

function printAttendanceSheet() {
    const month = document.getElementById('attendance-month')?.value || document.getElementById('rep-att-month')?.value || new Date().toISOString().slice(0, 7);
    
    // جلب المركز من شاشة الحضور أو من شاشة التقارير أيهما قيد الاستخدام
    const centerSelectAtt = document.getElementById('attendance-center');
    const centerSelectRep = document.getElementById('rep-att-center');
    const selectedCenterId = (centerSelectAtt && centerSelectAtt.value) ? centerSelectAtt.value : (centerSelectRep ? centerSelectRep.value : '');

    let students = db.students.filter(s => !s.archived);

    if (currentUserRole === 'teacher') {
        const myCenterId = localStorage.getItem('awqaf_center_id');
        students = students.filter(s => s.centerId === myCenterId);
    } else if (selectedCenterId) {
        students = students.filter(s => s.centerId === selectedCenterId);
    } else {
        return Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'الرجاء اختيار المركز أولاً لطباعة كشفه المخصص.', confirmButtonColor: '#047857' });
    }

    if(students.length === 0) return Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا توجد بيانات طلاب مسجلة في هذا المركز للطباعة.', confirmButtonColor: '#047857' });

   const centerId = currentUserRole === 'teacher' ? localStorage.getItem('awqaf_center_id') : selectedCenterId;
    const center = db.centers.find(c => c.id === centerId) || { name: 'المركز المحدد', type: 'ذكور' };
    
    // تكييف التسمية في ورقة الطباعة تلقائياً
    const studentLabel = center.type === 'ذكور' ? 'طالب' : 'طالبة';

    let html = `
        <div style="margin-bottom:20px; background:#f8fafc; padding:15px; border:2px solid #047857; border-radius:8px; font-weight:bold;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span>اسم المركز / المسجد: <span style="color:#047857;">${center.name} (${center.type})</span></span>
                <span>الشهر المستهدف: <span style="color:#047857;" dir="ltr">${month}</span></span>
            </div>
            <div>إجمالي عدد الطلاب المسجلين بالمركز: <span style="color:#047857;">${students.length} ${studentLabel}</span></div>
        </div>
        <h3 style="font-size:18px; font-weight:bold; margin-bottom:15px; text-align:center; background:#e2e8f0; padding:10px;">كشف الحضور والغياب الشهري المعتمد</h3>
...
        <table style="width:100%; border-collapse:collapse; text-align:center; font-size:14px;" border="1">
            <thead style="background:#f1f5f9;">
                <tr>
                    <th style="padding:8px; border:1px solid #94a3b8; width:40px;">ت</th>
                    <th style="padding:8px; border:1px solid #94a3b8; text-align:right;">اسم الطالب / الطالبة</th>
                    <th style="padding:8px; border:1px solid #94a3b8; width:90px;">أيام الحضور</th>
                    <th style="padding:8px; border:1px solid #94a3b8; width:90px;">أيام الغياب</th>
                    <th style="padding:8px; border:1px solid #94a3b8; width:90px;">الأعذار</th>
                    <th style="padding:8px; border:1px solid #94a3b8; width:100px;">نسبة الالتزام</th>
                </tr>
            </thead>
            <tbody>
    `;

    students.forEach((s, i) => {
        const att = (s.attendance && s.attendance[month]) ? s.attendance[month] : { present: 0, absent: 0, excused: 0 };
        const totalDays = (att.present + att.absent + att.excused) || 1;
        const percentage = Math.round((att.present / totalDays) * 100) + '%';

        html += `
            <tr>
                <td style="padding:8px; border:1px solid #94a3b8;">${i+1}</td>
                <td style="padding:8px; border:1px solid #94a3b8; font-weight:bold; text-align:right;">${s.name}</td>
                <td style="padding:8px; border:1px solid #94a3b8; color:#047857; font-weight:bold;">${att.present}</td>
                <td style="padding:8px; border:1px solid #94a3b8; color:#dc2626; font-weight:bold;">${att.absent}</td>
                <td style="padding:8px; border:1px solid #94a3b8; color:#d97706;">${att.excused}</td>
                <td style="padding:8px; border:1px solid #94a3b8; font-weight:bold;">${percentage}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    openPrintView(html);
}
