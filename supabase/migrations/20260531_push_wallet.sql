ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS auth_token TEXT;
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS pass_message TEXT;
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS pass_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS wallet_device_registrations (
  id uuid primary key default uuid_generate_v4(),
  device_library_id text not null,
  pass_type_id text not null,
  serial_number text not null,
  push_token text not null,
  created_at timestamptz default now(),
  unique (device_library_id, serial_number)
);
CREATE INDEX IF NOT EXISTS idx_wdr_serial ON wallet_device_registrations (pass_type_id, serial_number);
CREATE INDEX IF NOT EXISTS idx_wdr_device ON wallet_device_registrations (device_library_id);

CREATE TABLE IF NOT EXISTS wallet_notifications (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid references merchants(id) on delete cascade,
  title text not null,
  body text not null,
  sent_count int not null default 0,
  created_at timestamptz default now()
);
