-- ==============================================================================
-- SCRIPT DE MIGRACIÓN: ASOCIAR ADULTO RESPONSABLE (TUTOR_ID) A CADA SESIÓN DE JUEGO
-- ==============================================================================
-- Agrega la columna tutor_id a la tabla sesiones_juego para que cada sesión histórica
-- conserve exactamente el adulto responsable que llevó al niño en esa visita.

ALTER TABLE IF EXISTS public.sesiones_juego
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES public.tutores(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sesiones_juego.tutor_id IS 'ID del adulto responsable que ingresó al niño en esta sesión específica';
