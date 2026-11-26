-- Script 331 · Seguridad e índices de las facturas FEL emitidas migradas (carga_sat_ventas_lineas, script 330).
--   El 330 creó la tabla copiando la estructura de carga_sat_lineas («like»), y esa copia no trae la seguridad por filas,
--   las políticas, las llaves foráneas ni los triggers. Este script se los pone igual que a carga_sat_lineas:
--     1) Seguridad por filas: leer cualquier usuario activo; crear, modificar y quitar solo quien edita catálogos. Nada para anon.
--     2) Llaves foráneas a cargas_sat, cuentas, clasificaciones_compra, compras y caja_documentos (la pantalla las usa).
--     3) Índice por empresa y fecha de emisión (la pantalla Facturas FEL anteriores consulta por ese rango).
--     4) Trigger de auditoría.
--   No cambia datos. Se puede ejecutar más de una vez.
alter table public.carga_sat_ventas_lineas enable row level security;
revoke all on public.carga_sat_ventas_lineas from anon;
drop policy if exists "carga_sat_ventas_lineas: leer" on public.carga_sat_ventas_lineas;
create policy "carga_sat_ventas_lineas: leer" on public.carga_sat_ventas_lineas for select to authenticated using (public.usuario_activo());
drop policy if exists "carga_sat_ventas_lineas: crear" on public.carga_sat_ventas_lineas;
create policy "carga_sat_ventas_lineas: crear" on public.carga_sat_ventas_lineas for insert to authenticated with check (public.puede_editar_catalogos());
drop policy if exists "carga_sat_ventas_lineas: modificar" on public.carga_sat_ventas_lineas;
create policy "carga_sat_ventas_lineas: modificar" on public.carga_sat_ventas_lineas for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
drop policy if exists "carga_sat_ventas_lineas: quitar" on public.carga_sat_ventas_lineas;
create policy "carga_sat_ventas_lineas: quitar" on public.carga_sat_ventas_lineas for delete to authenticated using (public.puede_editar_catalogos());
grant select, insert, update, delete on public.carga_sat_ventas_lineas to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'carga_sat_ventas_lineas_carga_id_fkey') then
    alter table public.carga_sat_ventas_lineas add constraint carga_sat_ventas_lineas_carga_id_fkey foreign key (carga_id) references public.cargas_sat (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'carga_sat_ventas_lineas_localidad_id_fkey') then
    alter table public.carga_sat_ventas_lineas add constraint carga_sat_ventas_lineas_localidad_id_fkey foreign key (localidad_id) references public.localidades (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'carga_sat_ventas_lineas_cuenta_id_fkey') then
    alter table public.carga_sat_ventas_lineas add constraint carga_sat_ventas_lineas_cuenta_id_fkey foreign key (cuenta_id) references public.cuentas (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'carga_sat_ventas_lineas_clasificacion_id_fkey') then
    alter table public.carga_sat_ventas_lineas add constraint carga_sat_ventas_lineas_clasificacion_id_fkey foreign key (clasificacion_id) references public.clasificaciones_compra (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'carga_sat_ventas_lineas_compra_id_fkey') then
    alter table public.carga_sat_ventas_lineas add constraint carga_sat_ventas_lineas_compra_id_fkey foreign key (compra_id) references public.compras (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'carga_sat_ventas_lineas_caja_documento_id_fkey') then
    alter table public.carga_sat_ventas_lineas add constraint carga_sat_ventas_lineas_caja_documento_id_fkey foreign key (caja_documento_id) references public.caja_documentos (id) on delete set null;
  end if;
end;
$$;

create index if not exists carga_sat_ventas_lineas_fecha on public.carga_sat_ventas_lineas (localidad_id, fecha_emision desc);
create index if not exists carga_sat_ventas_lineas_carga on public.carga_sat_ventas_lineas (carga_id);

drop trigger if exists carga_sat_ventas_lineas_auditar on public.carga_sat_ventas_lineas;
create trigger carga_sat_ventas_lineas_auditar before insert or update on public.carga_sat_ventas_lineas for each row execute function public.auditar();

notify pgrst, 'reload schema';

select 'carga_sat_ventas_lineas' as tabla,
       (select relrowsecurity from pg_class where oid = 'public.carga_sat_ventas_lineas'::regclass) as seguridad_por_filas,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'carga_sat_ventas_lineas') as politicas,
       (select count(*) from pg_constraint where conrelid = 'public.carga_sat_ventas_lineas'::regclass and contype = 'f') as llaves_foraneas,
       (select count(*) from public.carga_sat_ventas_lineas) as facturas;
