// Tanpa impor Node: dipakai middleware (Edge).
/** PENDING hanya boleh menyentuh project Latihan miliknya sendiri. Murni: dipakai authz dan tes. */
export function pendingMayAccess(user: { id: string; status: string }, project: { isSandbox: boolean; sandboxOwnerId: string | null }): boolean {
  return user.status === "PENDING" && project.isSandbox && project.sandboxOwnerId === user.id;
}

/** Jalur yang boleh dibuka PENDING di middleware (cek akhir tetap di server): /projects/<KODE>/..., bukan /projects/new. */
export function pendingPathAllowed(pathname: string): boolean {
  // Lampiran dan bukti bug tetap dilayani lewat API (izin akhir di authz); rute API lain tertutup.
  if (/^\/api\/projects\/[^/]+\/(attachments|evidence)\/[^/]+$/.test(pathname)) return true;
  if (pathname === "/onboarding") return true; // halaman Panduan
  const m = /^\/projects\/([^/]+)(\/|$)/.exec(pathname);
  return !!m && m[1] !== "new";
}
