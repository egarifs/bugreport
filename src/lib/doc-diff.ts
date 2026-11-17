// Diff dokumen Markdown per bagian (heading). Bagian dicocokkan lewat judul; tanpa dependency.
export type SectionDiff = {
  heading: string;
  kind: "added" | "removed" | "changed" | "same";
  lines: { op: "+" | "-" | " "; text: string }[]; // hanya terisi untuk changed/added/removed
};

function sections(md: string) {
  const out = new Map<string, string>();
  let h = "(awal dokumen)";
  let buf: string[] = [];
  const flush = () => { const t = buf.join("\n").trim(); if (t || out.has(h)) out.set(h, ((out.get(h) ?? "") + "\n" + t).trim()); else if (h !== "(awal dokumen)") out.set(h, t); buf = []; };
  for (const line of md.split("\n")) {
    const m = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (m) { flush(); h = m[1]; } else buf.push(line);
  }
  flush();
  return out;
}

// LCS per baris. ponytail: O(n*m) cukup untuk bagian dokumen (<~2000 baris); ganti ke Myers bila perlu.
export function lineDiff(a: string, b: string): SectionDiff["lines"] {
  const x = a ? a.split("\n") : [], y = b ? b.split("\n") : [];
  const dp = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: SectionDiff["lines"] = [];
  let i = 0, j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { out.push({ op: " ", text: x[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: "-", text: x[i++] });
    else out.push({ op: "+", text: y[j++] });
  }
  while (i < x.length) out.push({ op: "-", text: x[i++] });
  while (j < y.length) out.push({ op: "+", text: y[j++] });
  return out;
}

export function diffDocs(oldMd: string, newMd: string): SectionDiff[] {
  const o = sections(oldMd), n = sections(newMd);
  const res: SectionDiff[] = [];
  for (const [heading, text] of n) {
    if (!o.has(heading)) res.push({ heading, kind: "added", lines: lineDiff("", text) });
    else if (o.get(heading) === text) res.push({ heading, kind: "same", lines: [] });
    else res.push({ heading, kind: "changed", lines: lineDiff(o.get(heading)!, text) });
  }
  for (const [heading, text] of o) if (!n.has(heading)) res.push({ heading, kind: "removed", lines: lineDiff(text, "") });
  return res;
}
