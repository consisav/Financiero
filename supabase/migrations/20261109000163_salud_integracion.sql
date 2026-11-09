-- Hospital y Clínicas médicas · etapa 3: integración administrativa y financiera y reportería.
-- Áreas del hospital con su centro de costo (la partida diaria de ingresos va por centro de costo); depósito en Caja y
-- Bancos de los cierres de caja del hospital y de la clínica; control de la partida diaria del hospital; menú de reportes.

alter table public.hos_areas add column if not exists centro_id bigint references public.centros_costo (id);
alter table public.hos_cierres_caja add column if not exists movimiento_id bigint references public.movimientos_bancarios (id);
alter table public.cli_cierres_caja add column if not exists movimiento_id bigint references public.movimientos_bancarios (id);

-- La partida diaria del hospital usa el control de partidas generadas.
alter table public.partidas_generadas drop constraint if exists partidas_generadas_origen_check;
alter table public.partidas_generadas add constraint partidas_generadas_origen_check check (origen in ('RECURRENTE', 'DIFERIDO', 'DIFERENCIAL', 'REVERSIÓN', 'CLÍNICA', 'HOSPITAL'));
create or replace function public.con_generar_partida(p_loc bigint, p_anio integer, p_mes integer, p_tipo text, p_descripcion text, p_lineas jsonb,
  p_origen text default null, p_ref bigint default null, p_monto numeric default null)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; p public.partidas;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede generar partidas automáticas.'; end if;
  if p_origen is not null and p_origen not in ('RECURRENTE', 'DIFERIDO', 'DIFERENCIAL', 'REVERSIÓN', 'CLÍNICA', 'HOSPITAL') then raise exception 'Origen no válido.'; end if;
  if p_tipo in ('PCR', 'PCE', 'PA') then raise exception 'Las partidas de cierre y apertura las genera el cierre anual.'; end if;
  v_id := public.con_generar_partida_int(p_loc, p_anio, p_mes, p_tipo, p_descripcion, p_lineas, p_origen, p_ref, p_monto, null, 'PARTIDA DEL MES', null, null);
  select * into p from public.partidas where id = v_id;
  if p_origen = 'CLÍNICA' then
    perform set_config('fin.clinica', 'si', true);
    update public.cli_cobros set partida_id = v_id where localidad_id = p_loc and estado = 'PAGADO' and partida_id is null and fecha = to_date(p_ref::text, 'YYYYMMDD');
    perform set_config('fin.clinica', '', true);
  end if;
  return jsonb_build_object('id', v_id, 'mes', p.mes, 'numero', p.numero, 'total', p.total_debe);
end;
$function$;

-- Depósito de cierres de caja (efectivo y cheques) en una cuenta bancaria: crea la boleta de depósito en Caja y Bancos,
-- donde se procesa su partida y se concilia.
create or replace function public.med_depositar(p_origen text, p_cierres bigint[], p_cuenta_bancaria bigint, p_fecha date, p_documento text default null)
 returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_loc bigint; v_org bigint; v_total numeric; v_n integer; v_mov bigint; v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para registrar depósitos.'; end if;
  if p_origen = 'HOSPITAL' then
    select min(localidad_id), min(organizacion_id), sum(efectivo + cheque), count(*) into v_loc, v_org, v_total, v_n from public.hos_cierres_caja where id = any (p_cierres) and movimiento_id is null;
  elsif p_origen = 'CLÍNICA' then
    select min(localidad_id), min(organizacion_id), sum(coalesce(efectivo_contado, efectivo) + cheque), count(*) into v_loc, v_org, v_total, v_n from public.cli_cierres_caja where id = any (p_cierres) and movimiento_id is null;
  else raise exception 'Origen no válido.'; end if;
  if coalesce(v_n, 0) = 0 or coalesce(v_total, 0) <= 0 then raise exception 'No hay cierres pendientes de depositar con efectivo o cheques.'; end if;
  if not exists (select 1 from public.cuentas_bancarias where id = p_cuenta_bancaria and localidad_id = v_loc) then raise exception 'La cuenta bancaria no es de la empresa.'; end if;
  insert into public.movimientos_bancarios (organizacion_id, localidad_id, cuenta_bancaria_id, tipo, fecha, moneda_id, tipo_cambio, valor, descripcion, numero_documento, tipo_tercero, tercero_nombre, tipo_operacion)
  values (v_org, v_loc, p_cuenta_bancaria, 'DEPOSITO', coalesce(p_fecha, current_date), null, 1, round(v_total, 2),
          'DEPÓSITO DE CIERRES DE CAJA ' || case when p_origen = 'HOSPITAL' then 'DEL HOSPITAL' else 'DE LA CLÍNICA' end || ' (' || v_n || ')', nullif(trim(p_documento), ''), 'OTRO', 'CAJA ' || p_origen, 'INGRESO')
  returning id into v_mov;
  if p_origen = 'HOSPITAL' then update public.hos_cierres_caja set movimiento_id = v_mov where id = any (p_cierres) and movimiento_id is null;
  else update public.cli_cierres_caja set movimiento_id = v_mov where id = any (p_cierres) and movimiento_id is null; end if;
  return jsonb_build_object('movimiento', v_mov, 'total', round(v_total, 2), 'cierres', v_n, 'usuario', v_quien);
end;
$$;
revoke execute on function public.med_depositar(text, bigint[], bigint, date, text) from public, anon;
grant execute on function public.med_depositar(text, bigint[], bigint, date, text) to authenticated;
grant execute on function public.con_generar_partida(bigint, integer, integer, text, text, jsonb, text, bigint, numeric) to authenticated;

do $$
declare v_mod bigint; v_id bigint; v_orden integer; o record;
begin
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    ('HOS', 1, 'procesos', 'Integración financiera', 'hos-contabilidad', 'Integración contable del hospital'), ('HOS', 2, 'procesos', 'Integración financiera', 'med-depositos', 'Depósito de cierres de caja'),
    ('HOS', 3, 'reportes', 'Reportes clínicos', 'med-rep-egresos', 'Morbilidad de egresos y estancia'), ('HOS', 4, 'reportes', 'Reportes clínicos', 'med-rep-mortalidad', 'Mortalidad hospitalaria'),
    ('HOS', 5, 'reportes', 'Reportes clínicos', 'med-rep-obstetricia', 'Partos y cesáreas'), ('HOS', 6, 'reportes', 'Reportes clínicos', 'med-rep-emergencia', 'Emergencia y triaje'),
    ('HOS', 7, 'reportes', 'Reportes quirúrgicos y de apoyo', 'med-rep-cirugias', 'Cirugías y uso de salas'), ('HOS', 8, 'reportes', 'Reportes quirúrgicos y de apoyo', 'med-rep-apoyo', 'Laboratorio e imagen'),
    ('HOS', 9, 'reportes', 'Reportes quirúrgicos y de apoyo', 'med-rep-farmacia', 'Consumo de farmacia'), ('HOS', 10, 'reportes', 'Reportes financieros', 'med-rep-rentabilidad', 'Rentabilidad por servicio'),
    ('HOS', 11, 'reportes', 'Reportes financieros', 'med-rep-aseguradoras', 'Facturación y cartera por aseguradora'), ('HOS', 12, 'reportes', 'Reportes financieros', 'med-rep-retenciones', 'Retenciones de ISR a médicos'),
    ('HOS', 13, 'reportes', 'Reportes financieros', 'hos-rep-personal', 'Personal por área y turno'), ('HOS', 14, 'reportes', 'Tablero', 'med-tablero', 'Tablero gerencial'),
    ('CLI', 1, 'procesos', 'Integración contable', 'med-depositos', 'Depósito de cierres de caja'), ('CLI', 2, 'reportes', 'Reportes financieros', 'med-rep-apoyo', 'Laboratorio e imagen'),
    ('CLI', 3, 'reportes', 'Reportes financieros', 'med-rep-rentabilidad', 'Rentabilidad por servicio'), ('CLI', 4, 'reportes', 'Reportes financieros', 'med-rep-aseguradoras', 'Facturación y cartera por aseguradora'),
    ('CLI', 5, 'reportes', 'Reportes financieros', 'med-rep-retenciones', 'Retenciones de ISR a médicos'), ('CLI', 6, 'reportes', 'Tablero', 'med-tablero', 'Tablero gerencial')) as x(m, n, grupo, subgrupo, clave, nombre) loop
    select id into v_mod from public.modulos_sistema where siglas = o.m limit 1;
    if v_mod is null then continue; end if;
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, o.grupo, o.subgrupo, o.clave, o.nombre, v_orden + o.n + case when o.m = 'CLI' then 100 else 0 end); end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
select 'Hospital y clínicas (etapa 3): centros de costo por área, depósitos de caja, partida diaria del hospital y reportes instalados.' as resultado;
