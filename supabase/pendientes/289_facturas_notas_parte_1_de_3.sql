-- Script 289 · Organización 4 (Tecnoalsa): notas bancarias con que se cobraron las facturas de venta, de «CON_FACTURAS_NOTAS.xlsx»: 1178 del lote al
--   04-11-2026 (no se habían migrado) y 10 del lote del 05 al 17-11-2026 (1188 registros).
--   Cada registro es un abono a una factura (FACTURA, scripts 262 y 288) con una nota de crédito bancaria (CUENTA_BANCARIA y NOTA, scripts 259 y 285):
--   va a factura_venta_pagos con forma DEPÓSITO, documento «NOTA <número>», la cuenta en banco y ABONO como valor; la fecha es la de la nota (o la de la factura).
--   Columnas nuevas en factura_venta_pagos: origen_anterior, cuenta_bancaria_id, cuenta_bancaria_anterior, nota_anterior, movimiento_id (nota bancaria ligada),
--   valor_factura_anterior y valor_factura_mi_anterior (VALOR_FACTURA, VALOR_FACTURA_MI), abono_mi_anterior (ABONO_MI) y fecha_respaldo_anterior (FECHA_BK, nueva en este lote).
--   VALOR_RETENCION, MONEDA, DIFERENCIAL y CONTRATO vienen vacías. 
--   Después se actualizan «pagado» y «saldo» de las facturas abonadas (saldo = total − retención de IVA − pagado; anuladas en 0), sin tocar sus totales ni el inventario.
--   CONTIENE NÚMEROS DE CUENTAS BANCARIAS: no se sube al repositorio (la parte 1, solo estructura, sí). Se ejecuta después de los scripts 262, 285 y 288.
--   Se puede ejecutar de nuevo: actualiza.
-- Parte 1: estructura.
set lock_timeout = '20s';
alter table public.factura_venta_pagos add column if not exists origen_anterior text;
alter table public.factura_venta_pagos add column if not exists cuenta_bancaria_id bigint references public.cuentas_bancarias(id) on delete set null;
alter table public.factura_venta_pagos add column if not exists cuenta_bancaria_anterior text;
alter table public.factura_venta_pagos add column if not exists nota_anterior integer;
alter table public.factura_venta_pagos add column if not exists movimiento_id bigint references public.movimientos_bancarios(id) on delete set null;
alter table public.factura_venta_pagos add column if not exists valor_factura_anterior numeric;
alter table public.factura_venta_pagos add column if not exists valor_factura_mi_anterior numeric;
alter table public.factura_venta_pagos add column if not exists abono_mi_anterior numeric;
alter table public.factura_venta_pagos add column if not exists fecha_respaldo_anterior timestamp;
create unique index if not exists factura_venta_pagos_nota_anterior on public.factura_venta_pagos (factura_id, cuenta_bancaria_anterior, nota_anterior) where origen_anterior = 'CON_FACTURAS_NOTAS';
notify pgrst, 'reload schema';
