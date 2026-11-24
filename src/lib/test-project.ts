import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

const ids: string[] = [];
let hooked = false;

/** Buat project uji dan hapus otomatis saat proses tes selesai, supaya database dev tidak menumpuk fixture. */
export async function createTestProject(args: Prisma.ProjectCreateArgs) {
  const project = await prisma.project.create(args);
  ids.push(project.id);
  if (!hooked) {
    hooked = true;
    // beforeExit terpicu lagi setiap loop kosong: jalankan sekali saja, kalau tidak tes tidak pernah selesai.
    process.once("beforeExit", async () => {
      try { await prisma.project.deleteMany({ where: { id: { in: ids.splice(0) } } }); } catch { /* pembersihan best-effort; jangan menggagalkan tes */ }
    });
  }
  return project;
}
