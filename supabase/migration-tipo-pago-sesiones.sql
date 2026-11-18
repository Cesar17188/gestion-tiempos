-- ==============================================================================
-- SCRIPT DE MIGRACIÓN: AGREGAR COLUMNA TIPO_PAGO A SESIONES_JUEGO
-- ==============================================================================
-- Agrega la columna tipo_pago a la tabla sesiones_juego para registrar el método
-- de pago utilizado por el cliente en cada sesión (Efectivo, Produbanco, Bendo/produbanco, De una).

ALTER TABLE IF EXISTS public.sesiones_juego
ADD COLUMN IF NOT EXISTS tipo_pago TEXT,
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES public.tutores(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sesiones_juego.tipo_pago IS 'Método de pago de la sesión: Efectivo, Produbanco, Bendo/produbanco, De una';
COMMENT ON COLUMN public.sesiones_juego.tutor_id IS 'ID del adulto responsable que ingresó al niño en esta sesión específica';
