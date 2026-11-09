-- EXECUTE on the bounded functions also requires USAGE on their schema.
-- The worker still has no direct table rights over tenant records.
GRANT USAGE ON SCHEMA app TO forma_worker;
