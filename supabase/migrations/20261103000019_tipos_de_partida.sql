-- Catálogos iniciales · Tipos de partida contable.
-- Clasifica las partidas del libro diario (Código de Comercio de Guatemala, arts. 368-372) según
-- el momento del ejercicio en que se registran: apertura, operación, ajuste o cierre.
-- Incluye las partidas propias de las entidades financieras supervisadas por la SIB
-- (intereses devengados, estimaciones por valuación de cartera, operaciones entre agencias).
-- Lectura: usuarios activos. Escritura: administrador. No se borra: se desactiva.
-- Puede ejecutarse de nuevo: no duplica los tipos que ya existan.

create table if not exists public.tipos_partida (
  id            bigint generated always as identity primary key,
  codigo        integer not null unique check (codigo > 0),
  siglas        text not null check (siglas ~ '^[A-Z0-9]{1,5}$'),
  nombre        text not null,
  clasificacion text not null check (clasificacion in ('APERTURA', 'OPERACIÓN', 'AJUSTE', 'CIERRE')),
  descripcion   text,
  activo        boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create unique index if not exists tipos_partida_siglas_key on public.tipos_partida (siglas);
create unique index if not exists tipos_partida_nombre_key on public.tipos_partida (lower(nombre));

drop trigger if exists tipos_partida_auditar on public.tipos_partida;
create trigger tipos_partida_auditar before insert or update on public.tipos_partida
  for each row execute function public.auditar();

alter table public.tipos_partida enable row level security;
drop policy if exists "tipos_partida: leer" on public.tipos_partida;
drop policy if exists "tipos_partida: crear" on public.tipos_partida;
drop policy if exists "tipos_partida: modificar" on public.tipos_partida;
create policy "tipos_partida: leer" on public.tipos_partida for select to authenticated using (public.usuario_activo());
create policy "tipos_partida: crear" on public.tipos_partida for insert to authenticated with check (public.puede_editar_catalogos());
create policy "tipos_partida: modificar" on public.tipos_partida for update to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());

-- ---------- Tipos de partida que se usan en Guatemala ----------
insert into public.tipos_partida (codigo, siglas, nombre, clasificacion, descripcion) values
  (1,  'PA',  'PARTIDA DE APERTURA',                       'APERTURA',  'Registra el inventario inicial o los saldos con que inicia el ejercicio contable.'),
  (2,  'PD',  'PARTIDA DE DIARIO',                         'OPERACIÓN', 'Operaciones ordinarias que no tienen un tipo de partida propio.'),
  (3,  'PI',  'PARTIDA DE INGRESOS',                       'OPERACIÓN', 'Recibos de caja, cobros y depósitos recibidos.'),
  (4,  'PE',  'PARTIDA DE EGRESOS',                        'OPERACIÓN', 'Cheques, transferencias y pagos emitidos.'),
  (5,  'PC',  'PARTIDA DE COMPRAS',                        'OPERACIÓN', 'Facturas de proveedores de bienes y servicios, con su IVA crédito fiscal.'),
  (6,  'PV',  'PARTIDA DE VENTAS',                         'OPERACIÓN', 'Facturación de bienes y servicios, con su IVA débito fiscal.'),
  (7,  'PB',  'PARTIDA DE BANCOS',                         'OPERACIÓN', 'Notas de débito y de crédito bancarias, comisiones y conciliaciones.'),
  (8,  'PN',  'PARTIDA DE PLANILLA',                       'OPERACIÓN', 'Sueldos, cuotas del IGSS, IRTRA e INTECAP, bonificación incentivo, bono 14, aguinaldo e indemnización.'),
  (9,  'PIN', 'PARTIDA DE INTERESES Y COMISIONES',         'OPERACIÓN', 'Intereses y comisiones devengados de cartera de créditos, depósitos e inversiones.'),
  (10, 'PAG', 'PARTIDA ENTRE AGENCIAS',                    'OPERACIÓN', 'Traslados y operaciones entre agencias o localidades de la entidad.'),
  (11, 'PIM', 'PARTIDA DE IMPUESTOS',                      'OPERACIÓN', 'Liquidación y pago de IVA, ISR, ISO, retenciones y timbres fiscales.'),
  (12, 'PDA', 'PARTIDA DE DEPRECIACIONES Y AMORTIZACIONES','AJUSTE',    'Depreciación de propiedad, planta y equipo y amortización de cargos diferidos e intangibles.'),
  (13, 'PPR', 'PARTIDA DE PROVISIONES',                    'AJUSTE',    'Provisiones de prestaciones laborales, cuentas incobrables y otros pasivos estimados.'),
  (14, 'PEV', 'PARTIDA DE ESTIMACIONES POR VALUACIÓN',     'AJUSTE',    'Reservas para cartera de créditos, inversiones y activos extraordinarios (normativa de la SIB).'),
  (15, 'PDC', 'PARTIDA DE DIFERENCIAL CAMBIARIO',          'AJUSTE',    'Revaluación de saldos en moneda extranjera por variación del tipo de cambio.'),
  (16, 'PAJ', 'PARTIDA DE AJUSTE',                         'AJUSTE',    'Devengos, regularizaciones y correcciones de fin de período.'),
  (17, 'PRC', 'PARTIDA DE RECLASIFICACIÓN',                'AJUSTE',    'Traslada saldos de una cuenta a otra sin afectar el resultado.'),
  (18, 'PRV', 'PARTIDA DE REVERSIÓN',                      'AJUSTE',    'Anula o revierte una partida registrada anteriormente.'),
  (19, 'PCR', 'PARTIDA DE CIERRE DE RESULTADOS',           'CIERRE',    'Liquida las cuentas de ingresos, costos y gastos contra la ganancia o pérdida del ejercicio.'),
  (20, 'PCE', 'PARTIDA DE CIERRE DEL EJERCICIO',           'CIERRE',    'Cierra las cuentas de balance (activo, pasivo y patrimonio) al final del ejercicio.')
on conflict (codigo) do nothing;

notify pgrst, 'reload schema';
