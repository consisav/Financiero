// Estructura del CRM: 6 módulos × 6 grupos de menú.
// Cada opción se irá conectando a sus tablas de Supabase.
window.GRUPOS = [
  { id: 'catalogos', nombre: 'Catálogos', icono: 'ti-list' },
  { id: 'registros', nombre: 'Registros', icono: 'ti-edit' },
  { id: 'mantenimientos', nombre: 'Mantenimientos', icono: 'ti-tool' },
  { id: 'procesos', nombre: 'Procesos', icono: 'ti-settings-automation' },
  { id: 'reportes', nombre: 'Reportes y gráficas', icono: 'ti-chart-bar' },
  { id: 'ayuda', nombre: 'Ayuda', icono: 'ti-help' }
];

// Catálogos compartidos: aparecen dentro de Catálogos en todos los módulos.
window.CATALOGOS_COMUNES = [
  {
    subgrupo: 'Geografía',
    icono: 'ti-map-2',
    pantallas: [
      { id: 'geografia', nombre: 'Geografía', icono: 'ti-world', descripcion: 'Países, estados o departamentos y ciudades o municipios.' },
      { id: 'organizaciones', nombre: 'Organizaciones', icono: 'ti-building', descripcion: 'Organizaciones y sus localidades.' }
    ]
  }
];

window.MODULOS = [
  {
    id: 'contabilidad',
    corto: 'Contabilidad',
    color: 'azul',
    nombre: 'Contabilidad y presupuesto',
    icono: 'ti-calculator',
    descripcion: 'Plan de cuentas, partidas, presupuesto y estados financieros.',
    opciones: {
      catalogos: ['Plan de cuentas', 'Centros de costo', 'Monedas y tipos de cambio', 'Tipos de partida'],
      registros: ['Partidas contables', 'Presupuesto anual', 'Movimientos bancarios'],
      mantenimientos: ['Períodos contables', 'Empresas', 'Parámetros contables'],
      procesos: ['Mayorización', 'Conciliación bancaria', 'Cierre de mes', 'Cierre de año'],
      reportes: ['Libro diario', 'Libro mayor', 'Balance general', 'Estado de resultados', 'Presupuesto vs. ejecutado'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  },
  {
    id: 'facturacion',
    corto: 'Facturación',
    color: 'verde',
    nombre: 'Facturación y ventas',
    icono: 'ti-receipt',
    descripcion: 'Clientes, cotizaciones, facturas y cuentas por cobrar.',
    opciones: {
      catalogos: ['Clientes', 'Productos y servicios', 'Vendedores', 'Formas de pago'],
      registros: ['Cotizaciones', 'Pedidos', 'Facturas', 'Notas de crédito', 'Cobros'],
      mantenimientos: ['Series de documentos', 'Listas de precios', 'Descuentos'],
      procesos: ['Anulación de documentos', 'Antigüedad de saldos', 'Comisiones'],
      reportes: ['Ventas por período', 'Ventas por cliente', 'Cuentas por cobrar', 'Gráfica de ventas'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  },
  {
    id: 'inventarios',
    corto: 'Inventarios',
    color: 'ambar',
    nombre: 'Inventarios',
    icono: 'ti-packages',
    descripcion: 'Productos, bodegas, existencias y kardex.',
    opciones: {
      catalogos: ['Productos', 'Categorías', 'Bodegas', 'Unidades de medida', 'Proveedores'],
      registros: ['Entradas', 'Salidas', 'Traslados entre bodegas', 'Ajustes'],
      mantenimientos: ['Mínimos y máximos', 'Costos', 'Ubicaciones'],
      procesos: ['Toma física', 'Recalcular costo promedio', 'Cierre de inventario'],
      reportes: ['Existencias', 'Kardex por producto', 'Valuación de inventario', 'Rotación'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  },
  {
    id: 'sat',
    corto: 'Integraciones SAT',
    color: 'violeta',
    nombre: 'Integraciones SAT',
    icono: 'ti-building-bank',
    descripcion: 'Factura electrónica FEL y obligaciones con la SAT Guatemala.',
    opciones: {
      catalogos: ['Certificadores FEL', 'Tipos de DTE', 'Frases y escenarios', 'Establecimientos'],
      registros: ['Documentos FEL emitidos', 'Documentos recibidos', 'Retenciones de IVA e ISR'],
      mantenimientos: ['Credenciales del certificador', 'Datos del emisor'],
      procesos: ['Certificar DTE', 'Anular DTE', 'Consultar NIT', 'Declaración de IVA'],
      reportes: ['Libro de compras', 'Libro de ventas', 'DTE por estado', 'Gráfica de IVA'],
      ayuda: ['Manual del módulo', 'Guía FEL SAT']
    }
  },
  {
    id: 'nominas',
    corto: 'Nóminas',
    color: 'coral',
    nombre: 'Nóminas y planillas',
    icono: 'ti-users',
    descripcion: 'Empleados, planillas, IGSS, ISR y prestaciones.',
    opciones: {
      catalogos: ['Empleados', 'Puestos', 'Departamentos', 'Conceptos de pago y descuento'],
      registros: ['Horas extra', 'Ausencias', 'Anticipos y préstamos', 'Vacaciones'],
      mantenimientos: ['Tablas de IGSS e ISR', 'Salario mínimo', 'Bonificación incentivo'],
      procesos: ['Generar planilla', 'Bono 14', 'Aguinaldo', 'Indemnización'],
      reportes: ['Planilla del período', 'Boletas de pago', 'Planilla IGSS', 'Costo de personal'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  },
  {
    id: 'comercio',
    corto: 'Import. y export.',
    color: 'turquesa',
    nombre: 'Importaciones y exportaciones',
    icono: 'ti-world',
    descripcion: 'Pólizas, DUCA, costos de importación y embarques.',
    opciones: {
      catalogos: ['Agentes aduanales', 'Aduanas', 'Incoterms', 'Partidas arancelarias'],
      registros: ['Pólizas de importación', 'Exportaciones', 'Gastos de importación', 'Embarques'],
      mantenimientos: ['Tasas de DAI', 'Navieras y transportistas'],
      procesos: ['Liquidación de póliza', 'Prorrateo de costos', 'Ingreso a inventario'],
      reportes: ['Importaciones por período', 'Costo por póliza', 'Exportaciones por destino'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  }
];
