-- ==============================================================================
-- SCRIPT DE BASE DE DATOS SUPABASE: GESTIÓN DE PERSONAL, PERFILES Y TRIGGER AUTH
-- ==============================================================================

-- 1. Asegurar la tabla perfiles con todas las columnas necesarias
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'ENCARGADO' CHECK (rol IN ('ADMINISTRADOR', 'ENCARGADO')),
    activo BOOLEAN DEFAULT TRUE,
    hora_entrada TEXT DEFAULT '09:00',
    hora_salida TEXT DEFAULT '20:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de seguridad RLS
-- Permitir lectura a usuarios autenticados
CREATE POLICY "Permitir lectura de perfiles a usuarios autenticados" 
ON public.perfiles FOR SELECT 
TO authenticated 
USING (true);

-- Permitir a usuarios editar su propio perfil
CREATE POLICY "Permitir a usuarios actualizar su propio perfil" 
ON public.perfiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Permitir a los ADMINISTRADORES insertar y actualizar cualquier perfil
CREATE POLICY "Permitir a Administradores gestionar cualquier perfil" 
ON public.perfiles FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() AND rol = 'ADMINISTRADOR'
  )
);

-- 4. Función y Trigger automático para crear perfil cuando un usuario se registra o confirma invitación
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, email, nombre, rol, activo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'ENCARGADO'),
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    nombre = COALESCE(EXCLUDED.nombre, public.perfiles.nombre),
    rol = COALESCE(EXCLUDED.rol, public.perfiles.rol);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existía previamente y recrearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
