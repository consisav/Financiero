-- Botón "Tasa cambio actual" de Monedas y tipos de cambio.
-- La función actualizar_tasas_banco_industrial() consulta en el momento:
--   1. La cotización del dólar de Banco Industrial (compra y venta en agencia), publicada en
--      InfoDolar (Banco Industrial no publica sus tasas en un formato que se pueda leer).
--   2. El tipo de cambio de mercado de las demás monedas (open.er-api.com, sin costo).
-- El dólar se graba con la cotización de Banco Industrial; las demás monedas con su tipo de
-- cambio de mercado en quetzales, aplicando el mismo margen de compra y venta del dólar de
-- Banco Industrial. Cada moneda necesita su código ISO (GTQ, USD, EUR, JPY…).
-- Se consulta desde la base de datos con la extensión http de Supabase, porque el navegador
-- no puede leer esas páginas directamente.

create extension if not exists http with schema extensions;

alter table public.monedas add column if not exists iso text check (iso ~ '^[A-Z]{3}$');
create unique index if not exists monedas_iso_key on public.monedas (iso);
update public.monedas set iso = v.iso
from (values (1, 'GTQ'), (2, 'USD'), (3, 'EUR'), (4, 'JPY')) as v (codigo, iso)
where monedas.codigo = v.codigo and monedas.iso is null;

create or replace function public.actualizar_tasas_banco_industrial() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_html     text;
  v_fila     text;
  v_valores  numeric[];
  v_online   numeric[];
  v_fecha_bi text;
  v_fx       jsonb;
  v_gtq      numeric;
  v_compra   numeric;
  v_venta    numeric;
  v_base     public.monedas;
  m          public.monedas;
  v_medio    numeric;
  v_c        numeric;
  v_v        numeric;
  v_res      jsonb := '[]'::jsonb;
begin
  if not public.puede_editar_catalogos() then
    raise exception 'Solo un administrador puede actualizar los tipos de cambio.';
  end if;

  select * into v_base from public.monedas where iso = 'GTQ';
  if v_base.id is null then
    raise exception 'Falta la moneda QUETZALES con código ISO GTQ.';
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '15000');

  -- 1. Dólar de Banco Industrial (fila de agencia; si no aparece, la de cambio en línea).
  select content into v_html from extensions.http((
    'GET', 'https://www.infodolar.com.gt/precio-dolar-entidad-banco-industrial.aspx',
    array[extensions.http_header('User-Agent', 'Mozilla/5.0')], null, null)::extensions.http_request)
  where status = 200;
  if v_html is null then
    raise exception 'No se pudo consultar la cotización de Banco Industrial. Intenta de nuevo en unos minutos.';
  end if;
  foreach v_fila in array regexp_split_to_array(v_html, '<tr>') loop
    continue when v_fila not like '%Banco Industrial%';
    v_valores := array(select (r)[1]::numeric from regexp_matches(v_fila, 'colCompraVenta" data-order="([0-9.]+)"', 'g') as r);
    continue when coalesce(array_length(v_valores, 1), 0) < 2;
    if v_fila like '%cambio-online%' then
      v_online := v_valores;
    elsif v_compra is null then
      v_compra := v_valores[1];
      v_venta := v_valores[2];
      v_fecha_bi := substring(v_fila from 'class="timeago date" title="([^"]+)"');
    end if;
  end loop;
  if v_compra is null and v_online is not null then
    v_compra := v_online[1];
    v_venta := v_online[2];
  end if;
  if v_compra is null or v_compra <= 0 or v_venta < v_compra then
    raise exception 'No se encontró la cotización del dólar de Banco Industrial.';
  end if;

  -- 2. Tipo de cambio de mercado de las demás monedas, por dólar.
  select content::jsonb into v_fx from extensions.http_get('https://open.er-api.com/v6/latest/USD') where status = 200;
  v_gtq := (v_fx -> 'rates' ->> 'GTQ')::numeric;
  if v_gtq is null or v_gtq <= 0 then
    raise exception 'No se pudo consultar el tipo de cambio de mercado de las demás monedas.';
  end if;

  for m in select * from public.monedas where activo and iso is not null and id <> v_base.id order by codigo loop
    if m.iso = 'USD' then
      v_c := v_compra;
      v_v := v_venta;
    else
      continue when (v_fx -> 'rates' ->> m.iso) is null;
      v_medio := v_gtq / (v_fx -> 'rates' ->> m.iso)::numeric;   -- quetzales por unidad de la moneda
      v_c := round(v_medio * v_compra / v_gtq, 6);
      v_v := round(v_medio * v_venta / v_gtq, 6);
    end if;
    insert into public.tipos_cambio (moneda_id, fecha, moneda_venta_id, valor_venta, moneda_compra_id, valor_compra)
    values (m.id, now(), v_base.id, v_v, v_base.id, v_c);
    v_res := v_res || jsonb_build_object('moneda', m.nombre, 'iso', m.iso, 'compra', v_c, 'venta', v_v);
  end loop;

  return jsonb_build_object('cotizacion_bi', v_fecha_bi, 'monedas', v_res);
end;
$$;

revoke execute on function public.actualizar_tasas_banco_industrial() from public, anon;
grant execute on function public.actualizar_tasas_banco_industrial() to authenticated;

notify pgrst, 'reload schema';
