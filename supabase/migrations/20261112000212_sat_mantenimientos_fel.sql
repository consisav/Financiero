-- Script 212 · Integraciones SAT › Mantenimientos › FEL: opciones del menú y accesos de las 5 pantallas de los objetos FEL migrados
--   (Documentos FEL, IDs FEL, Tipos de frase y escenarios, Tipos de documento FEL y Conexión del certificador). No crea tablas:
--   usa las de los scripts 154, 164, 165, 166 y 205. Cada opción nueva copia los accesos de «Historial FEL». Se puede ejecutar de nuevo.
do $$
declare v_mod bigint; v_ref bigint; v_id bigint; v_orden integer; o record;
begin
  select id, modulo_id into v_ref, v_mod from public.opciones_sistema where clave = 'sat-historial-fel' order by id limit 1;
  if v_mod is null then select modulo_id into v_mod from public.opciones_sistema where clave = 'dte-emitidos' order by id limit 1; end if;
  if v_mod is null then raise notice 'No existe el módulo Integraciones SAT (script 154).'; return; end if;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values (1, 'sat-mant-dte', 'Documentos FEL (DTE)'), (2, 'sat-mant-ids', 'IDs FEL'), (3, 'sat-mant-frases', 'Tipos de frase y escenarios'),
                                 (4, 'sat-mant-tipos-doc', 'Tipos de documento FEL'), (5, 'sat-mant-conexion', 'Conexión del certificador')) as x(n, clave, nombre) loop
    select id into v_id from public.opciones_sistema where clave = o.clave order by id limit 1;
    if v_id is null then
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, 'mantenimientos', 'FEL', o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    else
      update public.opciones_sistema set grupo = 'mantenimientos', subgrupo = 'FEL', nombre = o.nombre, activo = true where id = v_id;
    end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Resumen: opciones y cuántos registros migrados tiene cada objeto.
select o.clave, o.nombre, (select count(*) from public.rol_accesos a where a.opcion_id = o.id) as roles_con_acceso
  from public.opciones_sistema o where o.clave like 'sat-mant-%' order by o.orden;
select (select count(*) from public.sat_dte) as dte, (select count(*) from public.sat_dte_items) as items, (select count(*) from public.sat_dte_frases) as frases,
       (select count(*) from public.sat_dte_abonos) as abonos, (select count(*) from public.sat_dte_adendas) as adendas, (select count(*) from public.sat_dte_anulaciones) as anulaciones,
       (select count(*) from public.sat_fel_ids) as ids_fel, (select count(*) from public.sat_tipos_frase) as tipos_frase, (select count(*) from public.sat_frases) as escenarios,
       (select count(*) from public.sat_tipos_documento_fel) as tipos_documento, (select count(*) from public.sat_fel_conexiones) as conexiones;
