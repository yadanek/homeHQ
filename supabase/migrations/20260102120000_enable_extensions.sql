-- migration: enable required postgresql extensions
-- description: enables uuid-ossp for uuid generation and pgcrypto for secure random code generation
-- affected objects: database extensions
-- dependencies: none

-- enable uuid-ossp extension for uuid generation functions
-- this extension provides gen_random_uuid() and other uuid utilities
create extension if not exists "uuid-ossp";

-- enable pgcrypto extension for cryptographic functions
-- this extension provides gen_random_bytes() used for secure invitation code generation
create extension if not exists "pgcrypto";

