-- Catálogos comunes a todos los módulos: Geografía (países, regiones, departamentos,
-- municipios) y Organizaciones (organizaciones y sus localidades).
-- Lectura: cualquier usuario activo. Escritura: administrador o contador.
-- No se borran registros: se desactivan con "activo = false".

-- ---------- Permisos ----------
create function public.usuario_activo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and activo);
$$;

create function public.puede_editar_catalogos() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and activo and rol_id in ('administrador', 'contador')
  );
$$;

-- ---------- Auditoría: quién y cuándo grabó / modificó ----------
create function public.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quien uuid := (select auth.uid());
  v_nombre text := coalesce(
    (select nullif(split_part(p.nombre, ' ', 1), '') from public.perfiles p where p.id = v_quien),
    'sistema');
begin
  if tg_op = 'INSERT' then
    new.creado_por := v_quien;
    new.creado_por_nombre := v_nombre;
    new.creado_en := now();
    new.modificado_por := null;
    new.modificado_por_nombre := null;
    new.modificado_en := null;
  else
    new.creado_por := old.creado_por;
    new.creado_por_nombre := old.creado_por_nombre;
    new.creado_en := old.creado_en;
    new.modificado_por := v_quien;
    new.modificado_por_nombre := v_nombre;
    new.modificado_en := now();
  end if;
  return new;
end;
$$;

-- ---------- Geografía ----------
create table public.paises (
  id        bigint generated always as identity primary key,
  codigo    integer not null unique,
  nombre    text not null,
  iso2      char(2) not null unique,
  cod_tel   text,
  idioma    text,
  moneda    text,
  activo    boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);

create table public.regiones (
  id        bigint generated always as identity primary key,
  pais_id   bigint not null references public.paises (id),
  codigo    integer not null,
  nombre    text not null,
  activo    boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (pais_id, codigo)
);

create table public.departamentos (
  id         bigint generated always as identity primary key,
  pais_id    bigint not null references public.paises (id),
  region_id  bigint references public.regiones (id),
  codigo     integer not null,
  nombre     text not null,
  cod_tel    text,
  cod_postal text,
  activo     boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (pais_id, codigo)
);

create table public.municipios (
  id              bigint generated always as identity primary key,
  departamento_id bigint not null references public.departamentos (id),
  codigo          integer not null,
  nombre          text not null,
  cod_postal      text,
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (departamento_id, codigo)
);

create index on public.regiones (pais_id);
create index on public.departamentos (pais_id);
create index on public.departamentos (region_id);
create index on public.municipios (departamento_id);

-- ---------- Organizaciones ----------
create table public.organizaciones (
  id                  bigint generated always as identity primary key,
  codigo              integer not null unique,
  nombre              text not null,
  representante_legal text,
  telefonos           text,
  correos             text,
  direccion           text,
  pais_id             bigint references public.paises (id),
  departamento_id     bigint references public.departamentos (id),
  municipio_id        bigint references public.municipios (id),
  activo              boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);

-- codigo = "<código de la organización>-<correlativo de 2 dígitos>", por ejemplo 1-01
create table public.localidades (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null references public.organizaciones (id),
  correlativo      integer not null,
  codigo           text not null,
  nombre_comercial text not null,
  razon_social     text,
  nit              text,
  telefonos        text,
  correos          text,
  direccion        text,
  pais_id          bigint references public.paises (id),
  departamento_id  bigint references public.departamentos (id),
  municipio_id     bigint references public.municipios (id),
  activo           boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (organizacion_id, correlativo)
);

create index on public.organizaciones (municipio_id);
create index on public.localidades (organizacion_id);
create index on public.localidades (municipio_id);

create function public.codigo_organizacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.codigo is null then
    select coalesce(max(codigo), 0) + 1 into new.codigo from public.organizaciones;
  end if;
  return new;
end;
$$;

create function public.codigo_localidad() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.organizacion_id := old.organizacion_id;
    new.correlativo := old.correlativo;
    new.codigo := old.codigo;
    return new;
  end if;
  select coalesce(max(correlativo), 0) + 1 into new.correlativo
  from public.localidades where organizacion_id = new.organizacion_id;
  select o.codigo || '-' || lpad(new.correlativo::text, 2, '0') into new.codigo
  from public.organizaciones o where o.id = new.organizacion_id;
  return new;
end;
$$;

-- Los códigos de organización se asignan solos si no se envían.
alter table public.organizaciones alter column codigo drop not null;
create trigger organizaciones_codigo before insert on public.organizaciones
  for each row execute function public.codigo_organizacion();
alter table public.localidades alter column correlativo drop not null;
alter table public.localidades alter column codigo drop not null;
create trigger localidades_codigo before insert or update on public.localidades
  for each row execute function public.codigo_localidad();

-- Auditoría en todas las tablas
create trigger paises_auditar before insert or update on public.paises for each row execute function public.auditar();
create trigger regiones_auditar before insert or update on public.regiones for each row execute function public.auditar();
create trigger departamentos_auditar before insert or update on public.departamentos for each row execute function public.auditar();
create trigger municipios_auditar before insert or update on public.municipios for each row execute function public.auditar();
create trigger organizaciones_auditar before insert or update on public.organizaciones for each row execute function public.auditar();
create trigger localidades_auditar before insert or update on public.localidades for each row execute function public.auditar();

-- ---------- Seguridad a nivel de fila ----------
do $$
declare t text;
begin
  foreach t in array array['paises', 'regiones', 'departamentos', 'municipios', 'organizaciones', 'localidades'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
  end loop;
end;
$$;

revoke execute on function public.auditar() from public, anon, authenticated;
revoke execute on function public.codigo_organizacion() from public, anon, authenticated;
revoke execute on function public.codigo_localidad() from public, anon, authenticated;

-- ---------- Datos iniciales ----------
insert into public.paises (codigo, nombre, iso2, cod_tel, idioma, moneda) values
  (1,  'Guatemala',      'GT', '+502', 'Español', 'GTQ'),
  (2,  'El Salvador',    'SV', '+503', 'Español', 'USD'),
  (3,  'Honduras',       'HN', '+504', 'Español', 'HNL'),
  (4,  'Nicaragua',      'NI', '+505', 'Español', 'NIO'),
  (5,  'Costa Rica',     'CR', '+506', 'Español', 'CRC'),
  (6,  'Panamá',         'PA', '+507', 'Español', 'PAB / USD'),
  (7,  'Belice',         'BZ', '+501', 'Inglés',  'BZD'),
  (8,  'México',         'MX', '+52',  'Español', 'MXN'),
  (9,  'Estados Unidos', 'US', '+1',   'Inglés',  'USD'),
  (10, 'España',         'ES', '+34',  'Español', 'EUR');

insert into public.regiones (pais_id, codigo, nombre)
select p.id, r.codigo, r.nombre
from public.paises p,
     (values (1, 'Metropolitana'), (2, 'Norte'), (3, 'Nororiental'), (4, 'Suroriental'),
             (5, 'Central'), (6, 'Suroccidental'), (7, 'Noroccidental'), (8, 'Petén')) as r (codigo, nombre)
where p.iso2 = 'GT';

insert into public.departamentos (pais_id, region_id, codigo, nombre, cod_tel, cod_postal)
select p.id, r.id, d.codigo, d.nombre, '+502', lpad(d.codigo::text, 2, '0') || '001'
from public.paises p
join (values
  (1, 'Guatemala', 1), (2, 'El Progreso', 3), (3, 'Sacatepéquez', 5), (4, 'Chimaltenango', 5),
  (5, 'Escuintla', 5), (6, 'Santa Rosa', 4), (7, 'Sololá', 6), (8, 'Totonicapán', 6),
  (9, 'Quetzaltenango', 6), (10, 'Suchitepéquez', 6), (11, 'Retalhuleu', 6), (12, 'San Marcos', 6),
  (13, 'Huehuetenango', 7), (14, 'Quiché', 7), (15, 'Baja Verapaz', 2), (16, 'Alta Verapaz', 2),
  (17, 'Petén', 8), (18, 'Izabal', 3), (19, 'Zacapa', 3), (20, 'Chiquimula', 3),
  (21, 'Jalapa', 4), (22, 'Jutiapa', 4)
) as d (codigo, nombre, region) on true
join public.regiones r on r.pais_id = p.id and r.codigo = d.region
where p.iso2 = 'GT';

-- 340 municipios de Guatemala; código = departamento × 100 + número (1701 = Flores)
insert into public.municipios (departamento_id, codigo, nombre, cod_postal)
select d.id, d.codigo * 100 + m.n, m.nombre, case when m.n = 1 then d.cod_postal end
from public.departamentos d
join public.paises p on p.id = d.pais_id and p.iso2 = 'GT'
cross join lateral unnest(case d.codigo
  when 1 then array['Guatemala','Santa Catarina Pinula','San José Pinula','San José del Golfo','Palencia','Chinautla','San Pedro Ayampuc','Mixco','San Pedro Sacatepéquez','San Juan Sacatepéquez','San Raymundo','Chuarrancho','Fraijanes','Amatitlán','Villa Nueva','Villa Canales','San Miguel Petapa']
  when 2 then array['Guastatoya','Morazán','San Agustín Acasaguastlán','San Cristóbal Acasaguastlán','El Jícaro','Sansare','Sanarate','San Antonio La Paz']
  when 3 then array['Antigua Guatemala','Jocotenango','Pastores','Sumpango','Santo Domingo Xenacoj','Santiago Sacatepéquez','San Bartolomé Milpas Altas','San Lucas Sacatepéquez','Santa Lucía Milpas Altas','Magdalena Milpas Altas','Santa María de Jesús','Ciudad Vieja','San Miguel Dueñas','Alotenango','San Antonio Aguas Calientes','Santa Catarina Barahona']
  when 4 then array['Chimaltenango','San José Poaquil','San Martín Jilotepeque','San Juan Comalapa','Santa Apolonia','Tecpán Guatemala','Patzún','San Miguel Pochuta','Patzicía','Santa Cruz Balanyá','Acatenango','San Pedro Yepocapa','San Andrés Itzapa','Parramos','Zaragoza','El Tejar']
  when 5 then array['Escuintla','Santa Lucía Cotzumalguapa','La Democracia','Siquinalá','Masagua','Tiquisate','La Gomera','Guanagazapa','San José','Iztapa','Palín','San Vicente Pacaya','Nueva Concepción','Sipacate']
  when 6 then array['Cuilapa','Barberena','Santa Rosa de Lima','Casillas','San Rafael Las Flores','Oratorio','San Juan Tecuaco','Chiquimulilla','Taxisco','Santa María Ixhuatán','Guazacapán','Santa Cruz Naranjo','Pueblo Nuevo Viñas','Nueva Santa Rosa']
  when 7 then array['Sololá','San José Chacayá','Santa María Visitación','Santa Lucía Utatlán','Nahualá','Santa Catarina Ixtahuacán','Santa Clara La Laguna','Concepción','San Andrés Semetabaj','Panajachel','Santa Catarina Palopó','San Antonio Palopó','San Lucas Tolimán','Santa Cruz La Laguna','San Pablo La Laguna','San Marcos La Laguna','San Juan La Laguna','San Pedro La Laguna','Santiago Atitlán']
  when 8 then array['Totonicapán','San Cristóbal Totonicapán','San Francisco El Alto','San Andrés Xecul','Momostenango','Santa María Chiquimula','Santa Lucía La Reforma','San Bartolo Aguas Calientes']
  when 9 then array['Quetzaltenango','Salcajá','Olintepeque','San Carlos Sija','Sibilia','Cabricán','Cajolá','San Miguel Sigüilá','San Juan Ostuncalco','San Mateo','Concepción Chiquirichapa','San Martín Sacatepéquez','Almolonga','Cantel','Huitán','Zunil','Colomba Costa Cuca','San Francisco La Unión','El Palmar','Coatepeque','Génova','Flores Costa Cuca','La Esperanza','Palestina de Los Altos']
  when 10 then array['Mazatenango','Cuyotenango','San Francisco Zapotitlán','San Bernardino','San José El Ídolo','Santo Domingo Suchitepéquez','San Lorenzo','Samayac','San Pablo Jocopilas','San Antonio Suchitepéquez','San Miguel Panán','San Gabriel','Chicacao','Patulul','Santa Bárbara','San Juan Bautista','Santo Tomás La Unión','Zunilito','Pueblo Nuevo','Río Bravo','San José La Máquina']
  when 11 then array['Retalhuleu','San Sebastián','Santa Cruz Muluá','San Martín Zapotitlán','San Felipe','San Andrés Villa Seca','Champerico','Nuevo San Carlos','El Asintal']
  when 12 then array['San Marcos','San Pedro Sacatepéquez','San Antonio Sacatepéquez','Comitancillo','San Miguel Ixtahuacán','Concepción Tutuapa','Tacaná','Sibinal','Tajumulco','Tejutla','San Rafael Pie de la Cuesta','Nuevo Progreso','El Tumbador','El Rodeo','Malacatán','Catarina','Ayutla','Ocós','San Pablo','El Quetzal','La Reforma','Pajapita','Ixchiguán','San José Ojetenam','San Cristóbal Cucho','Sipacapa','Esquipulas Palo Gordo','Río Blanco','San Lorenzo','La Blanca']
  when 13 then array['Huehuetenango','Chiantla','Malacatancito','Cuilco','Nentón','San Pedro Necta','Jacaltenango','San Pedro Soloma','San Ildefonso Ixtahuacán','Santa Bárbara','La Libertad','La Democracia','San Miguel Acatán','San Rafael La Independencia','Todos Santos Cuchumatán','San Juan Atitán','Santa Eulalia','San Mateo Ixtatán','Colotenango','San Sebastián Huehuetenango','Tectitán','Concepción Huista','San Juan Ixcoy','San Antonio Huista','San Sebastián Coatán','Santa Cruz Barillas','Aguacatán','San Rafael Petzal','San Gaspar Ixchil','Santiago Chimaltenango','Santa Ana Huista','Unión Cantinil','Petatán']
  when 14 then array['Santa Cruz del Quiché','Chiché','Chinique','Zacualpa','Chajul','Chichicastenango','Patzité','San Antonio Ilotenango','San Pedro Jocopilas','Cunén','San Juan Cotzal','Joyabaj','Nebaj','San Andrés Sajcabajá','Uspantán','Sacapulas','San Bartolomé Jocotenango','Canillá','Chicamán','Ixcán','Pachalum']
  when 15 then array['Salamá','San Miguel Chicaj','Rabinal','Cubulco','Granados','El Chol','San Jerónimo','Purulhá']
  when 16 then array['Cobán','Santa Cruz Verapaz','San Cristóbal Verapaz','Tactic','Tamahú','Tucurú','Panzós','Senahú','San Pedro Carchá','San Juan Chamelco','Lanquín','Cahabón','Chisec','Chahal','Fray Bartolomé de las Casas','Santa Catalina La Tinta','Raxruhá']
  when 17 then array['Flores','San José','San Benito','San Andrés','La Libertad','San Francisco','Santa Ana','Dolores','San Luis','Sayaxché','Melchor de Mencos','Poptún','Las Cruces','El Chal']
  when 18 then array['Puerto Barrios','Livingston','El Estor','Morales','Los Amates']
  when 19 then array['Zacapa','Estanzuela','Río Hondo','Gualán','Teculután','Usumatlán','Cabañas','San Diego','La Unión','Huité','San Jorge']
  when 20 then array['Chiquimula','San José La Arada','San Juan Ermita','Jocotán','Camotán','Olopa','Esquipulas','Concepción Las Minas','Quezaltepeque','San Jacinto','Ipala']
  when 21 then array['Jalapa','San Pedro Pinula','San Luis Jilotepeque','San Manuel Chaparrón','San Carlos Alzatate','Monjas','Mataquescuintla']
  when 22 then array['Jutiapa','El Progreso','Santa Catarina Mita','Agua Blanca','Asunción Mita','Yupiltepeque','Atescatempa','Jerez','El Adelanto','Zapotitlán','Comapa','Jalpatagua','Conguaco','Moyuta','Pasaco','San José Acatempa','Quesada']
end) with ordinality as m (nombre, n);

notify pgrst, 'reload schema';
