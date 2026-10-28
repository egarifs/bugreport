"use client";

// Server errors never leak details here; digest lets admins match the server log.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="max-w-lg mx-auto p-8 mt-16 bg-white border border-slate-200 rounded" role="alert">
      <h1 className="text-base font-bold text-slate-900 mb-2">Halaman gagal dimuat</h1>
      <p className="text-sm text-slate-600 mb-4">
        Coba lagi. Jika terus gagal, kirim kode ini ke admin: <code className="font-bold">{error.digest ?? "tanpa kode"}</code>
      </p>
      <button onClick={reset} className="px-3.5 py-2 bg-action hover:bg-action-hover text-white text-sm font-bold rounded">
        Coba lagi
      </button>
    </main>
  );
}
