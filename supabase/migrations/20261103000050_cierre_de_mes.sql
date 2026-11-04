-- Contabilidad · Procesos · Cierre de mes, por localidad (empresa), año y mes.
--   cierres_mes: estado de cada mes cerrado (quién y cuándo) y su reapertura (quién, cuándo y
--   por qué).
--   periodo_cerrado(loc, año, mes): si el mes de la empresa está cerrado.
--   cerrar_mes(loc, año, mes, acción, motivo):
--     CERRAR: administrador; todas las partidas vigentes del mes deben estar aprobadas.
--     REABRIR: solo el Super Administrador y con motivo.
--   Con el mes cerrado, sus partidas y sus líneas no se registran, modifican, aprueban, anulan ni
--   eliminan (lo exige la base de datos, también para las partidas que generan los bancos).
-- Se ejecuta después del script 49.

create table if not exists public.cierres_mes (
  id                bigint generated always as identity primary key,
  organizacion_id   bigint not null references public.organizaciones (id),
  localidad_id      bigint not null,
  anio              integer not null check (anio between 1900 and 2999),
  mes               integer not null check (mes between 1 and 12),
  cerrado           boolean not null default true,
  cerrado_por       text,
  cerrado_en        timestamptz,
  reabierto_por     text,
  reabierto_en      timestamptz,
  motivo_reapertura text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, anio, mes)
);

drop trigger if exists cierres_mes_auditar on public.cierres_mes;
create trigger cierres_mes_auditar before insert or update on public.cierres_mes
  for each row execute function public.auditar();

create or replace function public.periodo_cerrado(p_loc bigint, p_anio integer, p_mes integer) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cierres_mes c where c.localidad_id = p_loc and c.anio = p_anio and c.mes = p_mes and c.cerrado);
$$;

-- ---------- Cerrar y reabrir ----------
create or replace function public.cerrar_mes(p_loc bigint, p_anio integer, p_mes integer, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_org bigint := (select organizacion_id from public.localidades where id = p_loc);
  v_pendientes integer;
  v_descuadradas integer;
begin
  if v_org is null then raise exception 'La localidad no existe.'; end if;
  if p_mes not between 1 and 12 then raise exception 'Mes no válido.'; end if;
  perform pg_advisory_xact_lock(4805, p_loc::integer);
  if p_accion = 'CERRAR' then
    if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede cerrar el mes.'; end if;
    if public.periodo_cerrado(p_loc, p_anio, p_mes) then raise exception 'El mes ya está cerrado.'; end if;
    select count(*) filter (where not aprobada), count(*) filter (where total_debe <> total_haber)
      into v_pendientes, v_descuadradas
      from public.partidas where localidad_id = p_loc and anio = p_anio and mes = p_mes and estado = 'VIGENTE';
    if v_descuadradas > 0 then raise exception 'Hay % partida(s) descuadrada(s) en el mes: corrígelas antes de cerrarlo.', v_descuadradas; end if;
    if v_pendientes > 0 then raise exception 'Hay % partida(s) sin aprobar en el mes: apruébalas o anúlalas antes de cerrarlo.', v_pendientes; end if;
    insert into public.cierres_mes (organizacion_id, localidad_id, anio, mes, cerrado, cerrado_por, cerrado_en)
    values (v_org, p_loc, p_anio, p_mes, true, v_quien, now())
    on conflict (localidad_id, anio, mes) do update set cerrado = true, cerrado_por = v_quien, cerrado_en = now();
  elsif p_accion = 'REABRIR' then
    if not public.es_superadmin() then raise exception 'Solo el Super Administrador puede reabrir un mes cerrado.'; end if;
    if not public.periodo_cerrado(p_loc, p_anio, p_mes) then raise exception 'El mes no está cerrado.'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la reapertura.'; end if;
    update public.cierres_mes set cerrado = false, reabierto_por = v_quien, reabierto_en = now(), motivo_reapertura = trim(p_motivo)
    where localidad_id = p_loc and anio = p_anio and mes = p_mes;
  else
    raise exception 'Acción no válida.';
  end if;
  return jsonb_build_object('anio', p_anio, 'mes', p_mes, 'accion', p_accion);
end;
$$;

-- ---------- Bloqueo de las partidas del mes cerrado ----------
create or replace function public.bloquear_mes_cerrado() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.partidas;
  v_meses constant text[] := array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
begin
  if tg_table_name = 'partidas' then
    if tg_op <> 'INSERT' and public.periodo_cerrado(old.localidad_id, old.anio, old.mes) then
      raise exception 'El mes de % % está cerrado: la partida %-% ya no se modifica.', v_meses[old.mes], old.anio, old.mes, old.numero;
    end if;
    if tg_op <> 'DELETE' and public.periodo_cerrado(new.localidad_id, new.anio, new.mes) then
      raise exception 'El mes de % % está cerrado: ya no se registran ni modifican partidas en él.', v_meses[new.mes], new.anio;
    end if;
  else
    select * into p from public.partidas where id = coalesce(new.partida_id, old.partida_id);
    if p.id is not null and public.periodo_cerrado(p.localidad_id, p.anio, p.mes) then
      raise exception 'El mes de % % está cerrado: la partida %-% ya no se modifica.', v_meses[p.mes], p.anio, p.mes, p.numero;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists partidas_mes_cerrado on public.partidas;
create trigger partidas_mes_cerrado before insert or update or delete on public.partidas
  for each row execute function public.bloquear_mes_cerrado();
drop trigger if exists partida_lineas_mes_cerrado on public.partida_lineas;
create trigger partida_lineas_mes_cerrado before insert or update or delete on public.partida_lineas
  for each row execute function public.bloquear_mes_cerrado();

alter table public.cierres_mes enable row level security;
drop policy if exists "cierres_mes: leer" on public.cierres_mes;
create policy "cierres_mes: leer" on public.cierres_mes for select to authenticated using (public.usuario_activo());

revoke execute on function public.bloquear_mes_cerrado() from public, anon, authenticated;
revoke execute on function public.periodo_cerrado(bigint, integer, integer) from public, anon;
revoke execute on function public.cerrar_mes(bigint, integer, integer, text, text) from public, anon;
grant execute on function public.periodo_cerrado(bigint, integer, integer) to authenticated;
grant execute on function public.cerrar_mes(bigint, integer, integer, text, text) to authenticated;
grant select on public.cierres_mes to authenticated;

-- Menú: Contabilidad · Procesos · Cierres · Cierre de mes (la opción ya existe).
update public.opciones_sistema set subgrupo = 'Cierres' where clave = 'cierre-de-mes' and grupo = 'procesos';

notify pgrst, 'reload schema';
