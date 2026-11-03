-- Iniciales · Roles módulos: quién puede hacer qué en cada pantalla.
--   roles_funcionales  puestos de la empresa (Gerente, Contador, Auditor…). Distintos de los roles
--                      del sistema (Super Administrador, Administrador, Cliente).
--   opciones_sistema   pantallas del sistema por módulo y grupo de menú.
--   rol_accesos        permisos de cada rol por pantalla: ver, crear, modificar, anular, imprimir.
--   rol_usuarios       usuarios asignados a un rol: desde, hasta, estado, asignado por y cuándo.
--   usuario_accesos    excepciones de un usuario dentro de su rol (null = hereda del rol).
-- Lectura: usuarios activos. Escritura: Super Administrador o Administrador.

create table public.roles_funcionales (
  id          bigint generated always as identity primary key,
  codigo      integer not null unique check (codigo > 0),
  nombre      text not null,
  descripcion text,
  activo      boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create unique index roles_funcionales_nombre on public.roles_funcionales (upper(nombre));

-- modulo_id null = pantalla común a todos los módulos (Iniciales, Geografía…).
create table public.opciones_sistema (
  id        bigint generated always as identity primary key,
  modulo_id bigint references public.modulos_sistema (id),
  grupo     text not null check (grupo in ('catalogos', 'registros', 'mantenimientos', 'procesos', 'reportes', 'ayuda')),
  subgrupo  text,
  clave     text not null,
  nombre    text not null,
  orden     integer not null default 0,
  activo    boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create unique index opciones_sistema_clave on public.opciones_sistema (coalesce(modulo_id, 0), grupo, clave);
create index on public.opciones_sistema (modulo_id);

create table public.rol_accesos (
  rol_id     bigint not null references public.roles_funcionales (id) on delete cascade,
  opcion_id  bigint not null references public.opciones_sistema (id) on delete cascade,
  ver        boolean not null default false,
  crear      boolean not null default false,
  modificar  boolean not null default false,
  anular     boolean not null default false,
  imprimir   boolean not null default false,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  primary key (rol_id, opcion_id)
);
create index on public.rol_accesos (opcion_id);

create table public.rol_usuarios (
  id           bigint generated always as identity primary key,
  rol_id       bigint not null references public.roles_funcionales (id),
  perfil_id    uuid not null references public.perfiles (id) on delete cascade,
  fecha_inicio date not null default current_date,
  fecha_fin    date,
  estado       text not null default 'ACTIVO' check (estado in ('ACTIVO', 'SUSPENDIDO', 'FINALIZADO')),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (rol_id, perfil_id),
  check (fecha_fin is null or fecha_fin >= fecha_inicio)
);
create index on public.rol_usuarios (perfil_id);

create table public.usuario_accesos (
  rol_usuario_id bigint not null references public.rol_usuarios (id) on delete cascade,
  opcion_id      bigint not null references public.opciones_sistema (id) on delete cascade,
  ver        boolean,
  crear      boolean,
  modificar  boolean,
  anular     boolean,
  imprimir   boolean,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  primary key (rol_usuario_id, opcion_id)
);
create index on public.usuario_accesos (opcion_id);

-- El rol y el usuario de una asignación no cambian; para cambiarlos se crea otra asignación.
create function public.fijar_rol_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.rol_id := old.rol_id;
  new.perfil_id := old.perfil_id;
  return new;
end;
$$;
create trigger rol_usuarios_fijar before update on public.rol_usuarios
  for each row execute function public.fijar_rol_usuario();

do $$
declare t text;
begin
  foreach t in array array['roles_funcionales', 'opciones_sistema', 'rol_accesos', 'rol_usuarios', 'usuario_accesos'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.es_admin())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.es_admin()) with check (public.es_admin())', t, t);
  end loop;
end;
$$;
-- Los permisos se pueden quitar (borrar la fila = sin acceso / vuelve a heredar del rol).
create policy "rol_accesos: quitar" on public.rol_accesos for delete to authenticated using (public.es_admin());
create policy "usuario_accesos: quitar" on public.usuario_accesos for delete to authenticated using (public.es_admin());

revoke execute on function public.fijar_rol_usuario() from public, anon, authenticated;

-- ---------- Datos iniciales ----------
insert into public.roles_funcionales (codigo, nombre, descripcion) values
  (10, 'GERENTE',                    'Consulta e impresión de todo el sistema'),
  (20, 'SUB GERENTE',                'Consulta e impresión de todo el sistema'),
  (30, 'AUDITOR',                    'Consulta e impresión para revisión'),
  (40, 'CONTADOR',                   'Contabilidad completa'),
  (50, 'AUXILIAR CONTABLE',          'Registros contables sin anular'),
  (60, 'SECRETARIA ADMINISTRATIVA',  'Consulta de catálogos generales'),
  (70, 'ENCARGADO DE INVENTARIOS',   'Inventarios completo'),
  (80, 'ENCARGADO DE NÓMINAS',       'Nóminas y planillas completo');

insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, o.grupo, o.subgrupo, o.clave, o.nombre, o.orden
from (values
  (null, 'catalogos', 'Iniciales', 'usuarios', 'Usuarios', 1),
  (null, 'catalogos', 'Iniciales', 'generar-usuario', 'Generar usuario y clave', 2),
  (null, 'catalogos', 'Iniciales', 'parametros', 'Parámetros generales', 3),
  (null, 'catalogos', 'Iniciales', 'modulos', 'Módulos', 4),
  (null, 'catalogos', 'Iniciales', 'roles-modulos', 'Roles módulos', 5),
  (null, 'catalogos', 'Geografía', 'geografia', 'Geografía', 6),
  (null, 'catalogos', 'Geografía', 'organizaciones', 'Organizaciones', 7),
  ('CON', 'catalogos', 'Cuentas y CC', 'tipos-cuenta', 'Tipos de cuentas', 8),
  ('CON', 'catalogos', 'Cuentas y CC', 'cuentas', 'Cuentas contables', 9),
  ('CON', 'catalogos', 'Cuentas y CC', 'centros-costo', 'Centros de costos', 10),
  ('CON', 'catalogos', null, 'monedas-y-tipos-de-cambio', 'Monedas y tipos de cambio', 11),
  ('CON', 'catalogos', null, 'tipos-de-partida', 'Tipos de partida', 12),
  ('CON', 'registros', null, 'partidas-contables', 'Partidas contables', 13),
  ('CON', 'registros', null, 'presupuesto-anual', 'Presupuesto anual', 14),
  ('CON', 'registros', null, 'movimientos-bancarios', 'Movimientos bancarios', 15),
  ('CON', 'mantenimientos', null, 'periodos-contables', 'Períodos contables', 16),
  ('CON', 'mantenimientos', null, 'empresas', 'Empresas', 17),
  ('CON', 'mantenimientos', null, 'parametros-contables', 'Parámetros contables', 18),
  ('CON', 'procesos', null, 'mayorizacion', 'Mayorización', 19),
  ('CON', 'procesos', null, 'conciliacion-bancaria', 'Conciliación bancaria', 20),
  ('CON', 'procesos', null, 'cierre-de-mes', 'Cierre de mes', 21),
  ('CON', 'procesos', null, 'cierre-de-ano', 'Cierre de año', 22),
  ('CON', 'reportes', null, 'libro-diario', 'Libro diario', 23),
  ('CON', 'reportes', null, 'libro-mayor', 'Libro mayor', 24),
  ('CON', 'reportes', null, 'balance-general', 'Balance general', 25),
  ('CON', 'reportes', null, 'estado-de-resultados', 'Estado de resultados', 26),
  ('CON', 'reportes', null, 'presupuesto-vs-ejecutado', 'Presupuesto vs. ejecutado', 27),
  ('CON', 'ayuda', null, 'manual-del-modulo', 'Manual del módulo', 28),
  ('CON', 'ayuda', null, 'preguntas-frecuentes', 'Preguntas frecuentes', 29),
  ('FAC', 'catalogos', null, 'clientes', 'Clientes', 30),
  ('FAC', 'catalogos', null, 'productos-y-servicios', 'Productos y servicios', 31),
  ('FAC', 'catalogos', null, 'vendedores', 'Vendedores', 32),
  ('FAC', 'catalogos', null, 'formas-de-pago', 'Formas de pago', 33),
  ('FAC', 'registros', null, 'cotizaciones', 'Cotizaciones', 34),
  ('FAC', 'registros', null, 'pedidos', 'Pedidos', 35),
  ('FAC', 'registros', null, 'facturas', 'Facturas', 36),
  ('FAC', 'registros', null, 'notas-de-credito', 'Notas de crédito', 37),
  ('FAC', 'registros', null, 'cobros', 'Cobros', 38),
  ('FAC', 'mantenimientos', null, 'series-de-documentos', 'Series de documentos', 39),
  ('FAC', 'mantenimientos', null, 'listas-de-precios', 'Listas de precios', 40),
  ('FAC', 'mantenimientos', null, 'descuentos', 'Descuentos', 41),
  ('FAC', 'procesos', null, 'anulacion-de-documentos', 'Anulación de documentos', 42),
  ('FAC', 'procesos', null, 'antiguedad-de-saldos', 'Antigüedad de saldos', 43),
  ('FAC', 'procesos', null, 'comisiones', 'Comisiones', 44),
  ('FAC', 'reportes', null, 'ventas-por-periodo', 'Ventas por período', 45),
  ('FAC', 'reportes', null, 'ventas-por-cliente', 'Ventas por cliente', 46),
  ('FAC', 'reportes', null, 'cuentas-por-cobrar', 'Cuentas por cobrar', 47),
  ('FAC', 'reportes', null, 'grafica-de-ventas', 'Gráfica de ventas', 48),
  ('FAC', 'ayuda', null, 'manual-del-modulo', 'Manual del módulo', 49),
  ('FAC', 'ayuda', null, 'preguntas-frecuentes', 'Preguntas frecuentes', 50),
  ('INV', 'catalogos', null, 'productos', 'Productos', 51),
  ('INV', 'catalogos', null, 'categorias', 'Categorías', 52),
  ('INV', 'catalogos', null, 'bodegas', 'Bodegas', 53),
  ('INV', 'catalogos', null, 'unidades-de-medida', 'Unidades de medida', 54),
  ('INV', 'catalogos', null, 'proveedores', 'Proveedores', 55),
  ('INV', 'registros', null, 'entradas', 'Entradas', 56),
  ('INV', 'registros', null, 'salidas', 'Salidas', 57),
  ('INV', 'registros', null, 'traslados-entre-bodegas', 'Traslados entre bodegas', 58),
  ('INV', 'registros', null, 'ajustes', 'Ajustes', 59),
  ('INV', 'mantenimientos', null, 'minimos-y-maximos', 'Mínimos y máximos', 60),
  ('INV', 'mantenimientos', null, 'costos', 'Costos', 61),
  ('INV', 'mantenimientos', null, 'ubicaciones', 'Ubicaciones', 62),
  ('INV', 'procesos', null, 'toma-fisica', 'Toma física', 63),
  ('INV', 'procesos', null, 'recalcular-costo-promedio', 'Recalcular costo promedio', 64),
  ('INV', 'procesos', null, 'cierre-de-inventario', 'Cierre de inventario', 65),
  ('INV', 'reportes', null, 'existencias', 'Existencias', 66),
  ('INV', 'reportes', null, 'kardex-por-producto', 'Kardex por producto', 67),
  ('INV', 'reportes', null, 'valuacion-de-inventario', 'Valuación de inventario', 68),
  ('INV', 'reportes', null, 'rotacion', 'Rotación', 69),
  ('INV', 'ayuda', null, 'manual-del-modulo', 'Manual del módulo', 70),
  ('INV', 'ayuda', null, 'preguntas-frecuentes', 'Preguntas frecuentes', 71),
  ('SAT', 'catalogos', null, 'certificadores-fel', 'Certificadores FEL', 72),
  ('SAT', 'catalogos', null, 'tipos-de-dte', 'Tipos de DTE', 73),
  ('SAT', 'catalogos', null, 'frases-y-escenarios', 'Frases y escenarios', 74),
  ('SAT', 'catalogos', null, 'establecimientos', 'Establecimientos', 75),
  ('SAT', 'registros', null, 'documentos-fel-emitidos', 'Documentos FEL emitidos', 76),
  ('SAT', 'registros', null, 'documentos-recibidos', 'Documentos recibidos', 77),
  ('SAT', 'registros', null, 'retenciones-de-iva-e-isr', 'Retenciones de IVA e ISR', 78),
  ('SAT', 'mantenimientos', null, 'credenciales-del-certificador', 'Credenciales del certificador', 79),
  ('SAT', 'mantenimientos', null, 'datos-del-emisor', 'Datos del emisor', 80),
  ('SAT', 'procesos', null, 'certificar-dte', 'Certificar DTE', 81),
  ('SAT', 'procesos', null, 'anular-dte', 'Anular DTE', 82),
  ('SAT', 'procesos', null, 'consultar-nit', 'Consultar NIT', 83),
  ('SAT', 'procesos', null, 'declaracion-de-iva', 'Declaración de IVA', 84),
  ('SAT', 'reportes', null, 'libro-de-compras', 'Libro de compras', 85),
  ('SAT', 'reportes', null, 'libro-de-ventas', 'Libro de ventas', 86),
  ('SAT', 'reportes', null, 'dte-por-estado', 'DTE por estado', 87),
  ('SAT', 'reportes', null, 'grafica-de-iva', 'Gráfica de IVA', 88),
  ('SAT', 'ayuda', null, 'manual-del-modulo', 'Manual del módulo', 89),
  ('SAT', 'ayuda', null, 'guia-fel-sat', 'Guía FEL SAT', 90),
  ('NOM', 'catalogos', null, 'empleados', 'Empleados', 91),
  ('NOM', 'catalogos', null, 'puestos', 'Puestos', 92),
  ('NOM', 'catalogos', null, 'departamentos', 'Departamentos', 93),
  ('NOM', 'catalogos', null, 'conceptos-de-pago-y-descuento', 'Conceptos de pago y descuento', 94),
  ('NOM', 'registros', null, 'horas-extra', 'Horas extra', 95),
  ('NOM', 'registros', null, 'ausencias', 'Ausencias', 96),
  ('NOM', 'registros', null, 'anticipos-y-prestamos', 'Anticipos y préstamos', 97),
  ('NOM', 'registros', null, 'vacaciones', 'Vacaciones', 98),
  ('NOM', 'mantenimientos', null, 'tablas-de-igss-e-isr', 'Tablas de IGSS e ISR', 99),
  ('NOM', 'mantenimientos', null, 'salario-minimo', 'Salario mínimo', 100),
  ('NOM', 'mantenimientos', null, 'bonificacion-incentivo', 'Bonificación incentivo', 101),
  ('NOM', 'procesos', null, 'generar-planilla', 'Generar planilla', 102),
  ('NOM', 'procesos', null, 'bono-14', 'Bono 14', 103),
  ('NOM', 'procesos', null, 'aguinaldo', 'Aguinaldo', 104),
  ('NOM', 'procesos', null, 'indemnizacion', 'Indemnización', 105),
  ('NOM', 'reportes', null, 'planilla-del-periodo', 'Planilla del período', 106),
  ('NOM', 'reportes', null, 'boletas-de-pago', 'Boletas de pago', 107),
  ('NOM', 'reportes', null, 'planilla-igss', 'Planilla IGSS', 108),
  ('NOM', 'reportes', null, 'costo-de-personal', 'Costo de personal', 109),
  ('NOM', 'ayuda', null, 'manual-del-modulo', 'Manual del módulo', 110),
  ('NOM', 'ayuda', null, 'preguntas-frecuentes', 'Preguntas frecuentes', 111),
  ('IMP', 'catalogos', null, 'agentes-aduanales', 'Agentes aduanales', 112),
  ('IMP', 'catalogos', null, 'aduanas', 'Aduanas', 113),
  ('IMP', 'catalogos', null, 'incoterms', 'Incoterms', 114),
  ('IMP', 'catalogos', null, 'partidas-arancelarias', 'Partidas arancelarias', 115),
  ('IMP', 'registros', null, 'polizas-de-importacion', 'Pólizas de importación', 116),
  ('IMP', 'registros', null, 'exportaciones', 'Exportaciones', 117),
  ('IMP', 'registros', null, 'gastos-de-importacion', 'Gastos de importación', 118),
  ('IMP', 'registros', null, 'embarques', 'Embarques', 119),
  ('IMP', 'mantenimientos', null, 'tasas-de-dai', 'Tasas de DAI', 120),
  ('IMP', 'mantenimientos', null, 'navieras-y-transportistas', 'Navieras y transportistas', 121),
  ('IMP', 'procesos', null, 'liquidacion-de-poliza', 'Liquidación de póliza', 122),
  ('IMP', 'procesos', null, 'prorrateo-de-costos', 'Prorrateo de costos', 123),
  ('IMP', 'procesos', null, 'ingreso-a-inventario', 'Ingreso a inventario', 124),
  ('IMP', 'reportes', null, 'importaciones-por-periodo', 'Importaciones por período', 125),
  ('IMP', 'reportes', null, 'costo-por-poliza', 'Costo por póliza', 126),
  ('IMP', 'reportes', null, 'exportaciones-por-destino', 'Exportaciones por destino', 127),
  ('IMP', 'ayuda', null, 'manual-del-modulo', 'Manual del módulo', 128),
  ('IMP', 'ayuda', null, 'preguntas-frecuentes', 'Preguntas frecuentes', 129)
) as o (siglas, grupo, subgrupo, clave, nombre, orden)
left join public.modulos_sistema m on m.siglas = o.siglas and m.modulo_mayor_id is null;

-- Permisos sugeridos por rol (se pueden ajustar en la pantalla).
insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
select r.id, o.id,
       true,
       p.todo or (p.registra and o.grupo = 'registros'),
       p.todo or (p.registra and o.grupo = 'registros'),
       p.todo,
       true
from public.roles_funcionales r
join (values
  ('GERENTE',                   null,  false, false),
  ('SUB GERENTE',               null,  false, false),
  ('AUDITOR',                   null,  false, false),
  ('CONTADOR',                  'CON', true,  false),
  ('AUXILIAR CONTABLE',         'CON', false, true),
  ('SECRETARIA ADMINISTRATIVA', 'COM', false, false),
  ('ENCARGADO DE INVENTARIOS',  'INV', true,  false),
  ('ENCARGADO DE NÓMINAS',      'NOM', true,  false)
) as p (rol, siglas, todo, registra) on p.rol = r.nombre
join public.opciones_sistema o on true
left join public.modulos_sistema m on m.id = o.modulo_id
where p.siglas is null
   or (p.siglas = 'COM' and o.modulo_id is null)
   or m.siglas = p.siglas;

notify pgrst, 'reload schema';
