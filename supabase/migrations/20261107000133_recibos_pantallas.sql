-- Recibos de cobro: pantallas «Recibos» y «Consulta de Recibos» (Facturación/Ventas · Registros).
-- Se ejecuta después del script 132 (que crea recibos_venta y liga los pagos de las facturas a su recibo).
--   recibos_venta: número interno del recibo (el del sistema anterior en los migrados), tipo de pago, situación
--   (EMITIDO o LIQUIDADO; ANULADO sigue en «estado»), retención, gastos administrativos, firma y sello digital y datos
--   de modificación y anulación. Un recibo nuevo toma el número siguiente de su empresa.
--   Equivalencias de los migrados: TIPO_RECIBO 1 = ABONO, 2 = CANCELACIÓN, 3 = ANTICIPO; ESTADO L = LIQUIDADO,
--   E = EMITIDO.
--   Menú: opciones «Recibos» y «Consulta de Recibos» con los permisos de «Facturas Ventas».
-- Puede ejecutarse de nuevo.

do $$
begin
  if to_regclass('public.recibos_venta') is null then raise exception 'Falta ejecutar el script 132 (recibos de cobro).'; end if;
end;
$$;

alter table public.recibos_venta add column if not exists numero integer;
alter table public.recibos_venta add column if not exists tipo_pago text;
alter table public.recibos_venta add column if not exists situacion text;
alter table public.recibos_venta add column if not exists tipo_retencion text;
alter table public.recibos_venta add column if not exists gasto_fecha date;
alter table public.recibos_venta add column if not exists gasto_concepto text;
alter table public.recibos_venta add column if not exists gasto_valor numeric(18, 2);
alter table public.recibos_venta add column if not exists firma_digital boolean not null default true;
alter table public.recibos_venta add column if not exists motivo_anulacion text;
alter table public.recibos_venta add column if not exists modificado_por text;
alter table public.recibos_venta add column if not exists modificado_en timestamptz;
alter table public.recibos_venta drop constraint if exists recibos_venta_tipo_pago_check;
alter table public.recibos_venta add constraint recibos_venta_tipo_pago_check check (tipo_pago in ('ABONO', 'CANCELACIÓN', 'ANTICIPO'));
alter table public.recibos_venta drop constraint if exists recibos_venta_situacion_check;
alter table public.recibos_venta add constraint recibos_venta_situacion_check check (situacion in ('EMITIDO', 'LIQUIDADO'));
alter table public.recibos_venta drop constraint if exists recibos_venta_tipo_retencion_check;
alter table public.recibos_venta add constraint recibos_venta_tipo_retencion_check check (tipo_retencion in ('IVA', 'ISR'));

-- Migrados: número, tipo de pago y situación desde los datos del sistema anterior.
update public.recibos_venta set numero = recibo_anterior where numero is null and recibo_anterior is not null;
update public.recibos_venta set tipo_pago = case tipo_recibo_anterior when 1 then 'ABONO' when 3 then 'ANTICIPO' else 'CANCELACIÓN' end where tipo_pago is null;
update public.recibos_venta set situacion = case when estado_anterior = 'E' then 'EMITIDO' else 'LIQUIDADO' end where situacion is null;
update public.recibos_venta set tipo_retencion = 'IVA' where tipo_retencion is null and coalesce(valor_retencion, 0) > 0;
create unique index if not exists recibos_venta_numero on public.recibos_venta (localidad_id, numero) where numero is not null;
create index if not exists recibos_venta_fecha on public.recibos_venta (localidad_id, fecha);

-- Número siguiente de la empresa (o el del sistema anterior), nombre en mayúsculas y situación por omisión.
create or replace function public.preparar_recibo_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.numero is null then
    if new.recibo_anterior is not null then new.numero := new.recibo_anterior;
    else
      perform pg_advisory_xact_lock(hashtext('recibos_venta'), new.localidad_id::int);
      select coalesce(max(numero), 0) + 1 into new.numero from public.recibos_venta where localidad_id = new.localidad_id;
    end if;
  end if;
  new.nombre := nullif(upper(trim(new.nombre)), '');
  new.situacion := coalesce(new.situacion, case when new.estado_anterior = 'E' then 'EMITIDO' when new.origen_anterior = 'MIGRADO' then 'LIQUIDADO' else 'EMITIDO' end);
  new.tipo_pago := coalesce(new.tipo_pago, case new.tipo_recibo_anterior when 1 then 'ABONO' when 3 then 'ANTICIPO' else 'CANCELACIÓN' end);
  return new;
end;
$$;
drop trigger if exists recibos_venta_preparar on public.recibos_venta;
create trigger recibos_venta_preparar before insert or update on public.recibos_venta for each row execute function public.preparar_recibo_venta();

-- Menú: «Recibos» y «Consulta de Recibos» debajo de «Consulta de Facturas», con los permisos de «Facturas Ventas».
do $$
declare v_mod bigint; v_fac bigint; v_orden integer; v_id bigint;
begin
  select id, modulo_id into v_fac, v_mod from public.opciones_sistema where grupo = 'registros' and clave = 'facturas-ventas' order by id limit 1;
  if v_fac is null then raise notice 'No existe la opción Facturas Ventas.'; return; end if;
  select orden into v_orden from public.opciones_sistema where modulo_id = v_mod and grupo = 'registros' and clave = 'consulta-de-facturas';
  v_orden := coalesce(v_orden, (select orden from public.opciones_sistema where id = v_fac));
  if not exists (select 1 from public.opciones_sistema where modulo_id = v_mod and grupo = 'registros' and clave = 'recibos') then
    update public.opciones_sistema set orden = orden + 2 where orden > v_orden;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
    values (v_mod, 'registros', 'Recibos', 'recibos', 'Recibos', v_orden + 1) returning id into v_id;
    insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
    select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_fac
    on conflict do nothing;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
    values (v_mod, 'registros', 'Recibos', 'consulta-de-recibos', 'Consulta de Recibos', v_orden + 2) returning id into v_id;
    insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
    select a.rol_id, v_id, a.ver, false, false, false, a.imprimir from public.rol_accesos a where a.opcion_id = v_fac
    on conflict do nothing;
  end if;
  raise notice 'Recibos y Consulta de Recibos instaladas.';
end;
$$;

notify pgrst, 'reload schema';
