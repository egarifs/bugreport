"use client";

import { StatePanel } from "@/components/ui/state-panel";

// Server errors never leak details here; digest lets admins match the server log.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="max-w-lg mx-auto p-8 mt-16">
      <StatePanel
        kind="error"
        title="Halaman gagal dimuat"
        reference={error.digest ?? "tanpa kode"}
        action={{ label: "Coba lagi", onClick: reset }}
      >
        Coba lagi. Jika terus gagal, kirim kode referensi ke admin.
      </StatePanel>
    </main>
  );
}
