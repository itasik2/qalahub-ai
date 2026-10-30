-- QalaHub AI | schema v1 | PostgreSQL 17
-- Apply only to a dedicated qalahub-ai database after review.
-- No data is scraped or copied from any external provider by this migration.
BEGIN;

CREATE TABLE IF NOT EXISTS city (
  id                text PRIMARY KEY,
  name_ru           text NOT NULL,
  name_kk           text,
  region_id         text,
  aliases           text[] NOT NULL DEFAULT '{}',
  timezone          text NOT NULL DEFAULT 'Asia/Almaty',
  country_code      char(2) NOT NULL DEFAULT 'KZ' CHECK (country_code = 'KZ'),
  coverage          text NOT NULL DEFAULT 'experimental'
                    CHECK (coverage IN ('pilot','experimental','supported')),
  latitude          double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude         double precision CHECK (longitude BETWEEN -180 AND 180),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS city_provider (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  base_url          text,
  license_note      text,
  enabled           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS city_place (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           text NOT NULL REFERENCES city(id) ON UPDATE CASCADE,
  provider_id       text NOT NULL REFERENCES city_provider(id),
  external_id       text NOT NULL,
  name              text NOT NULL CHECK (length(btrim(name)) > 0),
  category          text NOT NULL,
  address           text,
  latitude          double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude         double precision CHECK (longitude BETWEEN -180 AND 180),
  source_url        text NOT NULL CHECK (source_url ~* '^https?://'),
  retrieved_at      timestamptz NOT NULL,
  verified_at       timestamptz,
  last_updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, provider_id, external_id),
  UNIQUE (city_id, id)
);

CREATE TABLE IF NOT EXISTS city_event (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           text NOT NULL REFERENCES city(id) ON UPDATE CASCADE,
  provider_id       text NOT NULL REFERENCES city_provider(id),
  external_id       text NOT NULL,
  title             text NOT NULL CHECK (length(btrim(title)) > 0),
  category          text NOT NULL DEFAULT 'event',
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz,
  place_id          uuid,
  price_min_kzt     integer CHECK (price_min_kzt >= 0),
  price_max_kzt     integer CHECK (price_max_kzt >= 0),
  ticket_url        text CHECK (ticket_url IS NULL OR ticket_url ~* '^https?://'),
  source_url        text NOT NULL CHECK (source_url ~* '^https?://'),
  retrieved_at      timestamptz NOT NULL,
  verified_at       timestamptz,
  status            text NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','cancelled','postponed')),
  last_updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_event_place_same_city FOREIGN KEY(city_id,place_id) REFERENCES city_place(city_id,id),
  CONSTRAINT event_time_order CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT event_price_order CHECK (price_min_kzt IS NULL OR price_max_kzt IS NULL OR price_max_kzt >= price_min_kzt),
  UNIQUE (city_id,provider_id,external_id)
);

CREATE INDEX IF NOT EXISTS idx_city_place_city_category ON city_place(city_id,category);
CREATE INDEX IF NOT EXISTS idx_city_place_city_name ON city_place(city_id,name);
CREATE INDEX IF NOT EXISTS idx_city_event_city_time ON city_event(city_id,starts_at);
CREATE INDEX IF NOT EXISTS idx_city_event_city_end ON city_event(city_id,ends_at);
CREATE INDEX IF NOT EXISTS idx_city_event_city_status_time ON city_event(city_id,status,starts_at);
COMMIT;
