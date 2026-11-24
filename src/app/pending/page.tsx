import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function PendingPage() {
  const session = await auth();
  const sessionUser = session?.user as
    | { email?: string; status?: string; name?: string }
    | undefined;

  if (!sessionUser?.email) redirect("/login");

  // Always check fresh status in DB directly
  const dbUser = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    select: { status: true, rejectReason: true },
  });

  const currentStatus = dbUser?.status || sessionUser.status;

  if (currentStatus === "ACTIVE") {
    // Redirect via route handler to safely update JWT cookie with response header
    redirect("/api/auth/refresh-session");
  }

  const isRejected = currentStatus === "REJECTED";
  const isSuspended = currentStatus === "SUSPENDED";
  const initials = (sessionUser.name || sessionUser.email).slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4 bg-glow">
      <div className="w-full max-w-[520px] bg-surface rounded-2xl shadow-lg border border-slate-200 p-8 flex flex-col gap-[18px]">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-warn-bg text-warn flex items-center justify-center text-[11px] font-bold">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="font-bold text-[15px] truncate">{sessionUser.name || sessionUser.email}</div>
            <div className="text-xs text-slate-600 truncate">{sessionUser.email}</div>
          </div>
          <form
            className="ml-auto"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="h-9 px-3 text-[13px] font-bold border border-slate-300 rounded-lg hover:bg-slate-50">
              Keluar
            </button>
          </form>
        </div>

        <h1 className="text-2xl leading-[30px] font-bold">
          {isRejected ? "Akses ditolak" : isSuspended ? "Akun ditangguhkan" : "Akun Anda menunggu persetujuan"}
        </h1>

        {isRejected || isSuspended ? (
          <p className="text-sm text-slate-600">
            {isRejected
              ? "Permintaan akses akun Anda tidak disetujui Admin."
              : "Akun Anda sedang ditangguhkan Admin."}{" "}
            Hubungi Admin atau QA lead Anda untuk informasi lebih lanjut.
            {dbUser?.rejectReason && (
              <span className="block mt-3 p-3 bg-bad-bg border border-bad-border rounded text-bad">
                <b>Alasan:</b> {dbUser.rejectReason}
              </span>
            )}
          </p>
        ) : (
          <>
            <ol className="flex flex-col gap-3 text-sm">
              <li><b>Akun dibuat</b><div className="text-xs text-slate-600">Lewat Google · {sessionUser.email}</div></li>
              <li><b className="text-link">Admin meninjau</b><div className="text-xs text-slate-600">Admin sudah diberi notifikasi. Biasanya kurang dari 1 hari kerja.</div></li>
              <li><b className="text-slate-600">Diberi akses project dan peran</b><div className="text-xs text-slate-600">Setelah disetujui, buka lagi halaman ini untuk masuk ke project.</div></li>
            </ol>
            <div className="flex gap-2.5 items-center">
              <Link
                href="/api/auth/refresh-session"
                prefetch={false}
                className="h-10 px-4 inline-flex items-center bg-action hover:bg-action-hover text-on-action text-sm font-bold rounded-lg cursor-pointer"
              >
                Periksa lagi
              </Link>
              <span className="text-xs text-slate-600">Butuh cepat? Hubungi QA lead atau PIC project Anda.</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}


