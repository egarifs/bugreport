import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { encode, getToken } from "next-auth/jwt";

async function recheckAction() {
  "use server";
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true, isAdmin: true },
  });

  if (dbUser?.status === "ACTIVE") {
    // Refresh JWT cookie so middleware lets user enter /projects
    const cookieStore = await cookies();
    const secure = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").startsWith("https://");
    const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
    const existingToken = await getToken({
      req: {
        headers: {
          cookie: cookieStore.toString(),
        },
      },
      secret: process.env.AUTH_SECRET,
      secureCookie: secure,
    });

    if (existingToken) {
      const updatedToken = {
        ...existingToken,
        userId: dbUser.id,
        status: dbUser.status,
        isAdmin: dbUser.isAdmin,
      };
      const newCookieVal = await encode({
        token: updatedToken,
        secret: process.env.AUTH_SECRET!,
        salt: cookieName,
      });

      cookieStore.set(cookieName, newCookieVal, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
      });
    }

    redirect("/projects");
  }

  redirect("/pending");
}

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
    // If active in DB but cookie still says PENDING, run recheck to update cookie & redirect
    await recheckAction();
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
              <form action={recheckAction}>
                <button type="submit" className="h-10 px-4 inline-flex items-center bg-action hover:bg-action-hover text-on-action text-sm font-bold rounded-lg cursor-pointer">
                  Periksa lagi
                </button>
              </form>
              <span className="text-xs text-slate-600">Butuh cepat? Hubungi QA lead atau PIC project Anda.</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

