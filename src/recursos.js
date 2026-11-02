// Catálogo de tablas expuestas por la API CRUD genérica.
// Solo las columnas listadas aquí se pueden leer o escribir (lista blanca).
module.exports = {
  // Cuentas por cobrar / pagar
  terceros: {
    tabla: 'TERCEROS',
    pk: 'ID_TERCERO',
    columnas: ['TIPO', 'NIT', 'NOMBRE', 'EMAIL', 'TELEFONO', 'DIRECCION', 'DIAS_CREDITO', 'ACTIVO'],
  },
  documentos: {
    tabla: 'DOCUMENTOS_CXC_CXP',
    pk: 'ID_DOCUMENTO',
    columnas: ['ID_TERCERO', 'TIPO', 'SERIE', 'NUMERO', 'FECHA_EMISION', 'FECHA_VENCIMIENTO', 'MONEDA', 'TOTAL', 'SALDO', 'ESTADO', 'DESCRIPCION'],
  },
  pagos: {
    tabla: 'PAGOS_CXC_CXP',
    pk: 'ID_PAGO',
    columnas: ['ID_DOCUMENTO', 'ID_MOVIMIENTO', 'FECHA', 'MONTO', 'REFERENCIA'],
  },
  // Bancos y caja
  'cuentas-bancarias': {
    tabla: 'CUENTAS_BANCARIAS',
    pk: 'ID_CUENTA',
    columnas: ['BANCO', 'NUMERO_CUENTA', 'TIPO', 'MONEDA', 'SALDO_INICIAL', 'ACTIVO'],
  },
  'movimientos-bancarios': {
    tabla: 'MOVIMIENTOS_BANCARIOS',
    pk: 'ID_MOVIMIENTO',
    columnas: ['ID_CUENTA', 'FECHA', 'TIPO', 'MONTO', 'REFERENCIA', 'DESCRIPCION', 'CONCILIADO'],
  },
  // Presupuesto
  'centros-costo': {
    tabla: 'CENTROS_COSTO',
    pk: 'ID_CENTRO',
    columnas: ['CODIGO', 'NOMBRE', 'ACTIVO'],
  },
  presupuestos: {
    tabla: 'PRESUPUESTOS',
    pk: 'ID_PRESUPUESTO',
    columnas: ['ID_CENTRO', 'CUENTA_CONTABLE', 'ANIO', 'MES', 'MONTO'],
  },
  // Inventarios
  productos: {
    tabla: 'PRODUCTOS',
    pk: 'ID_PRODUCTO',
    columnas: ['CODIGO', 'NOMBRE', 'UNIDAD', 'COSTO_PROMEDIO', 'ACTIVO'],
  },
  bodegas: {
    tabla: 'BODEGAS',
    pk: 'ID_BODEGA',
    columnas: ['CODIGO', 'NOMBRE', 'ACTIVO'],
  },
  'movimientos-inventario': {
    tabla: 'MOVIMIENTOS_INVENTARIO',
    pk: 'ID_MOV_INV',
    columnas: ['ID_PRODUCTO', 'ID_BODEGA', 'FECHA', 'TIPO', 'CANTIDAD', 'COSTO_UNITARIO', 'REFERENCIA'],
  },
  // Nóminas
  empleados: {
    tabla: 'EMPLEADOS',
    pk: 'ID_EMPLEADO',
    columnas: ['CODIGO', 'NOMBRE', 'DPI', 'PUESTO', 'ID_CENTRO', 'FECHA_INGRESO', 'SALARIO_BASE', 'ACTIVO'],
  },
  planillas: {
    tabla: 'PLANILLAS',
    pk: 'ID_PLANILLA',
    columnas: ['PERIODO_INICIO', 'PERIODO_FIN', 'DESCRIPCION', 'ESTADO'],
  },
  'planilla-detalle': {
    tabla: 'PLANILLA_DETALLE',
    pk: 'ID_DETALLE',
    columnas: ['ID_PLANILLA', 'ID_EMPLEADO', 'CONCEPTO', 'TIPO', 'MONTO'],
  },
  // Integraciones
  'integraciones-log': {
    tabla: 'INTEGRACIONES_LOG',
    pk: 'ID_LOG',
    columnas: ['SISTEMA', 'OPERACION', 'ESTADO', 'MENSAJE'],
  },
};
