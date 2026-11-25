-- Step 9: biomod stat bonuses live in bionics.effect_bonuses since 20261125170000, and the site no longer reads
-- this table. Its policies, grants, indexes and foreign keys go with it. No cascade: nothing else depends on it.
drop table public.bionic_bonuses;
