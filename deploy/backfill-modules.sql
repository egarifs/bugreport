-- Idempotent: turn legacy free-text Bug.component / TestCase.moduleArea into Module rows and link them.
-- Case variants ("Billing"/"billing") merge into one module.
INSERT INTO "Module" (id, "projectId", name, "sortOrder", "updatedAt")
SELECT gen_random_uuid(), "projectId", min(n), 0, now()
FROM (
  SELECT "projectId", trim(component) AS n FROM "Bug" WHERE coalesce(trim(component), '') <> ''
  UNION ALL
  SELECT "projectId", trim("moduleArea") FROM "TestCase" WHERE coalesce(trim("moduleArea"), '') <> ''
) s
WHERE NOT EXISTS (SELECT 1 FROM "Module" m WHERE m."projectId" = s."projectId" AND lower(m.name) = lower(s.n))
GROUP BY "projectId", lower(n)
ON CONFLICT DO NOTHING;

UPDATE "Bug" b SET "moduleId" = m.id FROM "Module" m
WHERE b."moduleId" IS NULL AND m."projectId" = b."projectId" AND lower(m.name) = lower(trim(b.component));

UPDATE "TestCase" t SET "moduleId" = m.id FROM "Module" m
WHERE t."moduleId" IS NULL AND m."projectId" = t."projectId" AND lower(m.name) = lower(trim(t."moduleArea"));
