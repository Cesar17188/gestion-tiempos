-- ==============================================================================
-- SCRIPT DE MIGRACIÓN: AGREGAR TIPO DE PASE Y OBSERVACIONES A TUTORES
-- ==============================================================================
-- Agrega las columnas tipo_pase y observaciones_tipo_pase a la tabla tutores
-- para categorizar al adulto responsable (Fidelidad, Nuevo Cliente, Alianza / Grupos).

ALTER TABLE IF EXISTS public.tutores 
ADD COLUMN IF NOT EXISTS tipo_pase TEXT,
ADD COLUMN IF NOT EXISTS observaciones_tipo_pase TEXT;

-- Comentario informativo en las columnas
COMMENT ON COLUMN public.tutores.tipo_pase IS 'Tipo de pase: Fidelidad, Nuevo Cliente, Alianza / Grupos';
COMMENT ON COLUMN public.tutores.observaciones_tipo_pase IS 'Observaciones y notas adicionales sobre el tipo de pase del tutor';
