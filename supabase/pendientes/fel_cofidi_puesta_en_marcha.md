# FEL en línea con COFIDI: puesta en marcha

Conversión de los paquetes del sistema anterior (PK_DTE_FACTURA, PK_DTE_NOTAS, PK_ANULACION_DTE y PK_FEL_DTE, más la tabla CAR_FEL_PROCESO_XML):

- La migración `20261109000166_fel_cofidi_en_linea.sql` arma el XML, guarda la bitácora y lee la respuesta.
- La Edge Function `functions/fel-cofidi` hace el envío.

## Cómo funciona

1. En **Facturas Ventas** o **Notas**, «Certificar» llama a la Edge Function `fel-cofidi`.
2. `sat_fel_preparar` revisa los permisos y el documento, y arma el XML del DTE (GTDocumento 0.2.0) sin firmar. COFIDI es quien firma.
3. La función envía el sobre SOAP `RequestTransaction` (`http://www.fact.com.mx/schema/ws`) con estos datos:
   - el Requestor y el usuario (secretos);
   - el NIT emisor en `Entity`;
   - en `Data1`, el identificador;
   - en `Data2`, el XML en Base64;
   - en `Data3`, el número interno.
4. `sat_fel_registrar_respuesta` lee de la respuesta:
   - `Result`, `Description` y `Hint`;
   - `TimeStamp`, la fecha de certificación;
   - `Batch`, la serie;
   - `Serial`, el número;
   - `DocumentGUID`, la autorización;
   - `ResponseData1`, el XML certificado.

   Con eso actualiza la factura o la nota y agrega el DTE al repositorio (`sat_dte`, con origen «EN LÍNEA»).
5. En **Anulación de documentos DTE**, un documento certificado se anula primero en la SAT (GTAnulacionDocumento) y después en el sistema.
6. Si un envío se queda sin respuesta, el siguiente «Certificar» consulta primero a COFIDI por el número interno, para no certificar dos veces.

## Lo que falta para encenderla

1. **Ejecutar la migración 166** en el SQL Editor de Supabase.
2. **Obtener de COFIDI**, o del sistema anterior, los datos de conexión:
   - **URL del web service.** El sistema anterior la pasaba como parámetro `p_url` a `PK_FEL_DTE.p_sendRequest` desde la forma de facturación; no está en los paquetes. Pide a COFIDI la URL de pruebas y la de producción.
   - **Transacción e identificadores.** Ejecuta en Oracle `select tipo_conexion, transaccion, identificador from car_datos_fel;` (solo esas columnas). Compara los valores con las columnas de `sat_fel_conexiones`:
     - `transaccion`;
     - `dato_certificar` (tipo 1);
     - `dato_anular` (tipo 2);
     - `transaccion_consulta` (tipo 3).
   - **Requestor y usuario** de COFIDI. Son credenciales: no van en el chat, en tablas ni en el repositorio.
3. **Instalar la función**: Supabase › Edge Functions › Deploy a new function, con el nombre `fel-cofidi` y el contenido de `supabase/functions/fel-cofidi/index.ts`.
4. **Guardar los secretos**: Supabase › Edge Functions › Secrets.
   - Si todos los establecimientos usan las mismas credenciales: `COFIDI_REQUESTOR` y `COFIDI_USUARIO`.
   - Si cada establecimiento tiene las suyas: `COFIDI_REQUESTOR_<localidad_id>` y `COFIDI_USUARIO_<localidad_id>`.
5. **Registrar la conexión** en el SQL Editor, empezando en pruebas:

   ```sql
   insert into public.sat_fel_conexiones (organizacion_id, localidad_id, ambiente, url, activo)
   select organizacion_id, localidad_id, 'PRUEBAS', 'URL_DE_PRUEBAS_DE_COFIDI', true
     from public.sat_emisores where localidad_id in (29, 30)
   on conflict (localidad_id) do update set url = excluded.url, ambiente = excluded.ambiente, activo = true;
   ```

   Si COFIDI exige el encabezado SOAPAction, llena `soap_action`. El sistema anterior no lo enviaba.
6. **Revisar el emisor** en Integraciones SAT:
   - NIT, razón social, nombre comercial y afiliación (GEN);
   - dirección del establecimiento y frases;
   - para exportaciones, `sat_emisores.codigo_exportador`.
7. **Probar en el ambiente de pruebas** de COFIDI, revisando la bitácora `sat_fel_procesos` después de cada envío:
   - una factura, una factura cambiaria y una exenta de medicamentos genéricos;
   - una nota de crédito y una de abono;
   - una anulación.
8. **Pasar a producción**: cambia la URL, pon `ambiente = 'PRODUCCION'` y usa los secretos de producción.

## Validación hecha

- En las 8,807 facturas que COFIDI ya certificó, el XML nuevo reproduce el gran total y el IVA del DTE certificado en 8,789. Las 18 restantes son facturas migradas cuyas líneas difieren de su DTE.
- Las frases salen iguales a las certificadas.
- En las notas certificadas, el gran total coincide en 193 de 194 y el IVA en las 194.
- Con respuestas simuladas se comprobaron la certificación, el rechazo y la anulación.
- Solo la Edge Function, con la llave de servicio, puede registrar respuestas.

## Correcciones respecto al original

- La hora usaba `HH24:MM:SS`, donde MM es el mes; ahora es `HH24:MI:SS`.
- El xmlns del complemento de factura especial se asignaba al nodo equivocado.
- El IVA total se suma de las líneas.
- Los textos se escapan para XML.
- El tipo interno FEXP se envía como FACT con `Exp="SI"`.
