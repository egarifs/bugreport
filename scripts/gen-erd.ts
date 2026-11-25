// Generates docs/database-erd.md (Mermaid) from the Prisma schema, so the diagram never drifts.
// Usage: npx tsx scripts/gen-erd.ts
import { Prisma } from "@prisma/client";
import { writeFileSync } from "node:fs";

type Field = Prisma.DMMF.Field;
const models = Prisma.dmmf.datamodel.models;
const enums = new Set(Prisma.dmmf.datamodel.enums.map((e) => e.name));

// Domain groups for the readable per-area diagrams; any model not listed lands in "Lainnya".
const GROUPS: Record<string, string[]> = {
  "Pengguna, project, dan akses": ["User", "Project", "ProjectMember", "Module", "RolePermission", "ApiKey", "ApiKeyRateLimit", "ProjectResourceLink", "OnboardingProgress", "AuditLog", "Notification", "NotificationPreference"],
  "Bug dan kolaborasi": ["Bug", "BugComment", "BugAttachment", "BugAssignee", "BugCoReporter", "BugTag", "SavedBugView", "Sprint", "SprintClosure", "PerformanceNote"],
  "Test case dan test run": ["TestCase", "TestCaseVersion", "TestRun", "TestRunItem", "TestRunAttempt", "TestRunItemBug", "Evidence", "AgentRun"],
  "Dokumen bisnis dan STLC": ["BusinessDoc", "BusinessDocVersion", "BusinessDocChunk", "RequirementSection", "StlcDoc"],
  "Chat": ["ChatThread", "ChatMessage"],
};

const isFk = (f: Field) => f.kind === "object" && (f.relationFromFields?.length ?? 0) > 0;

function entity(name: string, withFields: boolean) {
  const m = models.find((x) => x.name === name)!;
  if (!withFields) return "";
  const rows = m.fields
    .filter((f) => f.kind !== "object")
    .map((f) => {
      const type = enums.has(f.type) ? "enum" : f.type.toLowerCase();
      const tag = f.isId ? " PK" : m.fields.some((o) => isFk(o) && o.relationFromFields?.includes(f.name)) ? " FK" : f.isUnique ? " UK" : "";
      return `    ${type}${f.isList ? "[]" : ""} ${f.name}${tag}`;
    });
  return `  ${name} {\n${rows.join("\n")}\n  }`;
}

// One line per relation: parent ||--o{ child, drawn from the FK side. Implicit many-to-many drawn once.
function relations(names: Set<string>) {
  const out: string[] = [];
  const seenM2M = new Set<string>();
  for (const m of models) {
    for (const f of m.fields) {
      if (f.kind !== "object") continue;
      if (isFk(f)) {
        if (!names.has(m.name) || !names.has(f.type)) continue;
        const optional = m.fields.filter((x) => f.relationFromFields?.includes(x.name)).some((x) => !x.isRequired);
        out.push(`  ${f.type} ${optional ? "|o" : "||"}--o{ ${m.name} : "${f.name}"`);
      } else if (f.isList) {
        const back = models.find((x) => x.name === f.type)?.fields.find((x) => x.relationName === f.relationName && x.name !== f.name);
        if (back?.isList) {
          const k = [m.name, f.type].sort().join("|") + f.relationName;
          if (seenM2M.has(k) || !names.has(m.name) || !names.has(f.type)) continue;
          seenM2M.add(k);
          out.push(`  ${m.name} }o--o{ ${f.type} : "${f.name}"`);
        }
      }
    }
  }
  return [...new Set(out)];
}

const all = new Set(models.map((m) => m.name));
const grouped = new Set(Object.values(GROUPS).flat());
const rest = [...all].filter((n) => !grouped.has(n)).sort();
const areas: Record<string, string[]> = { ...GROUPS, ...(rest.length ? { Lainnya: rest } : {}) };

const diagram = (names: string[], fields: boolean) => {
  const set = new Set(names.filter((n) => all.has(n)));
  const ents = [...set].map((n) => entity(n, fields)).filter(Boolean);
  return ["```mermaid", "erDiagram", ...relations(set), ...ents, "```"].join("\n");
};

const md = [
  "# Grafik relasi database",
  "",
  `Dibuat otomatis dari \`prisma/schema.prisma\` (${models.length} tabel). Jangan diedit tangan; jalankan \`npx tsx scripts/gen-erd.ts\` setelah mengubah skema.`,
  "",
  "Keterangan: `PK` primary key, `FK` foreign key, `UK` unique. Garis `||--o{` = satu ke banyak, `|o--o{` = satu ke banyak dengan induk opsional, `}o--o{` = banyak ke banyak.",
  "",
  "## Ringkasan seluruh tabel (relasi saja)",
  "",
  diagram([...all], false),
  "",
  ...Object.entries(areas).flatMap(([title, names]) => [`## ${title}`, "", diagram(names, true), ""]),
].join("\n");

writeFileSync("docs/database-erd.md", md);
console.log(`docs/database-erd.md ditulis: ${models.length} tabel, ${Object.keys(areas).length} area.`);
