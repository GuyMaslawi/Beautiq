-- Session revocation stamp.
--
-- Sessions are JWTs, so nothing about them lives server-side and a credential
-- change could not previously end them. An admin resetting the password of a
-- compromised account locked out the real owner while the attacker's existing
-- token stayed valid for the rest of its lifetime. Sessions issued before this
-- moment are now rejected in getCurrentUser(). NULL = all sessions valid.
ALTER TABLE "User" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
