import Link from "next/link";
import type { ReactNode } from "react";

type Kind = "empty" | "filtered" | "forbidden" | "error";

const DEFAULT_TITLE: Record<Kind, string> = {
  empty: "Belum ada data",
  filtered: "Tidak ada yang cocok",
  forbidden: "Anda tidak punya akses",
  error: "Gagal dimuat",
};

// Shared empty / filtered / forbidden / error pattern (G7). Errors get role="alert".
export function StatePanel({
  kind,
  title,
  children,
  action,
  reference,
}: {
  kind: Kind;
  title?: string;
  children?: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  reference?: string;
}) {
  const cls =
    "bg-surface border border-slate-200 rounded p-10 text-center text-sm text-slate-600 flex flex-col items-center gap-2";
  const btn = "mt-2 px-3.5 py-2 bg-action hover:bg-action-hover text-on-action text-sm font-bold rounded";
  return (
    <div className={cls} role={kind === "error" ? "alert" : "status"}>
      <p className="font-bold text-slate-900">{title ?? DEFAULT_TITLE[kind]}</p>
      {children && <p>{children}</p>}
      {reference && (
        <p>
          Kode referensi: <code className="font-bold">{reference}</code>
        </p>
      )}
      {action?.href && (
        <Link href={action.href} className={btn}>
          {action.label}
        </Link>
      )}
      {action?.onClick && (
        <button type="button" onClick={action.onClick} className={btn}>
          {action.label}
        </button>
      )}
    </div>
  );
}
