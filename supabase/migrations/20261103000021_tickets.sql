-- Tickets · Generación: requerimientos de recursos tecnológicos.
--   Organización, localidad, usuario y fecha (con hora) se colocan solos desde el perfil del
--   usuario que lo crea y no se pueden alterar.
--   Ticket: correlativo <organización>-<localidad>-<año>-<mes>-<correlativo>, p. ej. 1-01-2026-11-1;
--   el correlativo empieza en 1 cada mes en cada localidad.
--   Prioridad: 1 Normal (por defecto) … 5 Importante y urgente.
--   Estado: etapas del seguimiento (estados_ticket); cada cambio de estado o de recurso
--   queda en el historial (ticket_movimientos), que alimenta la gráfica del proceso.
--   Adjuntos: archivos o imágenes en el bucket privado "tickets" (máximo 10 MB cada uno).
-- Lectura: usuarios activos. Crear: usuarios activos. Modificar: quien lo creó, el recurso
-- asignado o un administrador.

-- ---------- Etapas del proceso ----------
create table public.estados_ticket (
  codigo      integer primary key check (codigo > 0),
  nombre      text not null unique,
  descripcion text,
  activo      boolean not null default true
);
insert into public.estados_ticket (codigo, nombre, descripcion) values
  (1, 'REGISTRADO',  'El requerimiento fue ingresado y espera revisión.'),
  (2, 'EN REVISIÓN', 'Se analiza el requerimiento, su alcance y los recursos necesarios.'),
  (3, 'ASIGNADO',    'Se asignó el recurso tecnológico responsable de atenderlo.'),
  (4, 'EN PROCESO',  'El recurso asignado trabaja en la solución.'),
  (5, 'EN PRUEBAS',  'La solución se valida con el usuario que lo solicitó.'),
  (6, 'RESUELTO',    'La solución fue aceptada por el usuario.'),
  (7, 'CERRADO',     'El ticket se cerró y queda solo para consulta.');

-- ---------- Tickets ----------
create table public.tickets (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  perfil_id       uuid references public.perfiles (id),
  usuario         text,
  fecha           timestamptz not null default now(),
  anio            integer not null,
  mes             integer not null,
  correlativo     integer not null,
  numero          text not null unique,
  descripcion     text not null check (length(trim(descripcion)) > 0),
  prioridad       integer not null default 1 check (prioridad between 1 and 5),
  estado          integer not null default 1 references public.estados_ticket (codigo),
  recurso_id      uuid references public.perfiles (id),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, anio, mes, correlativo)
);
create index on public.tickets (organizacion_id, localidad_id, fecha desc);
create index on public.tickets (recurso_id);
create index on public.tickets (perfil_id);

create table public.ticket_adjuntos (
  id        bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  ruta      text not null unique,
  nombre    text not null,
  tipo      text,
  tamano    bigint,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create index on public.ticket_adjuntos (ticket_id);

create table public.ticket_movimientos (
  id         bigint generated always as identity primary key,
  ticket_id  bigint not null references public.tickets (id) on delete cascade,
  estado     integer not null references public.estados_ticket (codigo),
  recurso_id uuid references public.perfiles (id),
  usuario    text,
  fecha      timestamptz not null default now()
);
create index on public.ticket_movimientos (ticket_id, fecha);

-- Datos por defecto y número del ticket; en una modificación no cambian.
create function public.preparar_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p   public.perfiles;
  v_org integer;
  v_loc integer;
begin
  if tg_op = 'UPDATE' then
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    new.perfil_id := old.perfil_id;
    new.usuario := old.usuario;
    new.fecha := old.fecha;
    new.anio := old.anio;
    new.mes := old.mes;
    new.correlativo := old.correlativo;
    new.numero := old.numero;
    return new;
  end if;

  select * into p from public.perfiles where id = (select auth.uid());
  new.perfil_id := p.id;
  new.usuario := coalesce(upper(p.usuario), 'SISTEMA');
  new.organizacion_id := coalesce(p.organizacion_id, new.organizacion_id);
  new.localidad_id := coalesce(p.localidad_id, new.localidad_id);
  if new.localidad_id is null then
    raise exception 'Tu usuario no tiene organización y localidad asignadas.';
  end if;
  new.fecha := now();
  new.anio := extract(year from new.fecha at time zone 'America/Guatemala');
  new.mes := extract(month from new.fecha at time zone 'America/Guatemala');

  -- Un ticket a la vez por localidad, para que el correlativo no se repita.
  perform pg_advisory_xact_lock(4801, new.localidad_id::integer);
  select coalesce(max(correlativo), 0) + 1 into new.correlativo
  from public.tickets where localidad_id = new.localidad_id and anio = new.anio and mes = new.mes;

  select o.codigo, l.correlativo into v_org, v_loc
  from public.localidades l join public.organizaciones o on o.id = l.organizacion_id
  where l.id = new.localidad_id;
  new.numero := format('%s-%s-%s-%s-%s', v_org, lpad(v_loc::text, 2, '0'), new.anio, lpad(new.mes::text, 2, '0'), new.correlativo);
  return new;
end;
$$;
create trigger tickets_preparar before insert or update on public.tickets
  for each row execute function public.preparar_ticket();

create function public.historial_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado or new.recurso_id is distinct from old.recurso_id then
    insert into public.ticket_movimientos (ticket_id, estado, recurso_id, usuario)
    values (new.id, new.estado, new.recurso_id,
      coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA'));
  end if;
  return null;
end;
$$;
create trigger tickets_historial after insert or update on public.tickets
  for each row execute function public.historial_ticket();

create trigger tickets_auditar before insert or update on public.tickets
  for each row execute function public.auditar();
create trigger ticket_adjuntos_auditar before insert or update on public.ticket_adjuntos
  for each row execute function public.auditar();

-- Quien lo creó, el recurso asignado o un administrador.
create function public.puede_editar_ticket(p_ticket bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.usuario_activo() and (public.puede_editar_catalogos() or exists (
    select 1 from public.tickets t
    where t.id = p_ticket and (select auth.uid()) in (t.perfil_id, t.recurso_id)));
$$;

-- Usuarios activos que se pueden asignar como recurso (la tabla perfiles solo deja ver el propio).
create function public.recursos_ticket() returns table (id uuid, usuario text, nombre text)
language sql stable security definer set search_path = '' as $$
  select p.id, upper(p.usuario), p.nombre from public.perfiles p
  where p.activo and public.usuario_activo()
  order by p.nombre;
$$;

alter table public.estados_ticket enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_adjuntos enable row level security;
alter table public.ticket_movimientos enable row level security;
create policy "estados_ticket: leer" on public.estados_ticket for select to authenticated using (public.usuario_activo());
create policy "tickets: leer" on public.tickets for select to authenticated using (public.usuario_activo());
create policy "tickets: crear" on public.tickets for insert to authenticated with check (public.usuario_activo());
create policy "tickets: modificar" on public.tickets for update to authenticated
  using (public.puede_editar_ticket(id)) with check (public.usuario_activo());
create policy "ticket_adjuntos: leer" on public.ticket_adjuntos for select to authenticated using (public.usuario_activo());
create policy "ticket_adjuntos: crear" on public.ticket_adjuntos for insert to authenticated with check (public.puede_editar_ticket(ticket_id));
create policy "ticket_adjuntos: quitar" on public.ticket_adjuntos for delete to authenticated using (public.puede_editar_ticket(ticket_id));
create policy "ticket_movimientos: leer" on public.ticket_movimientos for select to authenticated using (public.usuario_activo());

revoke execute on function public.preparar_ticket() from public, anon, authenticated;
revoke execute on function public.historial_ticket() from public, anon, authenticated;
revoke execute on function public.puede_editar_ticket(bigint) from public, anon;
revoke execute on function public.recursos_ticket() from public, anon;
grant execute on function public.puede_editar_ticket(bigint) to authenticated;
grant execute on function public.recursos_ticket() to authenticated;

-- ---------- Adjuntos (bucket privado) ----------
-- Ruta: <id del ticket>/<marca de tiempo>-<nombre del archivo>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 10485760, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

create policy "tickets: ver adjuntos" on storage.objects
  for select to authenticated
  using (bucket_id = 'tickets' and public.usuario_activo());
create policy "tickets: subir adjuntos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tickets' and public.puede_editar_ticket(nullif((storage.foldername(name))[1], '')::bigint));
create policy "tickets: quitar adjuntos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'tickets' and public.puede_editar_ticket(nullif((storage.foldername(name))[1], '')::bigint));

notify pgrst, 'reload schema';
