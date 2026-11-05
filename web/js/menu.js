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
    corto: 'Facturación/Ventas',
    color: 'verde',
    nombre: 'Facturación y ventas',
    icono: 'ti-receipt',
    descripcion: 'Clientes, cotizaciones, facturas y cuentas por cobrar.',
    subgrupos: {
      catalogos: [
        {
          subgrupo: 'Ventas',
          icono: 'ti-user-dollar',
          pantallas: [
            { id: 'clientes', nombre: 'Clientes', icono: 'ti-users', descripcion: 'Clientes de la empresa: documento (NIT, CUI…), contacto, vendedor, tipo de precio, entrega, crédito, ubicación y datos de exportación.' },
            { id: 'vendedores', nombre: 'Vendedores', icono: 'ti-user-dollar', descripcion: 'Vendedores de la empresa: contacto, comisiones (general, crédito y contado), siglas y usuario del sistema.' }
          ]
        },
        {
          subgrupo: 'Productos',
          icono: 'ti-package',
          pantallas: [
            { id: 'clasificaciones-y-tipos', nombre: 'Clasificaciones y tipos', icono: 'ti-category', descripcion: 'Clasificaciones de productos y servicios con su cuenta, y los tipos de productos de cada clasificación.' },
            { id: 'tipos-de-medida', nombre: 'Tipos de medida', icono: 'ti-ruler-measure', descripcion: 'Unidades de medida de los productos.' },
            { id: 'tipos-de-precio', nombre: 'Tipos de precio', icono: 'ti-currency-dollar', descripcion: 'Listas de precio: % de utilidad, % de descuento, factor y estado.' },
            { id: 'presentaciones-productos', nombre: 'Presentación productos', icono: 'ti-box', descripcion: 'Presentaciones en que vienen los productos.', separador: true },
            { id: 'productos-y-servicios', nombre: 'Productos y servicios', icono: 'ti-package', descripcion: 'Definición de artículos: clasificación y tipo, proveedor, presentación, medida, punto mínimo, costo, ubicación, bodega, precios e imagen.' }
          ]
        }
      ]
    },
    opciones: {
      catalogos: ['Formas de pago'],
      registros: ['Cotizaciones', 'Pedidos', 'Facturas', 'Notas de crédito', 'Cobros'],
      mantenimientos: ['Series de documentos', 'Listas de precios', 'Descuentos'],
      procesos: ['Anulación de documentos', 'Antigüedad de saldos', 'Comisiones'],
      reportes: ['Ventas por período', 'Ventas por cliente', 'Cuentas por cobrar', 'Gráfica de ventas'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  },
  {
    id: 'compras',
    corto: 'Compras',
    color: 'cian',
    hereda: 'facturacion',
    nombre: 'Compras',
    icono: 'ti-shopping-cart',
    descripcion: 'Proveedores, órdenes de compra, facturas de compra y cuentas por pagar.',
    subgrupos: {
      catalogos: [
        {
          subgrupo: 'Proveedores',
          icono: 'ti-truck',
          pantallas: [
            { id: 'proveedores', nombre: 'Proveedores', icono: 'ti-truck', descripcion: 'Proveedores de la empresa: datos fiscales y de contacto, tipo, régimen ISR, datos contables y datos de pago.' },
            { id: 'bodegas', nombre: 'Bodegas', icono: 'ti-building-warehouse', descripcion: 'Bodegas generales y sub-bodegas: permisos, encargado, tipo de precio y definiciones contables por bodega.' }
          ]
        }
      ],
      registros: [
        {
          subgrupo: 'Compras',
          icono: 'ti-file-invoice',
          pantallas: [
            { id: 'clasificaciones-compra', nombre: 'Clasificación compras', icono: 'ti-tags', descripcion: 'Clasificaciones fiscales de las compras: siglas, libro de compras y si aplica IVA.' },
            { id: 'tipos-documento-compra', nombre: 'Tipo documento', icono: 'ti-file-description', descripcion: 'Tipos de documento de las compras y cómo se calcula su IVA.', separador: true },
            {
              subgrupo: 'Órdenes de compra',
              icono: 'ti-clipboard-list',
              pantallas: [
                { id: 'solicitudes-de-compra', nombre: 'Solicitudes de compra', icono: 'ti-file-plus', descripcion: 'Generación de órdenes de compra: proveedor, bodega, productos con su existencia y punto mínimo, cotizaciones y envío a autorización.' },
                { id: 'autorizaciones-de-compras', nombre: 'Autorizaciones compras', icono: 'ti-checklist', descripcion: 'Autorización de cada orden: cantidad aprobada por producto, aprobar, devolver o rechazar.' },
                { id: 'autorizar-ordenes', nombre: 'Aprobación órdenes', icono: 'ti-list-check', descripcion: 'Órdenes en espera de autorización, con su botón Ver.', separador: true },
                { id: 'ordenes-de-compra', nombre: 'Órdenes de compra', icono: 'ti-clipboard-list', descripcion: 'Ingresos de compras basados en órdenes: lote, vencimiento, aplicar inventario y generar la factura de compra.' },
                { id: 'recepcion-de-mercaderia', nombre: 'Recepción de mercadería', icono: 'ti-truck-delivery', descripcion: 'Recepción en bodega de lo comprado contra la orden de compra.' },
                { id: 'notas-de-credito-proveedores', nombre: 'Notas de crédito de proveedores', icono: 'ti-receipt-refund', descripcion: 'Notas de crédito recibidas de los proveedores.' }
              ]
            },
            {
              subgrupo: 'Procesar Compras',
              icono: 'ti-file-invoice',
              pantallas: [
                { id: 'facturas-compra', nombre: 'Ingreso de compras', icono: 'ti-file-invoice', descripcion: 'Ingreso de la compra (bienes o servicios): compra de inventario sin facturar, artículos, carga al inventario, documento, proveedor, desglose fiscal, retención, detalle, detalle contable, contraseña de pago y pagos.' },
                { id: 'regularizacion-anticipos', nombre: 'Regularización anticipos', icono: 'ti-arrows-exchange', descripcion: 'Liquida los anticipos a proveedores (cheques y notas de débito) contra las compras por pagar y genera su póliza contable.' },
                { id: 'notas-credito-compras', nombre: 'Notas crédito compras', icono: 'ti-receipt-refund', descripcion: 'Notas de crédito y débito de los proveedores: factura de referencia, devolución al inventario, detalle contable y póliza.' },
                { id: 'productos-consignacion', nombre: 'Productos en consignación', icono: 'ti-packages', descripcion: 'Partes de depósito de los proveedores: envío o devolución de mercadería en consignación y su carga al inventario.' },
                { id: 'contrasenas-pago', nombre: 'Contraseñas de pago', icono: 'ti-key', descripcion: 'Recepción de facturas del proveedor: documentos recibidos, fecha estimada de pago, autorización, impresión y liquidación.' }
              ]
            },
            {
              subgrupo: 'Cuentas x Pagar',
              icono: 'ti-report-money',
              pantallas: [
                { id: 'cxp-mensual', nombre: 'Consolidado CXP mensual', icono: 'ti-calendar-month', descripcion: 'Cuentas por pagar de un mes: proveedor, tipo de fecha, saldo, tipo de proveedor y días de mora.' },
                { id: 'cxp-general', nombre: 'Consolidado general', icono: 'ti-report-money', descripcion: 'Cuentas por pagar en un rango de fechas, con su valor y saldo en quetzales.' },
                { id: 'cxp-periodo', nombre: 'CXP por periodo', icono: 'ti-calendar-dollar', descripcion: 'Saldo de las compras a una fecha, con resumen por proveedor y estado de cuenta.' }
              ]
            }
          ]
        }
      ],
      mantenimientos: [
        {
          subgrupo: 'Inventarios',
          icono: 'ti-packages',
          pantallas: [
            { id: 'kardex-productos', nombre: 'Kardex de Productos', icono: 'ti-list-numbers', descripcion: 'Movimientos de inventario de cada producto por bodega: entradas, salidas, saldo y costo, con su documento de origen.' },
            { id: 'analisis-costos', nombre: 'Análisis de Costos', icono: 'ti-chart-line', descripcion: 'Compras de cada producto con su costo unitario, promedio ponderado, descuentos, bonificaciones, notas de crédito y costo neto.' }
          ]
        }
      ]
    },
    opciones: {
      catalogos: ['Productos y servicios de compra', 'Compradores', 'Condiciones de pago'],
      mantenimientos: ['Series de documentos', 'Listas de precios de proveedores'],
      procesos: ['Aprobación de órdenes de compra', 'Anulación de documentos', 'Antigüedad de saldos'],
      reportes: ['Compras por período', 'Compras por proveedor', 'Cuentas por pagar', 'Gráfica de compras'],
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
