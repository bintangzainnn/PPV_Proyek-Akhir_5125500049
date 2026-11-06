window.addEventListener('load', () => {
    'use strict';

    const STORAGE_KEY = 'kalkulator-ipk:v2';
    const SESSION_KEY = 'kalkulator-ipk:user-session';

    const GRADES = [
        { letter: 'A',  point: 4 },
        { letter: 'AB', point: 3.5 },
        { letter: 'B',  point: 3 },
        { letter: 'BC', point: 2.5 },
        { letter: 'C',  point: 2 },
        { letter: 'D',  point: 1 },
        { letter: 'E',  point: 0 },
    ];

    const BANDS = { top: 'Sangat baik', high: 'Baik', mid: 'Cukup', low: 'Perlu ditingkatkan' };

    const nf2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const nfPts = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

    const $ = (id) => document.getElementById(id);
    const el = {
        loginView: $('loginView'),
        mainApp: $('mainApp'),
        loginForm: $('loginForm'),
        loginName: $('loginName'),
        loginNrp: $('loginNrp'),
        loginError: $('loginError'),
        userDisplayName: $('userDisplayName'),
        userDisplayNrp: $('userDisplayNrp'),
        profileName: $('profileName'),
        profileNrp: $('profileNrp'),
        btnLogout: $('btnLogout'),

        console: $('console'),
        gauge: $('gauge'),
        needle: $('needle'),
        bands: document.querySelectorAll('.band'),
        ipValue: $('ipValue'),
        predikat: $('predikat'),
        totalSks: $('totalSks'),
        totalPoints: $('totalPoints'),
        ipkCumulative: $('ipkCumulative'),
        ipkHint: $('ipkHint'),
        trackTotal: $('trackTotal'),
        clips: $('clips'),

        quickSelect: $('quickSelect'),
        form: $('ipkForm'),
        nameInput: $('courseName'),
        sksInput: $('courseSks'),
        errorName: $('errorName'),
        errorSks: $('errorSks'),
        submitBtn: $('submitBtn'),
        stepper: document.querySelector('.stepper'),

        history: $('history'),
        prevSks: $('prevSks'),
        prevIpk: $('prevIpk'),
        errorHistory: $('errorHistory'),

        ledger: $('ledger'),
        courseCount: $('courseCount'),
        resetBtn: $('resetBtn'),
        emptyState: $('emptyState'),
        loadingState: $('loadingState'),
        tableWrap: $('tableWrap'),
        tbody: $('courseTableBody'),

        toast: $('toast'),
        toastMsg: $('toastMsg'),
        toastUndo: $('toastUndo'),
    };

    const state = { courses: [], history: { sks: '', ipk: '' } };
    let nextId = Date.now();
    let needleAngle = 0;

    // --- PROSES PERPINDAHAN TAMPILAN LOGIN DAFTAR ---
    function masukKeKalkulator(nama, nrp) {
        if (el.loginView) el.loginView.style.display = 'none';
        if (el.mainApp) el.mainApp.style.display = 'block';

        if (el.userDisplayName) el.userDisplayName.textContent = nama;
        if (el.userDisplayNrp) el.userDisplayNrp.textContent = nrp;
        if (el.profileName) el.profileName.textContent = nama;
        if (el.profileNrp) el.profileNrp.textContent = nrp;
    }

    function checkAuth() {
        try {
            const session = JSON.parse(localStorage.getItem(SESSION_KEY));
            if (session && session.name && session.nrp) {
                masukKeKalkulator(session.name, session.nrp);
            } else {
                if (el.loginView) el.loginView.style.display = 'flex';
                if (el.mainApp) el.mainApp.style.display = 'none';
            }
        } catch (e) {
            if (el.loginView) el.loginView.style.display = 'flex';
            if (el.mainApp) el.mainApp.style.display = 'none';
        }
    }

    // EVENT TOMBOL LOGIN
    if (el.loginForm) {
        el.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nama = el.loginName ? el.loginName.value.trim() : '';
            const nrp = el.loginNrp ? el.loginNrp.value.trim() : '';

            if (nama.length < 3 || nrp.length < 3) {
                if (el.loginError) el.loginError.textContent = 'Isi Nama dan NRP minimal 3 karakter!';
                const card = el.loginView.querySelector('.auth-card');
                if (card) {
                    card.classList.add('shake');
                    setTimeout(() => card.classList.remove('shake'), 350);
                }
                return;
            }

            if (el.loginError) el.loginError.textContent = '';
            
            try {
                localStorage.setItem(SESSION_KEY, JSON.stringify({ name: nama, nrp: nrp }));
            } catch(err){}

            masukKeKalkulator(nama, nrp);
        });
    }

    if (el.btnLogout) {
        el.btnLogout.addEventListener('click', () => {
            try { localStorage.removeItem(SESSION_KEY); } catch(err){}
            if (el.loginName) el.loginName.value = '';
            if (el.loginNrp) el.loginNrp.value = '';
            if (el.mainApp) el.mainApp.style.display = 'none';
            if (el.loginView) el.loginView.style.display = 'flex';
        });
    }

    // NAVIGASI TAB
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('aktif'));
            e.target.classList.add('aktif');

            const pKalkulator = $('panelKalkulator');
            const pProfil = $('panelProfil');

            if (targetId === 'panelKalkulator') {
                if (pKalkulator) pKalkulator.style.display = 'block';
                if (pProfil) pProfil.style.display = 'none';
            } else {
                if (pKalkulator) pKalkulator.style.display = 'none';
                if (pProfil) pProfil.style.display = 'block';
            }
        });
    });

    // LOGIKA PERHITUNGAN IPK
    const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
    const gradeByPoint = (point) => GRADES.find((g) => g.point === point) || GRADES[GRADES.length - 1];
    const bandOf = (ip) => (ip >= 3.5 ? 'top' : ip >= 3 ? 'high' : ip >= 2 ? 'mid' : 'low');

    function summarize() {
        let totalSks = 0;
        let totalPoints = 0;
        for (const c of state.courses) {
            totalSks += c.sks;
            totalPoints += c.sks * c.point;
        }
        const ip = totalSks > 0 ? Math.round((totalPoints / totalSks) * 100) / 100 : 0;
        return { totalSks, totalPoints, ip };
    }

    function renderConsole() {
        const { totalSks, totalPoints, ip } = summarize();
        const has = totalSks > 0;
        const band = has ? bandOf(ip) : 'none';

        if (el.console) el.console.dataset.band = band;
        if (el.ipValue) el.ipValue.textContent = nf2.format(ip);
        if (el.predikat) el.predikat.textContent = has ? BANDS[band] : 'Belum ada nilai';
        if (el.totalSks) el.totalSks.textContent = totalSks;
        if (el.totalPoints) el.totalPoints.textContent = nfPts.format(totalPoints);
        if (el.trackTotal) el.trackTotal.textContent = `${totalSks} SKS`;

        needleAngle = (clamp(ip, 0, 4) / 4) * 180;
        if (el.needle) el.needle.style.transform = `rotate(${needleAngle}deg)`;

        if (state.courses.length === 0) {
            if (el.clips) el.clips.innerHTML = '<li class="clip-empty">Klip mata kuliah muncul di sini.</li>';
        } else {
            if (el.clips) {
                el.clips.innerHTML = state.courses.map((c) => {
                    const g = gradeByPoint(c.point);
                    return `<li class="clip" data-grade="${g.letter}" style="--sks:${c.sks}"><b>${g.letter}</b><span>${c.name}</span></li>`;
                }).join('');
            }
        }
    }

    function renderLedger() {
        const has = state.courses.length > 0;
        if (el.courseCount) el.courseCount.textContent = `${state.courses.length} mata kuliah`;
        if (el.emptyState) el.emptyState.style.display = has ? 'none' : 'block';
        if (el.tableWrap) el.tableWrap.style.display = has ? 'block' : 'none';

        if (el.tbody) {
            el.tbody.innerHTML = state.courses.map((c) => {
                const g = gradeByPoint(c.point);
                const options = GRADES.map((opt) => `<option value="${opt.point}"${opt.point === c.point ? ' selected' : ''}>${opt.letter}</option>`).join('');
                return `<tr data-id="${c.id}">
                    <td><b>${c.name}</b></td>
                    <td><select class="grade-select" data-role="grade" data-grade="${g.letter}">${options}</select></td>
                    <td class="num">${c.sks}</td>
                    <td class="num">${nfPts.format(c.sks * c.point)}</td>
                    <td class="col-action"><button type="button" class="btn-remove" data-action="remove">Hapus</button></td>
                </tr>`;
            }).join('');
        }
    }

    if (el.quickSelect) {
        el.quickSelect.addEventListener('change', (e) => {
            if (!e.target.value) return;
            const [name, sks] = e.target.value.split('|');
            if (el.nameInput) el.nameInput.value = name;
            if (el.sksInput) el.sksInput.value = sks;
        });
    }

    if (el.form) {
        el.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = el.nameInput ? el.nameInput.value.trim() : '';
            const sks = el.sksInput ? Number(el.sksInput.value) : 0;
            const gradeVal = el.form.elements['grade'] ? Number(el.form.elements['grade'].value) : 4;

            if (name.length < 3 || sks < 1) {
                if (el.errorName) el.errorName.textContent = 'Isi nama minimal 3 karakter!';
                return;
            }

            if (el.errorName) el.errorName.textContent = '';
            state.courses.push({ id: Date.now(), name, sks, point: gradeVal });
            if (el.nameInput) el.nameInput.value = '';
            renderLedger();
            renderConsole();
        });
    }

    if (el.tbody) {
        el.tbody.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'remove') {
                const id = Number(e.target.closest('tr').dataset.id);
                state.courses = state.courses.filter((c) => c.id !== id);
                renderLedger();
                renderConsole();
            }
        });

        el.tbody.addEventListener('change', (e) => {
            if (e.target.dataset.role === 'grade') {
                const id = Number(e.target.closest('tr').dataset.id);
                const c = state.courses.find((x) => x.id === id);
                if (c) {
                    c.point = Number(e.target.value);
                    renderLedger();
                    renderConsole();
                }
            }
        });
    }

    checkAuth();
    renderLedger();
    renderConsole();
});