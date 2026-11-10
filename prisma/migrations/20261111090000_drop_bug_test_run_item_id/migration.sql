-- Closes the Step #10 migration order: Bug.testRunItemId was copied to "TestRunItemBug" in
-- 20261110090000. Refuse to drop if any legacy link has no join row (would lose data).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Bug" b
    WHERE b."testRunItemId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "TestRunItemBug" l WHERE l."bugId" = b."id" AND l."itemId" = b."testRunItemId")
  ) THEN
    RAISE EXCEPTION 'Bug.testRunItemId has links missing from TestRunItemBug; backfill before dropping';
  END IF;
END $$;

ALTER TABLE "Bug" DROP CONSTRAINT IF EXISTS "Bug_testRunItemId_fkey";
DROP INDEX IF EXISTS "Bug_testRunItemId_key";
ALTER TABLE "Bug" DROP COLUMN "testRunItemId";
