import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { TypeIcon, timeAgo } from "@/components/layout/notification-parts";

const PAGE = 50;

async function markAllRead() {
  "use server";
  const uid = (await auth())?.user?.id;
  if (!uid) return;
  await prisma.notification.updateMany({ where: { userId: uid, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const uid = (await auth())?.user?.id;
  if (!uid) redirect("/login");
  const { filter, page } = await searchParams;
  const unreadOnly = filter === "unread";
  const p = Math.max(1, Number(page) || 1);
  const where = { userId: uid, ...(unreadOnly ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (p - 1) * PAGE }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: uid, readAt: null } }),
  ]);
  const now = Date.now();
  const tab = (active: boolean) =>
    `px-3 py-1.5 rounded text-sm font-medium ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`;

  return (
    <AppShell>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center gap-3">
          <h1 className="font-bold text-slate-900">Notifikasi</h1>
          <nav className="flex gap-1" aria-label="Filter">
            <Link href="/notifications" className={tab(!unreadOnly)} aria-current={!unreadOnly ? "page" : undefined}>Semua</Link>
            <Link href="/notifications?filter=unread" className={tab(unreadOnly)} aria-current={unreadOnly ? "page" : undefined}>
              Belum dibaca{unread > 0 && ` (${unread})`}
            </Link>
          </nav>
          {unread > 0 && (
            <form action={markAllRead} className="ml-auto">
              <button className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50">Tandai semua dibaca</button>
            </form>
          )}
        </header>

        <main className="p-6">
          {items.length === 0 ? (
            <div className="max-w-xl mx-auto mt-10 text-center bg-white border border-slate-200 rounded-lg p-10">
              <p className="font-semibold text-slate-900">{unreadOnly ? "Semua sudah dibaca" : "Belum ada notifikasi"}</p>
              <p className="mt-1 text-sm text-slate-500">Notifikasi disimpan 90 hari.</p>
            </div>
          ) : (
            <ul className="max-w-3xl bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={`/notifications/${n.id}`} prefetch={false} className={`flex gap-3 px-5 py-4 hover:bg-slate-50 ${n.readAt ? "" : "bg-slate-50/60"}`}>
                    <TypeIcon type={n.type} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm ${n.readAt ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</span>
                      {n.body && <span className="block text-sm text-slate-500 truncate mt-0.5">{n.body}</span>}
                      <span className="block text-xs text-slate-500 mt-1">{timeAgo(n.createdAt.toISOString(), now)}</span>
                    </span>
                    {!n.readAt && <span className="mt-2 w-2 h-2 shrink-0 rounded-full bg-rose-600" aria-label="Belum dibaca" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {total > PAGE && (
            <nav className="max-w-3xl mt-4 flex justify-between text-sm" aria-label="Halaman">
              {p > 1 ? <Link href={`?${unreadOnly ? "filter=unread&" : ""}page=${p - 1}`} className="font-semibold underline">← Lebih baru</Link> : <span />}
              {p * PAGE < total && <Link href={`?${unreadOnly ? "filter=unread&" : ""}page=${p + 1}`} className="font-semibold underline">Lebih lama →</Link>}
            </nav>
          )}
        </main>
      </div>
    </AppShell>
  );
}
