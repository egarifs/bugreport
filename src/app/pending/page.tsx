import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const session = await auth();
  const user = session?.user as
    | { email?: string; status?: string; name?: string }
    | undefined;

  if (!user?.email) {
    redirect("/login");
  }

  if (user.status === "ACTIVE") {
    redirect("/projects");
  }

  const isRejected = user.status === "REJECTED";
  const isSuspended = user.status === "SUSPENDED";

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
          !
        </div>

        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          {isRejected
            ? "Akses Ditolak"
            : isSuspended
            ? "Akun Ditangguhkan"
            : "Menunggu Persetujuan Admin"}
        </h1>

        <p className="text-sm text-slate-600 mb-6">
          {isRejected ? (
            "Permintaan akses akun Anda tidak disetujui oleh Administrator."
          ) : isSuspended ? (
            "Akun Anda sedang ditangguhkan oleh Administrator."
          ) : (
            <>
              Akun Anda telah terdaftar dengan email{" "}
              <strong className="text-slate-900">{user.email}</strong>. Admin
              sedang melakukan review akses Anda. Anda belum dapat membuka project
              sebelum disetujui.
            </>
          )}
        </p>

        <div className="bg-slate-50 rounded border border-slate-200 p-3 mb-6 text-left text-xs text-slate-600 space-y-1">
          <div>
            <span className="text-slate-400">Email:</span> {user.email}
          </div>
          <div>
            <span className="text-slate-400">Status:</span>{" "}
            <span className="font-medium text-amber-700">{user.status}</span>
          </div>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded transition"
          >
            Keluar (Sign Out)
          </button>
        </form>
      </div>
    </main>
  );
}
