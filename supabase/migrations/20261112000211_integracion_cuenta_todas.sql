-- Script 211 · Integración por cuenta: sin cuenta = todas las cuentas (una fila por partida y cuenta, agrupadas por cuenta),
--   con el saldo anterior de cada cuenta. Correr después del 209 y el 210. Se puede ejecutar de nuevo.
create or replace function public.con_integracion_cuenta(p_loc bigint, p_cuenta text, p_desde date, p_hasta date)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_cuenta text := nullif(trim(p_cuenta), ''); v_saldos jsonb; v_filas jsonb; v_total integer; v_nombre text; v_codigos text[];
begin
  if not public.usuario_activo() then raise exception 'Usuario no autorizado.'; end if;
  if p_desde > p_hasta then raise exception 'La fecha inicial es posterior a la final.'; end if;
  if v_cuenta is not null then
    select k.nombre into v_nombre from public.cuentas k join public.catalogos_cuentas c on c.id = k.catalogo_id
     where c.localidad_id = p_loc and k.codigo = v_cuenta order by c.activo desc, c.version desc limit 1;
  end if;
  select coalesce(jsonb_object_agg(s.cuenta, s.saldo), '{}'::jsonb) into v_saldos from public.con_int_saldos(p_loc, p_desde, v_cuenta) s;
  -- Una fila por partida; sin cuenta elegida, una por partida y cuenta.
  with g as (
    select case when v_cuenta is null then l.cuenta else v_cuenta end as cuenta, min(l.cuenta_nombre) as cuenta_nombre,
           l.partida_id, l.anio, l.mes, l.siglas, l.numero, l.fecha, l.partida_desc, sum(l.debe) as debe, sum(l.haber) as haber
      from public.con_int_lineas(p_loc, p_desde, p_hasta, v_cuenta) l
     group by 1, l.partida_id, l.anio, l.mes, l.siglas, l.numero, l.fecha, l.partida_desc)
  select count(*)::integer,
         coalesce((select jsonb_agg(jsonb_build_object('c', z.cuenta, 'cn', z.cuenta_nombre, 'id', z.partida_id, 'anio', z.anio, 'mes', z.mes, 'tipo', z.siglas,
                    'numero', z.numero, 'fecha', z.fecha, 'descripcion', z.partida_desc, 'debe', z.debe, 'haber', z.haber)
                    order by z.cuenta, z.fecha, z.anio, z.mes, z.numero)
                   from (select * from g order by g.cuenta, g.fecha, g.anio, g.mes, g.numero limit 20000) z), '[]'::jsonb)
    into v_total, v_filas from g;
  v_codigos := array(select distinct x ->> 'c' from jsonb_array_elements(v_filas) x union select jsonb_object_keys(v_saldos) union select v_cuenta);
  return jsonb_build_object('cuenta', v_cuenta, 'nombre', v_nombre, 'saldos', v_saldos,
                            'saldo_inicial', (select coalesce(sum(value::numeric), 0) from jsonb_each_text(v_saldos)),
                            'total', v_total, 'filas', v_filas, 'nats', public.con_int_naturalezas(p_loc, v_codigos),
                            'nat', coalesce((public.con_int_naturalezas(p_loc, array[v_cuenta]) ->> v_cuenta)::integer, 1));
end;
$function$;

revoke execute on function public.con_integracion_cuenta(bigint, text, date, date) from public, anon;
grant execute on function public.con_integracion_cuenta(bigint, text, date, date) to authenticated;

notify pgrst, 'reload schema';
