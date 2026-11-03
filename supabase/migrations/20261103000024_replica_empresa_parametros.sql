-- Cuentas y CC · Replicación · Empresa y parámetros.
-- Una réplica copia los Parámetros generales de una empresa (localidad) origen a una empresa
-- destino, por grupos: tiempo, uso de pantallas, impuestos, IDP, otros y firmantes. El NIT no se
-- copia porque es propio de cada empresa.
--   aplicar_replica(id):    guarda un respaldo de los parámetros del destino y copia los grupos
--                           elegidos; si el destino no tenía parámetros, se crean.
--   desaplicar_replica(id): devuelve el destino a como estaba antes (solo la última réplica
--                           aplicada a ese destino, para no deshacer réplicas posteriores).
-- Solo un administrador puede crear, aplicar o desaplicar réplicas.

create table public.replicas (
  id                   bigint generated always as identity primary key,
  numero               integer not null unique,
  tipo                 text not null default 'EMPRESA_PARAMETROS' check (tipo in ('EMPRESA_PARAMETROS')),
  fecha                timestamptz not null default now(),
  origen_localidad_id  bigint not null references public.localidades (id),
  destino_localidad_id bigint not null references public.localidades (id),
  descripcion          text,
  objetos              text[] not null default array['TIEMPO', 'PANTALLAS', 'IMPUESTOS', 'IDP', 'OTROS', 'FIRMANTES']
                       check (objetos <@ array['TIEMPO', 'PANTALLAS', 'IMPUESTOS', 'IDP', 'OTROS', 'FIRMANTES'] and cardinality(objetos) > 0),
  estado               text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APLICADA', 'DESAPLICADA')),
  respaldo             jsonb,
  aplicada_por         text, aplicada_en timestamptz,
  desaplicada_por      text, desaplicada_en timestamptz,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  check (origen_localidad_id <> destino_localidad_id)
);
create index on public.replicas (destino_localidad_id, aplicada_en desc);

-- Columnas de Parámetros generales de cada grupo.
create function public.columnas_replica(p_grupo text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_grupo
    when 'TIEMPO' then array['anio_actual', 'mes_actual', 'proximo_cierre', 'ultimo_cierre', 'inicio_periodo_actual',
                             'fin_periodo_actual', 'inicio_periodo_fiscal', 'fin_periodo_fiscal', 'primer_mes_contable', 'ultimo_mes_contable']
    when 'PANTALLAS' then array['aplicar_iva', 'incluir_centros_costo', 'migracion_bancos']
    when 'IMPUESTOS' then array['impuesto1', 'nombre_impuesto1', 'impuesto2', 'nombre_impuesto2',
                                'impuesto3', 'nombre_impuesto3', 'impuesto4', 'nombre_impuesto4']
    when 'IDP' then array['idp_super', 'idp_regular', 'idp_diesel']
    when 'OTROS' then array['valor_cheques_autorizacion', 'moneda_integracion', 'moneda_ingreso']
    else array[]::text[]
  end;
$$;

-- Número correlativo; aplicada o desaplicada, la réplica ya no cambia de empresas ni de grupos.
create function public.preparar_replica() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4802);
    new.numero := coalesce((select max(numero) from public.replicas), 0) + 1;
    new.fecha := now();
    new.estado := 'PENDIENTE';
    new.respaldo := null;
    new.aplicada_por := null; new.aplicada_en := null; new.desaplicada_por := null; new.desaplicada_en := null;
  else
    new.numero := old.numero;
    new.fecha := old.fecha;
    new.tipo := old.tipo;
    if old.estado <> 'PENDIENTE' and current_setting('fin.replica', true) is distinct from 'si' then
      new.origen_localidad_id := old.origen_localidad_id;
      new.destino_localidad_id := old.destino_localidad_id;
      new.objetos := old.objetos;
    end if;
    -- El estado y el respaldo solo los cambian aplicar_replica / desaplicar_replica.
    if current_setting('fin.replica', true) is distinct from 'si' then
      new.estado := old.estado;
      new.respaldo := old.respaldo;
      new.aplicada_por := old.aplicada_por; new.aplicada_en := old.aplicada_en;
      new.desaplicada_por := old.desaplicada_por; new.desaplicada_en := old.desaplicada_en;
    end if;
  end if;
  return new;
end;
$$;
create trigger replicas_preparar before insert or update on public.replicas
  for each row execute function public.preparar_replica();
create trigger replicas_auditar before insert or update on public.replicas
  for each row execute function public.auditar();

create function public.aplicar_replica(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r        public.replicas;
  v_dest   public.localidades;
  v_origen public.parametros_generales;
  v_par    public.parametros_generales;
  v_cols   text[];
  v_lista  text;
  g        text;
  v_quien  text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then
    raise exception 'Solo un administrador puede aplicar réplicas.';
  end if;
  select * into r from public.replicas where id = p_id for update;
  if r.id is null then raise exception 'La réplica no existe.'; end if;
  if r.estado = 'APLICADA' then raise exception 'La réplica % ya está aplicada.', r.numero; end if;

  select * into v_origen from public.parametros_generales where localidad_id = r.origen_localidad_id;
  if v_origen.id is null then
    raise exception 'La empresa origen no tiene Parámetros generales para replicar.';
  end if;
  select * into v_dest from public.localidades where id = r.destino_localidad_id;
  select * into v_par from public.parametros_generales where localidad_id = r.destino_localidad_id;

  perform set_config('fin.replica', 'si', true);

  -- Respaldo del destino tal como está ahora.
  update public.replicas set respaldo = jsonb_build_object(
      'parametros', case when v_par.id is null then null else to_jsonb(v_par) end,
      'firmantes', coalesce((select jsonb_agg(to_jsonb(f) order by f.orden) from public.parametros_firmantes f where f.parametros_id = v_par.id), '[]'::jsonb))
  where id = r.id;

  if v_par.id is null then
    insert into public.parametros_generales (organizacion_id, localidad_id)
    values (v_dest.organizacion_id, v_dest.id) returning * into v_par;
  end if;

  foreach g in array r.objetos loop
    v_cols := public.columnas_replica(g);
    continue when cardinality(v_cols) = 0;
    select string_agg(format('%I', c), ', ') into v_lista from unnest(v_cols) c;
    execute format('update public.parametros_generales set (%s) = (select %s from public.parametros_generales where id = $1) where id = $2',
                   v_lista, v_lista)
      using v_origen.id, v_par.id;
  end loop;

  if 'FIRMANTES' = any (r.objetos) then
    delete from public.parametros_firmantes where parametros_id = v_par.id;
    insert into public.parametros_firmantes (parametros_id, orden, tipo, nombre, cargo, registro, perfil_id)
    select v_par.id, f.orden, f.tipo, f.nombre, f.cargo, f.registro, f.perfil_id
    from public.parametros_firmantes f where f.parametros_id = v_origen.id;
  end if;

  update public.replicas
  set estado = 'APLICADA', aplicada_por = v_quien, aplicada_en = now(), desaplicada_por = null, desaplicada_en = null
  where id = r.id;
  perform set_config('fin.replica', '', true);

  return jsonb_build_object('numero', r.numero, 'grupos', cardinality(r.objetos));
end;
$$;

create function public.desaplicar_replica(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r       public.replicas;
  v_par   public.parametros_generales;
  v_cols  text[] := array[]::text[];
  v_lista text;
  g       text;
  v_quien text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then
    raise exception 'Solo un administrador puede desaplicar réplicas.';
  end if;
  select * into r from public.replicas where id = p_id for update;
  if r.id is null then raise exception 'La réplica no existe.'; end if;
  if r.estado <> 'APLICADA' then raise exception 'La réplica % no está aplicada.', r.numero; end if;
  if exists (select 1 from public.replicas x
             where x.destino_localidad_id = r.destino_localidad_id and x.estado = 'APLICADA' and x.aplicada_en > r.aplicada_en) then
    raise exception 'Hay una réplica posterior aplicada a la misma empresa destino. Desaplícala primero.';
  end if;

  select * into v_par from public.parametros_generales where localidad_id = r.destino_localidad_id;
  if r.respaldo -> 'parametros' is null or jsonb_typeof(r.respaldo -> 'parametros') = 'null' then
    -- El destino no tenía parámetros: se quitan los que creó la réplica.
    delete from public.parametros_generales where id = v_par.id;
  elsif v_par.id is not null then
    foreach g in array r.objetos loop
      v_cols := v_cols || public.columnas_replica(g);
    end loop;
    if cardinality(v_cols) > 0 then
      select string_agg(format('%I', c), ', ') into v_lista from unnest(v_cols) c;
      execute format('update public.parametros_generales set (%s) = (select %s from jsonb_populate_record(null::public.parametros_generales, $1)) where id = $2',
                     v_lista, v_lista)
        using r.respaldo -> 'parametros', v_par.id;
    end if;
    if 'FIRMANTES' = any (r.objetos) then
      delete from public.parametros_firmantes where parametros_id = v_par.id;
      insert into public.parametros_firmantes (parametros_id, orden, tipo, nombre, cargo, registro, perfil_id)
      select v_par.id, f.orden, f.tipo, f.nombre, f.cargo, f.registro, f.perfil_id
      from jsonb_populate_recordset(null::public.parametros_firmantes, r.respaldo -> 'firmantes') f;
    end if;
  end if;

  perform set_config('fin.replica', 'si', true);
  update public.replicas set estado = 'DESAPLICADA', desaplicada_por = v_quien, desaplicada_en = now() where id = r.id;
  perform set_config('fin.replica', '', true);

  return jsonb_build_object('numero', r.numero);
end;
$$;

alter table public.replicas enable row level security;
create policy "replicas: leer" on public.replicas for select to authenticated using (public.usuario_activo());
create policy "replicas: crear" on public.replicas for insert to authenticated with check (public.puede_editar_catalogos());
create policy "replicas: modificar" on public.replicas for update to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());

revoke execute on function public.preparar_replica() from public, anon, authenticated;
revoke execute on function public.aplicar_replica(bigint) from public, anon;
revoke execute on function public.desaplicar_replica(bigint) from public, anon;
grant execute on function public.aplicar_replica(bigint) to authenticated;
grant execute on function public.desaplicar_replica(bigint) to authenticated;

notify pgrst, 'reload schema';
