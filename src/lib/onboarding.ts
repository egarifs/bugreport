// Konfigurasi onboarding sebagai kode (mudah diubah). Langkah selesai karena aksi nyata di project Latihan, bukan klik "tandai selesai".
export const GUIDE_ROLES = ["QA", "DEVELOPER", "VENDOR", "CLIENT", "ADMIN"] as const;
export type GuideRole = (typeof GUIDE_ROLES)[number];
export const GUIDE_ROLE_LABEL: Record<GuideRole, string> = { QA: "QA", DEVELOPER: "Developer", VENDOR: "Vendor", CLIENT: "Klien", ADMIN: "PO / Admin" };
export const GUIDE_ROLE_HINT: Record<GuideRole, string> = {
  QA: "Menulis test case, menjalankan test run, melaporkan dan memverifikasi bug.",
  DEVELOPER: "Mengerjakan bug yang ditugaskan dan memindahkannya ke Ready for QA.",
  VENDOR: "Menjalankan test dan mengisi hasil perbaikan untuk bug yang ditugaskan.",
  CLIENT: "Melaporkan bug dari sisi pengguna dan memantau perkembangannya.",
  ADMIN: "Meninjau draf, memantau kesiapan rilis, dan menyetujui dokumen.",
};

export const STEP_EVENTS = ["sandbox.bug_created", "sandbox.triage_done", "sandbox.comment_added", "sandbox.testrun_executed"] as const;
export type StepEvent = (typeof STEP_EVENTS)[number];
export const STEP_LABEL: Record<StepEvent, { title: string; hint: string }> = {
  "sandbox.bug_created": { title: "Laporkan sebuah bug", hint: "Buka Bug → Laporkan bug, isi judul, langkah, dan severity." },
  "sandbox.triage_done": { title: "Ubah status sebuah bug", hint: "Buka sebuah bug, lalu pindahkan statusnya (mis. dari Draft ke Open)." },
  "sandbox.comment_added": { title: "Tulis komentar di bug", hint: "Di halaman bug, tulis komentar pada kolom diskusi." },
  "sandbox.testrun_executed": { title: "Jalankan satu item test run", hint: "Buka Test case → test run → catat hasil Lolos atau Gagal." },
};

/** Langkah pertama per peran panduan (urutan tampil). */
export const ROLE_STEPS: Record<GuideRole, readonly StepEvent[]> = {
  QA: ["sandbox.bug_created", "sandbox.triage_done", "sandbox.testrun_executed", "sandbox.comment_added"],
  DEVELOPER: ["sandbox.triage_done", "sandbox.comment_added"],
  VENDOR: ["sandbox.testrun_executed", "sandbox.triage_done", "sandbox.comment_added"],
  CLIENT: ["sandbox.bug_created", "sandbox.comment_added"],
  ADMIN: ["sandbox.triage_done", "sandbox.bug_created", "sandbox.testrun_executed"],
};

export const isGuideRole = (v: unknown): v is GuideRole => typeof v === "string" && (GUIDE_ROLES as readonly string[]).includes(v);

export interface SandboxFacts { bugsCreated: number; statusChanges: number; comments: number; attempts: number }
/** Event yang sudah terjadi dari fakta aksi nyata di project Latihan. */
export function eventsFromFacts(f: SandboxFacts): StepEvent[] {
  return [
    ...(f.bugsCreated > 0 ? ["sandbox.bug_created" as const] : []),
    ...(f.statusChanges > 0 ? ["sandbox.triage_done" as const] : []),
    ...(f.comments > 0 ? ["sandbox.comment_added" as const] : []),
    ...(f.attempts > 0 ? ["sandbox.testrun_executed" as const] : []),
  ];
}

export function progressOf(role: GuideRole | null, completed: readonly string[]) {
  const steps = ROLE_STEPS[role ?? "QA"];
  const done = steps.filter((s) => completed.includes(s)).length;
  return { done, total: steps.length, steps: steps.map((s) => ({ event: s, ...STEP_LABEL[s], ok: completed.includes(s) })) };
}

export const GLOSSARY: readonly { term: string; meaning: string }[] = [
  { term: "Severity", meaning: "Seberapa parah dampak bug: Blocker, High, Medium, Low." },
  { term: "Prioritas", meaning: "Seberapa cepat bug harus dikerjakan: Urgent, High, Normal, Low." },
  { term: "Triase", meaning: "Meninjau bug Draft: diterima menjadi Open, atau ditolak (Invalid/Duplicate)." },
  { term: "Ready for QA", meaning: "Perbaikan selesai dan menunggu QA menguji di build yang diisi." },
  { term: "Test run", meaning: "Satu putaran eksekusi sekumpulan test case; hasilnya Lolos, Gagal, atau Terblokir." },
  { term: "RTM", meaning: "Matriks yang menautkan bagian requirement ke test case, hasil, dan bug." },
  { term: "Definition of Done", meaning: "Daftar syarat yang harus terpenuhi sebelum sprint ditutup." },
];

export const FEATURES: readonly { title: string; when: string; path: string }[] = [
  { title: "Bug & triase", when: "Saat menemukan masalah atau meninjau laporan baru.", path: "" },
  { title: "Test case & test run", when: "Saat menyiapkan dan menjalankan pengujian.", path: "/test-cases" },
  { title: "Sprint", when: "Saat merencanakan dan menutup siklus kerja.", path: "/sprints" },
  { title: "Dokumen & RTM", when: "Saat memeriksa requirement dan cakupan ujinya.", path: "/docs" },
  { title: "Laporan", when: "Saat memantau kesiapan rilis, tren, dan performa.", path: "/reports" },
];

export const TOUR_ID = "bug-list";
/** Langkah tur sorotan di daftar bug Latihan. Penyorot memakai elemen nyata lewat selector; langkah tanpa elemen dilewati. */
export const TOUR_STEPS: readonly { selector: string; title: string; text: string }[] = [
  { selector: 'nav[aria-label="Tampilan bug"]', title: "Tampilan bug", text: "Pindah antara Perlu review, Tugas saya, dan Semua bug." },
  { selector: 'form[role="search"]', title: "Cari dan saring", text: "Cari ID atau judul, lalu saring menurut severity, modul, atau sprint." },
  { selector: "table", title: "Daftar bug", text: "Klik satu bug untuk melihat detail, mengubah status, dan menulis komentar." },
  { selector: 'a[href$="/bugs/new"]', title: "Laporkan bug", text: "Mulai dari sini untuk membuat laporan baru. Ini langkah pertama di checklist." },
];
