ALTER TABLE public.gym_settings
  ADD COLUMN IF NOT EXISTS color_theme text NOT NULL DEFAULT 'forge-green'
  CHECK (color_theme IN ('forge-green', 'ocean-blue', 'ember-orange', 'violet', 'rose'));
