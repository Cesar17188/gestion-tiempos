# Instrucciones para Agentes de IA (agents.md)

Este documento describe la arquitectura, stack tecnológico y convenciones de código para el proyecto **gestion-tiempos**. Los agentes de IA o asistentes de código deben adherirse a estas pautas al generar, refactorizar o analizar el código.

## 🛠️ Stack Tecnológico

- **Framework Frontend:** Angular 21 (Standalone Components).
- **Estilos:** Tailwind CSS v4 (con PostCSS) y animaciones de Angular (`@angular/animations`).
- **Backend / BaaS:** Supabase (`@supabase/supabase-js`).
- **Server-Side Rendering (SSR):** Angular SSR con Express.
- **Node.js & TypeScript:** TypeScript ~5.9.2.
- **Testing:** Vitest.

## 📂 Arquitectura y Estructura del Proyecto

El proyecto sigue una estructura orientada a características (Feature-driven architecture) dentro de `src/app/`:

- **`/core/`**: Contiene la lógica central, infraestructura y configuraciones globales.
  - `/guards/`: Guards funcionales para proteger rutas (ej. `auth.guard.ts`, `admin-guard.ts`).
  - `/services/`: Servicios singleton y lógica de acceso a datos/autenticación con Supabase.
- **`/features/`**: Contiene las funcionalidades o pantallas de la aplicación. Deben ser lo más independientes posible.
  - `/admin/`: Panel y funcionalidades de administración (`DashboardAdmin`).
  - `/auth/`: Flujos de autenticación (`Login`, `ActualizarPassword`).
  - `/dashboard/`: Panel principal para los usuarios regulares.
  - `/ingreso/`: Formularios o gestión de los ingresos y tiempos.
  - `/perfil/`: Configuración y visualización del perfil de usuario.
  - `/splash/`: Pantalla de carga/bienvenida (`Splash`).

## 📝 Convenciones de Desarrollo

### 1. Angular Standalone Components
- Utilizar siempre componentes Standalone. No utilizar `NgModules`.
- Importar las directivas, pipes y otros componentes estrictamente en la propiedad `imports` del decorador `@Component`.

### 2. Enrutamiento (Routing)
- Las rutas están definidas en `app.routes.ts`.
- Emplear **Lazy Loading** (`loadComponent`) para cargar vistas que no son críticas en el primer renderizado (por ejemplo, el módulo de `/admin`).
- Las protecciones de ruta se realizan a través de Functional Guards (`canActivate`, `canMatch`).

### 3. Integración con Supabase
- Toda la comunicación con Supabase (Autenticación y Base de Datos) debe encapsularse en los servicios dentro de `core/services/`.
- No llamar a Supabase directamente desde los componentes (excepto para prototipado rápido justificado).
- **Manejo de Búsquedas y Duplicados:** Cuando se realicen búsquedas por texto (ej. `ilike`) que puedan generar múltiples coincidencias o posibles duplicados (como nombres de personas), **no se debe** utilizar `.limit(1)` de forma arbitraria. Se debe devolver una lista limitando los resultados (ej. `.limit(10)`) y delegar a la interfaz de usuario (mediante selectores o dropdowns interactivos) la decisión de seleccionar el registro correcto para evitar sobrescribir o elegir datos erróneos.
- **Relaciones Muchos a Muchos (Ej. Niños - Tutores):** Cuando se realizan consultas relacionales que devuelven arreglos (como la extracción de tutores desde niños), se debe manejar explícitamente el array (por ejemplo extrayendo el último elemento activo) antes de intentar leer propiedades como `nombres_apellidos`. No asumir que retornará un solo objeto.

### 4. UI y Formularios Reactivos
- **Formularios Modales In-Place:** Se promueve el uso de diálogos flotantes (modales) con `ReactiveFormsModule` dentro del mismo componente para interacciones rápidas (como actualizar datos de un adulto responsable en una tarjeta), evitando tener que redirigir a nuevas páginas para acciones simples.

### 4. Estilos y TailwindCSS
- El proyecto utiliza Tailwind CSS v4. Usar las clases de utilidad provistas por Tailwind directamente en los templates (archivos `.html`).
- Limitar el uso de CSS puro o archivos `.css` de componentes, a menos que sea estrictamente necesario para animaciones complejas que Tailwind no pueda manejar.

### 5. Server-Side Rendering (SSR)
- Dado que el proyecto tiene SSR habilitado (`app.routes.server.ts` y `server.ts`), no se debe acceder globalmente a los objetos del navegador como `window`, `document` o `localStorage` directamente en el constructor o en el inicializador de la clase.
- Siempre validar la ejecución con `isPlatformBrowser()` cuando se necesiten APIs exclusivas del DOM.

### 6. Reactividad (Signals y RxJS)
- Si aplica, utilizar **Signals** de Angular (`signal`, `computed`, `effect`) para estados locales sincrónicos, en lugar del enfoque tradicional con Subject o variables de clase.
- Mantener **RxJS** para flujos asíncronos y eventos complejos (ej. peticiones HTTP/Supabase).

## 🚀 Comandos Principales

- **Desarrollo:** `npm start` (ejecuta `ng serve`)
- **Construcción:** `npm run build`
- **Testing:** `npm test` (ejecuta Vitest)
- **SSR Local:** `npm run serve:ssr:gestion-tiempos` (inicia el servidor node)
