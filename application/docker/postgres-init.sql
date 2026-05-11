-- Postgres init script — enables required extensions on first container start.
-- Used by docker-compose.yml volume mount.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- fallback uuid functions

-- Grant defaults
GRANT ALL PRIVILEGES ON DATABASE competency TO postgres;
