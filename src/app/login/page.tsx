import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { status?: string } | undefined;

  if (user?.status === "ACTIVE") {
    redirect("/projects");
  } else if (user) {
    redirect("/pending");
  }

  const { callbackUrl } = await searchParams;
  const showDevLogin = process.env.ENABLE_DEV_LOGIN === "true";

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6 bg-[radial-gradient(900px_400px_at_20%_0%,rgba(255,214,150,.3),transparent_70%)]">
      <div className="flex flex-col md:flex-row gap-10 md:gap-16 items-center max-w-[1080px] w-full">
        <section className="flex-1">
          <div className="flex items-center gap-2.5 mb-7">
            <span className="w-10 h-10 rounded-[10px] bg-ink text-on-ink flex items-center justify-center font-mono font-bold text-[13px]">
              BB
            </span>
            <span className="font-bold text-lg">BugBoard Sismedika</span>
          </div>
          <h1 className="text-[34px] leading-[42px] font-bold max-w-[20ch] mb-3">
            Satu tempat untuk temuan bug tim internal dan mitra.
          </h1>
          <p className="text-base text-slate-600 max-w-[52ch] mb-6">
            Lapor, triase, uji ulang, dan bagikan status rilis tanpa berpindah aplikasi.
          </p>
          <ul className="flex flex-col gap-2.5 text-[15px]">
            {[
              "Penjaga duplikat saat melapor",
              "Test run dengan riwayat percobaan",
              "Laporan rilis siap kirim ke WhatsApp",
            ].map((t) => (
              <li key={t} className="flex gap-2.5 items-center">
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 6.2l2.2 2.2 4.8-4.8" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </section>

        <div className="w-full md:w-[400px] bg-surface rounded-2xl shadow-lg border border-slate-200 p-8 flex flex-col gap-4">
          <h2 className="text-[22px] leading-7 font-bold">Masuk</h2>
          <p className="text-sm text-slate-600">
            Gunakan akun Google kantor atau akun Google yang diundang.
          </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl || "/projects" });
          }}
        >
          <button
            type="submit"
            className="w-full h-11 flex items-center justify-center gap-3 px-4 border border-slate-400 rounded-lg bg-surface hover:bg-slate-50 text-sm font-bold text-slate-900 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Masuk dengan Google
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Akun baru perlu disetujui Admin sebelum bisa membuka project. Anda akan melihat status persetujuan setelah masuk.
        </div>
        <p className="text-xs text-slate-600">
          Dengan masuk, aktivitas Anda tercatat di audit log project.
        </p>

        {showDevLogin && (
          <div className="mt-2 pt-4 border-t border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-500 mb-3">
              Developer Quick Login
            </p>
            <form
              action={async (formData) => {
                "use server";
                const email = formData.get("email") as string;
                await signIn("dev-login", {
                  email,
                  redirectTo: callbackUrl || "/projects",
                });
              }}
              className="space-y-2"
            >
              <input
                type="email"
                name="email"
                placeholder="test.qa@example.com"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <button
                type="submit"
                className="w-full text-xs py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded"
              >
                Login Dev (Auto-create user)
              </button>
            </form>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}
