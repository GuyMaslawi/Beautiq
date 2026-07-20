-- Seed the reference table of beauty/wellness categories so it is always
-- populated in every environment (including production, where `next build`
-- never runs `prisma db seed`). Idempotent: keyed on the unique "key" column,
-- so re-running only refreshes the Hebrew label and never duplicates rows.
INSERT INTO "BusinessCategory" ("id", "key", "nameHe", "createdAt", "updatedAt")
VALUES
  ('seedcat_nails',            'nails',            'ציפורניים',         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_brows',            'brows',            'גבות',              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_lashes',           'lashes',           'ריסים',             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_hair',             'hair',             'שיער',              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_makeup',           'makeup',           'איפור',             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_cosmetics',        'cosmetics',        'קוסמטיקה',          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_laser',            'laser',            'הסרת שיער בלייזר',  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_aesthetics',       'aesthetics',       'טיפולי אסתטיקה',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_massage',          'massage',          'עיסוי',             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_spa',              'spa',              'ספא',               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_permanent_makeup', 'permanent_makeup', 'איפור קבוע',        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seedcat_other',            'other',            'אחר',               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "nameHe" = EXCLUDED."nameHe";
