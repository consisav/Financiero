-- Organización 2 (Hospital Miraflores), lote del 05-11 al 17-11-2026 («Datos HM del 05-11-2026 al 17-11-2026»): mismo proceso de los scripts 200 y 277, solo con los registros de este lote.
-- Script 299 · parte 0 de 1 · Organización 2: columnas del detalle contable de compras. Se ejecuta UNA vez, antes de las partes 1 a 1.
set lock_timeout = '20s';
do $col$
declare r record; v_n int := 0;
begin
  for r in select * from (values ('cuenta_codigo_anterior', 'text'), ('version_cuenta_anterior', 'integer'), ('centro_costo_anterior', 'text'),
                                 ('debe_anterior', 'numeric(18, 2)'), ('haber_anterior', 'numeric(18, 2)'), ('reconstruida', 'boolean not null default false')) as x(col, tipo)
  loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compra_lineas' and column_name = r.col) then
      execute format('alter table public.compra_lineas add column %I %s', r.col, r.tipo);
      v_n := v_n + 1;
    end if;
  end loop;
  raise notice '%', format('Detalle contable de compras: %s columnas nuevas (las demás ya existían).', v_n);
end;
$col$;
-- Si el sistema reconstruyó líneas contables en estas compras migradas (script 168), se reemplazan por las del sistema anterior:
-- se borran aquí, una sola vez, solo en las compras de este lote que traen detalle contable (234).
do $rec$
declare v_rec int := 0; v_k int;
begin
  alter table public.compra_lineas disable trigger compra_lineas_validar;
  delete from public.compra_lineas cl
  using public.compras c join public.localidades l on l.id = c.localidad_id join public.organizaciones g on g.id = l.organizacion_id and g.codigo::text = '2'
  where cl.compra_id = c.id and cl.reconstruida and c.origen_anterior = 'VARIAS'
    and (l.correlativo, c.compra_anterior) in (values (1, 13884), (1, 13885), (1, 13886), (1, 13887), (1, 13888), (1, 13889), (1, 13890), (1, 13891), (1, 13892), (1, 13893), (1, 13894), (1, 13895), (1, 13896), (1, 13897), (1, 13898), (1, 13899), (1, 13900), (1, 13901), (1, 13902), (1, 13903), (1, 13904), (1, 13905), (1, 13906), (1, 13907), (1, 13908), (1, 13909), (1, 13910), (1, 13911), (1, 13912), (1, 13913), (1, 13914), (1, 13915), (1, 13916), (1, 13917), (1, 13918), (1, 13919), (1, 13921), (1, 13922), (1, 13923), (1, 13924), (1, 13925), (1, 13926), (1, 13927), (1, 13928), (1, 13929), (1, 13930), (1, 13931), (2, 2294), (2, 2295), (2, 2296), (2, 2297), (2, 2298), (2, 2299), (2, 2300), (2, 2301), (2, 2302), (3, 14596), (3, 14597), (3, 14598), (3, 14599), (3, 14600), (3, 14601), (3, 14602), (3, 14603), (3, 14604), (3, 14605), (3, 14606), (3, 14607), (3, 14608), (3, 14609), (3, 14610), (3, 14611), (3, 14612), (3, 14613), (3, 14614), (3, 14615), (3, 14616), (3, 14617), (3, 14618), (3, 14619), (3, 14620), (3, 14621), (3, 14622), (3, 14623), (3, 14624), (3, 14625), (3, 14626), (3, 14627), (3, 14628), (3, 14629), (3, 14630), (3, 14631), (3, 14632), (3, 14633), (3, 14634), (3, 14635), (3, 14636), (3, 14637), (3, 14638), (3, 14639), (3, 14640), (3, 14641), (3, 14642), (3, 14643), (3, 14644), (3, 14645), (3, 14646), (3, 14647), (3, 14648), (3, 14649), (3, 14650), (3, 14651), (3, 14652), (3, 14653), (3, 14654), (3, 14655), (3, 14656), (3, 14657), (3, 14658), (3, 14659), (3, 14660), (3, 14661), (3, 14662), (3, 14663), (3, 14664), (3, 14665), (3, 14666), (3, 14667), (3, 14668), (3, 14669), (3, 14670), (3, 14671), (3, 14672), (3, 14673), (3, 14674), (3, 14675), (3, 14676), (3, 14677), (3, 14678), (3, 14679), (3, 14680), (3, 14681), (3, 14682), (3, 14683), (3, 14684), (3, 14685), (3, 14686), (3, 14687), (3, 14688), (3, 14689), (3, 14690), (3, 14691), (3, 14692), (3, 14693), (3, 14694), (3, 14695), (3, 14696), (3, 14697), (3, 14698), (3, 14699), (3, 14700), (3, 14701), (3, 14702), (3, 14703), (3, 14704), (3, 14705), (3, 14706), (3, 14707), (3, 14708), (3, 14709), (3, 14710), (3, 14711), (3, 14712), (3, 14713), (3, 14714), (3, 14715), (3, 14716), (3, 14717), (3, 14718), (3, 14719), (3, 14720), (3, 14721), (3, 14722), (3, 14723), (3, 14724), (3, 14725), (3, 14726), (3, 14727), (3, 14728), (3, 14729), (3, 14730), (3, 14731), (3, 14732), (3, 14733), (3, 14734), (3, 14735), (3, 14736), (3, 14737), (3, 14738), (3, 14739), (3, 14740), (3, 14741), (3, 14742), (3, 14743), (3, 14744), (3, 14745), (3, 14746), (3, 14747), (3, 14748), (3, 14749), (3, 14750), (3, 14751), (3, 14752), (3, 14753), (3, 14754), (3, 14755), (3, 14756), (3, 14757), (3, 14758), (3, 14759), (3, 14760), (3, 14761), (3, 14762), (3, 14763), (3, 14764), (3, 14765), (3, 14766), (3, 14767), (3, 14768), (3, 14769), (3, 14770), (3, 14771), (3, 14772), (3, 14773));
  get diagnostics v_k = row_count; v_rec := v_rec + v_k;
  alter table public.compra_lineas enable trigger compra_lineas_validar;
  raise notice '%', format('Líneas reconstruidas que se reemplazarán: %s.', v_rec);
end;
$rec$;
analyze public.compras;
analyze public.compra_lineas;
notify pgrst, 'reload schema';
