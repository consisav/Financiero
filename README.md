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

## Catálogos comunes: Geografía

En **Catálogos** de todos los módulos aparece el subgrupo **Geografía** con dos pantallas
(`web/js/geografia.js` y `web/js/organizaciones.js`):

- **Geografía:** países → estados / departamentos (con regiones) → ciudades / municipios.
  Incluye los 22 departamentos, 8 regiones y 340 municipios de Guatemala.
- **Organizaciones:** organizaciones y sus localidades (código `1-01`, `1-02`…), con
  auditoría de quién grabó y modificó cada registro.

Migración: `supabase/migrations/20261102000002_geografia_y_organizaciones.sql`. Leen todos los
usuarios activos; graban el administrador y el contador. No se borra: se desactiva.

## Contabilidad: cuentas y centros de costos

En **Catálogos** de Contabilidad, el subgrupo desplegable **Cuentas y centros de costos**:

- **Tipos de cuentas** (`web/js/tipos_cuenta.js`): naturaleza debe-haber / haber-debe y efecto en el resultado.
- **Cuentas contables** y **Centros de costos** (`web/js/cuentas.js`): árbol en tres bloques
  maestro → detalle → detalle (`web/js/jerarquia.js`), con Bajar / Subir nivel para niveles más
  profundos. Las cuentas van por organización, localidad y versión del catálogo; los centros, por organización.
  El código de un hijo comienza con el de su mayor (1 → 101 → 10101) y hereda nivel y tipo.

Migraciones: `supabase/migrations/20261102000004_cuentas_y_centros_de_costo.sql` y
`20261102000005_cuentas_por_localidad.sql`.

## Publicación

GitHub Pages publica la rama `main` desde la raíz: https://consisav.github.io/Financiero/
(`index.html` de la raíz redirige a `web/`; `.nojekyll` evita el procesamiento con Jekyll).
