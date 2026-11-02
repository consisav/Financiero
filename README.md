# Financiero

Sistema Financiero de CONSISAV, construido desde cero sobre **Supabase**
(base de datos Postgres, autenticación, almacenamiento y funciones) y
publicado con **GitHub Pages**.

> Reinicio del proyecto: la versión anterior sobre Oracle 19c/Express quedó
> en el historial de Git (commit `a79ad`).

## Estructura (en construcción)

- `supabase/` — migraciones SQL, políticas RLS y Edge Functions.
- `web/` — sitio estático (HTML/CSS/JS + supabase-js) publicado en GitHub Pages.

## Pantalla inicial

`web/index.html` es un tablero de tarjetas con los 6 módulos; cada tarjeta abre
sus 6 grupos de menú (Catálogos, Registros, Mantenimientos, Procesos, Reportes y
gráficas, Ayuda). Los módulos y opciones se definen en `web/js/menu.js`.

La conexión a Supabase se configura en `web/js/config.js` (URL y llave pública
anon; nunca la `service_role`).

## Usuarios y roles

Inicio de sesión con Supabase Auth (pantalla dividida). La migración
`supabase/migrations/20261102000001_usuarios_y_roles.sql` crea `roles`, `perfiles` y
`rol_modulos` con RLS. El primer usuario registrado queda como administrador; los
demás quedan inactivos hasta que el administrador los active en **Usuarios**.

## Publicación

GitHub Pages publica la rama `main` desde la raíz: https://consisav.github.io/Financiero/
(`index.html` de la raíz redirige a `web/`; `.nojekyll` evita el procesamiento con Jekyll).
