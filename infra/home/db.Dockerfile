# Postgres 16 with PostGIS for arm64 and amd64 alike: the official postgres image plus Debian's
# PostGIS package (postgis/postgis publishes amd64 only). pg_trgm and unaccent ship with Postgres.
FROM postgres:16-bookworm
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-16-postgis-3 \
  && rm -rf /var/lib/apt/lists/*
