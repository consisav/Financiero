-- 166 · Facturación electrónica en línea con el certificador COFIDI.
-- Conversión a PostgreSQL de los paquetes Oracle del sistema anterior:
--   PK_DTE_FACTURA / PK_DTE_NOTAS  → sat_fel_xml_dte (arma el DTE de facturas y notas: emisor, receptor, frases,
--                                     ítems, impuestos, totales, complementos de exportación, cambiaria,
--                                     factura especial y referencias de nota, y la adenda NoInterno).
--   PK_ANULACION_DTE              → sat_fel_xml_anulacion (GTAnulacionDocumento).
--   PK_FEL_DTE.p_crearDocumentoFEL / p_crearDocumentoConsulta → sat_fel_preparar.
--   PK_FEL_DTE.p_validarCertificacion / p_validarConsulta     → sat_fel_registrar_respuesta.
--   CAR_FEL_PROCESO_XML / CAR_FEL_RESULTADO                   → sat_fel_procesos (bitácora de envíos).
--   CAR_DATOS_FEL                 → sat_fel_conexiones (sin credenciales: el Requestor y el usuario de COFIDI
--                                     viven como secretos de la Edge Function «fel-cofidi», nunca en tablas).
--   PK_FEL_DTE.p_crearDocEnvio / p_sendRequest (UTL_HTTP) → Edge Function supabase/functions/fel-cofidi.
-- Correcciones respecto al original: la hora usaba 'HH24:MM:SS' (MM = mes) y ahora es HH24:MI:SS; el xmlns del
-- complemento de factura especial se asignaba al nodo equivocado; el impuesto total se suma de las líneas para
-- que cuadre con lo que valida la SAT; los textos se escapan para XML.

-- ============ Datos del emisor que pide el complemento de exportación ============
alter table public.sat_emisores add column if not exists codigo_exportador text;

-- ============ Conexión con COFIDI por establecimiento (equivale a CAR_DATOS_FEL sin credenciales) ============
create table if not exists public.sat_fel_conexiones (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id bigint not null unique references public.localidades (id),
  ambiente text not null default 'PRUEBAS' check (ambiente in ('PRUEBAS', 'PRODUCCION')),
  url text,                                   -- dirección del web service RequestTransaction que entrega COFIDI
  soap_action text,                           -- solo si COFIDI la exige (el sistema anterior no la enviaba)
  transaccion text not null default 'SYSTEM_REQUEST',      -- CAR_DATOS_FEL.TRANSACCION
  dato_certificar text not null default 'POST_DOCUMENT_SAT', -- CAR_DATOS_FEL.IDENTIFICADOR (tipo de conexión 1)
  dato_anular text not null default 'VOID_DOCUMENT',         -- CAR_DATOS_FEL.IDENTIFICADOR (tipo de conexión 2)
  transaccion_consulta text,                  -- CAR_DATOS_FEL.TRANSACCION del tipo de conexión 3 (si difiere)
  secreto text not null default 'COFIDI',     -- prefijo de los secretos: <secreto>_REQUESTOR y <secreto>_USUARIO
  activo boolean not null default false,
  creado_en timestamptz not null default now(), modificado_en timestamptz
);

-- ============ Bitácora de envíos (CAR_FEL_PROCESO_XML + CAR_FEL_RESULTADO) ============
create table if not exists public.sat_fel_procesos (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id bigint not null references public.localidades (id),
  proceso text not null check (proceso in ('CERTIFICAR', 'ANULAR', 'CONSULTAR')),
  origen text not null check (origen in ('FACTURA', 'NOTA')),
  factura_venta_id bigint references public.facturas_venta (id) on delete set null,
  nota_venta_id bigint references public.notas_venta (id) on delete set null,
  tipo_dte text, no_interno text, nit_emisor text, gran_total numeric(16, 2), motivo text,
  xml_dte text,                               -- XML del DTE o de la anulación, sin firmar (COFIDI firma)
  estado text not null default 'PREPARADO' check (estado in ('PREPARADO', 'ENVIADO', 'CERTIFICADO', 'ANULADO', 'ENCONTRADO', 'RECHAZADO', 'ERROR')),
  http_status integer, respuesta text, resultado text, hint text, motivo_error text,
  autorizacion text, serie text, numero_dte text, fecha_certificacion timestamptz, xml_certificado text,
  creado_por uuid default auth.uid(), creado_por_nombre text, creado_en timestamptz not null default now(), enviado_en timestamptz, respondido_en timestamptz
);
create index if not exists sat_fel_procesos_factura on public.sat_fel_procesos (factura_venta_id);
create index if not exists sat_fel_procesos_nota on public.sat_fel_procesos (nota_venta_id);

-- ============ Ayudas de formato ============
create or replace function public.sat_fel_x(p text) returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(replace(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F]', '', 'g'),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&apos;');
$$;
create or replace function public.sat_fel_n(p numeric, d integer default 2) returns text language sql immutable set search_path = '' as $$
  select to_char(round(coalesce(p, 0), d), 'FM999999999990' || case when d > 0 then '.' || repeat('0', d) else '' end);
$$;
create or replace function public.sat_fel_q(p numeric) returns text language sql immutable set search_path = '' as $$
  select rtrim(rtrim(to_char(round(coalesce(p, 0), 6), 'FM999999999990.000000'), '0'), '.');
$$;
-- Identificación del receptor como la SAT la espera (CF, NIT sin guiones, CUI o extranjero).
create or replace function public.sat_fel_id_receptor(p_nit text, p_externo text, p_tipo_doc text, p_exportacion boolean) returns jsonb language plpgsql immutable set search_path = '' as $$
declare v text := upper(regexp_replace(coalesce(p_nit, ''), '[-. ]', '', 'g'));
begin
  if p_exportacion or upper(coalesce(p_tipo_doc, '')) = 'EXTRANJERO' then
    return jsonb_build_object('id', coalesce(nullif(trim(p_externo), ''), nullif(trim(p_nit), ''), 'CF'), 'especial', 'EXT');
  end if;
  if v in ('', '0', 'CF', 'C/F', 'C/FINAL', 'CONSUMIDORFINAL') then return jsonb_build_object('id', 'CF', 'especial', null); end if;
  if upper(coalesce(p_tipo_doc, '')) in ('CUI', 'DPI') or v ~ '^[0-9]{13}$' then return jsonb_build_object('id', v, 'especial', 'CUI'); end if;
  return jsonb_build_object('id', v, 'especial', null);
end;
$$;

-- ============ XML del DTE de una factura o nota (PK_DTE_FACTURA, PK_DTE_NOTAS y PK_FEL_DTE.p_addDocumento) ============
create or replace function public.sat_fel_xml_dte(p_origen text, p_id bigint) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  f public.facturas_venta; n public.notas_venta; o public.facturas_venta; e public.sat_emisores; c public.clientes;
  v_org bigint; v_loc bigint; v_tipo text; v_exp boolean := false; v_exento boolean := false; v_gen boolean := false; v_mon text; v_fecha timestamptz;
  v_nit text; v_ext text; v_nom text; v_dir text; v_correo text; v_noint text; v_doc_total numeric; v_rec jsonb;
  v_est integer; v_dir_em text; v_cp_em text; v_mun_em text; v_dep_em text;
  v_cp text; v_mun text; v_dep text; v_pais text;
  l record; v_items text := ''; v_frases text := ''; v_comp text := ''; v_lin integer := 0;
  v_q numeric; v_pu numeric; v_pr numeric; v_de numeric; v_to numeric; v_gr numeric; v_iv numeric; v_desc text;
  v_tiva numeric := 0; v_gran numeric := 0; v_err text[] := '{}'; v_xml text; v_esc integer;
  v_aut text; v_serie text; v_num text; v_femi timestamptz; v_isr numeric; v_riva numeric; v_venc date;
begin
  if p_origen = 'FACTURA' then
    select * into f from public.facturas_venta where id = p_id;
    if f.id is null then raise exception 'La factura no existe.'; end if;
    v_org := f.organizacion_id; v_loc := f.localidad_id; v_tipo := coalesce(nullif(trim(f.tipo_dte), ''), 'FACT'); v_fecha := f.fecha_emision;
    v_nit := f.nit; v_ext := f.nit_externo; v_nom := f.nombre; v_dir := f.direccion; v_correo := f.correo; v_noint := coalesce(nullif(trim(f.no_interno), ''), 'F-' || f.numero);
    v_exp := nullif(trim(f.incoterm), '') is not null or upper(coalesce(f.tipo_factura, '') || ' ' || coalesce(f.tipo_documento, '')) like '%EXPORTA%';
    v_exento := coalesce(f.exento_iva, false) or v_exp; v_gen := coalesce(f.generico, false);
    v_mon := coalesce((select iso from public.monedas where id = f.moneda_id), 'GTQ');
    v_doc_total := case when v_mon = 'GTQ' then f.total else coalesce(f.total_mi, f.total) end;
    if f.cliente_id is not null then select * into c from public.clientes where id = f.cliente_id; end if;
  elsif p_origen = 'NOTA' then
    select * into n from public.notas_venta where id = p_id;
    if n.id is null then raise exception 'La nota no existe.'; end if;
    v_org := n.organizacion_id; v_loc := n.localidad_id; v_fecha := n.fecha_emision;
    v_tipo := coalesce(nullif(trim(n.tipo_dte), ''), case upper(n.tipo) when 'CRÉDITO' then 'NCRE' when 'DÉBITO' then 'NDEB' else 'NABN' end);
    v_nit := n.nit; v_ext := n.nit_externo; v_nom := n.nombre; v_dir := n.direccion; v_correo := n.correo;
    v_noint := 'N' || case v_tipo when 'NCRE' then 'C' when 'NDEB' then 'D' else 'A' end || '-' || n.numero;
    if n.factura_id is not null then select * into o from public.facturas_venta where id = n.factura_id; end if;
    v_exp := o.id is not null and (nullif(trim(o.incoterm), '') is not null or upper(coalesce(o.tipo_factura, '')) like '%EXPORTA%');
    v_exento := coalesce(n.exento_iva, false) or coalesce(o.exento_iva, false) or v_exp;
    v_mon := coalesce((select iso from public.monedas where id = n.moneda_id), 'GTQ');
    v_doc_total := case when v_mon = 'GTQ' then n.valor else coalesce(n.valor_mi, n.valor) end;
    if n.cliente_id is not null then select * into c from public.clientes where id = n.cliente_id; end if;
    v_aut := coalesce(nullif(trim(o.autorizacion), ''), nullif(trim(n.autorizacion_documento_anterior), ''));
    v_serie := coalesce(nullif(trim(o.serie), ''), nullif(trim(n.serie_documento_anterior), ''));
    v_num := coalesce(nullif(trim(o.numero_dte), ''), nullif(trim(n.dte_documento_anterior), ''));
    v_femi := coalesce(o.fecha_emision, n.emision_documento_anterior at time zone 'America/Guatemala');
    if v_tipo in ('NCRE', 'NDEB') and v_aut is null then v_err := v_err || 'La nota no tiene la autorización de la factura de origen.'; end if;
  else
    raise exception 'Origen no válido: %', p_origen;
  end if;
  -- «FEXP» es un tipo interno: ante la SAT es una factura (FACT) con el atributo Exp="SI".
  if v_tipo = 'FEXP' then v_tipo := 'FACT'; v_exp := true; v_exento := true; end if;

  -- Emisor y establecimiento
  select * into e from public.sat_emisores where localidad_id = v_loc order by id limit 1;
  if e.id is null or nullif(trim(e.nit), '') is null then raise exception 'Configura el emisor FEL (NIT, nombre y afiliación) de este establecimiento en Integraciones SAT.'; end if;
  select s.codigo, s.direccion, s.codigo_postal, s.municipio, s.departamento into v_est, v_dir_em, v_cp_em, v_mun_em, v_dep_em
    from public.sat_establecimientos s where s.localidad_id = v_loc and coalesce(s.activo, true) order by s.codigo limit 1;

  -- Receptor
  v_rec := public.sat_fel_id_receptor(v_nit, v_ext, c.tipo_documento, v_exp);
  if c.id is not null then
    select m.nombre, nullif(m.cod_postal, '') into v_mun, v_cp from public.municipios m where m.id = c.municipio_id;
    select d.nombre into v_dep from public.departamentos d where d.id = c.departamento_id;
    select p.iso2 into v_pais from public.paises p where p.id = coalesce(case when v_exp then c.exp_pais_id end, c.pais_id);
    v_cp := coalesce(nullif(trim(c.codigo_postal), ''), v_cp);
  end if;
  v_pais := coalesce(nullif(trim(v_pais), ''), case when v_exp then null else 'GT' end, 'GT');
  v_cp := coalesce(v_cp, case when v_pais = 'GT' then '01001' else '00000' end);

  -- Frases del emisor (una por tipo, como las certificó el sistema anterior): las de tipo 4 (exenciones) solo cuando el
  -- documento va exento, con su escenario: 1 exportación, 9 medicamentos genéricos, 22 notas cuyo origen no lleva IVA.
  v_esc := case when not v_exento then null when v_exp then 1 when p_origen = 'NOTA' then 22 when v_gen then 9 end;
  select string_agg(format('<dte:Frase TipoFrase="%s" CodigoEscenario="%s"/>', z.tipo, z.escenario), '' order by z.tipo) into v_frases
    from (select distinct on (s.tipo) s.tipo, s.escenario
            from public.sat_emisor_frases ef join public.sat_frases s on s.id = ef.frase_id
           where ef.localidad_id = v_loc
             and (s.tipo <> 4 or (v_exento and s.escenario = coalesce(v_esc, (select min(s2.escenario) from public.sat_emisor_frases e2 join public.sat_frases s2 on s2.id = e2.frase_id
                                                                             where e2.localidad_id = v_loc and s2.tipo = 4 and s2.escenario not in (1, 9, 22)))))
           order by s.tipo, s.escenario) z;

  -- Ítems con su IVA
  for l in
    select x.linea, x.descripcion, x.tipo, x.cantidad, x.unidad_medida, x.lote, x.fecha_vencimiento,
           case when v_mon = 'GTQ' then x.precio else coalesce(x.precio_mi, x.precio) end pu,
           case when v_mon = 'GTQ' then x.total else coalesce(x.total_mi, x.total) end tot,
           case when v_mon = 'GTQ' then x.descuento else coalesce(x.descuento_mi, x.descuento) end des
      from (select linea, descripcion, tipo, cantidad, unidad_medida, lote, fecha_vencimiento, precio, precio_mi, total, total_mi, descuento, descuento_mi
              from public.factura_venta_lineas where p_origen = 'FACTURA' and factura_id = p_id
            union all
            select linea, descripcion, tipo, cantidad, unidad_medida, lote, fecha_vencimiento, precio, precio_mi, total, total_mi, 0, 0
              from public.nota_venta_lineas where p_origen = 'NOTA' and nota_id = p_id) x
     order by x.linea
  loop
    v_lin := v_lin + 1;
    v_q := coalesce(nullif(l.cantidad, 0), 1); v_to := round(coalesce(l.tot, 0), 2); v_de := round(coalesce(l.des, 0), 2); v_pu := coalesce(l.pu, 0);
    if v_de > 0 and abs(round(v_q * v_pu, 2) - v_de - v_to) <= 0.01 then v_pr := round(v_q * v_pu, 2); else v_pr := v_to; v_de := 0; end if;
    if abs(round(v_q * v_pu, 2) - v_pr) > 0.01 then v_pu := round(v_pr / v_q, 6); end if;
    if v_to <= 0 then v_err := v_err || format('La línea %s no tiene valor.', l.linea); end if;
    v_desc := coalesce(nullif(trim(l.descripcion), ''), 'PRODUCTO');
    if nullif(trim(l.lote), '') is not null then v_desc := v_desc || ' LOTE: ' || trim(l.lote) || coalesce(' VENCE: ' || to_char(l.fecha_vencimiento, 'DD/MM/YYYY'), ''); end if;
    v_gran := v_gran + v_to;
    v_items := v_items || format('<dte:Item NumeroLinea="%s" BienOServicio="%s"><dte:Cantidad>%s</dte:Cantidad><dte:UnidadMedida>%s</dte:UnidadMedida><dte:Descripcion>%s</dte:Descripcion><dte:PrecioUnitario>%s</dte:PrecioUnitario><dte:Precio>%s</dte:Precio><dte:Descuento>%s</dte:Descuento>',
      v_lin, case when upper(coalesce(l.tipo, '')) like 'SERV%' then 'S' else 'B' end, public.sat_fel_q(v_q), public.sat_fel_x(upper(left(coalesce(nullif(trim(l.unidad_medida), ''), 'UND'), 3))),
      public.sat_fel_x(left(v_desc, 1000)), public.sat_fel_n(v_pu, 6), public.sat_fel_n(v_pr), public.sat_fel_n(v_de));
    if v_tipo not in ('NABN', 'FPEQ') then
      if v_exento then v_gr := v_to; v_iv := 0; else v_gr := round(v_to / 1.12, 2); v_iv := round(v_to / 1.12 * 0.12, 2); end if;
      v_tiva := v_tiva + v_iv;
      v_items := v_items || format('<dte:Impuestos><dte:Impuesto><dte:NombreCorto>IVA</dte:NombreCorto><dte:CodigoUnidadGravable>%s</dte:CodigoUnidadGravable><dte:MontoGravable>%s</dte:MontoGravable><dte:MontoImpuesto>%s</dte:MontoImpuesto></dte:Impuesto></dte:Impuestos>',
        case when v_exento then 2 else 1 end, public.sat_fel_n(v_gr), public.sat_fel_n(v_iv));
    end if;
    v_items := v_items || format('<dte:Total>%s</dte:Total></dte:Item>', public.sat_fel_n(v_to));
  end loop;
  if v_lin = 0 then v_err := v_err || 'El documento no tiene líneas.'; end if;
  if abs(v_gran - coalesce(v_doc_total, 0)) > 0.05 then v_err := v_err || format('La suma de las líneas (%s) no cuadra con el total del documento (%s).', public.sat_fel_n(v_gran), public.sat_fel_n(v_doc_total)); end if;

  -- Complementos
  if v_exp and v_tipo in ('FACT', 'FCAM') then
    if coalesce(nullif(trim(f.incoterm), ''), nullif(trim(c.exp_incoterm), '')) is null then v_err := v_err || 'La factura de exportación no tiene INCOTERM.'; end if;
    v_comp := v_comp || format('<dte:Complemento IDComplemento="Exportacion" NombreComplemento="Exportacion" URIComplemento="http://www.sat.gob.gt/face2/ComplementoExportaciones/0.1.0"><cex:Exportacion xmlns:cex="http://www.sat.gob.gt/face2/ComplementoExportaciones/0.1.0" Version="1"><cex:NombreConsignatarioODestinatario>%s</cex:NombreConsignatarioODestinatario><cex:DireccionConsignatarioODestinatario>%s</cex:DireccionConsignatarioODestinatario>%s<cex:NombreComprador>%s</cex:NombreComprador><cex:DireccionComprador>%s</cex:DireccionComprador>%s<cex:INCOTERM>%s</cex:INCOTERM>%s</cex:Exportacion></dte:Complemento>',
      public.sat_fel_x(coalesce(nullif(trim(c.exp_consignatario), ''), nullif(trim(f.envio_nombre), ''), v_nom)),
      public.sat_fel_x(coalesce(nullif(trim(c.exp_direccion), ''), nullif(trim(f.envio_direccion), ''), nullif(trim(f.direccion_envio), ''), v_dir, 'CIUDAD')),
      coalesce('<cex:CodigoConsignatarioODestinatario>' || public.sat_fel_x(nullif(trim(c.exp_codigo_comprador), '')) || '</cex:CodigoConsignatarioODestinatario>', ''),
      public.sat_fel_x(v_nom), public.sat_fel_x(coalesce(nullif(trim(v_dir), ''), 'CIUDAD')),
      coalesce('<cex:CodigoComprador>' || public.sat_fel_x(nullif(trim(c.exp_codigo_comprador), '')) || '</cex:CodigoComprador>', ''),
      public.sat_fel_x(upper(coalesce(nullif(trim(f.incoterm), ''), nullif(trim(c.exp_incoterm), ''), ''))),
      case when nullif(trim(e.codigo_exportador), '') is not null then format('<cex:NombreExportador>%s</cex:NombreExportador><cex:CodigoExportador>%s</cex:CodigoExportador>', public.sat_fel_x(e.nombre_emisor), public.sat_fel_x(e.codigo_exportador)) else '' end);
  end if;
  if v_tipo = 'FCAM' then
    v_venc := coalesce(f.fecha_cobro, (v_fecha at time zone 'America/Guatemala')::date + coalesce(f.dias_credito, 0));
    v_comp := v_comp || format('<dte:Complemento IDComplemento="AbonosFacturaCambiaria" NombreComplemento="AbonosFacturaCambiaria" URIComplemento="http://www.sat.gob.gt/dte/fel/CompCambiaria/0.1.0"><cfc:AbonosFacturaCambiaria xmlns:cfc="http://www.sat.gob.gt/dte/fel/CompCambiaria/0.1.0" Version="1"><cfc:Abono><cfc:NumeroAbono>1</cfc:NumeroAbono><cfc:FechaVencimiento>%s</cfc:FechaVencimiento><cfc:MontoAbono>%s</cfc:MontoAbono></cfc:Abono></cfc:AbonosFacturaCambiaria></dte:Complemento>',
      to_char(v_venc, 'YYYY-MM-DD'), public.sat_fel_n(v_gran));
  end if;
  if v_tipo = 'FESP' then
    v_isr := coalesce(nullif(f.monto_retencion_isr, 0), round(v_gran / 1.12 * 0.05, 2)); v_riva := coalesce(nullif(f.monto_retencion_iva, 0), v_tiva);
    v_comp := v_comp || format('<dte:Complemento IDComplemento="FESP" NombreComplemento="RetencionesFacturaEspecial" URIComplemento="#RetencionesFacturaEspecial"><cfe:RetencionesFacturaEspecial xmlns:cfe="http://www.sat.gob.gt/face2/ComplementoFacturaEspecial/0.1.0" Version="1"><cfe:RetencionISR>%s</cfe:RetencionISR><cfe:RetencionIVA>%s</cfe:RetencionIVA><cfe:TotalMenosRetenciones>%s</cfe:TotalMenosRetenciones></cfe:RetencionesFacturaEspecial></dte:Complemento>',
      public.sat_fel_n(v_isr), public.sat_fel_n(v_riva), public.sat_fel_n(v_gran - v_isr - v_riva));
  end if;
  if v_tipo in ('NCRE', 'NDEB') then
    v_comp := v_comp || format('<dte:Complemento IDComplemento="ReferenciasNota" NombreComplemento="ReferenciasNota" URIComplemento="http://www.sat.gob.gt/face2/ComplementoReferenciaNota/0.1.0"><cno:ReferenciasNota xmlns:cno="http://www.sat.gob.gt/face2/ComplementoReferenciaNota/0.1.0" Version="1" NumeroAutorizacionDocumentoOrigen="%s" FechaEmisionDocumentoOrigen="%s" MotivoAjuste="%s"%s%s/></dte:Complemento>',
      public.sat_fel_x(upper(coalesce(v_aut, ''))), coalesce(to_char(v_femi at time zone 'America/Guatemala', 'YYYY-MM-DD'), ''), public.sat_fel_x(left(coalesce(nullif(trim(n.motivo), ''), 'AJUSTE'), 255)),
      coalesce(' SerieDocumentoOrigen="' || public.sat_fel_x(v_serie) || '"', ''), coalesce(' NumeroDocumentoOrigen="' || public.sat_fel_x(v_num) || '"', ''));
  end if;

  v_xml := '<?xml version="1.0" encoding="UTF-8"?>'
    || '<dte:GTDocumento xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:cfc="http://www.sat.gob.gt/dte/fel/CompCambiaria/0.1.0" xmlns:cno="http://www.sat.gob.gt/face2/ComplementoReferenciaNota/0.1.0" xmlns:cex="http://www.sat.gob.gt/face2/ComplementoExportaciones/0.1.0" xmlns:cfe="http://www.sat.gob.gt/face2/ComplementoFacturaEspecial/0.1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1" xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0">'
    || '<dte:SAT ClaseDocumento="dte"><dte:DTE ID="DatosCertificados"><dte:DatosEmision ID="DatosEmision">'
    || format('<dte:DatosGenerales Tipo="%s"%s FechaHoraEmision="%s" CodigoMoneda="%s"/>', v_tipo, case when v_exp then ' Exp="SI"' else '' end,
         to_char(coalesce(v_fecha, now()) at time zone 'America/Guatemala', 'YYYY-MM-DD"T"HH24:MI:SS') || '-06:00', v_mon)
    || format('<dte:Emisor NITEmisor="%s" NombreEmisor="%s" CodigoEstablecimiento="%s" NombreComercial="%s"%s AfiliacionIVA="%s"><dte:DireccionEmisor><dte:Direccion>%s</dte:Direccion><dte:CodigoPostal>%s</dte:CodigoPostal><dte:Municipio>%s</dte:Municipio><dte:Departamento>%s</dte:Departamento><dte:Pais>%s</dte:Pais></dte:DireccionEmisor></dte:Emisor>',
         public.sat_fel_x(upper(regexp_replace(e.nit, '[-. ]', '', 'g'))), public.sat_fel_x(e.nombre_emisor), coalesce(v_est, 1), public.sat_fel_x(coalesce(nullif(trim(e.nombre_comercial), ''), e.nombre_emisor)),
         coalesce(' CorreoEmisor="' || public.sat_fel_x(lower(nullif(trim(e.correo_emisor), ''))) || '"', ''), public.sat_fel_x(coalesce(nullif(trim(e.afiliacion_iva), ''), 'GEN')),
         public.sat_fel_x(coalesce(nullif(trim(v_dir_em), ''), nullif(trim(e.direccion), ''), 'CIUDAD')), public.sat_fel_x(coalesce(nullif(trim(v_cp_em), ''), nullif(trim(e.codigo_postal), ''), '01001')),
         public.sat_fel_x(coalesce(nullif(trim(v_mun_em), ''), nullif(trim(e.municipio), ''), '.')), public.sat_fel_x(coalesce(nullif(trim(v_dep_em), ''), nullif(trim(e.departamento), ''), '.')), public.sat_fel_x(coalesce(nullif(trim(e.pais), ''), 'GT')))
    || format('<dte:Receptor IDReceptor="%s"%s NombreReceptor="%s"%s><dte:DireccionReceptor><dte:Direccion>%s</dte:Direccion><dte:CodigoPostal>%s</dte:CodigoPostal><dte:Municipio>%s</dte:Municipio><dte:Departamento>%s</dte:Departamento><dte:Pais>%s</dte:Pais></dte:DireccionReceptor></dte:Receptor>',
         public.sat_fel_x(v_rec ->> 'id'), coalesce(' TipoEspecial="' || (v_rec ->> 'especial') || '"', ''), public.sat_fel_x(coalesce(nullif(trim(v_nom), ''), 'CONSUMIDOR FINAL')),
         case when v_correo ~ '^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$' then ' CorreoReceptor="' || public.sat_fel_x(lower(trim(v_correo))) || '"' else '' end,
         public.sat_fel_x(coalesce(nullif(trim(v_dir), ''), 'CIUDAD')), public.sat_fel_x(v_cp), public.sat_fel_x(coalesce(nullif(trim(v_mun), ''), '.')), public.sat_fel_x(coalesce(nullif(trim(v_dep), ''), '.')), public.sat_fel_x(v_pais))
    || coalesce('<dte:Frases>' || nullif(v_frases, '') || '</dte:Frases>', '')
    || '<dte:Items>' || v_items || '</dte:Items>'
    || '<dte:Totales>' || case when v_tipo not in ('NABN', 'FPEQ') then format('<dte:TotalImpuestos><dte:TotalImpuesto NombreCorto="IVA" TotalMontoImpuesto="%s"/></dte:TotalImpuestos>', public.sat_fel_n(v_tiva)) else '' end
    || format('<dte:GranTotal>%s</dte:GranTotal></dte:Totales>', public.sat_fel_n(v_gran))
    || coalesce('<dte:Complementos>' || nullif(v_comp, '') || '</dte:Complementos>', '')
    || '</dte:DatosEmision></dte:DTE>'
    || format('<dte:Adenda><NoInterno>%s</NoInterno></dte:Adenda>', public.sat_fel_x(v_noint))
    || '</dte:SAT></dte:GTDocumento>';

  return jsonb_build_object('xml', v_xml, 'organizacion_id', v_org, 'localidad_id', v_loc, 'tipo_dte', v_tipo, 'no_interno', v_noint, 'gran_total', v_gran,
    'total_iva', v_tiva, 'nit_emisor', upper(regexp_replace(e.nit, '[-. ]', '', 'g')), 'receptor', v_rec ->> 'id', 'exportacion', v_exp, 'exento', v_exento, 'errores', to_jsonb(v_err));
end;
$$;

-- ============ XML de la anulación (PK_ANULACION_DTE y PK_FEL_DTE.p_addDocumentoAnulacion) ============
create or replace function public.sat_fel_xml_anulacion(p_origen text, p_id bigint, p_motivo text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_org bigint; v_loc bigint; v_aut text; v_fecha timestamptz; v_nit text; v_ext text; v_tdoc text; v_noint text; v_tipo text; v_exp boolean := false; e public.sat_emisores; v_rec jsonb; v_xml text;
begin
  if p_origen = 'FACTURA' then
    select f.organizacion_id, f.localidad_id, f.autorizacion, f.fecha_emision, f.nit, f.nit_externo, c.tipo_documento, coalesce(nullif(trim(f.no_interno), ''), 'F-' || f.numero), f.tipo_dte,
           nullif(trim(f.incoterm), '') is not null or upper(coalesce(f.tipo_factura, '')) like '%EXPORTA%'
      into v_org, v_loc, v_aut, v_fecha, v_nit, v_ext, v_tdoc, v_noint, v_tipo, v_exp
      from public.facturas_venta f left join public.clientes c on c.id = f.cliente_id where f.id = p_id;
  elsif p_origen = 'NOTA' then
    select n.organizacion_id, n.localidad_id, n.autorizacion, n.fecha_emision, n.nit, n.nit_externo, c.tipo_documento, n.tipo_dte, n.numero::text
      into v_org, v_loc, v_aut, v_fecha, v_nit, v_ext, v_tdoc, v_tipo, v_noint
      from public.notas_venta n left join public.clientes c on c.id = n.cliente_id where n.id = p_id;
    v_noint := 'N' || case v_tipo when 'NCRE' then 'C' when 'NDEB' then 'D' else 'A' end || '-' || v_noint;
  else raise exception 'Origen no válido: %', p_origen; end if;
  if v_loc is null then raise exception 'El documento no existe.'; end if;
  if nullif(trim(v_aut), '') is null then raise exception 'El documento no está certificado: no hay nada que anular en la SAT.'; end if;
  if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
  select * into e from public.sat_emisores where localidad_id = v_loc order by id limit 1;
  if e.id is null then raise exception 'Configura el emisor FEL de este establecimiento en Integraciones SAT.'; end if;
  v_rec := public.sat_fel_id_receptor(v_nit, v_ext, v_tdoc, v_exp);
  v_xml := '<?xml version="1.0" encoding="UTF-8"?>'
    || '<dte:GTAnulacionDocumento xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Version="0.1" xmlns:dte="http://www.sat.gob.gt/dte/fel/0.1.0">'
    || '<dte:SAT><dte:AnulacionDTE ID="DatosCertificados">'
    || format('<dte:DatosGenerales ID="DatosAnulacion" NumeroDocumentoAAnular="%s" NITEmisor="%s" IDReceptor="%s" FechaEmisionDocumentoAnular="%s" FechaHoraAnulacion="%s" MotivoAnulacion="%s"/>',
         public.sat_fel_x(upper(trim(v_aut))), public.sat_fel_x(upper(regexp_replace(e.nit, '[-. ]', '', 'g'))), public.sat_fel_x(v_rec ->> 'id'),
         to_char(v_fecha at time zone 'America/Guatemala', 'YYYY-MM-DD"T"HH24:MI:SS'), to_char(now() at time zone 'America/Guatemala', 'YYYY-MM-DD"T"HH24:MI:SS'), public.sat_fel_x(left(trim(p_motivo), 255)))
    || '</dte:AnulacionDTE></dte:SAT></dte:GTAnulacionDocumento>';
  return jsonb_build_object('xml', v_xml, 'organizacion_id', v_org, 'localidad_id', v_loc, 'tipo_dte', v_tipo, 'no_interno', v_noint, 'nit_emisor', upper(regexp_replace(e.nit, '[-. ]', '', 'g')), 'autorizacion', upper(trim(v_aut)), 'errores', '[]'::jsonb);
end;
$$;

-- ============ Preparar un envío (PK_FEL_DTE.p_crearDocumentoFEL y p_crearDocumentoConsulta) ============
-- Lo llama la Edge Function con la sesión del usuario; devuelve el XML que se enviará a COFIDI.
create or replace function public.sat_fel_preparar(p_origen text, p_id bigint, p_proceso text default 'CERTIFICAR', p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; v_id bigint; v_aut text; v_estado text; v_nombre text;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para certificar o anular documentos.'; end if;
  if p_proceso not in ('CERTIFICAR', 'ANULAR', 'CONSULTAR') then raise exception 'Proceso no válido: %', p_proceso; end if;
  if p_origen = 'FACTURA' then select autorizacion, estado into v_aut, v_estado from public.facturas_venta where id = p_id;
  else select autorizacion, estado into v_aut, v_estado from public.notas_venta where id = p_id; end if;
  if v_estado is null then raise exception 'El documento no existe.'; end if;
  if p_proceso = 'CERTIFICAR' then
    if nullif(trim(v_aut), '') is not null then raise exception 'El documento ya está certificado (autorización %).', v_aut; end if;
    if v_estado = 'ANULADA' then raise exception 'El documento está anulado.'; end if;
    if exists (select 1 from public.sat_fel_procesos where proceso = 'CERTIFICAR' and estado = 'ENVIADO' and respondido_en is null
                 and (case when p_origen = 'FACTURA' then factura_venta_id else nota_venta_id end) = p_id and creado_en > now() - interval '2 minutes') then
      raise exception 'Hay un envío a COFIDI en curso para este documento: espera un momento y usa «Consultar en COFIDI».';
    end if;
    d := public.sat_fel_xml_dte(p_origen, p_id);
  elsif p_proceso = 'ANULAR' then
    d := public.sat_fel_xml_anulacion(p_origen, p_id, p_motivo);
  else
    d := public.sat_fel_xml_dte(p_origen, p_id) - 'xml';  -- consulta por número interno: no envía XML
    d := d || jsonb_build_object('errores', '[]'::jsonb);
  end if;
  if jsonb_array_length(coalesce(d -> 'errores', '[]')) > 0 then
    raise exception 'Revisa el documento antes de certificar: %', (select string_agg(x, ' ') from jsonb_array_elements_text(d -> 'errores') x);
  end if;
  select coalesce(nullif(trim(nombre), ''), usuario) into v_nombre from public.perfiles where id = auth.uid();
  insert into public.sat_fel_procesos (organizacion_id, localidad_id, proceso, origen, factura_venta_id, nota_venta_id, tipo_dte, no_interno, nit_emisor, gran_total, motivo, xml_dte, creado_por_nombre)
  values ((d ->> 'organizacion_id')::bigint, (d ->> 'localidad_id')::bigint, p_proceso, p_origen, case when p_origen = 'FACTURA' then p_id end, case when p_origen = 'NOTA' then p_id end,
          d ->> 'tipo_dte', d ->> 'no_interno', d ->> 'nit_emisor', (d ->> 'gran_total')::numeric, nullif(trim(p_motivo), ''), d ->> 'xml', v_nombre)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'proceso', p_proceso, 'localidad_id', (d ->> 'localidad_id')::bigint, 'nit_emisor', d ->> 'nit_emisor', 'no_interno', d ->> 'no_interno', 'xml', d ->> 'xml');
end;
$$;

-- ============ Registrar la respuesta de COFIDI (PK_FEL_DTE.p_validarCertificacion y p_validarConsulta) ============
-- Solo la llama la Edge Function con la llave de servicio. Lee Result, Hint, Description, TimeStamp, Batch (serie),
-- Serial (número), DocumentGUID (autorización) y ResponseData1 (XML certificado en Base64) y actualiza el documento.
create or replace function public.sat_fel_registrar_respuesta(p_id bigint, p_http integer, p_respuesta text, p_error text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.sat_fel_procesos; v_ok boolean; v_hint text; v_desc text; v_ts text; v_fecha timestamptz; v_serie text; v_num text; v_aut text; v_b64 text; v_xml text; v_estado text; v_dte bigint;
  t text := coalesce(p_respuesta, '');
  tag text;
begin
  select * into p from public.sat_fel_procesos where id = p_id for update;
  if p.id is null then raise exception 'El envío % no existe.', p_id; end if;
  -- Extrae el texto de una etiqueta con o sin prefijo de espacio de nombres.
  v_ok := lower(coalesce((regexp_match(t, '<(?:\w+:)?Result>\s*([^<]*?)\s*</(?:\w+:)?Result>'))[1], '')) = 'true';
  v_hint := (regexp_match(t, '<(?:\w+:)?Hint>([^<]*)</(?:\w+:)?Hint>'))[1];
  v_desc := (regexp_match(t, '<(?:\w+:)?Description>([^<]*)</(?:\w+:)?Description>'))[1];
  v_ts := (regexp_match(t, '<(?:\w+:)?TimeStamp>\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})'))[1];
  v_serie := (regexp_match(t, '<(?:\w+:)?Batch>([^<]*)</(?:\w+:)?Batch>'))[1];
  v_num := (regexp_match(t, '<(?:\w+:)?Serial>([^<]*)</(?:\w+:)?Serial>'))[1];
  v_aut := upper((regexp_match(t, '<(?:\w+:)?DocumentGUID>([^<]*)</(?:\w+:)?DocumentGUID>'))[1]);
  v_b64 := coalesce((regexp_match(t, '<(?:\w+:)?ResponseData1>([^<]*)</(?:\w+:)?ResponseData1>'))[1], (regexp_match(t, '<(?:\w+:)?ResponseData2>([^<]*)</(?:\w+:)?ResponseData2>'))[1]);
  if v_ts is not null then v_fecha := (replace(v_ts, 'T', ' ')::timestamp) at time zone 'America/Guatemala'; end if;
  if nullif(v_b64, '') is not null then
    begin v_xml := convert_from(decode(regexp_replace(v_b64, '\s', '', 'g'), 'base64'), 'UTF8'); exception when others then v_xml := null; end;
  end if;
  if p_error is not null or coalesce(p_http, 0) <> 200 then v_estado := 'ERROR';
  elsif not v_ok then v_estado := 'RECHAZADO';
  elsif p.proceso = 'CERTIFICAR' then v_estado := 'CERTIFICADO';
  elsif p.proceso = 'ANULAR' then v_estado := 'ANULADO';
  else v_estado := 'ENCONTRADO'; end if;

  update public.sat_fel_procesos set estado = v_estado, http_status = p_http, respuesta = left(t, 200000), resultado = case when v_ok then 'true' else 'false' end, hint = v_hint,
    motivo_error = coalesce(p_error, case when not v_ok then coalesce(nullif(v_desc, ''), v_hint, 'COFIDI no aceptó el documento.') end),
    autorizacion = v_aut, serie = v_serie, numero_dte = v_num, fecha_certificacion = coalesce(v_fecha, case when v_ok then now() end), xml_certificado = v_xml, respondido_en = now()
   where id = p_id;

  perform set_config('fin.sat', 'si', true); perform set_config('fin.factura', 'si', true);
  if v_estado in ('CERTIFICADO', 'ENCONTRADO') and v_aut is not null then
    if p.origen = 'FACTURA' then
      update public.facturas_venta set autorizacion = v_aut, serie = v_serie, numero_dte = v_num, fecha_certificacion = coalesce(v_fecha, now()) where id = p.factura_venta_id and nullif(trim(autorizacion), '') is null;
    else
      update public.notas_venta set autorizacion = v_aut, serie = v_serie, numero_dte = v_num, fecha_certificacion = coalesce(v_fecha, now()) where id = p.nota_venta_id and nullif(trim(autorizacion), '') is null;
    end if;
    -- Repositorio de DTE: el documento certificado en línea queda junto al historial migrado.
    if not exists (select 1 from public.sat_dte where localidad_id = p.localidad_id and upper(autorizacion) = v_aut) then
      insert into public.sat_dte (organizacion_id, localidad_id, id_anterior, tipo_dte, no_interno, fecha_emision, moneda, gran_total, total_iva, emisor_nit, receptor_nit, receptor_nombre, receptor_correo,
                                  serie, numero_dte, autorizacion, fecha_certificacion, resultado, factura_venta_id, nota_venta_id, origen)
      select p.organizacion_id, p.localidad_id, -p.id, p.tipo_dte, p.no_interno, d.fecha_emision, coalesce((select iso from public.monedas where id = d.moneda_id), 'GTQ'), p.gran_total, coalesce(d.iva, 0),
             p.nit_emisor, d.nit, d.nombre, d.correo, v_serie, v_num, v_aut, coalesce(v_fecha, now()), 'CERTIFICADO', p.factura_venta_id, p.nota_venta_id, 'EN LÍNEA'
        from (select fecha_emision, moneda_id, iva, nit, nombre, correo from public.facturas_venta where id = p.factura_venta_id
              union all select fecha_emision, moneda_id, null, nit, nombre, correo from public.notas_venta where id = p.nota_venta_id) d
      limit 1 returning id into v_dte;
    end if;
  elsif v_estado = 'ANULADO' then
    if p.origen = 'FACTURA' then
      update public.facturas_venta set estado = 'ANULADA', motivo_anulacion = coalesce(motivo_anulacion, p.motivo), anulada_en = coalesce(anulada_en, now()), anulada_por = coalesce(anulada_por, upper(p.creado_por_nombre)) where id = p.factura_venta_id and estado <> 'ANULADA';
    else
      update public.notas_venta set estado = 'ANULADA', motivo_anulacion = coalesce(motivo_anulacion, p.motivo), anulada_en = coalesce(anulada_en, now()), anulada_por = coalesce(anulada_por, upper(p.creado_por_nombre)) where id = p.nota_venta_id and estado <> 'ANULADA';
    end if;
    update public.sat_dte set estado = 'ANULADO', anulado_en = now(), motivo_anulacion = p.motivo where localidad_id = p.localidad_id and upper(autorizacion) = (select upper(autorizacion) from public.facturas_venta where id = p.factura_venta_id union all select upper(autorizacion) from public.notas_venta where id = p.nota_venta_id limit 1);
  end if;
  perform set_config('fin.sat', '', true); perform set_config('fin.factura', '', true);

  return jsonb_build_object('id', p_id, 'estado', v_estado, 'ok', v_estado in ('CERTIFICADO', 'ANULADO', 'ENCONTRADO'), 'autorizacion', v_aut, 'serie', v_serie, 'numero_dte', v_num,
    'fecha_certificacion', coalesce(v_fecha, case when v_ok then now() end),
    'mensaje', case v_estado when 'CERTIFICADO' then 'Documento certificado por COFIDI.' when 'ANULADO' then 'Documento anulado en la SAT.' when 'ENCONTRADO' then 'COFIDI tiene el documento certificado: se registró su autorización.'
                             when 'RECHAZADO' then coalesce(nullif(v_desc, ''), v_hint, 'COFIDI no aceptó el documento.') else coalesce(p_error, 'COFIDI respondió con el código ' || coalesce(p_http::text, '—') || '.') end);
end;
$$;

-- Marca un envío como enviado (lo usa la Edge Function antes de llamar a COFIDI).
create or replace function public.sat_fel_marcar_enviado(p_id bigint) returns void language sql security definer set search_path = '' as $$
  update public.sat_fel_procesos set estado = 'ENVIADO', enviado_en = now() where id = p_id and estado = 'PREPARADO';
$$;

-- ============ Permisos ============
revoke execute on function public.sat_fel_xml_dte(text, bigint) from public, anon;
revoke execute on function public.sat_fel_xml_anulacion(text, bigint, text) from public, anon;
grant execute on function public.sat_fel_xml_dte(text, bigint) to authenticated;               -- vista previa del XML
grant execute on function public.sat_fel_xml_anulacion(text, bigint, text) to authenticated;
revoke execute on function public.sat_fel_preparar(text, bigint, text, text) from public, anon;
grant execute on function public.sat_fel_preparar(text, bigint, text, text) to authenticated;
revoke execute on function public.sat_fel_registrar_respuesta(bigint, integer, text, text) from public, anon, authenticated;
revoke execute on function public.sat_fel_marcar_enviado(bigint) from public, anon, authenticated;
grant execute on function public.sat_fel_registrar_respuesta(bigint, integer, text, text) to service_role;
grant execute on function public.sat_fel_marcar_enviado(bigint) to service_role;

alter table public.sat_fel_conexiones enable row level security;
drop policy if exists "sat_fel_conexiones: leer" on public.sat_fel_conexiones;
create policy "sat_fel_conexiones: leer" on public.sat_fel_conexiones for select to authenticated using (public.usuario_activo());
drop policy if exists "sat_fel_conexiones: escribir" on public.sat_fel_conexiones;
create policy "sat_fel_conexiones: escribir" on public.sat_fel_conexiones for all to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
grant select, insert, update, delete on public.sat_fel_conexiones to authenticated;

alter table public.sat_fel_procesos enable row level security;
drop policy if exists "sat_fel_procesos: leer" on public.sat_fel_procesos;
create policy "sat_fel_procesos: leer" on public.sat_fel_procesos for select to authenticated using (public.usuario_activo());
grant select on public.sat_fel_procesos to authenticated;
grant all on public.sat_fel_procesos, public.sat_fel_conexiones to service_role;
