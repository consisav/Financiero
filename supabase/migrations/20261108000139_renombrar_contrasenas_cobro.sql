-- Renombra la opción de Mantenimientos «Administración de Contraseñas Cobros» a «Contraseñas de Cobro».
update public.opciones_sistema set nombre = 'Contraseñas de Cobro' where clave = 'contrasenas-cobros';
