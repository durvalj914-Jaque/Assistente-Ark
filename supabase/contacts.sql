CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  google_resource_name TEXT UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  phone_e164 TEXT,
  photo_url TEXT,
  organization TEXT,
  job_title TEXT,
  notes TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_read_contacts" ON contacts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = contacts.tenant_id AND tm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE POLICY "members_can_insert_contacts" ON contacts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = contacts.tenant_id AND tm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE POLICY "members_can_update_contacts" ON contacts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = contacts.tenant_id AND tm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE POLICY "members_can_delete_contacts" ON contacts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = contacts.tenant_id AND tm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_e164);
