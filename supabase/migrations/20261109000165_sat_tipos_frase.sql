-- Integraciones SAT · catálogo de tipos de frase FEL (del sistema anterior, archivo CAR_TIPOS_FRASES_FEL) relacionado con
-- las frases y escenarios. Los tipos que ya usaban las frases del sistema y no venían en el archivo se crean con el nombre
-- de su frase.
create table if not exists public.sat_tipos_frase (
  codigo integer primary key, nombre text not null, descripcion text, activo boolean not null default true
);
insert into public.sat_tipos_frase (codigo, nombre, descripcion) values
  (1, 'Frase de retención del ISR', 'Indica el régimen al que se encuentra inscrito el EMISOR para que el RECEPTOR sepa si debe efectuarle o no la respectiva retención.'),
  (2, 'Frase de retención del IVA', 'Indica si el EMISOR es Agente de Retención del IVA. Si el RECEPTOR también lo es sabrá que no debe efectuar la respectiva retención.'),
  (3, 'Frase de no genera derecho a crédito fiscal del IVA', 'Cuando el emisor se encuentre afiliado al régimen de pequeño contribuyente, para que el receptor sepa que la factura no genera derecho a crédito fiscal.'),
  (4, 'Frase de exento o no afecto al IVA', 'Existen facturas que por diferentes motivos: a) NO deben incluir el IVA. b) Deben incluir la base legal por la cual no incluyen el IVA (art. 11 Reglamento de la Ley del IVA y art. 29 literal “a” Ley del IVA).')
on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion;
insert into public.sat_tipos_frase (codigo, nombre, descripcion)
select distinct on (f.tipo) f.tipo, 'Frase de ' || lower(f.descripcion), f.texto from public.sat_frases f
where not exists (select 1 from public.sat_tipos_frase t where t.codigo = f.tipo) order by f.tipo, f.escenario;
alter table public.sat_frases drop constraint if exists sat_frases_tipo_fkey;
alter table public.sat_frases add constraint sat_frases_tipo_fkey foreign key (tipo) references public.sat_tipos_frase (codigo);
alter table public.sat_tipos_frase enable row level security;
drop policy if exists "sat_tipos_frase: leer" on public.sat_tipos_frase;
create policy "sat_tipos_frase: leer" on public.sat_tipos_frase for select to authenticated using (public.usuario_activo());
drop policy if exists "sat_tipos_frase: escribir" on public.sat_tipos_frase;
create policy "sat_tipos_frase: escribir" on public.sat_tipos_frase for all to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
grant select, insert, update, delete on public.sat_tipos_frase to authenticated;
notify pgrst, 'reload schema';
select string_agg(codigo || ' · ' || nombre, '; ' order by codigo) as tipos_de_frase from public.sat_tipos_frase;
