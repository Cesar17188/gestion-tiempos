# ⏳ Gestión de Tiempos

Una aplicación web moderna para la gestión y seguimiento del tiempo. Diseñada para proporcionar a los usuarios una herramienta eficiente donde puedan registrar sus ingresos y tiempos de forma rápida, y a los administradores una visión global del uso a través de paneles de control.

## ✨ Características Principales

- **Autenticación Segura:** Sistema de login y recuperación de contraseñas impulsado por Supabase.
- **Roles de Usuario:** Diferenciación entre usuarios regulares y administradores con paneles dedicados.
- **Gestión de Registros (Ingresos):** Interfaz para añadir y visualizar tiempos registrados, incluyendo búsquedas inteligentes de usuarios y niños con selectores interactivos que evitan la duplicidad de datos.
- **Panel de Administración (Dashboard Admin):** Vistas analíticas y de control para la administración (cargado de forma diferida o *Lazy Loaded*).
- **Perfil de Usuario:** Sección dedicada para que los usuarios configuren y actualicen sus datos.
- **Server-Side Rendering (SSR):** Optimizado para SEO y cargas iniciales rápidas mediante Angular SSR con Express.

## 🛠️ Stack Tecnológico

- **Frontend:** Angular 21 (Componentes Standalone)
- **Estilos:** Tailwind CSS v4 (con PostCSS) y Angular Animations
- **Backend & Base de Datos:** Supabase
- **SSR (Server-Side Rendering):** Angular Universal / Express
- **Testing:** Vitest

## 📋 Requisitos Previos

Asegúrate de tener instalado en tu entorno local:
- [Node.js](https://nodejs.org/) (Versión 20 o superior recomendada)
- [npm](https://www.npmjs.com/) (Instalado con Node.js)

## 🚀 Instalación y Ejecución Local

1. **Clona el repositorio:**
   ```bash
   git clone <url-del-repositorio>
   cd gestion-tiempos
   ```

2. **Instala las dependencias:**
   ```bash
   npm install
   ```

3. **Configura las variables de entorno:**
   Configura tus credenciales de Supabase en los archivos `src/environments/environment.ts` (asegúrate de que existan).

4. **Inicia el servidor de desarrollo:**
   ```bash
   npm start
   ```
   Abre tu navegador y navega a `http://localhost:4200/`.

## 📂 Estructura del Proyecto

El proyecto está diseñado bajo una arquitectura orientada a características (*Feature-driven*):

```
src/
└── app/
    ├── core/          # Lógica central: Guards (auth, admin) y Servicios (Supabase)
    ├── features/      # Módulos de la aplicación
    │   ├── admin/     # Panel de administración
    │   ├── auth/      # Flujos de autenticación
    │   ├── dashboard/ # Panel principal de usuario
    │   ├── ingreso/   # Registro de tiempos
    │   ├── perfil/    # Perfil del usuario
    │   └── splash/    # Pantalla de carga
    ├── app.routes.ts  # Configuración de enrutamiento y Lazy Loading
    └── ...
```

## 📜 Comandos Disponibles

- `npm start` - Inicia el entorno de desarrollo local (`ng serve`).
- `npm run build` - Construye la aplicación para producción en el directorio `dist/`.
- `npm run serve:ssr:gestion-tiempos` - Inicia el servidor Node.js compilado con Server-Side Rendering.
- `npm test` - Ejecuta los tests unitarios utilizando Vitest.

## 🤖 Agentes de IA

Si estás utilizando asistentes de código basados en IA (como Copilot o Cursor), consulta el archivo [`agents.md`](./agents.md) en la raíz del proyecto para conocer las reglas de arquitectura y convenciones de código.
