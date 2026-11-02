const $ = s => document.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = d => d.split("-").reverse().join("/");
const cap = s => s[0].toUpperCase() + s.slice(1);
const uid = () => Date.now() + Math.floor(Math.random() * 1000);
const STATUS = ["Belum Dikerjakan", "Proses", "Selesai"];
const sisa = d => Math.round((new Date(d + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / 864e5);

let users = load("users", [{ id: 1, name: "Admin", email: "admin@tugasku.id", password: "admin123", role: "admin", active: true }]);
let courses = load("courses", []);
let tasks = load("tasks", []);
let me = load("me", null);
const simpan = () => { save("users", users); save("courses", courses); save("tasks", tasks); save("me", me); };
const myTasks = () => tasks.filter(t => t.userId === me.id);
const myCourses = () => courses.filter(c => c.userId === me.id);
const namaMk = id => (courses.find(c => c.id === id) || { name: "-" }).name;

function renderNav() {
    const l = me
        ? [["dashboard.html", "Dashboard"], ["tugas.html", "Tugas"], ["matkul.html", "Mata Kuliah"], ["kalender.html", "Kalender"], ["profil.html", "Profil"]]
        : [["index.html", "Beranda"], ["login.html", "Masuk"], ["register.html", "Daftar"]];
    if (me && me.role === "admin") l.splice(4, 0, ["pengguna.html", "Pengguna"]);
    const cur = location.pathname.split("/").pop() || "index.html";
    $("nav").innerHTML = l.map(([h, t]) => `<a href="${h}" class="${h === cur ? "aktif" : ""}">${t}</a>`).join("") + (me ? `<a href="#" id="keluar">Keluar</a>` : "");
    if (me) $("#keluar").addEventListener("click", e => { e.preventDefault(); me = null; simpan(); location = "login.html"; });
}

function tampilBanner() {
    const belum = myTasks().filter(t => t.status !== 2);
    const telat = belum.filter(t => sisa(t.deadline) < 0).length;
    const hariIni = belum.filter(t => sisa(t.deadline) === 0).length;
    const besok = belum.filter(t => sisa(t.deadline) === 1).length;

    const pesan = [];
    if (telat) pesan.push(telat + " tugas terlambat");
    if (hariIni) pesan.push(hariIni + " tugas jatuh tempo hari ini");
    if (besok) pesan.push(besok + " tugas jatuh tempo besok");
    if (!pesan.length) return;

    const div = document.createElement("div");
    div.className = "banner";
    div.textContent = "Perhatian: " + pesan.join(", ") + ".";
    $("main").prepend(div);
}

const pages = {
    register() {
        $("form").addEventListener("submit", e => {
            e.preventDefault();
            const name = $("#nama").value.trim(), email = $("#email").value.trim().toLowerCase(), password = $("#sandi").value;
            if (!name || !email || password.length < 6) return alert("Isi semua kolom. Kata sandi minimal 6 karakter.");
            if (users.some(u => u.email === email)) return alert("Email sudah terdaftar.");
            users.push({ id: uid(), name, email, password, role: "mahasiswa", active: true });
            simpan(); alert("Akun berhasil dibuat. Silakan masuk."); location = "login.html";
        });
    },

    login() {
        $("form").addEventListener("submit", e => {
            e.preventDefault();
            const u = users.find(x => x.email === $("#email").value.trim().toLowerCase() && x.password === $("#sandi").value);
            if (!u) return alert("Email atau kata sandi salah.");
            if (!u.active) return alert("Akun dinonaktifkan. Hubungi admin.");
            me = u; simpan(); location = "dashboard.html";
        });
    },

    dashboard() {
        const t = myTasks();
        $("#stat").innerHTML = STATUS.map((s, i) => `<div class="stat"><b>${t.filter(x => x.status === i).length}</b>${s}</div>`).join("");
        const dekat = t.filter(x => x.status !== 2 && sisa(x.deadline) <= 7).sort((a, b) => a.deadline.localeCompare(b.deadline));
        $("#isi").innerHTML = dekat.map(x => {
            const s = sisa(x.deadline);
            const ket = s < 0 ? "Terlambat " + (-s) + " hari" : s === 0 ? "Hari ini" : s + " hari lagi";
            return `<tr class="${s < 0 ? "telat" : ""}"><td>${esc(x.title)}</td><td>${esc(namaMk(x.courseId))}</td><td>${fmt(x.deadline)}</td><td>${ket}</td><td class="${x.priority}">${cap(x.priority)}</td></tr>`;
        }).join("") || `<tr><td colspan="5">Tidak ada tugas yang mendesak.</td></tr>`;
    },

    matkul() {
        const tampil = () => {
            $("#isi").innerHTML = myCourses().map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.code)}</td><td>${esc(c.lecturer)}</td><td><button data-hapus="${c.id}">Hapus</button></td></tr>`).join("") || `<tr><td colspan="4">Belum ada mata kuliah.</td></tr>`;
        };
        $("form").addEventListener("submit", e => {
            e.preventDefault();
            const name = $("#nama").value.trim();
            if (!name) return alert("Nama mata kuliah wajib diisi.");
            courses.push({ id: uid(), userId: me.id, name, code: $("#kode").value.trim(), lecturer: $("#dosen").value.trim() });
            simpan(); e.target.reset(); tampil();
        });
        $("#isi").addEventListener("click", e => {
            const id = Number(e.target.dataset.hapus);
            if (id && confirm("Hapus mata kuliah ini beserta semua tugasnya?")) {
                courses = courses.filter(c => c.id !== id);
                tasks = tasks.filter(t => t.courseId !== id);
                simpan(); tampil();
            }
        });
        tampil();
    },

    tugas() {
        const opt = myCourses().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
        $("#mk").innerHTML = opt || `<option value="">(tambah mata kuliah dulu)</option>`;
        $("#fMk").innerHTML = `<option value="">Semua mata kuliah</option>` + opt;
        $("#fStatus").innerHTML = `<option value="">Semua status</option>` + STATUS.map((s, i) => `<option value="${i}">${s}</option>`).join("");

        const tampil = () => {
            const q = $("#cari").value.toLowerCase(), fm = $("#fMk").value, fs = $("#fStatus").value;
            const rows = myTasks()
                .filter(t => (!fm || t.courseId === Number(fm)) && (fs === "" || t.status === Number(fs)) && t.title.toLowerCase().includes(q))
                .sort((a, b) => a.deadline.localeCompare(b.deadline));
            $("#isi").innerHTML = rows.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.title)}</td><td>${esc(namaMk(t.courseId))}</td><td>${fmt(t.deadline)}</td><td class="${t.priority}">${cap(t.priority)}</td>
                <td><select data-st="${t.id}">${STATUS.map((s, j) => `<option value="${j}"${t.status === j ? " selected" : ""}>${s}</option>`).join("")}</select></td>
                <td><button data-ubah="${t.id}">Ubah</button> <button data-hapus="${t.id}">Hapus</button></td></tr>`).join("") || `<tr><td colspan="7">Tidak ada tugas.</td></tr>`;
        };
        const reset = () => { $("form").reset(); $("#id").value = ""; $("#batal").hidden = true; $("#simpan").textContent = "Simpan tugas"; };

        $("form").addEventListener("submit", e => {
            e.preventDefault();
            const data = { courseId: Number($("#mk").value), title: $("#judul").value.trim(), desc: $("#ket").value.trim(), deadline: $("#deadline").value, priority: $("#prioritas").value };
            if (!data.title || !data.courseId || !data.deadline) return alert("Judul, mata kuliah, dan deadline wajib diisi.");
            const id = Number($("#id").value);
            if (id) Object.assign(tasks.find(t => t.id === id), data);
            else tasks.push({ id: uid(), userId: me.id, status: 0, ...data });
            simpan(); reset(); tampil();
        });
        $("#batal").addEventListener("click", reset);
        ["#cari", "#fMk", "#fStatus"].forEach(s => $(s).addEventListener("input", tampil));

        $("#isi").addEventListener("change", e => {
            if (e.target.dataset.st) { tasks.find(t => t.id === Number(e.target.dataset.st)).status = Number(e.target.value); simpan(); tampil(); }
        });
        $("#isi").addEventListener("click", e => {
            const ubah = Number(e.target.dataset.ubah), hapus = Number(e.target.dataset.hapus);
            if (ubah) {
                const t = tasks.find(x => x.id === ubah);
                $("#id").value = t.id; $("#judul").value = t.title; $("#mk").value = t.courseId; $("#deadline").value = t.deadline;
                $("#prioritas").value = t.priority; $("#ket").value = t.desc;
                $("#batal").hidden = false; $("#simpan").textContent = "Simpan perubahan"; scrollTo(0, 0);
            }
            if (hapus && confirm("Hapus tugas ini?")) { tasks = tasks.filter(t => t.id !== hapus); simpan(); tampil(); }
        });
        tampil();
    },

    kalender() {
        const bln = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        let y = new Date().getFullYear(), m = new Date().getMonth();
        const tampil = () => {
            $("#bulan").textContent = bln[m] + " " + y;
            const awal = (new Date(y, m, 1).getDay() + 6) % 7, jml = new Date(y, m + 1, 0).getDate();
            let h = "<tr>" + "<td></td>".repeat(awal);
            for (let d = 1; d <= jml; d++) {
                if ((awal + d - 1) % 7 === 0 && d > 1) h += "</tr><tr>";
                const tgl = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const isi = myTasks().filter(x => x.deadline === tgl).map(x => `<span class="tgs ${x.priority}${x.status === 2 ? " selesai" : ""}">${esc(x.title)}</span>`).join("");
                h += `<td><b>${d}</b>${isi}</td>`;
            }
            $("#kal").innerHTML = h + "</tr>";
        };
        $("#prev").addEventListener("click", () => { m--; if (m < 0) { m = 11; y--; } tampil(); });
        $("#next").addEventListener("click", () => { m++; if (m > 11) { m = 0; y++; } tampil(); });
        tampil();
    },

    profil() {
        const u = users.find(x => x.id === me.id);
        $("#email").textContent = u.email; $("#nama").value = u.name;
        $("#f1").addEventListener("submit", e => {
            e.preventDefault();
            if (!$("#nama").value.trim()) return alert("Nama wajib diisi.");
            u.name = $("#nama").value.trim(); me = u; simpan(); alert("Profil disimpan.");
        });
        $("#f2").addEventListener("submit", e => {
            e.preventDefault();
            if ($("#lama").value !== u.password) return alert("Kata sandi lama salah.");
            if ($("#baru").value.length < 6) return alert("Kata sandi baru minimal 6 karakter.");
            u.password = $("#baru").value; me = u; simpan(); e.target.reset(); alert("Kata sandi diubah.");
        });
    },

    pengguna() {
        const tampil = () => {
            $("#isi").innerHTML = users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role}</td><td>${u.active ? "Aktif" : "Nonaktif"}</td>
                <td>${u.id === me.id ? "-" : `<button data-toggle="${u.id}">${u.active ? "Nonaktifkan" : "Aktifkan"}</button>`}</td></tr>`).join("");
        };
        $("#isi").addEventListener("click", e => {
            const id = Number(e.target.dataset.toggle);
            if (id) { const u = users.find(x => x.id === id); u.active = !u.active; simpan(); tampil(); }
        });
        tampil();
    }
};

const auth = document.body.dataset.auth;
if (auth !== "none" && !me) location = "login.html";
else if (auth === "admin" && me.role !== "admin") location = "dashboard.html";
else {
    renderNav();
    const halaman = document.body.dataset.page;
    if (halaman === "dashboard" || halaman === "tugas") tampilBanner();
    const p = pages[halaman];
    if (p) p();
}