-- Google sign-in (AUC-85/AUC-86): a user is identified by phone, email, or both.
--
-- Until now `phone_number` was NOT NULL and was the only identifier a user
-- could have, because OTP was the only way in. Google returns a verified email
-- and never a phone number, so a Google sign-in had literally nothing to write
-- into the required column and the INSERT failed.
--
-- Existing rows are untouched: every one keeps its phone number and gets a NULL
-- email. Nothing is dropped and nothing is rewritten, so this is reversible by
-- restoring NOT NULL once the email column is empty again.

-- 1. Phone becomes optional. The unique index stays: Postgres permits any
--    number of NULLs in a unique index, so users without a phone do not
--    collide with each other.
ALTER TABLE "users" ALTER COLUMN "phone_number" DROP NOT NULL;

-- 2. Email, unique on the same terms.
ALTER TABLE "users" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- 3. "At least one identifier" enforced in the database, not just the
--    application. Without this the two nullable columns above would allow an
--    anonymous row that nothing could ever log in as, search for, or contact —
--    and the admin dashboard has no way to render one.
ALTER TABLE "users"
  ADD CONSTRAINT "users_identity_present"
  CHECK ("phone_number" IS NOT NULL OR "email" IS NOT NULL);
