# Financiero

Aplicación financiera de CONSISAV sobre **Oracle Database 19c**.
Backend Node.js (Express + `node-oracledb` en modo **Thin**, sin Oracle Instant Client) y frontend web.

## Pantalla inicial

Menú lateral con 6 módulos, cada uno con 6 grupos de menú:

| Módulos | Grupos de menú |
|---|---|
| Contabilidad y presupuesto · Facturación y ventas · Inventarios · Integraciones SAT (FEL Guatemala) · Nóminas y planillas · Importaciones y exportaciones | Catálogos · Registros · Mantenimientos · Procesos · Reportes y gráficas · Ayuda |

Las opciones de cada grupo se definen en `public/js/menu.js`. Una opción con `vista` abre una pantalla
funcional (hoy: Facturación y ventas › Catálogos › Clientes y proveedores); las demás muestran
"en construcción". La interfaz arranca aunque Oracle no esté disponible y lo indica en la barra superior.

## Requisitos

- Node.js 20 o superior
- Acceso de red al listener de Oracle (puerto 1521) desde la máquina donde corre la app
- Un usuario DBA (SYSTEM) para crear los usuarios la primera vez

## 1. Crear usuarios y esquema en Oracle

Todo se crea en un esquema propio (`FIN_OWNER`). **No se modifica ninguna tabla de la aplicación de
Contabilidad e Inventarios existente.**

| Usuario / rol | Uso | Privilegios |
|---|---|---|
| `FIN_OWNER` | Dueño de tablas y secuencias; solo para correr scripts | CREATE SESSION/TABLE/SEQUENCE/VIEW/PROCEDURE/TRIGGER |
| `FIN_APP_ROLE` | Rol de la aplicación | SELECT/INSERT/UPDATE/DELETE sobre tablas de FIN_OWNER |
| `FIN_APP` | Usuario con el que se conecta la app | CREATE SESSION + FIN_APP_ROLE |

En el servidor (o cualquier equipo con SQL*Plus / SQLcl), desde la carpeta del proyecto. Reemplace
`ORCLPDB` por el nombre de servicio de su PDB (`lsnrctl status` lo muestra):

```bat
sqlplus system@//localhost:1521/ORCLPDB @sql/01_usuarios.sql
sqlplus FIN_OWNER@//localhost:1521/ORCLPDB @sql/02_esquema.sql
sqlplus FIN_OWNER@//localhost:1521/ORCLPDB @sql/03_permisos.sql
```

`01_usuarios.sql` pide las contraseñas de `FIN_OWNER` y `FIN_APP` sin mostrarlas.
Para empezar de cero: `DROP USER FIN_OWNER CASCADE; DROP USER FIN_APP; DROP ROLE FIN_APP_ROLE;` y volver a correr los tres scripts.

## 2. Configurar la app

```bat
npm install
copy .env.example .env
```

Edite `.env` con la contraseña de `FIN_APP` y el `ORACLE_CONNECT_STRING` (`host:1521/servicio`).
`.env` está en `.gitignore`: **las credenciales nunca van en el código ni en el frontend.**

## 3. Probar y arrancar

```bat
npm run test:db   :: conecta, inserta, lee, actualiza y borra un registro de prueba
npm start         :: http://localhost:3000
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/salud` | Estado de la conexión a Oracle |
| GET | `/api/recursos` | Lista de recursos disponibles |
| GET | `/api/:recurso?limite=100` | Listar |
| GET | `/api/:recurso/:id` | Obtener uno |
| POST | `/api/:recurso` | Crear (JSON con columnas en mayúsculas; fechas `YYYY-MM-DD`) |
| PUT | `/api/:recurso/:id` | Actualizar |
| DELETE | `/api/:recurso/:id` | Eliminar |

Recursos: `terceros`, `documentos`, `pagos`, `cuentas-bancarias`, `movimientos-bancarios`, `centros-costo`,
`presupuestos`, `productos`, `bodegas`, `movimientos-inventario`, `empleados`, `planillas`,
`planilla-detalle`, `integraciones-log` (ver `src/recursos.js`).

> La API aún **no tiene autenticación**: úsela solo en red local hasta agregar login.

## Seguridad

- Oracle 19.3 sin Release Updates tiene vulnerabilidades públicas: aplique el último RU de 19c.
- No exponga el puerto 1521 a Internet. Exponga solo esta app por HTTPS (proxy inverso) y deje 1521 accesible únicamente desde la red interna.
- El modo Thin no soporta *Native Network Encryption*. Si el servidor exige NNE (`SQLNET.ENCRYPTION_SERVER=REQUIRED`), use TLS (TCPS) o el modo Thick.

## Pendiente

- Reportes financieros: leer (solo SELECT) de las tablas de la contabilidad existente cuando se conozca su estructura; requiere que el DBA otorgue `SELECT` sobre esas tablas a `FIN_APP_ROLE`.
- Integración del módulo de Inventarios con el inventario de la aplicación existente.
- Autenticación de usuarios y diseño definitivo de las pantallas.
