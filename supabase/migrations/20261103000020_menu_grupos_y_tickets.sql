-- Menú de Catálogos: "Iniciales" se divide en tres grupos y se agrega el grupo Tickets.
--   Usuarios:   Usuarios · Generar clave (antes "Generar usuario y clave")
--   Módulos:    Módulos · Roles módulos
--   Parámetros: Parámetros generales · Tipos de cambio (antes "Monedas y tipos de cambio"),
--               que pasa a ser pantalla común a todos los módulos.
--   Cuentas y CC (Contabilidad): se le agrega Tipos de partida.
--   Tickets (Contabilidad, debajo de Cuentas y CC): Generación · Asignación · Seguimiento · Cierre.
-- Así la matriz de accesos de Roles módulos muestra los mismos grupos que el menú.
-- Puede ejecutarse de nuevo.

do $$
declare
  v_con bigint := (select id from public.modulos_sistema where siglas = 'CON' and modulo_mayor_id is null);
begin
  -- Se abre espacio en el orden para las 4 pantallas de Tickets (después de Tipos de partida).
  if not exists (select 1 from public.opciones_sistema where clave = 'tickets-generacion') then
    update public.opciones_sistema set orden = orden + 4
    where orden > (select orden from public.opciones_sistema where clave = 'tipos-de-partida' and modulo_id = v_con);
  end if;

  update public.opciones_sistema o
  set subgrupo = v.subgrupo, nombre = v.nombre, orden = v.orden,
      modulo_id = case when v.comun then null else o.modulo_id end
  from (values
    ('usuarios',                  'Usuarios',     'Usuarios',             1, true),
    ('generar-usuario',           'Usuarios',     'Generar clave',        2, true),
    ('modulos',                   'Módulos',      'Módulos',              3, true),
    ('roles-modulos',             'Módulos',      'Roles módulos',        4, true),
    ('parametros',                'Parámetros',   'Parámetros generales', 5, true),
    ('monedas-y-tipos-de-cambio', 'Parámetros',   'Tipos de cambio',      6, true),
    ('geografia',                 'Geografía',    'Geografía',            7, true),
    ('organizaciones',            'Geografía',    'Organizaciones',       8, true),
    ('tipos-cuenta',              'Cuentas y CC', 'Tipos de cuentas',     9, false),
    ('cuentas',                   'Cuentas y CC', 'Cuentas contables',   10, false),
    ('centros-costo',             'Cuentas y CC', 'Centros de costos',   11, false),
    ('tipos-de-partida',          'Cuentas y CC', 'Tipos de partida',    12, false)
  ) as v (clave, subgrupo, nombre, orden, comun)
  where o.clave = v.clave and o.grupo = 'catalogos';

  insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
  values (v_con, 'catalogos', 'Tickets', 'tickets-generacion',  'Generación',  13),
         (v_con, 'catalogos', 'Tickets', 'tickets-asignacion',  'Asignación',  14),
         (v_con, 'catalogos', 'Tickets', 'tickets-seguimiento', 'Seguimiento', 15),
         (v_con, 'catalogos', 'Tickets', 'tickets-cierre',      'Cierre',      16)
  on conflict do nothing;
end;
$$;

-- Tipos de cambio ahora es pantalla común: el Administrador del Sistema la administra completa,
-- igual que las demás pantallas comunes.
update public.rol_accesos a set crear = true, modificar = true, anular = true
from public.roles_funcionales r, public.opciones_sistema o
where a.rol_id = r.id and a.opcion_id = o.id
  and upper(r.nombre) = 'ADMINISTRADOR DEL SISTEMA' and o.clave = 'monedas-y-tipos-de-cambio';
