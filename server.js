// Atom Journey — Server Tahap 2
// Menyimpan data siswa (per sesi = kelas + tanggal), dan menyediakan ekspor Excel
// terproteksi password khusus guru.

const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const ExcelJS = require("exceljs");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const db = new Database(path.join(__dirname, "data.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    kelas TEXT NOT NULL,
    session_key TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS exploration_data (
    student_id TEXT PRIMARY KEY REFERENCES students(id),
    data TEXT NOT NULL,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS elaboration_data (
    student_id TEXT PRIMARY KEY REFERENCES students(id),
    data TEXT NOT NULL,
    updated_at TEXT
  );
`);

const MODEL_ORDER = ["dalton", "thomson", "rutherford", "bohr", "kuantum"];
const MODEL_LABEL = { dalton: "Dalton", thomson: "Thomson", rutherford: "Rutherford", bohr: "Bohr", kuantum: "Mekanika Kuantum" };

function slug(s) {
  return (s || "").toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}

// Sesi otomatis dikelompokkan per KELAS + TANGGAL (bisa dikembangkan jadi label manual nanti)
function sessionKeyFor(kelas, dateStr) {
  const ymd = dateStr || new Date().toISOString().slice(0, 10);
  return slug(kelas) + "_" + ymd;
}

function checkTeacherPassword(req, res) {
  const provided = req.query.password || (req.body && req.body.password);
  const expected = process.env.TEACHER_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: "TEACHER_PASSWORD belum diatur di server (lihat README)." });
    return false;
  }
  if (provided !== expected) {
    res.status(401).json({ error: "Password salah." });
    return false;
  }
  return true;
}

/* ---------------- API: SISWA ---------------- */
app.post("/api/student", (req, res) => {
  const { nama, kelas } = req.body || {};
  if (!nama || !kelas || !nama.trim() || !kelas.trim()) {
    return res.status(400).json({ error: "Nama dan kelas wajib diisi." });
  }
  const sessionKey = sessionKeyFor(kelas);
  const id = slug(nama) + "__" + slug(kelas) + "__" + sessionKey;

  const existing = db.prepare("SELECT id FROM students WHERE id = ?").get(id);
  if (!existing) {
    db.prepare("INSERT INTO students (id, nama, kelas, session_key) VALUES (?,?,?,?)").run(id, nama.trim(), kelas.trim(), sessionKey);
  }

  const exp = db.prepare("SELECT data FROM exploration_data WHERE student_id = ?").get(id);
  const ela = db.prepare("SELECT data FROM elaboration_data WHERE student_id = ?").get(id);

  res.json({
    studentId: id,
    sessionKey,
    exploration: exp ? JSON.parse(exp.data) : null,
    elaboration: ela ? JSON.parse(ela.data) : null
  });
});

/* ---------------- API: SIMPAN JAWABAN (auto-save) ---------------- */
app.post("/api/save", (req, res) => {
  const { studentId, section, data } = req.body || {};
  if (!studentId || !section || (section !== "exploration" && section !== "elaboration")) {
    return res.status(400).json({ error: "studentId dan section ('exploration'/'elaboration') wajib diisi." });
  }
  const table = section === "exploration" ? "exploration_data" : "elaboration_data";
  const now = new Date().toISOString();
  const existing = db.prepare(`SELECT student_id FROM ${table} WHERE student_id = ?`).get(studentId);
  if (existing) {
    db.prepare(`UPDATE ${table} SET data = ?, updated_at = ? WHERE student_id = ?`).run(JSON.stringify(data), now, studentId);
  } else {
    db.prepare(`INSERT INTO ${table} (student_id, data, updated_at) VALUES (?,?,?)`).run(studentId, JSON.stringify(data), now);
  }
  res.json({ ok: true });
});

/* ---------------- API GURU: DAFTAR SESI ---------------- */
app.get("/api/sessions", (req, res) => {
  if (!checkTeacherPassword(req, res)) return;
  const rows = db.prepare(`
    SELECT session_key, kelas, COUNT(*) as jumlah_siswa, MIN(created_at) as mulai
    FROM students GROUP BY session_key ORDER BY session_key DESC
  `).all();
  res.json(rows);
});

/* ---------------- API GURU: EKSPOR EXCEL (password wajib) ---------------- */
app.get("/api/export", async (req, res) => {
  if (!checkTeacherPassword(req, res)) return;
  const sessionKey = req.query.session;
  if (!sessionKey) return res.status(400).json({ error: "Parameter 'session' wajib diisi." });

  const students = db.prepare("SELECT * FROM students WHERE session_key = ? ORDER BY nama").all(sessionKey);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Atom Journey";
  wb.created = new Date();

  // Sheet 1 — Exploration (REFERENSI, TIDAK DINILAI)
  const s1 = wb.addWorksheet("Exploration (Referensi)");
  s1.addRow(["CATATAN: Data di sheet ini untuk bahan refleksi & pembanding — BUKAN dasar penilaian."]);
  s1.mergeCells("A1:F1");
  s1.getRow(1).font = { italic: true, color: { argb: "FFB00060" } };
  s1.addRow([]);
  const header1 = s1.addRow(["Nama", "Kelas", "Model", "Inti Gambaran", "Hal Baru Dibanding Model Sebelumnya", "Hal yang Membuat Bertanya-tanya"]);
  header1.font = { bold: true };
  header1.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDEF0FF" } }; });

  students.forEach((s) => {
    const row = db.prepare("SELECT data FROM exploration_data WHERE student_id = ?").get(s.id);
    const d = row ? JSON.parse(row.data) : { ws: {} };
    MODEL_ORDER.forEach((m) => {
      const ws = (d.ws && d.ws[m]) || {};
      s1.addRow([s.nama, s.kelas, MODEL_LABEL[m], ws.gambaran || "", ws.baru || "", ws.tanya || ""]);
    });
  });
  s1.columns.forEach((col) => { col.width = 26; });

  // Sheet Tambahan — Engagement (REFERENSI, gambaran awal sebelum belajar)
  const ENGAGE_LABEL = {
    pejal: "Bola padat, tidak ada isinya",
    "isi-titik": "Bola berisi titik-titik kecil di dalamnya",
    "tata-surya": "Mirip tata surya",
    awan: "Seperti awan buram di sekitar pusatnya"
  };
  const s0 = wb.addWorksheet("Engagement (Referensi)");
  s0.addRow(["CATATAN: Gambaran awal siswa sebelum belajar — bahan diskusi pembuka, BUKAN dasar penilaian."]);
  s0.mergeCells("A1:C1");
  s0.getRow(1).font = { italic: true, color: { argb: "FFB00060" } };
  s0.addRow([]);
  const header0 = s0.addRow(["Nama", "Kelas", "Pilihan Gambaran Awal"]);
  header0.font = { bold: true };
  header0.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE6F2" } }; });
  students.forEach((s) => {
    const row = db.prepare("SELECT data FROM exploration_data WHERE student_id = ?").get(s.id);
    const d = row ? JSON.parse(row.data) : {};
    const pilihan = d.engagement && d.engagement.pilihan;
    s0.addRow([s.nama, s.kelas, ENGAGE_LABEL[pilihan] || "(belum menjawab)"]);
  });
  s0.columns.forEach((col) => { col.width = 30; });

  // Sheet 2 — Elaboration (DASAR PENILAIAN)
  const s2 = wb.addWorksheet("Elaboration (Dasar Penilaian)");
  s2.addRow(["CATATAN: Skor Kartu Sortir otomatis. Kolom skor Dimensi/TP dikosongkan — isi manual berdasarkan rubrik."]);
  s2.mergeCells("A1:L1");
  s2.getRow(1).font = { italic: true, color: { argb: "FFB00060" } };
  s2.addRow([]);
  const header2 = s2.addRow([
    "Nama", "Kelas", "Skor Kartu Sortir",
    "Jawaban Galeri — Kasus 1 (Rutherford vs Bohr)",
    "Jawaban Galeri — Kasus 2 (Thomson)",
    "Jawaban Galeri — Kasus 3 (Awan Elektron)",
    "Jawaban Galeri — Kasus 4 (Hubungan Antar Model)",
    "Jawaban Galeri — Kasus 5 (Kulit vs Orbital)",
    "Skor Pemahaman Konsep (TP1)",
    "Skor Analisis (TP3)",
    "Skor Kesimpulan (TP3, TP5)",
    "Skor Penerapan pada Situasi Baru (TP2, TP4)"
  ]);
  header2.font = { bold: true };
  header2.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE6F2" } }; });

  students.forEach((s) => {
    const row = db.prepare("SELECT data FROM elaboration_data WHERE student_id = ?").get(s.id);
    const d = row ? JSON.parse(row.data) : {};
    const cardsort = d.cardsort || {};
    const gallery = d.gallery || {};
    const correctCount = cardsort.correctCount || 0;
    s2.addRow([
      s.nama, s.kelas, correctCount + " / 10",
      gallery.g1 || "", gallery.g2 || "", gallery.g3 || "", gallery.g4 || "", gallery.g5 || "",
      "", "", "", "" // kolom skor Dimensi/TP dikosongkan, diisi guru
    ]);
  });
  s2.columns.forEach((col, i) => { col.width = i < 3 ? 20 : 30; });

  res.setHeader("Content-Disposition", `attachment; filename="AtomJourney_${sessionKey}.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  await wb.xlsx.write(res);
  res.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Atom Journey server jalan di port " + PORT));
