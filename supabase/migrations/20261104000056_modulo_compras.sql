-- Módulo Compras (debajo de Facturación/Ventas en el menú).
--   modulos_sistema: COM Compras como módulo principal.
--   rol_modulos: cada rol recibe en Compras los permisos que tiene en Facturación/Ventas.
-- Se ejecuta después del script 55.

do $$
declare
  v_codigo integer;
begin
  if not exists (select 1 from public.modulos_sistema where siglas = 'COM' and modulo_mayor_id is null) then
    select min(n) into v_codigo from generate_series(9, 99) n where not exists (select 1 from public.modulos_sistema where codigo = n);
    insert into public.modulos_sistema (codigo, siglas, descripcion) values (v_codigo, 'COM', 'COMPRAS');
  end if;
end $$;

insert into public.rol_modulos (rol_id, modulo, puede_ver, puede_editar)
select rol_id, 'compras', puede_ver, puede_editar
from public.rol_modulos
where modulo = 'facturacion'
on conflict (rol_id, modulo) do nothing;

notify pgrst, 'reload schema';
