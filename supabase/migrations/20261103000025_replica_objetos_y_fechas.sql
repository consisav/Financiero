-- Replicar información contable: la réplica de empresa se amplía con fecha inicial y final y
-- con los objetos de catálogos y de operación del diseño original.
--   Parámetros de la empresa: TIEMPO, PANTALLAS, IMPUESTOS, IDP, OTROS, FIRMANTES (script 24).
--   Objetos de catálogos que se copian:
--     CUENTAS  la versión activa más reciente del catálogo de cuentas del origen se copia como
--              una versión nueva del catálogo del destino.
--     CENTROS  igual, con el catálogo de centros de costo.
--   TIPOS_CUENTA y MONEDAS son comunes a todas las empresas: no hay nada que copiar.
--   Los demás objetos (flujo de efectivo, caja chica, pólizas, cheques…) se habilitan cuando
--   existan sus módulos; hoy no se pueden marcar.
--   Fecha inicial y final: rango de documentos para los objetos de operación.
-- Desaplicar quita las versiones de catálogo que creó la réplica y devuelve los parámetros.
-- Requiere el script 24. Puede ejecutarse de nuevo.

alter table public.replicas
  add column if not exists fecha_inicial date,
  add column if not exists fecha_final   date;

alter table public.replicas drop constraint if exists replicas_objetos_check;
alter table public.replicas drop constraint if exists replicas_fechas_check;
alter table public.replicas add constraint replicas_objetos_check check (cardinality(objetos) > 0 and objetos <@ array[
  'TIEMPO', 'PANTALLAS', 'IMPUESTOS', 'IDP', 'OTROS', 'FIRMANTES',
  'TIPOS_CUENTA', 'CUENTAS', 'CENTROS', 'FLUJO_EFECTIVO', 'MONEDAS', 'OBJETOS_CONTABLES', 'CAJA_CHICA', 'TRANSACCIONES', 'PROVEEDORES', 'CLIENTES',
  'POLIZAS', 'CHEQUES', 'CUENTAS_BANCARIAS', 'DEPOSITOS', 'NOTAS_CREDITO', 'NOTAS_DEBITO', 'CONCILIACION', 'DISPONIBILIDAD', 'COMPRAS', 'VENTAS', 'RECIBOS']);
alter table public.replicas add constraint replicas_fechas_check check (fecha_final is null or fecha_inicial is null or fecha_final >= fecha_inicial);

-- Objetos que hoy se pueden replicar (los comunes no copian nada pero se pueden marcar).
create or replace function public.objetos_replica_disponibles() returns text[]
language sql immutable set search_path = '' as $$
  select array['TIEMPO', 'PANTALLAS', 'IMPUESTOS', 'IDP', 'OTROS', 'FIRMANTES', 'TIPOS_CUENTA', 'CUENTAS', 'CENTROS', 'MONEDAS'];
$$;

create or replace function public.aplicar_replica(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r          public.replicas;
  v_dest     public.localidades;
  v_origen   public.parametros_generales;
  v_par      public.parametros_generales;
  v_cols     text[];
  v_lista    text;
  g          text;
  v_param    boolean;
  v_cat_o    bigint;
  v_cat_d    bigint;
  v_cuentas  integer := 0;
  v_centros  integer := 0;
  v_resp     jsonb := '{}'::jsonb;
  v_nivel    integer;
  v_quien    text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then
    raise exception 'Solo un administrador puede aplicar réplicas.';
  end if;
  select * into r from public.replicas where id = p_id for update;
  if r.id is null then raise exception 'La réplica no existe.'; end if;
  if r.estado = 'APLICADA' then raise exception 'La réplica % ya está aplicada.', r.numero; end if;
  if exists (select 1 from unnest(r.objetos) o where o <> all (public.objetos_replica_disponibles())) then
    raise exception 'La réplica tiene objetos que todavía no se pueden replicar: %.',
      (select string_agg(o, ', ') from unnest(r.objetos) o where o <> all (public.objetos_replica_disponibles()));
  end if;
  select * into v_dest from public.localidades where id = r.destino_localidad_id;
  v_param := r.objetos && array['TIEMPO', 'PANTALLAS', 'IMPUESTOS', 'IDP', 'OTROS', 'FIRMANTES'];

  perform set_config('fin.replica', 'si', true);

  -- ---------- Parámetros generales ----------
  if v_param then
    select * into v_origen from public.parametros_generales where localidad_id = r.origen_localidad_id;
    if v_origen.id is null then
      raise exception 'La empresa origen no tiene Parámetros generales para replicar.';
    end if;
    select * into v_par from public.parametros_generales where localidad_id = r.destino_localidad_id;
    v_resp := v_resp || jsonb_build_object(
      'parametros', case when v_par.id is null then null else to_jsonb(v_par) end,
      'firmantes', coalesce((select jsonb_agg(to_jsonb(f) order by f.orden) from public.parametros_firmantes f where f.parametros_id = v_par.id), '[]'::jsonb));
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
  end if;

  -- ---------- Catálogo de cuentas contables ----------
  if 'CUENTAS' = any (r.objetos) then
    select id into v_cat_o from public.catalogos_cuentas
    where localidad_id = r.origen_localidad_id and activo order by version desc limit 1;
    if v_cat_o is null then raise exception 'La empresa origen no tiene un catálogo de cuentas activo.'; end if;
    insert into public.catalogos_cuentas (organizacion_id, localidad_id, version, fecha_del)
    values (v_dest.organizacion_id, v_dest.id,
            coalesce((select max(version) from public.catalogos_cuentas where localidad_id = v_dest.id), 0) + 1, current_date)
    returning id into v_cat_d;
    for v_nivel in 1..coalesce((select max(nivel) from public.cuentas where catalogo_id = v_cat_o), 0) loop
      insert into public.cuentas (catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra, cuenta_anterior, vigente)
      select v_cat_d, c.codigo, c.nombre,
             (select d.id from public.cuentas d join public.cuentas m on m.id = c.cuenta_mayor_id
              where d.catalogo_id = v_cat_d and d.codigo = m.codigo),
             c.tipo_cuenta_id, c.integra, c.cuenta_anterior, c.vigente
      from public.cuentas c where c.catalogo_id = v_cat_o and c.nivel = v_nivel;
    end loop;
    select count(*) into v_cuentas from public.cuentas where catalogo_id = v_cat_d;
    v_resp := v_resp || jsonb_build_object('cuentas_catalogo', v_cat_d);
  end if;

  -- ---------- Catálogo de centros de costo ----------
  if 'CENTROS' = any (r.objetos) then
    select id into v_cat_o from public.catalogos_centros
    where localidad_id = r.origen_localidad_id and activo order by version desc limit 1;
    if v_cat_o is null then raise exception 'La empresa origen no tiene un catálogo de centros de costo activo.'; end if;
    insert into public.catalogos_centros (organizacion_id, localidad_id, version, fecha_del)
    values (v_dest.organizacion_id, v_dest.id,
            coalesce((select max(version) from public.catalogos_centros where localidad_id = v_dest.id), 0) + 1, current_date)
    returning id into v_cat_d;
    for v_nivel in 1..coalesce((select max(nivel) from public.centros_costo where catalogo_id = v_cat_o), 0) loop
      insert into public.centros_costo (catalogo_id, organizacion_id, codigo, nombre, centro_mayor_id, integra, centro_anterior, vigente)
      select v_cat_d, v_dest.organizacion_id, c.codigo, c.nombre,
             (select d.id from public.centros_costo d join public.centros_costo m on m.id = c.centro_mayor_id
              where d.catalogo_id = v_cat_d and d.codigo = m.codigo),
             c.integra, c.centro_anterior, c.vigente
      from public.centros_costo c where c.catalogo_id = v_cat_o and c.nivel = v_nivel;
    end loop;
    select count(*) into v_centros from public.centros_costo where catalogo_id = v_cat_d;
    v_resp := v_resp || jsonb_build_object('centros_catalogo', v_cat_d);
  end if;

  update public.replicas
  set estado = 'APLICADA', respaldo = v_resp, aplicada_por = v_quien, aplicada_en = now(), desaplicada_por = null, desaplicada_en = null
  where id = r.id;
  perform set_config('fin.replica', '', true);

  return jsonb_build_object('numero', r.numero, 'cuentas', v_cuentas, 'centros', v_centros, 'parametros', v_param);
end;
$$;

create or replace function public.desaplicar_replica(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r       public.replicas;
  v_par   public.parametros_generales;
  v_cols  text[] := array[]::text[];
  v_lista text;
  g       text;
  v_cat   bigint;
  v_nivel integer;
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

  -- ---------- Parámetros generales ----------
  if r.respaldo ? 'parametros' then
    select * into v_par from public.parametros_generales where localidad_id = r.destino_localidad_id;
    if jsonb_typeof(r.respaldo -> 'parametros') = 'null' then
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
  end if;

  -- ---------- Versiones de catálogo creadas por la réplica (de las subcuentas hacia arriba) ----------
  v_cat := (r.respaldo ->> 'cuentas_catalogo')::bigint;
  if v_cat is not null then
    for v_nivel in reverse coalesce((select max(nivel) from public.cuentas where catalogo_id = v_cat), 0)..1 loop
      delete from public.cuentas where catalogo_id = v_cat and nivel = v_nivel;
    end loop;
    delete from public.catalogos_cuentas where id = v_cat;
  end if;
  v_cat := (r.respaldo ->> 'centros_catalogo')::bigint;
  if v_cat is not null then
    for v_nivel in reverse coalesce((select max(nivel) from public.centros_costo where catalogo_id = v_cat), 0)..1 loop
      delete from public.centros_costo where catalogo_id = v_cat and nivel = v_nivel;
    end loop;
    delete from public.catalogos_centros where id = v_cat;
  end if;

  perform set_config('fin.replica', 'si', true);
  update public.replicas set estado = 'DESAPLICADA', desaplicada_por = v_quien, desaplicada_en = now() where id = r.id;
  perform set_config('fin.replica', '', true);

  return jsonb_build_object('numero', r.numero);
end;
$$;

-- Aplicada, la réplica tampoco cambia sus fechas.
create or replace function public.preparar_replica() returns trigger
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
      new.fecha_inicial := old.fecha_inicial;
      new.fecha_final := old.fecha_final;
    end if;
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

notify pgrst, 'reload schema';
