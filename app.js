let db = { centers: [], teachers: [], students: [], messages: [], assistants: [] };
let currentUserRole = localStorage.getItem('awqaf_auth') || 'guest'; 
let editModes = { centerId: null, teacherId: null, studentId: null };
let pendingMsgFile = null;
const ITEMS_PER_PAGE = 10;
let currentPage = { centers: 1, teachers: 1, students: 1 };
let myCharts = {};

const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
const quranSurahs = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const getAuthHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('awqaf_token') });

// نظام التنقل الذكي بزر Enter
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const t = e.target;
        if (['INPUT', 'SELECT', 'DATE', 'TIME'].includes(t.tagName)) {
            if(t.id === 'msg-input' || t.id.startsWith('search-') || t.type === 'file') return; 
            e.preventDefault();
            const form = t.closest('.grid, .card-body, .p-6, .flex');
            if (form) {
                const focusable = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled])'));
                const idx = focusable.indexOf(t);
                if (idx > -1 && idx < focusable.length - 1) focusable[idx + 1].focus();
                else { const btn = (t.closest('.bg-white') || form).querySelector('.btn-primary'); if (btn) btn.click(); }
            }
        }
    }
});

function toggleDarkMode() { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; }
function calculateAge(d) { if(!d) return '-'; const age = Math.abs(new Date(Date.now() - new Date(d).getTime()).getUTCFullYear() - 1970); return age ? age + ' سنة' : '-'; }
function filterCentersByGender(id, g) { const d = document.getElementById(id); if(!d) return; const v = d.value; d.innerHTML = '<option value="">-- الاختيار --</option>' + db.centers.filter(c=>c.type===g).map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); if(db.centers.find(c=>c.id===v && c.type===g)) d.value = v; }

async function fetchDB() {
    try {
        const res = await fetch('/api/data', { headers: getAuthHeaders() });
        if (res.status === 401 || res.status === 403) { if(currentUserRole !== 'guest') logout(); return; }
        if (!res.ok) throw new Error('Error');
        db = await res.json(); renderAll();
    } catch (e) { Toast.fire({ icon: 'info', title: 'جاري الاتصال..' }); }
}

async function saveDB() {
    if (currentUserRole === 'viewer') return; 
    populateCenterDropdowns(); renderCenters(); renderTeachers(); renderStudents(); renderArchive(); if(document.getElementById('dashboard').classList.contains('active')) renderDashboard(); if(document.getElementById('permissions').classList.contains('active')) renderPermissions();
    try {
        const res = await fetch('/api/data', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(db) });
        if (res.status === 401 || res.status === 403) logout();
    } catch(e) {}
}

function updateUIRoleDisplay() {
    let roleText = 'المدير العام'; 
    if(currentUserRole === 'entry') roleText = 'مساعد مدير'; 
    if(currentUserRole === 'viewer') roleText = 'مستخدم مشاهد'; 
    if(currentUserRole === 'teacher') roleText = 'معلم حلقة';
    
    document.getElementById('user-role-badge').innerText = roleText;
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = (currentUserRole === 'admin' || currentUserRole === 'entry' || currentUserRole === 'viewer') ? '' : 'none');
    document.querySelectorAll('.strict-admin-only').forEach(el => el.style.display = (currentUserRole === 'admin') ? '' : 'none');
    document.querySelectorAll('.editor-only').forEach(el => el.style.display = (currentUserRole === 'admin' || currentUserRole === 'entry') ? '' : 'none');
}

window.onload = async () => { if (currentUserRole !== 'guest' && localStorage.getItem('awqaf_token')) { await fetchDB(); document.getElementById('login-screen').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden'); updateUIRoleDisplay(); initApp(); } else document.getElementById('login-screen').classList.remove('hidden'); };

async function login() {
    const u = document.getElementById('username').value.trim(); const p = document.getElementById('password').value.trim(); if(!u || !p) return;
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        const data = await res.json();
        if(data.success) {
            localStorage.setItem('awqaf_token', data.token); localStorage.setItem('awqaf_auth', data.role);
            if(data.role === 'teacher') { localStorage.setItem('awqaf_center_id', data.centerId); localStorage.setItem('awqaf_teacher_id', JSON.parse(atob(data.token.split('.')[1])).teacherId); } 
            currentUserRole = data.role; document.getElementById('login-screen').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden');
            updateUIRoleDisplay(); await fetchDB(); initApp(); Toast.fire({ icon: 'success', title: 'تم الدخول' });
        } else Swal.fire({ icon: 'error', title: 'بيانات غير صحيحة' });
    } catch(err) { Swal.fire({ icon: 'error', title: 'خطأ اتصال' }); }
}
function logout() { localStorage.clear(); location.reload(); }

function initApp() {
    document.querySelectorAll('.surah-dropdown').forEach(d => d.innerHTML = '<option value="">-- السورة --</option>' + quranSurahs.map(s => `<option value="${s}">${s}</option>`).join(''));
    if (currentUserRole === 'teacher') ['nav-centers', 'nav-teachers', 'nav-archive', 'nav-dashboard', 'nav-permissions'].forEach(id => {if(document.getElementById(id)) document.getElementById(id).style.display = 'none'});
    renderAll(); const tab = localStorage.getItem('awqaf_current_tab'); showTab((currentUserRole === 'teacher') ? 'students' : (tab || 'dashboard'));
}

function showTab(t) { document.querySelectorAll('.tab-content, .nav-btn').forEach(e => e.classList.remove('active')); if(document.getElementById(t)) document.getElementById(t).classList.add('active'); if(document.getElementById('nav-'+t)) document.getElementById('nav-'+t).classList.add('active'); localStorage.setItem('awqaf_current_tab', t); if(t==='dashboard') renderDashboard(); if(t==='attendance') renderAttendanceTable(); if(t==='teacher-att') renderTeacherAttendanceTable(); }

function renderAll() { populateCenterDropdowns(); renderCenters(); renderTeachers(); renderStudents(); renderArchive(); if(document.getElementById('dashboard').classList.contains('active')) renderDashboard(); if(document.getElementById('permissions').classList.contains('active')) renderPermissions(); renderMessageContacts(); if(currentUserRole === 'teacher') selectChatUser('admin', 'الإدارة المركزية'); }

function populateCenterDropdowns() {
    document.querySelectorAll('.center-dropdown').forEach(d => { const v = d.value; d.innerHTML = '<option value="">-- الكل --</option>' + db.centers.map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`).join(''); if(v) d.value = v; });
    filterCentersByGender('t-center', document.getElementById('t-type').value === 'معلم' ? 'ذكور' : 'إناث'); filterCentersByGender('s-center', document.getElementById('s-gender').value === 'ذكر' ? 'ذكور' : 'إناث');
}

function changePage(t, s) { currentPage[t] += s; if(t==='centers') renderCenters(); if(t==='teachers') renderTeachers(); if(t==='students') renderStudents(); }
function renderPaginationControls(t, cur, tot, len, start, end) { const c = document.getElementById(`${t}-pagination`); if(tot <= 1) { c.innerHTML=''; return; } c.innerHTML = `<div class="flex justify-between p-2"><button onclick="changePage('${t}', -1)" ${cur===1?'disabled':''} class="btn btn-outline text-xs">السابق</button><span class="text-xs mt-2">صفحة ${cur} من ${tot}</span><button onclick="changePage('${t}', 1)" ${cur===tot?'disabled':''} class="btn btn-outline text-xs">التالي</button></div>`; }

function renderDashboard() {
    const act = db.students.filter(s => !s.archived); document.getElementById('stat-centers').innerText = db.centers.length; document.getElementById('stat-teachers').innerText = db.teachers.length; document.getElementById('stat-students').innerText = act.length;
    if(myCharts.gender) myCharts.gender.destroy(); myCharts.gender = new Chart(document.getElementById('genderChart'), { type: 'doughnut', data: { labels: ['ذكور', 'إناث'], datasets: [{ data: [act.filter(s=>s.gender==='ذكر').length, act.filter(s=>s.gender==='أنثى').length], backgroundColor: ['#047857', '#fbbf24'] }] }, options: { cutout: '60%', maintainAspectRatio: false } });
    let cC = {}; act.forEach(s => cC[s.centerId] = (cC[s.centerId]||0)+1); let sC = Object.keys(cC).map(id => ({ name: db.centers.find(x=>x.id===id)?.name||'غير محدد', count: cC[id] })).sort((a,b)=>b.count-a.count).slice(0, 5);
    if(myCharts.centers) myCharts.centers.destroy(); myCharts.centers = new Chart(document.getElementById('centersChart'), { type: 'bar', data: { labels: sC.map(x=>x.name), datasets: [{ data: sC.map(x=>x.count), backgroundColor: '#3b82f6' }] }, options: { plugins:{legend:{display:false}}, maintainAspectRatio: false } });
}

const getAdminBtns = (editFunc, delFunc, id) => { if (currentUserRole === 'viewer') return '-'; return `<button onclick="${editFunc}('${id}')" class="text-blue-500 mx-2"><i class="fas fa-edit"></i></button><button onclick="${delFunc}('${id}')" class="text-red-500 mx-2"><i class="fas fa-trash"></i></button>`; };

function openCenterModal() { if(currentUserRole==='viewer') return; cancelEditCenter(); document.getElementById('centerModal').classList.remove('hidden'); }
function closeCenterModal() { document.getElementById('centerModal').classList.add('hidden'); }
function saveCenter() { const n = document.getElementById('center-name').value; if(!n) return; if(editModes.centerId) { const c = db.centers.find(x=>x.id===editModes.centerId); if(c) { c.name=n; c.type=document.getElementById('center-type').value; } } else { db.centers.unshift({id:Date.now().toString(), name:n, type:document.getElementById('center-type').value}); currentPage.centers=1; } closeCenterModal(); saveDB(); Toast.fire({icon:'success',title:'تم الحفظ'}); }
function editCenter(id) { const c = db.centers.find(x=>x.id===id); document.getElementById('center-name').value=c.name; document.getElementById('center-type').value=c.type; editModes.centerId=id; document.getElementById('centerModal').classList.remove('hidden'); }
function cancelEditCenter() { editModes.centerId=null; document.getElementById('center-name').value=''; }
function deleteCenter(id) { Swal.fire({title:'تأكيد الحذف', icon:'warning', showCancelButton:true, confirmButtonText:'نعم'}).then(r => { if(r.isConfirmed){ db.centers = db.centers.filter(c=>c.id!==id); saveDB(); }}); }
function renderCenters() {
    const s = document.getElementById('search-center').value; const tbody = document.getElementById('centers-list');
    let f = db.centers.filter(c => c.name.includes(s)); const tP = Math.ceil(f.length/ITEMS_PER_PAGE); if(currentPage.centers>tP) currentPage.centers=tP||1; const st = (currentPage.centers-1)*ITEMS_PER_PAGE; const pData = f.slice(st, st+ITEMS_PER_PAGE);
    tbody.innerHTML = pData.map((c, i) => `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700"><td class="text-center py-2">${st+i+1}</td><td class="font-bold text-right">${c.name}</td><td class="text-center">${c.type}</td><td class="text-center font-bold">${db.students.filter(x=>x.centerId===c.id && !x.archived).length}</td><td class="text-center editor-only">${getAdminBtns('editCenter','deleteCenter',c.id)}</td></tr>`).join('');
    renderPaginationControls('centers', currentPage.centers, tP, f.length, st, st+pData.length); updateUIRoleDisplay();
}

function openTeacherModal() { if(currentUserRole==='viewer') return; cancelEditTeacher(); document.getElementById('teacherModal').classList.remove('hidden'); }
function closeTeacherModal() { document.getElementById('teacherModal').classList.add('hidden'); }
function saveTeacher() { const t = { id: editModes.teacherId||Date.now().toString(), name: document.getElementById('t-name').value, nid: document.getElementById('t-nid').value, dob: document.getElementById('t-dob').value, type: document.getElementById('t-type').value, certified: document.getElementById('t-certified').value, payment: document.getElementById('t-payment').value, username: document.getElementById('t-username').value, password: document.getElementById('t-password').value, phone: document.getElementById('t-phone').value, period: document.getElementById('t-period').value, centerId: document.getElementById('t-center').value }; if(!t.name||!t.centerId) return; if(editModes.teacherId) { const old = db.teachers.find(x=>x.id===editModes.teacherId); if(old) t.attendance = old.attendance; db.teachers[db.teachers.findIndex(x=>x.id===editModes.teacherId)]=t; } else { db.teachers.unshift(t); currentPage.teachers=1; } closeTeacherModal(); saveDB(); Toast.fire({icon:'success',title:'تم الحفظ'}); }
function editTeacher(id) { const t = db.teachers.find(x=>x.id===id); ['name','nid','dob','type','certified','payment','username','password','phone','period'].forEach(k => { if(document.getElementById(`t-${k}`)) document.getElementById(`t-${k}`).value = t[k]||''; }); filterCentersByGender('t-center', t.type==='معلم'?'ذكور':'إناث'); document.getElementById('t-center').value=t.centerId; editModes.teacherId=id; document.getElementById('teacherModal').classList.remove('hidden'); }
function cancelEditTeacher() { editModes.teacherId=null; ['t-name','t-nid','t-dob','t-phone','t-username','t-password'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value=''; }); }
function deleteTeacher(id) { Swal.fire({title:'حذف', icon:'warning', showCancelButton:true, confirmButtonText:'نعم'}).then(r => { if(r.isConfirmed){ db.teachers = db.teachers.filter(x=>x.id!==id); saveDB(); }}); }
function renderTeachers() {
    const sN = document.getElementById('search-teacher').value; const sC = document.getElementById('filter-t-center').value; const tbody = document.getElementById('teachers-list');
    let f = db.teachers.filter(t => t.name.includes(sN)); if(sC) f=f.filter(t=>t.centerId===sC); const tP = Math.ceil(f.length/ITEMS_PER_PAGE); if(currentPage.teachers>tP) currentPage.teachers=tP||1; const st = (currentPage.teachers-1)*ITEMS_PER_PAGE; const pData = f.slice(st, st+ITEMS_PER_PAGE);
    tbody.innerHTML = pData.map(t => `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700 py-1"><td class="font-bold text-right">${t.name} <div class="text-xs text-gray-400">يوزر: ${t.username||'-'}</div></td><td class="text-right">${db.centers.find(c=>c.id===t.centerId)?.name||'-'}</td><td class="text-center">${t.type}</td><td class="text-right" dir="ltr">${t.phone||'-'}</td><td class="text-center editor-only">${getAdminBtns('editTeacher','deleteTeacher',t.id)}</td></tr>`).join('');
    renderPaginationControls('teachers', currentPage.teachers, tP, f.length, st, st+pData.length); updateUIRoleDisplay();
}

window.makeEditable = function(el, id, field) { if(currentUserRole === 'viewer' || el.querySelector('input')) return; const old = el.innerText.trim(); el.innerHTML = `<input type="text" class="form-input text-sm px-1 w-full dark:bg-slate-800 text-black dark:text-white" value="${old}" onblur="cancelInline(this, '${old}')" onkeydown="if(event.key==='Enter') saveInline(this, '${id}', '${field}')" onclick="event.stopPropagation()">`; el.querySelector('input').focus(); };
window.cancelInline = function(inpt, old) { inpt.parentElement.innerHTML = old; };
window.saveInline = function(inpt, id, f) { const n = inpt.value.trim(); if(!n) return cancelInline(inpt, ''); const s = db.students.find(x=>x.id===id); if(s) { s[f]=n; saveDB(); inpt.parentElement.innerHTML = n; } };

function openStudentModal() { if(currentUserRole==='viewer') return; cancelEditStudent(); const cd = document.getElementById('s-center'); if(currentUserRole==='teacher') { cd.value=localStorage.getItem('awqaf_center_id'); cd.disabled=true; } else cd.disabled=false; document.getElementById('studentModal').classList.remove('hidden'); }
function closeStudentModal() { document.getElementById('studentModal').classList.add('hidden'); }
function saveStudent() {
    const surah = document.getElementById('s-surah').value; const date = document.getElementById('s-date').value || new Date().toISOString().split('T')[0];
    let cid = document.getElementById('s-center').value; if(currentUserRole==='teacher') cid=localStorage.getItem('awqaf_center_id');
    let s = { id: editModes.studentId||Date.now().toString(), name: document.getElementById('s-name').value.trim(), dob: document.getElementById('s-dob').value, gender: document.getElementById('s-gender').value, centerId: cid, riwaya: document.getElementById('s-riwaya').value, surah, date, archived: false, completionDate: '', history: [] };
    if(!s.name||!s.centerId) return Toast.fire({icon:'warning', title:'تأكد من البيانات'});
    if (editModes.studentId) { const old = db.students.find(x=>x.id===editModes.studentId); s.archived=old.archived; s.completionDate=old.completionDate; s.history=old.history||[]; if(surah) s.history.push({surah,date}); db.students[db.students.findIndex(x=>x.id===editModes.studentId)]=s; } 
    else { if(surah) s.history.push({surah,date}); db.students.unshift(s); currentPage.students=1; }
    closeStudentModal(); saveDB(); Toast.fire({icon:'success',title:'تم الحفظ'});
}
function editStudent(id) { const s = db.students.find(x=>x.id===id); ['name','dob','gender','riwaya','surah','date'].forEach(k => { if(document.getElementById(`s-${k}`)) document.getElementById(`s-${k}`).value = s[k]||''; }); filterCentersByGender('s-center', s.gender==='ذكر'?'ذكور':'إناث'); document.getElementById('s-center').value=s.centerId; editModes.studentId=id; document.getElementById('studentModal').classList.remove('hidden'); }
function cancelEditStudent() { editModes.studentId=null; ['s-name','s-dob','s-surah','s-date'].forEach(id => document.getElementById(id).value=''); document.getElementById('s-gender').value='ذكر'; }
function graduateStudent(id) { if(currentUserRole === 'viewer') return; const s = db.students.find(x=>x.id===id); if(!s.archived) { Swal.fire({title:'تتويج بالختم', input:'date', inputValue:new Date().toISOString().split('T')[0], showCancelButton:true, confirmButtonText:'حفظ بالأرشيف'}).then((res) => { if(res.isConfirmed && res.value) { s.archived = true; s.completionDate = res.value; saveDB(); Toast.fire({ icon: 'success', title: 'تم النقل للأرشيف' }); } }); } else { Swal.fire({title:'إلغاء الختم', showCancelButton:true, confirmButtonText:'نعم'}).then((res) => { if (res.isConfirmed) { s.archived = false; s.completionDate = ''; saveDB(); Toast.fire({ icon: 'success', title: 'تم الاسترجاع' }); } }); } }
function deleteStudentFinal(id) { Swal.fire({title:'حذف نهائي', icon:'error', showCancelButton:true, confirmButtonText:'نعم'}).then((res) => { if (res.isConfirmed) { db.students = db.students.filter(x=>x.id!==id); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحذف' }); } }); }
function renderStudents() {
    const sN = document.getElementById('search-student').value; const sC = document.getElementById('filter-s-center').value; const tbody = document.getElementById('students-list');
    let f = db.students.filter(s => !s.archived && s.name.includes(sN)); if(sC) f=f.filter(s=>s.centerId===sC); const tP = Math.ceil(f.length/ITEMS_PER_PAGE); if(currentPage.students>tP) currentPage.students=tP||1; const st = (currentPage.students-1)*ITEMS_PER_PAGE; const pData = f.slice(st, st+ITEMS_PER_PAGE);
    tbody.innerHTML = pData.map(s => `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700"><td class="font-bold py-2 text-right" ondblclick="makeEditable(this, '${s.id}', 'name')">${s.name}</td><td class="text-right">${calculateAge(s.dob)}</td><td class="font-bold text-emerald-700 text-right">${db.centers.find(c=>c.id===s.centerId)?.name||'-'}</td><td class="font-bold text-blue-700 text-right">${s.surah?'سورة '+s.surah:'-'}</td><td class="text-center whitespace-nowrap"><button onclick="printIDCard('${s.id}')" class="text-teal-500 mx-1"><i class="fas fa-id-card"></i></button><button onclick="printCertificate('${s.id}')" class="text-yellow-500 mx-1"><i class="fas fa-award"></i></button>${currentUserRole !== 'viewer' ? `<button onclick="editStudent('${s.id}')" class="text-blue-500 mx-1"><i class="fas fa-edit"></i></button>` : ''} ${(currentUserRole === 'admin' || currentUserRole === 'entry') ? `<button onclick="graduateStudent('${s.id}')" class="text-orange-500 mx-1"><i class="fas fa-graduation-cap"></i></button><button onclick="deleteStudentFinal('${s.id}')" class="text-red-500 mx-1"><i class="fas fa-trash"></i></button>` : ''}</td></tr>`).join('');
    renderPaginationControls('students', currentPage.students, tP, f.length, st, st+pData.length);
}

function renderArchive() {
    const cont = document.getElementById('archive-container'); cont.innerHTML=''; const sC = document.getElementById('filter-archive-center').value; let f = db.students.filter(s => s.archived); if(sC) f=f.filter(s=>s.centerId===sC);
    const grps = {}; f.forEach(s => { if(!grps[s.centerId]) grps[s.centerId]=[]; grps[s.centerId].push(s); });
    for(const cid in grps) {
        cont.innerHTML += `<div class="card mb-6 dark:bg-slate-800"><div class="bg-emerald-800 text-white p-3 font-bold flex justify-between"><span>${db.centers.find(x=>x.id===cid)?.name||'-'}</span><span>${grps[cid].length} خاتم</span></div><div class="overflow-x-auto w-full"><table class="min-w-full text-sm whitespace-nowrap"><thead class="bg-emerald-50 text-black"><tr><th class="p-2 text-right">الاسم</th><th class="p-2 text-right">الختم</th><th class="p-2 text-center">إجراءات</th></tr></thead><tbody>` + 
        grps[cid].map(s => `<tr class="border-t"><td class="font-bold p-2 text-right">${s.name}</td><td class="p-2 text-right" dir="ltr">${s.completionDate||'-'}</td><td class="text-center whitespace-nowrap"><button onclick="printCertificate('${s.id}')" class="text-yellow-500 mx-1"><i class="fas fa-award"></i></button> ${currentUserRole !== 'viewer' ? `<button onclick="editStudent('${s.id}')" class="text-blue-500 mx-1"><i class="fas fa-edit"></i></button><button onclick="graduateStudent('${s.id}')" class="text-gray-400 mx-1"><i class="fas fa-undo"></i></button><button onclick="deleteStudentFinal('${s.id}')" class="text-red-500 mx-1"><i class="fas fa-trash"></i></button>` : ''}</td></tr>`).join('') + `</tbody></table></div></div>`;
    }
}

// =================== حضور الطلاب ===================
document.addEventListener("DOMContentLoaded", () => { const t=new Date().toISOString().slice(0, 7); const d=new Date().toISOString().split('T')[0]; if(document.getElementById('attendance-month')) document.getElementById('attendance-month').value=t; if(document.getElementById('rep-att-month')) document.getElementById('rep-att-month').value=t; if(document.getElementById('t-att-date')) document.getElementById('t-att-date').value=d; if(document.getElementById('rep-t-att-month')) document.getElementById('rep-t-att-month').value=t; });
function renderAttendanceTable() {
    const m = document.getElementById('attendance-month').value || new Date().toISOString().slice(0, 7); const cid = document.getElementById('attendance-center') ? document.getElementById('attendance-center').value : ''; const tbody = document.getElementById('attendance-list');
    let stds = db.students.filter(s => !s.archived); if (currentUserRole === 'teacher') stds = stds.filter(s => s.centerId === localStorage.getItem('awqaf_center_id')); else if (cid) stds = stds.filter(s => s.centerId === cid); else { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8">الرجاء اختيار المركز</td></tr>`; return; }
    tbody.innerHTML = stds.map(s => {
        if(!s.attendance) s.attendance = {}; if(!s.attendance[m]) s.attendance[m] = { present: 0, absent: 0, excused: 0 };
        const a = s.attendance[m]; const p = Math.round((a.present / ((a.present+a.absent+a.excused)||1)) * 100);
        return `<tr><td class="font-bold py-2 text-right">${s.name}</td><td class="text-center"><input type="number" min="0" value="${a.present}" class="form-input w-16 text-center mx-auto text-black dark:text-white" onchange="updateAttendance('${s.id}', '${m}', 'present', this.value)" ${currentUserRole==='viewer'?'disabled':''}></td><td class="text-center"><input type="number" min="0" value="${a.absent}" class="form-input w-16 text-center mx-auto text-black dark:text-white" onchange="updateAttendance('${s.id}', '${m}', 'absent', this.value)" ${currentUserRole==='viewer'?'disabled':''}></td><td class="text-center"><input type="number" min="0" value="${a.excused}" class="form-input w-16 text-center mx-auto text-black dark:text-white" onchange="updateAttendance('${s.id}', '${m}', 'excused', this.value)" ${currentUserRole==='viewer'?'disabled':''}></td><td class="text-center text-emerald-600 font-bold">${p}%</td></tr>`;
    }).join('');
}
function updateAttendance(id, m, f, v) { if(currentUserRole === 'viewer') return; const s = db.students.find(x=>x.id===id); if(s) { s.attendance[m][f] = parseInt(v)||0; saveDB(); Toast.fire({ icon: 'success', title: 'تم الحفظ' }); } }

// =================== حضور وانصراف الكادر ===================
function renderTeacherAttendanceTable() {
    const d = document.getElementById('t-att-date').value || new Date().toISOString().split('T')[0]; const cid = document.getElementById('t-att-center') ? document.getElementById('t-att-center').value : ''; const tbody = document.getElementById('t-attendance-list');
    let tchs = db.teachers; if (currentUserRole === 'teacher') tchs = tchs.filter(t => t.centerId === localStorage.getItem('awqaf_center_id')); else if (cid) tchs = tchs.filter(t => t.centerId === cid); else { tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8">الرجاء اختيار المركز</td></tr>`; return; }
    tbody.innerHTML = tchs.map(t => {
        if(!t.attendance) t.attendance = {}; if(!t.attendance[d]) t.attendance[d] = { timeIn: '', timeOut: '' };
        const a = t.attendance[d];
        return `<tr><td class="font-bold py-2 text-right">${t.name}</td><td class="text-right">${db.centers.find(c=>c.id===t.centerId)?.name||'-'}</td><td class="text-center"><input type="time" value="${a.timeIn}" class="form-input w-32 mx-auto text-black dark:text-white" onchange="updateTeacherAttendance('${t.id}', '${d}', 'timeIn', this.value)" ${currentUserRole==='viewer'?'disabled':''}></td><td class="text-center"><input type="time" value="${a.timeOut}" class="form-input w-32 mx-auto text-black dark:text-white" onchange="updateTeacherAttendance('${t.id}', '${d}', 'timeOut', this.value)" ${currentUserRole==='viewer'?'disabled':''}></td></tr>`;
    }).join('');
}
function updateTeacherAttendance(id, d, f, v) { if(currentUserRole === 'viewer') return; const t = db.teachers.find(x=>x.id===id); if(t) { t.attendance[d][f] = v; saveDB(); Toast.fire({ icon: 'success', title: 'تم الحفظ' }); } }

// =================== التقارير والطباعة ===================
function printCustomReport() { openPrintView('تم طباعة التقرير'); } 
function exportToExcel(tid, n) { let tbl = document.getElementById(tid); if(!tbl) return; let ws = XLSX.utils.table_to_sheet(tbl); ws['!dir']='rtl'; let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, n); XLSX.writeFile(wb, `${n}.xlsx`); }
function exportData() { const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db)); a.download = "Backup.json"; a.click(); }
function importData(e) { const r = new FileReader(); r.onload = ev => { db = JSON.parse(ev.target.result); saveDB(); location.reload(); }; r.readAsText(e.target.files[0]); }
function openPrintView(c, skip = false) { const p = document.getElementById('print-area'); p.innerHTML = skip ? c : `<div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #000; padding-bottom:10px;"><h2>وزارة الأوقاف - مكتب سرت</h2><h3>قسم القرآن الكريم والسنة النبوية</h3></div>`+c; p.classList.remove('hidden'); window.print(); p.classList.add('hidden'); }
function printCenters(t) { openPrintView(`<h3 style="text-align:center;">كشف مراكز (${t})</h3><table border="1" width="100%" dir="rtl" style="text-align:center; border-collapse:collapse;"><tr><th>م</th><th>المركز</th></tr>` + db.centers.filter(c=>c.type===t).map((c,i)=>`<tr><td>${i+1}</td><td>${c.name}</td></tr>`).join('') + `</table>`); }
function printSingleCenter() { const cid=document.getElementById('report-center').value; const cName = db.centers.find(c=>c.id===cid)?.name||''; openPrintView(`<h3 style="text-align:center;">كشف طلاب: ${cName}</h3><table border="1" width="100%" dir="rtl" style="text-align:center; border-collapse:collapse;"><tr><th>م</th><th>الاسم</th><th>الرواية</th><th>المقدار</th></tr>` + db.students.filter(s=>s.centerId===cid).map((s,i)=>`<tr><td>${i+1}</td><td>${s.name}</td><td>${s.riwaya||'-'}</td><td>${s.surah||'-'}</td></tr>`).join('') + `</table>`); }
function printTeachers(t) { openPrintView(`<h3 style="text-align:center;">الكادر التعليمي (${t})</h3><table border="1" width="100%" dir="rtl" style="text-align:center; border-collapse:collapse;"><tr><th>م</th><th>الاسم</th><th>الهاتف</th><th>المركز</th></tr>` + db.teachers.filter(x=>x.type===t).map((x,i)=>`<tr><td>${i+1}</td><td>${x.name}</td><td dir="ltr">${x.phone||'-'}</td><td>${db.centers.find(c=>c.id===x.centerId)?.name||'-'}</td></tr>`).join('') + `</table>`); }
function printAttendanceSheet() { openPrintView(`<h3 style="text-align:center;">كشف الحضور للطلاب</h3>`, false); }
function printTeacherAttendanceSheet() { 
    const m = document.getElementById('rep-t-att-month').value; const cid = document.getElementById('rep-t-att-center').value; if(!m || !cid) return alert('اختر المركز والشهر'); 
    const cName = db.centers.find(c=>c.id===cid)?.name||'';
    const tchs = db.teachers.filter(t=>t.centerId === cid);
    let html = `<h3 style="text-align:center;">كشف حضور وانصراف الكادر التعليمي</h3><h4 style="text-align:center;">${cName} - شهر ${m}</h4><table border="1" width="100%" dir="rtl" style="text-align:center; border-collapse:collapse;"><tr><th>الاسم</th><th>أيام الحضور (التي تم توقيعها)</th></tr>`;
    tchs.forEach(t => { let days = 0; if(t.attendance) { Object.keys(t.attendance).forEach(d => { if(d.startsWith(m) && t.attendance[d].timeIn) days++; }); } html += `<tr><td>${t.name}</td><td>${days} يوم</td></tr>`; });
    openPrintView(html + `</table>`);
}
function printCertificate(id) { const s = db.students.find(x=>x.id===id); openPrintView(`<div style="text-align:center; padding:50px; border:5px double #000; margin:20px;"><h1>شهادة</h1><h2>${s.name}</h2></div>`, true); }
function printIDCard(id) { const s = db.students.find(x=>x.id===id); openPrintView(`<div style="text-align:center; padding:20px; border:1px solid #000; width:300px; display:inline-block; margin:10px;"><h3>بطاقة تعريف</h3><p><strong>${s.name}</strong></p></div>`, true); }

// =================== نظام الصلاحيات المتقدم ===================
let editingAssistantId = null;
function renderPermissions() {
    if(currentUserRole !== 'admin') return;
    document.getElementById('perm-teachers-list').innerHTML = db.teachers.map(t => `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700"><td class="p-2 font-bold text-right">${t.name}</td><td class="p-2 text-right text-emerald-600">${t.username||'-'}</td><td class="p-2 text-red-500 text-right">${t.password||'-'}</td></tr>`).join('');
    document.getElementById('perm-assistants-list').innerHTML = (db.assistants || []).map(a => {
        const rLabel = a.role === 'viewer' ? '<span class="text-blue-500 text-xs">(مشاهد فقط)</span>' : '<span class="text-emerald-500 text-xs">(مساعد مدير)</span>';
        return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700"><td class="p-2 font-bold text-right">${a.name} ${rLabel}</td><td class="p-2 text-right text-emerald-600">${a.username}</td><td class="p-2 text-center"><button onclick="editAssistant('${a.id}')" class="text-blue-500 mx-2"><i class="fas fa-edit"></i></button><button onclick="deleteAssistant('${a.id}')" class="text-red-500 mx-2"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('');
}
function saveAssistant() {
    const name = document.getElementById('ast-name').value.trim(); const userPass = document.getElementById('ast-user').value.trim(); const role = document.getElementById('ast-role').value;
    if(!name || !userPass) return Toast.fire({ icon: 'warning', title: 'يرجى تعبئة الحقول' });
    if(!db.assistants) db.assistants = [];
    if(editingAssistantId) { const ast = db.assistants.find(x=>x.id===editingAssistantId); if(ast) { ast.name=name; ast.username=userPass; ast.password=userPass; ast.role=role; } } 
    else db.assistants.push({ id: Date.now().toString(), name, username: userPass, password: userPass, role });
    cancelEditAssistant(); renderPermissions(); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحفظ' });
}
function editAssistant(id) { const a = db.assistants.find(x=>x.id===id); if(a) { document.getElementById('ast-name').value=a.name; document.getElementById('ast-user').value=a.username; document.getElementById('ast-role').value=a.role||'entry'; document.getElementById('ast-id').value=a.id; editingAssistantId=id; }}
function cancelEditAssistant() { document.getElementById('ast-name').value=''; document.getElementById('ast-user').value=''; document.getElementById('ast-role').value='entry'; document.getElementById('ast-id').value=''; editingAssistantId=null; }
function deleteAssistant(id) { db.assistants = db.assistants.filter(a => a.id !== id); renderPermissions(); saveDB(); Toast.fire({ icon: 'success', title: 'تم الحذف' }); }

// =================== المراسلة الاحترافية ===================
let activeChatUserId = null;
function renderMessageContacts() {
    if(currentUserRole === 'teacher') return;
    const cf = document.getElementById('msg-center-filter'); if(cf.options.length <= 1) cf.innerHTML = '<option value="">-- كل المراكز --</option>' + db.centers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const list = cf.value ? db.teachers.filter(t => t.centerId === cf.value) : db.teachers;
    document.getElementById('msg-contacts').innerHTML = list.map(t => `<div onclick="selectChatUser('${t.id}', '${t.name}')" class="p-3 bg-white hover:bg-blue-50 dark:bg-slate-800 rounded-lg cursor-pointer border mb-1 ${activeChatUserId===t.id?'border-blue-500 border-2':'border-transparent'}"><div class="font-bold">${t.name}</div><div class="text-xs text-gray-500">${db.centers.find(c=>c.id===t.centerId)?.name||''}</div></div>`).join('');
}
function selectChatUser(id, name) { activeChatUserId = id; document.getElementById('chat-title').innerText = name; if(document.getElementById('chat-overlay')) document.getElementById('chat-overlay').style.display = 'none'; renderChatBox(); }

function handleFileAttachment(e) {
    const file = e.target.files[0]; if(!file) return;
    if(file.size > 2 * 1024 * 1024) return Swal.fire({ icon:'error', title:'حجم الملف كبير', text:'يجب أن يكون أقل من 2 ميجابايت' });
    const reader = new FileReader(); reader.onload = function(ev) { pendingMsgFile = { name: file.name, type: file.type.includes('image') ? 'image' : 'pdf', data: ev.target.result }; Toast.fire({ icon: 'success', title: `تم الإرفاق` }); }; reader.readAsDataURL(file);
}

function renderChatBox() {
    if(!activeChatUserId && currentUserRole !== 'teacher') return;
    const box = document.getElementById('chat-box');
    const myId = currentUserRole === 'teacher' ? localStorage.getItem('awqaf_teacher_id') || 'teacher' : 'admin';
    const msgs = (db.messages || []).filter(m => (m.senderId === activeChatUserId && m.receiverId === 'admin') || (m.senderId === 'admin' && m.receiverId === activeChatUserId) || (currentUserRole === 'teacher' && (m.senderId === myId || m.receiverId === myId)));
    
    box.innerHTML = msgs.map(m => {
        const isMe = m.senderId === myId;
        const align = isMe ? 'self-end chat-me' : 'self-start chat-other';
        let fileHtml = '';
        if(m.file) {
            if(m.file.type === 'image') fileHtml = `<img src="${m.file.data}" class="max-w-[150px] rounded mb-2 cursor-pointer" onclick="Swal.fire({imageUrl: '${m.file.data}'})">`;
            else fileHtml = `<a href="${m.file.data}" download="${m.file.name}" class="underline text-sm mb-2 block"><i class="fas fa-file-pdf"></i> ${m.file.name}</a>`;
        }
        const editBtn = isMe ? `<button onclick="editMessagePrompt('${m.id}')" class="opacity-60 hover:opacity-100 mr-2 text-xs"><i class="fas fa-pen"></i></button>` : '';
        const editedMark = m.edited ? `<span class="text-[9px] mr-1">(معدلة)</span>` : '';
        return `<div class="max-w-[85%] md:max-w-[70%] p-3 ${align} flex flex-col relative text-sm md:text-base">${fileHtml}<div class="flex justify-between items-start gap-3"><span class="font-bold break-words">${m.text}</span> ${editBtn}</div><div class="text-[10px] mt-1 opacity-70 text-left flex justify-end gap-1" dir="ltr">${editedMark} ${m.date}</div></div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('msg-input'); const text = input.value.trim(); const editId = document.getElementById('edit-msg-id').value;
    if(!text && !pendingMsgFile) return;
    if(currentUserRole !== 'teacher' && !activeChatUserId) return Toast.fire({ icon: 'warning', title: 'اختر معلماً أولاً' });
    
    if(editId) { const m = db.messages.find(x => x.id === editId); if(m) { m.text = text; m.edited = true; document.getElementById('edit-msg-id').value = ''; } } 
    else {
        let senderId = 'admin'; let receiverId = activeChatUserId;
        if(currentUserRole === 'teacher') { senderId = localStorage.getItem('awqaf_teacher_id') || 'teacher'; receiverId = 'admin'; activeChatUserId = 'admin'; }
        if(!db.messages) db.messages = []; db.messages.push({ id: Date.now().toString(), text: text || 'مرفق', senderId, receiverId, date: new Date().toLocaleString('ar-LY', {hour: '2-digit', minute:'2-digit'}), file: pendingMsgFile, edited: false });
    }
    pendingMsgFile = null; input.value = ''; document.getElementById('msg-file-input').value = ''; renderChatBox(); saveDB();
}

function editMessagePrompt(id) { const m = db.messages.find(x => x.id === id); if(!m) return; document.getElementById('msg-input').value = m.text; document.getElementById('edit-msg-id').value = m.id; document.getElementById('msg-input').focus(); }
