-- Tabela de Status Updates (estilo WhatsApp Status/Stories)
-- Expira automaticamente após 24h (via app-level filter)

CREATE TABLE IF NOT EXISTS public.status_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  type TEXT DEFAULT 'text', -- text, image, video
  media_id TEXT, -- WhatsApp media_id se for imagem/vídeo
  bg_color TEXT DEFAULT '#1f2c34', -- cor de fundo para status de texto
  author_name TEXT DEFAULT 'Admin',
  author_role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

-- RLS
ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can read own status" ON public.status_updates
  FOR SELECT USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own status" ON public.status_updates
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own status" ON public.status_updates
  FOR DELETE USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_status_tenant ON public.status_updates(tenant_id, created_at DESC);

-- Comentário
COMMENT ON TABLE public.status_updates IS 'Status updates estilo WhatsApp, expiram em 24h';
