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

// Subgrupos desplegables de Catálogos. Los comunes aparecen en todos los módulos;
// cada módulo puede agregar los suyos en "subgrupos.catalogos".
window.CATALOGOS_COMUNES = [
  {
    subgrupo: 'Iniciales',
    icono: 'ti-adjustments',
    pantallas: [
      { id: 'usuarios', nombre: 'Usuarios', icono: 'ti-user-cog', descripcion: 'Usuarios del sistema por organización y localidad, con su rol y datos generales.' },
      { id: 'generar-usuario', nombre: 'Generar usuario y clave', icono: 'ti-key', descripcion: 'Crea el usuario (iniciales de los nombres + primer apellido) y una clave nueva para entrar al sistema.' },
      { id: 'parametros', nombre: 'Parámetros generales', icono: 'ti-settings', descripcion: 'Parámetros de tiempo, impuestos, monedas y firmantes de cada localidad.' },
      { id: 'modulos', nombre: 'Módulos', icono: 'ti-apps', descripcion: 'Módulos principales del sistema y sus sub-módulos.' }
    ]
  },
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
    subgrupos: {
      catalogos: [
        {
          subgrupo: 'Cuentas y CC',
          icono: 'ti-sitemap',
          pantallas: [
            { id: 'tipos-cuenta', nombre: 'Tipos de cuentas', icono: 'ti-tags', descripcion: 'Naturaleza de cada tipo de cuenta y su efecto en el resultado del ejercicio.' },
            { id: 'cuentas', nombre: 'Cuentas contables', icono: 'ti-list-tree', descripcion: 'Catálogo de cuentas por organización, localidad y versión: cuenta principal, subcuentas y sus niveles.' },
            { id: 'centros-costo', nombre: 'Centros de costos', icono: 'ti-hierarchy-2', descripcion: 'Centros de costo por organización, en niveles.' }
          ]
        }
      ]
    },
    opciones: {
      catalogos: ['Monedas y tipos de cambio', 'Tipos de partida'],
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
