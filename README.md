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

## Publicación

El flujo `.github/workflows/pages.yml` publica la carpeta `web/` en GitHub Pages
en cada push a `main`. Requiere activar en GitHub: Settings → Pages → Source:
**GitHub Actions**.
