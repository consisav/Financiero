-- Replicación deja de estar dentro de Cuentas y CC: es un grupo de primer nivel de Catálogos,
-- arriba de Tickets. La matriz de accesos de Roles módulos muestra el mismo grupo.
-- Requiere el script 22. Puede ejecutarse de nuevo.

update public.opciones_sistema set subgrupo = 'Replicación'
where clave in ('replicacion-empresa', 'replicacion-nomenclatura', 'replicacion-centros') and grupo = 'catalogos';
