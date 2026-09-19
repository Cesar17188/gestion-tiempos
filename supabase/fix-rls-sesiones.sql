-- ==============================================================================
-- SCRIPT DE BASE DE DATOS SUPABASE: CORRECCIÓN Y VERIFICACIÓN DE POLÍTICAS RLS
-- ==============================================================================
-- Este script garantiza que todos los colaboradores autenticados (Anfitrionas y Administradores)
-- puedan cargar y gestionar las sesiones activas, niños, tutores y relaciones en sala.

-- 1. Políticas para tabla SESIONES_JUEGO
ALTER TABLE IF EXISTS public.sesiones_juego ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Permitir lectura de sesiones a usuarios autenticados
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sesiones_juego' AND policyname = 'Permitir lectura de sesiones a usuarios autenticados'
    ) THEN
        CREATE POLICY "Permitir lectura de sesiones a usuarios autenticados" 
        ON public.sesiones_juego FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    -- Permitir inserción de sesiones a usuarios autenticados
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sesiones_juego' AND policyname = 'Permitir crear sesiones a usuarios autenticados'
    ) THEN
        CREATE POLICY "Permitir crear sesiones a usuarios autenticados" 
        ON public.sesiones_juego FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
    END IF;

    -- Permitir actualización de sesiones a usuarios autenticados
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sesiones_juego' AND policyname = 'Permitir actualizar sesiones a usuarios autenticados'
    ) THEN
        CREATE POLICY "Permitir actualizar sesiones a usuarios autenticados" 
        ON public.sesiones_juego FOR UPDATE 
        TO authenticated 
        USING (true);
    END IF;
END $$;

-- 2. Políticas para tabla NINOS
ALTER TABLE IF EXISTS public.ninos ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ninos' AND policyname = 'Permitir lectura de ninos a usuarios autenticados'
    ) THEN
        CREATE POLICY "Permitir lectura de ninos a usuarios autenticados" 
        ON public.ninos FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ninos' AND policyname = 'Permitir crear o actualizar ninos a usuarios autenticados'
    ) THEN
        CREATE POLICY "Permitir crear o actualizar ninos a usuarios autenticados" 
        ON public.ninos FOR ALL 
        TO authenticated 
        USING (true);
    END IF;
END $$;

-- 3. Políticas para tabla TUTORES
ALTER TABLE IF EXISTS public.tutores ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tutores' AND policyname = 'Permitir lectura de tutores a usuarios autenticados'
    ) THEN
        CREATE POLICY "Permitir lectura de tutores a usuarios autenticados" 
        ON public.tutores FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tutores' AND policyname = 'Permitir crear o actualizar tutores a usuarios autenticados'
    ) THEN
        CREATE POLICY "Permitir crear o actualizar tutores a usuarios autenticados" 
        ON public.tutores FOR ALL 
        TO authenticated 
        USING (true);
    END IF;
END $$;

-- 4. Políticas para tabla intermedia NINOS_TUTORES
ALTER TABLE IF EXISTS public.ninos_tutores ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ninos_tutores' AND policyname = 'Permitir acceso a ninos_tutores a usuarios autenticados'
    ) THEN
        CREATE POLICY "Permitir acceso a ninos_tutores a usuarios autenticados" 
        ON public.ninos_tutores FOR ALL 
        TO authenticated 
        USING (true);
    END IF;
END $$;
