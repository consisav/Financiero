-- Replicación · Nomenclatura y Replicación · Centros de costos.
-- Crean el catálogo (de cuentas o de centros de costo) de un rango de empresas destino a partir
-- del catálogo activo de una empresa fuente, con la misma estructura funcional.
--   replicar_catalogo(tipo, origen, destinos, solo_madres)
--       Por cada empresa destino crea una versión nueva de su catálogo con las cuentas (o los
--       centros) de la versión activa más reciente de la fuente. "Solo madres": solo las cuentas
--       o centros que tienen subcuentas.
--   replicar_parametros_catalogo(tipo, origen, destinos)
--       Copia los Parámetros generales que corresponden al catálogo:
--         NOMENCLATURA  parámetros de tiempo (año y mes, cierres, períodos y meses contables)
--         CENTROS       uso de centros de costo (incluir centros de costo)
--   eliminar_replica_catalogo(tipo, accion, destino)
--       Deshace la última replicación de ese tipo hecha a la empresa: quita la versión de catálogo
--       creada o devuelve los parámetros a como estaban.
-- Cada empresa queda registrada en replicaciones_catalogo con su mensaje (el área de mensajes).
-- Si una empresa falla, se informa y se sigue con las demás. Solo un administrador.
-- Requiere los scripts 24 y 25.

create table public.replicaciones_catalogo (
  id                   bigint generated always as identity primary key,
  tipo                 text not null check (tipo in ('NOMENCLATURA', 'CENTROS')),
  accion               text not null check (accion in ('CATALOGO', 'PARAMETROS')),
  origen_localidad_id  bigint not null references public.localidades (id),
  destino_localidad_id bigint not null references public.localidades (id),
  solo_madres          boolean not null default false,
  catalogo_id          bigint,
  total                integer,
  respaldo             jsonb,
  estado               text not null check (estado in ('APLICADA', 'ERROR', 'ELIMINADA')),
  mensaje              text not null,
  usuario              text,
  fecha                timestamptz not null default now(),
  eliminada_por        text,
  eliminada_en         timestamptz
);
create index on public.replicaciones_catalogo (tipo, destino_localidad_id, fecha desc);

alter table public.replicaciones_catalogo enable row level security;
create policy "replicaciones_catalogo: leer" on public.replicaciones_catalogo for select to authenticated using (public.usuario_activo());

-- Columnas de Parámetros generales que corresponden a cada catálogo.
create function public.columnas_parametros_catalogo(p_tipo text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'NOMENCLATURA' then public.columnas_replica('TIEMPO')
    when 'CENTROS' then array['incluir_centros_costo']
    else array[]::text[] end;
$$;

-- Copia la versión activa de la fuente como versión nueva del destino. Devuelve id y total.
create function public.copiar_catalogo(p_tipo text, p_origen bigint, p_destino bigint, p_solo_madres boolean,
  out catalogo_id bigint, out total integer, out version integer, out version_origen integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_dest  public.localidades;
  v_cat_o bigint;
  v_nivel integer;
begin
  select * into v_dest from public.localidades where id = p_destino;
  if p_tipo = 'NOMENCLATURA' then
    select k.id, k.version into v_cat_o, version_origen from public.catalogos_cuentas k
    where k.localidad_id = p_origen and k.activo order by k.version desc limit 1;
    if v_cat_o is null then raise exception 'La empresa fuente no tiene una nomenclatura activa.'; end if;
    version := coalesce((select max(k.version) from public.catalogos_cuentas k where k.localidad_id = p_destino), 0) + 1;
    insert into public.catalogos_cuentas (organizacion_id, localidad_id, version, fecha_del)
    values (v_dest.organizacion_id, v_dest.id, version, current_date) returning id into catalogo_id;
    for v_nivel in 1..coalesce((select max(c.nivel) from public.cuentas c where c.catalogo_id = v_cat_o), 0) loop
      insert into public.cuentas (catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra, cuenta_anterior, vigente)
      select copiar_catalogo.catalogo_id, c.codigo, c.nombre,
             (select d.id from public.cuentas d join public.cuentas m on m.id = c.cuenta_mayor_id
              where d.catalogo_id = copiar_catalogo.catalogo_id and d.codigo = m.codigo),
             c.tipo_cuenta_id, c.integra, c.cuenta_anterior, c.vigente
      from public.cuentas c
      where c.catalogo_id = v_cat_o and c.nivel = v_nivel
        and (not p_solo_madres or exists (select 1 from public.cuentas h where h.cuenta_mayor_id = c.id));
    end loop;
    select count(*) into total from public.cuentas c where c.catalogo_id = copiar_catalogo.catalogo_id;
  else
    select k.id, k.version into v_cat_o, version_origen from public.catalogos_centros k
    where k.localidad_id = p_origen and k.activo order by k.version desc limit 1;
    if v_cat_o is null then raise exception 'La empresa fuente no tiene un catálogo de centros de costo activo.'; end if;
    version := coalesce((select max(k.version) from public.catalogos_centros k where k.localidad_id = p_destino), 0) + 1;
    insert into public.catalogos_centros (organizacion_id, localidad_id, version, fecha_del)
    values (v_dest.organizacion_id, v_dest.id, version, current_date) returning id into catalogo_id;
    for v_nivel in 1..coalesce((select max(c.nivel) from public.centros_costo c where c.catalogo_id = v_cat_o), 0) loop
      insert into public.centros_costo (catalogo_id, organizacion_id, codigo, nombre, centro_mayor_id, integra, centro_anterior, vigente)
      select copiar_catalogo.catalogo_id, v_dest.organizacion_id, c.codigo, c.nombre,
             (select d.id from public.centros_costo d join public.centros_costo m on m.id = c.centro_mayor_id
              where d.catalogo_id = copiar_catalogo.catalogo_id and d.codigo = m.codigo),
             c.integra, c.centro_anterior, c.vigente
      from public.centros_costo c
      where c.catalogo_id = v_cat_o and c.nivel = v_nivel
        and (not p_solo_madres or exists (select 1 from public.centros_costo h where h.centro_mayor_id = c.id));
    end loop;
    select count(*) into total from public.centros_costo c where c.catalogo_id = copiar_catalogo.catalogo_id;
  end if;
end;
$$;

create function public.validar_replica_catalogo(p_tipo text, p_origen bigint, p_destinos bigint[]) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_editar_catalogos() then
    raise exception 'Solo un administrador puede replicar catálogos.';
  end if;
  if p_tipo not in ('NOMENCLATURA', 'CENTROS') then raise exception 'Tipo de replicación no válido.'; end if;
  if p_origen is null or not exists (select 1 from public.localidades where id = p_origen) then
    raise exception 'Indica la empresa fuente.';
  end if;
  if coalesce(cardinality(p_destinos), 0) = 0 then raise exception 'Indica el rango de empresas destino.'; end if;
end;
$$;

create function public.replicar_catalogo(p_tipo text, p_origen bigint, p_destinos bigint[], p_solo_madres boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d       bigint;
  c       record;
  v_res   jsonb := '[]'::jsonb;
  v_msg   text;
  v_quien text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  v_unidad text := case p_tipo when 'NOMENCLATURA' then 'cuentas' else 'centros de costo' end;
begin
  perform public.validar_replica_catalogo(p_tipo, p_origen, p_destinos);
  foreach d in array p_destinos loop
    if d = p_origen then
      v_res := v_res || jsonb_build_object('destino', d, 'ok', false, 'mensaje', 'Es la misma empresa fuente: se omite.');
      continue;
    end if;
    begin
      select * into c from public.copiar_catalogo(p_tipo, p_origen, d, p_solo_madres);
      v_msg := format('Versión %s creada con %s %s (copia de la versión %s de la fuente%s).',
                      c.version, c.total, v_unidad, c.version_origen, case when p_solo_madres then ', solo madres' else '' end);
      insert into public.replicaciones_catalogo (tipo, accion, origen_localidad_id, destino_localidad_id, solo_madres, catalogo_id, total, estado, mensaje, usuario)
      values (p_tipo, 'CATALOGO', p_origen, d, p_solo_madres, c.catalogo_id, c.total, 'APLICADA', v_msg, v_quien);
      v_res := v_res || jsonb_build_object('destino', d, 'ok', true, 'mensaje', v_msg);
    exception when others then
      insert into public.replicaciones_catalogo (tipo, accion, origen_localidad_id, destino_localidad_id, solo_madres, estado, mensaje, usuario)
      values (p_tipo, 'CATALOGO', p_origen, d, p_solo_madres, 'ERROR', sqlerrm, v_quien);
      v_res := v_res || jsonb_build_object('destino', d, 'ok', false, 'mensaje', sqlerrm);
    end;
  end loop;
  return v_res;
end;
$$;

create function public.replicar_parametros_catalogo(p_tipo text, p_origen bigint, p_destinos bigint[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d        bigint;
  v_origen public.parametros_generales;
  v_par    public.parametros_generales;
  v_dest   public.localidades;
  v_cols   text[] := public.columnas_parametros_catalogo(p_tipo);
  v_lista  text;
  v_res    jsonb := '[]'::jsonb;
  v_msg    text;
  v_quien  text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
begin
  perform public.validar_replica_catalogo(p_tipo, p_origen, p_destinos);
  select * into v_origen from public.parametros_generales where localidad_id = p_origen;
  if v_origen.id is null then raise exception 'La empresa fuente no tiene Parámetros generales.'; end if;
  select string_agg(format('%I', c), ', ') into v_lista from unnest(v_cols) c;
  foreach d in array p_destinos loop
    if d = p_origen then
      v_res := v_res || jsonb_build_object('destino', d, 'ok', false, 'mensaje', 'Es la misma empresa fuente: se omite.');
      continue;
    end if;
    begin
      select * into v_dest from public.localidades where id = d;
      select * into v_par from public.parametros_generales where localidad_id = d;
      insert into public.replicaciones_catalogo (tipo, accion, origen_localidad_id, destino_localidad_id, respaldo, estado, mensaje, usuario)
      values (p_tipo, 'PARAMETROS', p_origen, d,
              jsonb_build_object('parametros', case when v_par.id is null then null else to_jsonb(v_par) end),
              'APLICADA', '', v_quien);
      if v_par.id is null then
        insert into public.parametros_generales (organizacion_id, localidad_id) values (v_dest.organizacion_id, d) returning * into v_par;
        v_msg := format('Parámetros creados (%s copiados).', case when cardinality(v_cols) = 1 then '1 valor' else cardinality(v_cols) || ' valores' end);
      else
        v_msg := format('%s; se guardó un respaldo.', case when cardinality(v_cols) = 1 then '1 parámetro actualizado' else cardinality(v_cols) || ' parámetros actualizados' end);
      end if;
      execute format('update public.parametros_generales set (%s) = (select %s from public.parametros_generales where id = $1) where id = $2', v_lista, v_lista)
        using v_origen.id, v_par.id;
      update public.replicaciones_catalogo set mensaje = v_msg
      where id = (select max(id) from public.replicaciones_catalogo where destino_localidad_id = d and accion = 'PARAMETROS' and tipo = p_tipo);
      v_res := v_res || jsonb_build_object('destino', d, 'ok', true, 'mensaje', v_msg);
    exception when others then
      insert into public.replicaciones_catalogo (tipo, accion, origen_localidad_id, destino_localidad_id, estado, mensaje, usuario)
      values (p_tipo, 'PARAMETROS', p_origen, d, 'ERROR', sqlerrm, v_quien);
      v_res := v_res || jsonb_build_object('destino', d, 'ok', false, 'mensaje', sqlerrm);
    end;
  end loop;
  return v_res;
end;
$$;

create function public.eliminar_replica_catalogo(p_tipo text, p_accion text, p_destino bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r       public.replicaciones_catalogo;
  v_par   public.parametros_generales;
  v_cols  text[] := public.columnas_parametros_catalogo(p_tipo);
  v_lista text;
  v_nivel integer;
  v_msg   text;
  v_quien text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then
    raise exception 'Solo un administrador puede eliminar replicaciones.';
  end if;
  select * into r from public.replicaciones_catalogo
  where tipo = p_tipo and accion = p_accion and destino_localidad_id = p_destino and estado = 'APLICADA'
  order by fecha desc, id desc limit 1 for update;
  if r.id is null then
    raise exception 'La empresa no tiene una replicación de % aplicada para eliminar.',
      case p_accion when 'CATALOGO' then case p_tipo when 'NOMENCLATURA' then 'nomenclatura' else 'centros de costo' end else 'parámetros' end;
  end if;

  if p_accion = 'CATALOGO' then
    if p_tipo = 'NOMENCLATURA' then
      for v_nivel in reverse coalesce((select max(nivel) from public.cuentas where catalogo_id = r.catalogo_id), 0)..1 loop
        delete from public.cuentas where catalogo_id = r.catalogo_id and nivel = v_nivel;
      end loop;
      delete from public.catalogos_cuentas where id = r.catalogo_id;
    else
      for v_nivel in reverse coalesce((select max(nivel) from public.centros_costo where catalogo_id = r.catalogo_id), 0)..1 loop
        delete from public.centros_costo where catalogo_id = r.catalogo_id and nivel = v_nivel;
      end loop;
      delete from public.catalogos_centros where id = r.catalogo_id;
    end if;
    v_msg := format('Se eliminó la versión replicada (%s %s).', r.total, case p_tipo when 'NOMENCLATURA' then 'cuentas' else 'centros de costo' end);
  else
    select * into v_par from public.parametros_generales where localidad_id = p_destino;
    if jsonb_typeof(r.respaldo -> 'parametros') = 'null' then
      delete from public.parametros_generales where id = v_par.id;
      v_msg := 'Se quitaron los parámetros que creó la replicación.';
    elsif v_par.id is not null then
      select string_agg(format('%I', c), ', ') into v_lista from unnest(v_cols) c;
      execute format('update public.parametros_generales set (%s) = (select %s from jsonb_populate_record(null::public.parametros_generales, $1)) where id = $2', v_lista, v_lista)
        using r.respaldo -> 'parametros', v_par.id;
      v_msg := 'Los parámetros volvieron a como estaban antes de replicar.';
    end if;
  end if;

  update public.replicaciones_catalogo set estado = 'ELIMINADA', eliminada_por = v_quien, eliminada_en = now() where id = r.id;
  return jsonb_build_object('destino', p_destino, 'ok', true, 'mensaje', v_msg);
end;
$$;

revoke execute on function public.copiar_catalogo(text, bigint, bigint, boolean) from public, anon, authenticated;
revoke execute on function public.validar_replica_catalogo(text, bigint, bigint[]) from public, anon, authenticated;
revoke execute on function public.replicar_catalogo(text, bigint, bigint[], boolean) from public, anon;
revoke execute on function public.replicar_parametros_catalogo(text, bigint, bigint[]) from public, anon;
revoke execute on function public.eliminar_replica_catalogo(text, text, bigint) from public, anon;
grant execute on function public.replicar_catalogo(text, bigint, bigint[], boolean) to authenticated;
grant execute on function public.replicar_parametros_catalogo(text, bigint, bigint[]) to authenticated;
grant execute on function public.eliminar_replica_catalogo(text, text, bigint) to authenticated;

notify pgrst, 'reload schema';
