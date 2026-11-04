// Estructura del CRM: módulos × grupos de menú (los 6 de GRUPOS, o los propios del módulo en "grupos").
// Cada opción se irá conectando a sus tablas de Supabase.
window.GRUPOS = [
  { id: 'catalogos', nombre: 'Catálogos', icono: 'ti-list' },
  { id: 'registros', nombre: 'Registros', icono: 'ti-edit' },
  { id: 'mantenimientos', nombre: 'Mantenimientos', icono: 'ti-tool' },
  { id: 'procesos', nombre: 'Procesos', icono: 'ti-settings-automation' },
  { id: 'reportes', nombre: 'Reportes y gráficas', icono: 'ti-chart-bar' },
  { id: 'ayuda', nombre: 'Ayuda', icono: 'ti-help' }
];

// Subgrupos desplegables de Catálogos. Los comunes (usuarios, módulos, parámetros, geografía) solo
// aparecen en el módulo con "comunes: true" (Administración); cada módulo agrega los suyos en
// "subgrupos.catalogos". "separador: true" dibuja una línea
// debajo de la opción. Una opción con "subgrupo" y "pantallas" es un subgrupo anidado.
window.CATALOGOS_COMUNES = [
  {
    subgrupo: 'Usuarios',
    icono: 'ti-users',
    pantallas: [
      { id: 'usuarios', nombre: 'Usuarios', icono: 'ti-user-cog', descripcion: 'Usuarios del sistema por organización y localidad, con su rol y datos generales.' },
      { id: 'generar-usuario', nombre: 'Generar clave', icono: 'ti-key', descripcion: 'Crea el usuario (iniciales de los nombres + primer apellido) y una clave nueva para entrar al sistema.' }
    ]
  },
  {
    subgrupo: 'Módulos',
    icono: 'ti-apps',
    pantallas: [
      { id: 'modulos', nombre: 'Módulos', icono: 'ti-apps', descripcion: 'Módulos principales del sistema y sus sub-módulos.' },
      { id: 'roles-modulos', nombre: 'Roles módulos', icono: 'ti-shield-lock', descripcion: 'Roles funcionales, usuarios asignados y accesos a cada pantalla.' }
    ]
  },
  {
    subgrupo: 'Parámetros',
    icono: 'ti-adjustments',
    pantallas: [
      { id: 'parametros', nombre: 'Parámetros generales', icono: 'ti-settings', descripcion: 'Parámetros de tiempo, impuestos, monedas y firmantes de cada localidad.' },
      { id: 'monedas-y-tipos-de-cambio', nombre: 'Tipos de cambio', icono: 'ti-currency-dollar', descripcion: 'Monedas que maneja el sistema y su tipo de cambio por fecha.' }
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
    id: 'administracion',
    corto: 'Administración',
    color: 'pizarra',
    nombre: 'Administración',
    icono: 'ti-briefcase',
    descripcion: 'Usuarios, módulos, parámetros, tickets, solicitudes, órdenes de compra y contratos.',
    comunes: true,
    // Tickets va como grupo propio, después de Catálogos y antes de Registros.
    grupos: [window.GRUPOS[0], { id: 'tickets', nombre: 'Tickets', icono: 'ti-ticket' }, ...window.GRUPOS.slice(1)],
    subgrupos: {
      procesos: [
        {
          subgrupo: 'Procesos',
          icono: 'ti-settings-automation',
          pantallas: [
            { id: 'backup', nombre: 'Backup', icono: 'ti-database-export', descripcion: 'Respaldo de la información por organización y localidad en un archivo, en la carpeta o ruta indicada.' }
          ]
        }
      ],
      tickets: [
        {
          subgrupo: 'Tickets',
          icono: 'ti-ticket',
          pantallas: [
            { id: 'tickets-generacion', nombre: 'Generación', icono: 'ti-ticket', descripcion: 'Creación de tickets de solicitud o soporte.' },
            { id: 'tickets-asignacion', nombre: 'Asignación', icono: 'ti-user-check', descripcion: 'Asignación de cada ticket a su responsable.' },
            { id: 'tickets-seguimiento', nombre: 'Seguimiento', icono: 'ti-progress-check', descripcion: 'Estado y avance de los tickets hasta su cierre.' },
            { id: 'tickets-cierre', nombre: 'Cierre', icono: 'ti-circle-check', descripcion: 'Cierre de los tickets resueltos.' }
          ]
        }
      ]
    },
    opciones: {
      catalogos: ['Departamentos', 'Puestos', 'Proveedores'],
      registros: ['Solicitudes', 'Órdenes de compra', 'Contratos'],
      mantenimientos: ['Parámetros administrativos', 'Niveles de aprobación'],
      procesos: ['Aprobaciones', 'Cierre administrativo'],
      reportes: ['Gastos por departamento', 'Órdenes de compra por período', 'Contratos vigentes'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  },
  {
    id: 'contabilidad',
    corto: 'Contabilidad',
    color: 'azul',
    nombre: 'Contabilidad y presupuesto',
    icono: 'ti-calculator',
    descripcion: 'Plan de cuentas, partidas, presupuesto y estados financieros.',
    subgrupos: {
      procesos: [
        {
          subgrupo: 'Cierres',
          icono: 'ti-calendar-check',
          pantallas: [
            { id: 'cierre-de-mes', nombre: 'Cierre de mes', icono: 'ti-calendar-check', descripcion: 'Cierra o reabre cada mes de la empresa; con el mes cerrado sus partidas ya no se modifican.' }
          ]
        }
      ],
      registros: [
        {
          subgrupo: 'Partidas',
          icono: 'ti-notebook',
          pantallas: [
            { id: 'partidas-contables', nombre: 'Partidas contables', icono: 'ti-file-invoice', descripcion: 'Pólizas de cada organización y localidad: encabezado, detalle de cuentas, aprobación y cierre definitivo.' }
          ]
        },
        {
          subgrupo: 'Presupuestos',
          icono: 'ti-report-money',
          pantallas: [
            { id: 'presupuesto', nombre: 'Presupuesto', icono: 'ti-chart-bar', descripcion: 'Presupuestos por organización y localidad: tipo, frecuencia, período, estado y rubros con lo presupuestado y lo ejecutado.' }
          ]
        }
      ],
      catalogos: [
        {
          subgrupo: 'Cuentas y CC',
          icono: 'ti-sitemap',
          pantallas: [
            { id: 'tipos-cuenta', nombre: 'Tipos de cuentas', icono: 'ti-tags', descripcion: 'Naturaleza de cada tipo de cuenta y su efecto en el resultado del ejercicio.' },
            { id: 'cuentas', nombre: 'Cuentas contables', icono: 'ti-list-tree', descripcion: 'Catálogo de cuentas por organización, localidad y versión: cuenta principal, subcuentas y sus niveles.' },
            { id: 'centros-costo', nombre: 'Centros de costos', icono: 'ti-hierarchy-2', descripcion: 'Centros de costo por organización, en niveles.' },
            { id: 'tipos-de-partida', nombre: 'Tipos de partida', icono: 'ti-file-invoice', descripcion: 'Clasificación de las partidas contables (diario, ajuste, cierre…).' },
            { id: 'rubros-presupuesto', nombre: 'Rubros de presupuesto', icono: 'ti-report-money', descripcion: 'Rubros que se presupuestan: ingresos, personal, gastos financieros y administrativos, impuestos e inversiones.' }
          ]
        },
        {
          subgrupo: 'Objetos contables',
          icono: 'ti-box',
          pantallas: [
            { id: 'objetos-definicion', nombre: 'Definición de objetos', icono: 'ti-category', descripcion: 'Objetos contables de cada organización y localidad con sus cuentas y transacciones.' },
            { id: 'objetos-transacciones', nombre: 'Transacciones', icono: 'ti-arrows-exchange', descripcion: 'Plantillas de partida con sus cuentas, debe o haber, operación y centro de costo.' }
          ]
        },
        {
          subgrupo: 'Replicación',
          icono: 'ti-copy',
          pantallas: [
            { id: 'replicacion-empresa', nombre: 'Empresa y parámetros', icono: 'ti-building-cog', descripcion: 'Replica la empresa y sus parámetros generales en otra organización o localidad.' },
            { id: 'replicacion-nomenclatura', nombre: 'Nomenclatura', icono: 'ti-list-tree', descripcion: 'Replica el catálogo de cuentas contables en otra organización o localidad.' },
            { id: 'replicacion-centros', nombre: 'Centros de costos', icono: 'ti-hierarchy-2', descripcion: 'Replica la estructura de centros de costo en otra organización o localidad.' }
          ]
        }
      ]
    },
    opciones: {
      registros: [],
      mantenimientos: ['Períodos contables', 'Empresas', 'Parámetros contables'],
      procesos: ['Mayorización', 'Cierre de año'],
      reportes: ['Libro diario', 'Libro mayor', 'Balance general', 'Estado de resultados', 'Presupuesto vs. ejecutado'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  },
  {
    id: 'caja-bancos',
    corto: 'Caja y Bancos',
    color: 'indigo',
    nombre: 'Caja y bancos',
    icono: 'ti-building-bank',
    descripcion: 'Bancos, cheques y cajas de cada organización y localidad.',
    grupos: [
      { id: 'bancos', nombre: 'Bancos', icono: 'ti-building-bank' },
      { id: 'cheques', nombre: 'Cheques', icono: 'ti-writing' },
      { id: 'cajas', nombre: 'Cajas', icono: 'ti-cash-register' }
    ],
    subgrupos: {
      bancos: [
        {
          subgrupo: 'Bancos',
          icono: 'ti-building-bank',
          pantallas: [
            { id: 'cuentas-bancarias', nombre: 'Cuentas bancarias', icono: 'ti-building-bank', descripcion: 'Bancos del sistema y cuentas bancarias de cada organización y localidad.', separador: true },
            { id: 'depositos', nombre: 'Depósitos multimoneda', icono: 'ti-cash-banknote', descripcion: 'Depósitos en cualquier moneda con sus facturas, recibos y detalle contable.', separador: true },
            { id: 'notas-credito', nombre: 'Notas de crédito / transferencias', icono: 'ti-file-plus', descripcion: 'Notas de crédito y transferencias recibidas.' },
            { id: 'notas-debito', nombre: 'Notas de débito / transferencias', icono: 'ti-file-minus', descripcion: 'Notas de débito y transferencias enviadas a proveedores.', separador: true },
            { id: 'conciliacion-bancaria', nombre: 'Conciliación bancaria', icono: 'ti-scale', descripcion: 'Conciliación mensual de cada cuenta bancaria con el saldo del banco y el contable.' },
            { id: 'disponibilidad-bancaria', nombre: 'Disponibilidad bancaria', icono: 'ti-chart-line', descripcion: 'Movimiento y disponibilidad de cada cuenta bancaria en un rango de fechas.', separador: true },
            { id: 'disponibilidad-integrada', nombre: 'Disponibilidad integrada', icono: 'ti-chart-pie', descripcion: 'Disponibilidad consolidada de todas las cuentas de la organización, en quetzales.' }
          ]
        }
      ],
      cheques: [
        {
          subgrupo: 'Cheques',
          icono: 'ti-writing',
          pantallas: [
            { id: 'solicitud-de-cheques', nombre: 'Solicitud de cheques', icono: 'ti-file-dollar', descripcion: 'Requisición de cheques: beneficiario, monto y motivo del pago, con su aprobación y seguimiento hasta la emisión.' },
            { id: 'emision-de-cheques', nombre: 'Emisión de cheques', icono: 'ti-writing', descripcion: 'Cheques de cada cuenta bancaria con el número de su chequera, beneficiario, detalle contable, facturas pagadas e impresión.' },
            { id: 'generacion-cheques', nombre: 'Generación cheques', icono: 'ti-files', descripcion: 'Cheques automáticos de las facturas y recibos de compra pendientes de pago, uno por proveedor o por factura.' },
            { id: 'generacion-transferencias', nombre: 'Generación transferencias', icono: 'ti-arrows-exchange', descripcion: 'Transferencias bancarias automáticas a los proveedores por sus facturas pendientes, con el lote para el banco.' },
            { id: 'facturas-de-compra', nombre: 'Facturas de compra por pagar', icono: 'ti-file-invoice', descripcion: 'Facturas y recibos de compra: proveedor, importe, bonificaciones, notas, forma de pago y detalle contable.' }
          ]
        }
      ],
      cajas: [
        {
          subgrupo: 'Cajas',
          icono: 'ti-cash-register',
          pantallas: [
            { id: 'cajas-chicas', nombre: 'Cajas chicas', icono: 'ti-cash-register', descripcion: 'Selección de la caja a operar y su administración: subcajas por mes, anticipo, adelanto y liquidación, documentos con su desglose fiscal, detalle contable y póliza.' }
          ]
        }
      ]
    },
    opciones: {
      cheques: ['Chequeras', 'Anulación de cheques', 'Cheques en circulación'],
      cajas: ['Arqueo de caja']
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
    id: 'presupuesto-flujo',
    corto: 'Presupuesto y Flujo',
    color: 'rosa',
    nombre: 'Presupuesto y flujo de efectivo',
    icono: 'ti-report-money',
    descripcion: 'Proyección de ingresos y egresos, flujo de efectivo y comparativo contra lo ejecutado.',
    opciones: {
      catalogos: ['Rubros de flujo', 'Escenarios'],
      registros: ['Presupuesto de flujo', 'Proyección de ingresos', 'Proyección de egresos'],
      mantenimientos: ['Períodos de proyección'],
      procesos: ['Cálculo del flujo proyectado', 'Comparativo real vs. proyectado'],
      reportes: ['Flujo de efectivo', 'Presupuesto vs. ejecutado', 'Gráfica de flujo'],
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
    id: 'activos-fijos',
    corto: 'Activos Fijos',
    color: 'oliva',
    nombre: 'Activos fijos',
    icono: 'ti-building-warehouse',
    descripcion: 'Registro de activos, depreciación, traslados y bajas.',
    opciones: {
      catalogos: ['Tipos de activo', 'Ubicaciones', 'Responsables', 'Métodos de depreciación'],
      registros: ['Altas de activos', 'Bajas', 'Traslados', 'Revaluaciones'],
      mantenimientos: ['Vidas útiles', 'Porcentajes de depreciación'],
      procesos: ['Depreciación mensual', 'Cierre de activos'],
      reportes: ['Inventario de activos', 'Depreciación acumulada', 'Activos por ubicación'],
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
