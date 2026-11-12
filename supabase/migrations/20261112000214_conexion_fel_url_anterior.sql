-- Script 214 · Conexión del certificador: copia la URL del sistema anterior (url_anterior, de CAR_DATOS_FEL) al campo URL del web service
--   en las conexiones que aún no tienen URL. Es un servicio puente local (localhost), así que la conexión sigue INACTIVA: al recibir
--   la URL real de COFIDI se reemplaza en la pantalla y se activa. Se puede ejecutar de nuevo (no toca una URL ya escrita).
update public.sat_fel_conexiones
   set url = url_anterior, activo = false, modificado_en = now()
 where url is null and url_anterior is not null;

select l.codigo as empresa, c.url, c.activo
  from public.sat_fel_conexiones c join public.localidades l on l.id = c.localidad_id order by l.codigo;
