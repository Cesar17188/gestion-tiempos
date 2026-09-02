// Supabase Edge Function: invitar-usuario
// Permite a los Administradores invitar nuevo personal al sistema de forma segura

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // 1. Manejo de peticiones CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Faltan variables de entorno en el servidor de Supabase (SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).");
    }

    // 2. Verificar la identidad y rol del usuario que hace la petición
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No se proporcionó token de autorización." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente para validar la sesión del solicitante
    const supabaseCaller = createClient(supabaseUrl, supabaseAnonKey ?? "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user: callerUser }, error: userError } = await supabaseCaller.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Sesión inválida o expirada. Por favor inicie sesión nuevamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente con permisos de Administrador Supremo (Service Role)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Validar en la tabla perfiles que quien llama sea ADMINISTRADOR
    const { data: callerProfile, error: profileCheckError } = await supabaseAdmin
      .from("perfiles")
      .select("rol, activo")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileCheckError || !callerProfile || callerProfile.rol !== "ADMINISTRADOR") {
      return new Response(
        JSON.stringify({ error: "Acceso denegado: Solo los Administradores Generales pueden dar de alta personal." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Extraer y validar los datos del nuevo colaborador
    const { email, nombre, rol, redirectTo } = await req.json();

    if (!email || !nombre || !rol) {
      return new Response(
        JSON.stringify({ error: "Los campos email, nombre y rol son obligatorios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailNormalizado = String(email).trim().toLowerCase();
    const nombreNormalizado = String(nombre).trim();
    const rolValido = (rol === "ADMINISTRADOR" || rol === "ENCARGADO") ? rol : "ENCARGADO";

    // 4. Generar contraseña temporal segura
    const tempPassword = "VP!" + Math.random().toString(36).slice(-8) + "Aa9#";

    // 5. Crear usuario directamente para saltar limites de envio de correo
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.createUser({
      email: emailNormalizado,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        nombre: nombreNormalizado,
        rol: rolValido,
      },
    });

    if (inviteError) {
      // Si el usuario ya existe en auth.users
      if (inviteError.message?.toLowerCase().includes("already registered") || inviteError.message?.toLowerCase().includes("already exists")) {
        // Obtenemos los datos del usuario existente para sincronizar el perfil si es necesario
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = listData?.users?.find((u: { id: string; email?: string }) => u.email?.toLowerCase() === emailNormalizado);

        if (existingUser) {
          await supabaseAdmin.from("perfiles").upsert({
            id: existingUser.id,
            email: emailNormalizado,
            nombre: nombreNormalizado,
            rol: rolValido,
            activo: true,
          });

          // Actualizamos la contraseña para poder darsela al administrador
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password: tempPassword
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: `El usuario ya existía en el sistema. Se reactivó su perfil.`,
              password: tempPassword,
              user: existingUser,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: `Error de Supabase Auth: ${inviteError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nuevoUsuario = inviteData.user;

    // 5. Asegurar la fila en la tabla public.perfiles
    if (nuevoUsuario) {
      const { error: upsertError } = await supabaseAdmin.from("perfiles").upsert({
        id: nuevoUsuario.id,
        email: emailNormalizado,
        nombre: nombreNormalizado,
        rol: rolValido,
        activo: true,
      });

      if (upsertError) {
        console.error("Error al registrar perfil en tabla perfiles:", upsertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `El colaborador ha sido registrado con éxito de forma directa, sin depender de los correos automáticos.`,
        password: tempPassword,
        user: nuevoUsuario,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error en Edge Function invitar-usuario:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error interno del servidor al procesar la invitación." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
