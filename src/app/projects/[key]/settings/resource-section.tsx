import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { deleteResourceLink, saveResourceLink } from "@/lib/resource-service";

// F9 (mockup 95): link to the test-accounts document. Only the link is stored; credentials stay in the document.
export async function ResourceSection({ projectId, projectKey, canManage }: { projectId: string; projectKey: string; canManage: boolean }) {
  const [rows, members] = await Promise.all([
    prisma.projectResourceLink.findMany({ where: { projectId, kind: "TEST_ACCOUNTS" }, include: { owner: { select: { name: true, email: true } } } }),
    prisma.projectMember.findMany({ where: { projectId, role: { in: ["ADMIN", "QA", "DEVELOPER"] } }, include: { user: { select: { id: true, name: true, email: true } } } }),
  ]);
  const path = `/projects/${projectKey}/settings`;
  const primary = rows.find((r) => r.audience === "PRIMARY");
  const vendor = rows.find((r) => r.audience === "VENDOR");

  async function save(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
    "use server";
    const actor = await requireProjectPermission(projectId, "project.manage");
    const audience = fd.get("audience") === "VENDOR" ? "VENDOR" : "PRIMARY";
    const r = await saveResourceLink({ id: actor.id, email: actor.email }, projectId, audience, {
      label: String(fd.get("label") ?? ""), url: String(fd.get("url") ?? ""), visibility: String(fd.get("visibility") ?? ""), ownerUserId: String(fd.get("ownerUserId") ?? "") || null,
    });
    if ("error" in r) return { error: r.error };
    revalidatePath(path);
    return { ok: "Link disimpan." };
  }
  async function remove(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
    "use server";
    const actor = await requireProjectPermission(projectId, "project.manage");
    const r = await deleteResourceLink({ id: actor.id, email: actor.email }, projectId, fd.get("audience") === "VENDOR" ? "VENDOR" : "PRIMARY");
    if ("error" in r) return { error: r.error };
    revalidatePath(path);
    return { ok: "Link dihapus." };
  }

  const status = (r: (typeof rows)[number]) => (
    <div className="text-xs mt-2 space-y-1">
      {r.lastProblem && (
        <p className="text-sev-blocker font-bold" role="alert">
          {r.lastProblem === "ROLE_MISSING" ? `Agent melapor peran "${r.lastProblemRole ?? "?"}" tidak ada` : "Agent melapor link tidak bisa dibuka"}
          {r.lastProblemAt && ` · ${r.lastProblemAt.toLocaleString("id-ID")}`}
        </p>
      )}
      <p className="text-slate-600">{r.lastOkAt ? `Terakhir berhasil dibuka agent: ${r.lastOkAt.toLocaleString("id-ID")}` : "Belum pernah dibuka agent."}</p>
    </div>
  );

  const form = (audience: "PRIMARY" | "VENDOR", r?: (typeof rows)[number]) => (
    <ActionForm action={save} className="grid gap-3 text-sm">
      <input type="hidden" name="audience" value={audience} />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="grid gap-1 font-bold">Label
          <input name="label" required maxLength={80} defaultValue={r?.label} placeholder="Akun uji Staging" className="px-3 py-2 min-h-[44px] border border-slate-300 rounded font-normal" />
        </label>
        <label className="grid gap-1 font-bold">URL
          <input name="url" type="url" required defaultValue={r?.url} placeholder="https://" className="px-3 py-2 min-h-[44px] border border-slate-300 rounded font-normal" />
        </label>
      </div>
      {audience === "PRIMARY" && (
        <fieldset className="grid gap-1">
          <legend className="font-bold">Terlihat oleh</legend>
          <label className="flex items-center gap-2 min-h-[44px]"><input type="radio" name="visibility" value="INTERNAL" defaultChecked={r?.visibility !== "INTERNAL_AND_VENDOR"} /> Internal saja</label>
          <label className="flex items-center gap-2 min-h-[44px]"><input type="radio" name="visibility" value="INTERNAL_AND_VENDOR" defaultChecked={r?.visibility === "INTERNAL_AND_VENDOR"} /> Internal + Vendor</label>
          <span className="text-xs text-slate-600">Admin, QA, Developer selalu bisa melihat. Client dan Viewer tidak pernah.</span>
        </fieldset>
      )}
      <label className="grid gap-1 font-bold">Penanggung jawab isi dokumen
        <select name="ownerUserId" defaultValue={r?.ownerUserId ?? ""} className="px-3 py-2 min-h-[44px] border border-slate-300 rounded font-normal bg-surface">
          <option value="">Belum ditentukan</option>
          {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-normal">Mendapat notifikasi bila agent melaporkan link tidak bisa dibuka atau peran tidak ada.</span>
      </label>
      <div><SubmitButton pendingText="Menyimpan...">Simpan</SubmitButton></div>
    </ActionForm>
  );

  const view = (r: (typeof rows)[number]) => (
    <div className="text-sm">
      <p className="font-bold">{r.label}</p>
      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-link underline break-all">{r.url}</a>
      <p className="text-xs text-slate-600 mt-1">Penanggung jawab: {r.owner?.name || r.owner?.email || "belum ditentukan"}</p>
      {status(r)}
    </div>
  );

  return (
    <section className="bg-surface border border-slate-200 rounded p-6" aria-labelledby="resource-heading">
      <h2 id="resource-heading" className="text-base font-bold text-slate-900">Sumber akun uji</h2>
      <p className="text-sm text-slate-600 mb-4 max-w-prose">BugBoard hanya menyimpan link. Isi dokumen dibuka oleh agent dengan akses masing-masing anggota.</p>

      <h3 className="text-sm font-bold mb-2">Link utama</h3>
      {canManage ? form("PRIMARY", primary) : primary ? view(primary) : <p className="text-sm text-slate-600">Belum diatur.</p>}
      {canManage && primary && status(primary)}
      {canManage && primary && !vendor && (
        <ActionForm action={remove} className="mt-2"><input type="hidden" name="audience" value="PRIMARY" /><SubmitButton pendingText="Menghapus..." className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-100 text-sm font-bold">Hapus link utama</SubmitButton></ActionForm>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100">
        <h3 className="text-sm font-bold">Link khusus Vendor <span className="font-normal text-slate-600">(opsional)</span></h3>
        <p className="text-xs text-slate-600 mb-2">Pakai bila Vendor memakai akun uji berbeda. Bila diisi, Vendor melihat link ini, bukan link utama.</p>
        {!primary ? <p className="text-sm text-slate-600">Isi link utama dulu.</p> : canManage ? (
          <>
            {form("VENDOR", vendor)}
            {vendor && <ActionForm action={remove} className="mt-2"><input type="hidden" name="audience" value="VENDOR" /><SubmitButton pendingText="Menghapus..." className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-100 text-sm font-bold">Hapus link Vendor</SubmitButton></ActionForm>}
          </>
        ) : vendor ? view(vendor) : <p className="text-sm text-slate-600">Tidak ada.</p>}
      </div>

      <details className="mt-6 text-sm">
        <summary className="cursor-pointer font-bold min-h-[44px] flex items-center">Format dokumen yang disarankan</summary>
        <table className="mt-2 text-xs border border-slate-200 w-full max-w-xl">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Lingkungan</th><th className="p-2">Peran</th><th className="p-2">Username</th><th className="p-2">Password</th><th className="p-2">Catatan</th></tr></thead>
          <tbody><tr className="border-t border-slate-200"><td className="p-2">Staging</td><td className="p-2">Sales A</td><td className="p-2">sales.a@qa.test</td><td className="p-2">••••••</td><td className="p-2">tim Utara</td></tr></tbody>
        </table>
        <p className="text-xs text-slate-600 mt-1">Nama peran harus sama dengan yang ditulis di test case. Password tetap di dokumen, bukan di BugBoard.</p>
      </details>
      <p className="text-xs text-slate-600 mt-4">Perubahan link dicatat di audit log.</p>
    </section>
  );
}
