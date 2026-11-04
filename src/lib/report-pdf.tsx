import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { BugSeverity, BugStatus } from "@prisma/client";
import type { getProjectReport } from "./report";
import { formatWib, statusLabelFor, summarizeRelease, type ShareAudience } from "./report-share";

type ProjectReport = Awaited<ReturnType<typeof getProjectReport>>;

// The bundled hyphenation rules are English and split Indonesian words wrongly ("lang-sung"): wrap whole words only.
Font.registerHyphenationCallback((word) => [word]);

export interface ReleasePdfInput {
  projectName: string;
  audience: ShareAudience;
  version?: string;
  generatedAt: Date;
  generatedBy: string;
  liveUrl?: string;
  report: ProjectReport;
}

const SEVERITIES: BugSeverity[] = ["BLOCKER", "HIGH", "MEDIUM", "LOW"];
const SEV_LABEL: Record<BugSeverity, string> = { BLOCKER: "Blocker", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
const SEV_COLOR: Record<BugSeverity, string> = { BLOCKER: "#B42318", HIGH: "#B54708", MEDIUM: "#8A6100", LOW: "#3D5A80" };

// Print palette: white stock, near-black ink, rules >= 1px so the PDF survives a grayscale printer.
const C = { ink: "#1F1C17", ink2: "#2E2A23", muted: "#5C564C", rule: "#CFC8BB", hair: "#E2DDD3", tint: "#F6F4EF", red: "#B42318", green: "#14783D" };

const s = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 56, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 11, color: C.ink },
  // No lineHeight on Page or wrappers: on Page it stops the fixed footer from rendering (react-pdf 4.9),
  // and on a wrapper View it inherits as a fixed size and doubles the spacing of smaller text.
  body: {},
  head: { flexDirection: "row", justifyContent: "space-between", fontSize: 9, color: C.muted, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: C.rule, marginBottom: 20 },
  foot: { position: "absolute", left: 48, right: 48, bottom: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 8.5, color: C.muted, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.hair },
  tag: { alignSelf: "flex-start", borderWidth: 1, borderColor: C.muted, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 7, fontSize: 8.5, fontFamily: "Helvetica-Bold", letterSpacing: 1, color: C.ink2 },
  tagInternal: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: C.ink, borderRadius: 4, padding: 8, marginBottom: 16 },
  verdictKicker: { fontFamily: "Helvetica-Bold", fontSize: 10, letterSpacing: 1.5, marginTop: 14 },
  verdict: { fontFamily: "Helvetica-Bold", fontSize: 32, lineHeight: 1.15, marginTop: 2 },
  lead: { fontSize: 13.5, color: C.ink2, marginTop: 8 },
  meta: { fontSize: 10, color: C.muted, marginTop: 6 },
  stats: { flexDirection: "row", marginTop: 20 },
  stat: { flex: 1, borderWidth: 1, borderColor: C.rule, borderRadius: 5, padding: 11, marginRight: 9 },
  statNum: { fontFamily: "Helvetica-Bold", fontSize: 28, lineHeight: 1.1 },
  statLabel: { fontSize: 10, color: C.ink2 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: 22, marginBottom: 7 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.hair, paddingVertical: 6 },
  th: { flexDirection: "row", backgroundColor: "#F1EEE7", borderBottomWidth: 1, borderBottomColor: C.rule, paddingVertical: 5, fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  mono: { fontFamily: "Courier-Bold", fontSize: 10 },
  note: { backgroundColor: C.tint, borderRadius: 5, padding: 11, marginTop: 20, fontSize: 10, color: C.ink2 },
  twoCol: { flexDirection: "row" },
  col: { flex: 1 },
  kv: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.hair, paddingVertical: 5 },
});

function Header({ projectName, right }: { projectName: string; right: string }) {
  return (
    <View style={s.head} fixed>
      <Text>BugBoard · {projectName}</Text>
      <Text>{right}</Text>
    </View>
  );
}

function Footer({ left }: { left: string }) {
  return (
    <View style={s.foot} fixed>
      <Text>{left}</Text>
      <Text render={({ pageNumber, totalPages }) => `Hal ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function assigneeName(a: { name: string | null; email: string } | null) {
  return a ? a.name || a.email : "Belum ditentukan";
}

export function ReleaseReportPdf({ projectName, audience, version, generatedAt, generatedBy, liveUrl, report: r }: ReleasePdfInput) {
  const sum = summarizeRelease(projectName, r, version);
  const internal = audience === "internal";
  const stamp = formatWib(generatedAt);
  const footLeft = `${internal ? "Internal" : "Eksternal"} · Dibuat oleh ${generatedBy}, ${stamp}`;
  const verdictColor = sum.releaseReady ? C.green : C.red;
  const statuses = (Object.entries(r.byStatus) as [BugStatus, number][]).filter(([, n]) => n > 0);

  return (
    <Document title={`Kesiapan rilis ${projectName}`} author={generatedBy} creator="BugBoard" language="id">
      {/* Page 1 is what WhatsApp shows as the file preview: verdict and three numbers, nothing else needed. */}
      <Page size="A4" style={s.page}>
        <Header projectName={projectName} right="Laporan kesiapan rilis" />
        <View style={s.body}>
        {internal ? (
          <View style={s.tagInternal}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5, letterSpacing: 1.2, marginRight: 8 }}>INTERNAL</Text>
            <Text style={{ fontSize: 10, color: C.ink2 }}>Jangan diteruskan ke luar tim.</Text>
          </View>
        ) : (
          <Text style={s.tag}>EKSTERNAL</Text>
        )}

        <Text style={[s.verdictKicker, { color: verdictColor }]}>{sum.releaseReady ? "READY" : "BLOCKED"}</Text>
        <Text style={s.verdict}>{sum.releaseReady ? "Siap rilis" : "Belum siap rilis"}</Text>
        <Text style={s.lead}>
          {sum.releaseReady
            ? "Tidak ada bug Blocker atau High yang masih aktif."
            : `Masih ada ${sum.highCount} bug High dan ${sum.blockerCount} Blocker yang belum selesai.`}
        </Text>
        <Text style={s.meta}>Target: {sum.version ?? "semua versi"} · Per {stamp}</Text>

        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={[s.statNum, sum.blockerCount > 0 ? { color: C.red } : {}]}>{sum.blockerCount}</Text>
            <Text style={s.statLabel}>Blocker</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statNum, sum.highCount > 0 ? { color: SEV_COLOR.HIGH } : {}]}>{sum.highCount}</Text>
            <Text style={s.statLabel}>High belum selesai</Text>
          </View>
          <View style={[s.stat, { marginRight: 0 }]}>
            <Text style={s.statNum}>{sum.activeTotal}</Text>
            <Text style={s.statLabel}>Total bug aktif</Text>
          </View>
        </View>

        {r.releaseBlockers.length > 0 && (
          <View>
            <Text style={s.h2}>Harus selesai sebelum rilis</Text>
            <View style={{ borderTopWidth: 1, borderTopColor: C.rule }}>
              {r.releaseBlockers.slice(0, 8).map((b) => (
                <View key={b.key} style={s.row} wrap={false}>
                  <Text style={[s.mono, { width: 62 }]}>{b.key}</Text>
                  <Text style={{ flex: 1, paddingRight: 8 }}>{b.title}</Text>
                  <Text style={{ width: 92, textAlign: "right", color: C.ink2 }}>{statusLabelFor(b.status, audience)}</Text>
                </View>
              ))}
            </View>
            {r.releaseBlockers.length > 8 && (
              <Text style={s.meta}>+{r.releaseBlockers.length - 8} bug lain, lihat halaman berikutnya.</Text>
            )}
          </View>
        )}

        {liveUrl && (
          <View style={s.note}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Data bisa berubah setelah laporan ini dibuat</Text>
            <Text>Versi live (perlu login): {liveUrl}</Text>
          </View>
        )}
        </View>
        <Footer left={footLeft} />
      </Page>

      <Page size="A4" style={s.page}>
        <Header projectName={projectName} right="Laporan kesiapan rilis · rincian" />
        <View style={s.body}>

        <Text style={[s.h2, { marginTop: 0 }]}>Penghalang rilis</Text>
        {r.releaseBlockers.length === 0 ? (
          <Text style={{ color: C.ink2 }}>Tidak ada bug Blocker atau High yang aktif.</Text>
        ) : (
          <View style={{ borderWidth: 1, borderColor: C.rule }}>
            <View style={s.th}>
              <Text style={{ width: 62, paddingLeft: 6 }}>ID</Text>
              <Text style={{ flex: 1 }}>Judul</Text>
              <Text style={{ width: 56 }}>Severity</Text>
              <Text style={{ width: 86 }}>Status</Text>
              <Text style={{ width: 96 }}>Penanggung jawab</Text>
            </View>
            {r.releaseBlockers.map((b) => (
              <View key={b.key} style={[s.row, { fontSize: 10 }]} wrap={false}>
                <Text style={[s.mono, { width: 62, paddingLeft: 6 }]}>{b.key}</Text>
                <Text style={{ flex: 1, paddingRight: 6 }}>{b.title}</Text>
                <Text style={{ width: 56, color: SEV_COLOR[b.severity] }}>{SEV_LABEL[b.severity]}</Text>
                <Text style={{ width: 86 }}>{statusLabelFor(b.status, audience)}</Text>
                <Text style={{ width: 96, color: b.assignee ? C.ink : C.muted }}>{assigneeName(b.assignee)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.twoCol}>
          <View style={[s.col, { marginRight: 18 }]}>
            <Text style={s.h2}>Bug aktif per severity</Text>
            <View style={{ borderTopWidth: 1, borderTopColor: C.rule }}>
              {SEVERITIES.map((sev) => (
                <View key={sev} style={s.kv}>
                  <Text>{SEV_LABEL[sev]}</Text>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{r.openBySeverity[sev] ?? 0}</Text>
                </View>
              ))}
              <View style={[s.kv, { borderBottomWidth: 0 }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Total</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{sum.activeTotal}</Text>
              </View>
            </View>

            <Text style={s.h2}>Penanggung jawab</Text>
            <View style={{ borderTopWidth: 1, borderTopColor: C.rule }}>
              {r.workload.length === 0 ? (
                <Text style={{ paddingVertical: 5, color: C.muted }}>Belum ada bug aktif.</Text>
              ) : (
                r.workload.map((w) => (
                  <View key={w.assignee} style={s.kv}>
                    <Text>{w.assignee === "Unassigned" ? "Belum ditentukan" : w.assignee}</Text>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{w.count}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={s.col}>
            <Text style={s.h2}>Status semua bug</Text>
            <View style={{ borderTopWidth: 1, borderTopColor: C.rule }}>
              {statuses.map(([st, n]) => (
                <View key={st} style={s.kv}>
                  <Text>{statusLabelFor(st, audience)}</Text>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{n}</Text>
                </View>
              ))}
              <View style={s.kv}>
                <Text>Pernah dibuka ulang (regresi)</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{r.reopened}</Text>
              </View>
            </View>

            {/* Review backlog is an internal process signal; clients only need the release verdict. */}
            {internal && (
              <View>
                <Text style={s.h2}>Draft lebih dari 3 hari</Text>
                <View style={{ borderTopWidth: 1, borderTopColor: C.rule }}>
                  {r.staleDrafts.length === 0 ? (
                    <Text style={{ paddingVertical: 5, color: C.muted }}>Tidak ada.</Text>
                  ) : (
                    r.staleDrafts.map((d) => (
                      <View key={d.key} style={s.kv}>
                        <Text style={{ flex: 1, paddingRight: 6 }}>{d.key} {d.title}</Text>
                        <Text>{Math.floor((generatedAt.getTime() - d.createdAt.getTime()) / 86_400_000)} hari</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={s.note} wrap={false}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>Cara membaca laporan ini</Text>
          <Text>
            Rilis dianggap siap bila tidak ada bug Blocker atau High yang masih aktif. Bug aktif adalah semua bug selain Closed,
            Invalid, Duplikat, Tidak bisa direproduksi, dan Won&apos;t fix.
            {internal ? "" : " \"Menunggu review\" berarti laporan baru yang belum diperiksa tim QA."}
          </Text>
        </View>
        </View>
        <Footer left={footLeft} />
      </Page>
    </Document>
  );
}

export function renderReleasePdf(input: ReleasePdfInput): Promise<Buffer> {
  return renderToBuffer(<ReleaseReportPdf {...input} />);
}
