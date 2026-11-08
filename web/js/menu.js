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

// Subgrupos desplegables de Catálogos. Los comunes (usuarios, módulos, geografía y organizaciones) solo
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
      reportes: [
        {
          subgrupo: 'Reportes',
          icono: 'ti-report',
          pantallas: [
            { id: 'reporte-organizaciones', nombre: 'Organizaciones y localidades', icono: 'ti-building', descripcion: 'Organizaciones con sus localidades: datos fiscales, venta de productos, ubicación y estado.' },
            { id: 'reporte-modulos', nombre: 'Módulos y sub módulos', icono: 'ti-apps', descripcion: 'Módulos, sub módulos y opciones del sistema con los usuarios que tienen acceso.' },
            { id: 'reporte-roles', nombre: 'Roles módulos', icono: 'ti-shield-lock', descripcion: 'Roles con sus usuarios asignados y las opciones y permisos que dan.' },
            { id: 'reporte-usuarios', nombre: 'Listado de usuarios', icono: 'ti-users', descripcion: 'Usuarios por organización y localidad con su rol, roles funcionales y estado.' }
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
            { id: 'tickets-cierre', nombre: 'Cierre', icono: 'ti-circle-check', descripcion: 'Cierre de los tickets resueltos.' },
            { id: 'tickets-visualizacion', nombre: 'Visualización General', icono: 'ti-layout-dashboard', descripcion: 'Todos los tickets con su asignación y tiempo transcurrido, ordenados por la columna que elijas.' }
          ]
        }
      ]
    },
    opciones: {
      registros: ['Solicitudes', 'Órdenes de compra', 'Contratos'],
      mantenimientos: ['Parámetros administrativos', 'Niveles de aprobación'],
      procesos: ['Aprobaciones', 'Cierre administrativo'],
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
            { id: 'partidas-contables', nombre: 'Partidas contables', icono: 'ti-file-invoice', descripcion: 'Pólizas de cada organización y localidad: encabezado, detalle de cuentas, aprobación y cierre definitivo.' },
            { id: 'consulta-de-partidas', nombre: 'Consulta de Partidas', icono: 'ti-file-search', descripcion: 'Resumen de las partidas de la empresa por tipo, clasificación, fechas y estado (por aprobar, aprobadas, definitivas, anuladas, descuadradas), con su detalle contable y los documentos que las generaron.', separador: true }
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
          subgrupo: 'Parámetros',
          icono: 'ti-adjustments',
          pantallas: [
            { id: 'parametros', nombre: 'Parámetros generales', icono: 'ti-settings', descripcion: 'Parámetros de tiempo, impuestos, nómina, retenciones, cuentas de estados financieros y firmantes de cada localidad.' },
            { id: 'monedas-y-tipos-de-cambio', nombre: 'Tipos de cambio', icono: 'ti-currency-dollar', descripcion: 'Monedas que maneja el sistema y su tipo de cambio por fecha.' }
          ]
        },
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
      reportes: [],
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
      { id: 'cajas', nombre: 'Cajas', icono: 'ti-cash-register' },
      { id: 'ayuda', nombre: 'Ayuda', icono: 'ti-help' }
    ],
    subgrupos: {
      bancos: [
        {
          subgrupo: 'Bancos',
          icono: 'ti-building-bank',
          pantallas: [
            { id: 'cuentas-bancarias', nombre: 'Cuentas bancarias', icono: 'ti-building-bank', descripcion: 'Bancos del sistema y cuentas bancarias de cada organización y localidad.', separador: true },
            { id: 'depositos', nombre: 'Depósitos multimoneda', icono: 'ti-cash-banknote', descripcion: 'Depósitos en cualquier moneda con sus facturas, recibos y detalle contable.' },
            { id: 'consulta-de-depositos', nombre: 'Consulta de Depósitos Monetarios', icono: 'ti-file-search', descripcion: 'Resumen de los depósitos de la empresa por cuenta, cliente, fechas y estado (vigentes, anulados, conciliados, sin partida), con su detalle contable y sus facturas y recibos.', separador: true },
            { id: 'notas-credito', nombre: 'Notas de crédito / transferencias', icono: 'ti-file-plus', descripcion: 'Notas de crédito y transferencias recibidas.' },
            { id: 'notas-debito', nombre: 'Notas de débito / transferencias', icono: 'ti-file-minus', descripcion: 'Notas de débito y transferencias enviadas a proveedores.' },
            { id: 'consulta-de-notas', nombre: 'Consulta de Notas', icono: 'ti-file-search', descripcion: 'Resumen de las notas de crédito y débito de la empresa por cuenta, tipo, cliente o proveedor, fechas y estado, con su detalle contable y sus documentos.', separador: true },
            { id: 'conciliacion-bancaria', nombre: 'Conciliación bancaria', icono: 'ti-scale', descripcion: 'Conciliación mensual de cada cuenta bancaria con el saldo del banco y el contable.' },
            { id: 'disponibilidad-bancaria', nombre: 'Disponibilidad bancaria', icono: 'ti-chart-line', descripcion: 'Proceso: disponibilidad de un banco o todos, una cuenta o todas, a una fecha; cada generación se guarda con su correlativo, usuario y fecha y hora.' },
            { id: 'consulta-de-disponibilidad', nombre: 'Consulta de Disponibilidad', icono: 'ti-file-search', descripcion: 'Histórico de las disponibilidades generadas: correlativo, fecha de corte, usuario y fecha y hora, con el detalle de cada una en PDF y Excel.', separador: true },
            { id: 'disponibilidad-integrada', nombre: 'Disponibilidad integrada', icono: 'ti-chart-pie', descripcion: 'Disponibilidad consolidada de todas las cuentas de la organización, en quetzales.' }
          ]
        }
      ],
      cheques: [
        {
          subgrupo: 'Cheques',
          icono: 'ti-writing',
          pantallas: [
            { id: 'solicitud-de-cheques', nombre: 'Solicitud de cheques', icono: 'ti-file-dollar', descripcion: 'Requisición de cheques: beneficiario, monto y motivo del pago, con su aprobación y seguimiento hasta la emisión.', separador: true },
            { id: 'emision-de-cheques', nombre: 'Emisión de cheques', icono: 'ti-writing', descripcion: 'Cheques de cada cuenta bancaria con el número de su chequera, beneficiario, detalle contable, facturas pagadas e impresión.' },
            { id: 'consulta-de-cheques', nombre: 'Consulta de Cheques', icono: 'ti-file-search', descripcion: 'Resumen de los cheques de la empresa por cuenta, beneficiario, fechas y estado (vigentes, anulados, conciliados, sin partida), con su detalle contable y las compras que liquidó.', separador: true },
            { id: 'generacion-cheques', nombre: 'Generación cheques', icono: 'ti-files', descripcion: 'Cheques automáticos de las facturas y recibos de compra pendientes de pago, uno por proveedor o por factura.' },
            { id: 'generacion-transferencias', nombre: 'Generación transferencias', icono: 'ti-arrows-exchange', descripcion: 'Transferencias bancarias automáticas a los proveedores por sus facturas pendientes, con el lote para el banco.', separador: true },
            { id: 'facturas-de-compra', nombre: 'Facturas de compra por pagar', icono: 'ti-file-invoice', descripcion: 'Facturas y recibos de compra: proveedor, importe, bonificaciones, notas, forma de pago y detalle contable.' }
          ]
        }
      ],
      cajas: [
        {
          subgrupo: 'Cajas',
          icono: 'ti-cash-register',
          pantallas: [
            { id: 'definicion-cajas', nombre: 'Definición de Cajas', icono: 'ti-settings', descripcion: 'Cajas de la empresa: tipo de movimiento, transacción, cuenta principal, monto asignado, usuario que liquida, vinculación de cuentas para la carga masiva y tipos de gasto con su cuenta.', separador: true },
            { id: 'cajas-chicas', nombre: 'Cajas chicas', icono: 'ti-cash-register', descripcion: 'Selección de la caja a operar y su administración: subcajas por mes, anticipo, adelanto y liquidación, documentos con su desglose fiscal, detalle contable y póliza.' },
            { id: 'liquidacion-cajas-chicas', nombre: 'Liquidación de Cajas Chicas', icono: 'ti-file-check', descripcion: 'Subcajas por liquidar de una caja o de todas, con su anticipo y adelanto; se liquidan con una nota o un cheque y generan su póliza.' }
          ]
        }
      ]
    },
    opciones: {
      cheques: ['Chequeras', 'Anulación de cheques', 'Cheques en circulación'],
      cajas: ['Arqueo de caja'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
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
      procesos: [
        {
          subgrupo: 'Procesos',
          icono: 'ti-settings-automation',
          pantallas: [
            { id: 'carga-facturas-sat', nombre: 'Carga Facturas SAT', icono: 'ti-file-import', descripcion: 'Carga del archivo de facturas de la SAT (.xls, .xlsx o .csv) con su clasificación y cuenta contable, y generación de las compras o de los documentos de caja chica.' }
          ]
        },
        {
          subgrupo: 'Cuentas x Cobrar',
          icono: 'ti-report-money',
          pantallas: [
            { id: 'cxc-mensual', nombre: 'Consolidado CXC mensual', icono: 'ti-calendar-month', descripcion: 'Cuentas por cobrar de un mes de todas las ventas: cliente, tipo de fecha, saldo, tipo de cliente y días de mora.' },
            { id: 'cxc-general', nombre: 'Consolidado general', icono: 'ti-report-money', descripcion: 'Cuentas por cobrar de todas las ventas en un rango de fechas, con su valor y saldo en quetzales.' },
            { id: 'cxc-periodo', nombre: 'CXC por periodo', icono: 'ti-calendar-dollar', descripcion: 'Saldo de las ventas a una fecha, con resumen por cliente y estado de cuenta.' },
            { id: 'cxc-estado', nombre: 'Estado de cuenta clientes', icono: 'ti-file-invoice', descripcion: 'Estado de cuenta de uno o todos los clientes en un rango de fechas: saldo anterior, facturas, notas, retenciones, cobros, saldo final y antigüedad, en PDF o Excel.' }
          ]
        }
      ],
      catalogos: [
        {
          subgrupo: 'Ventas',
          icono: 'ti-user-dollar',
          pantallas: [
            { id: 'clientes', nombre: 'Clientes', icono: 'ti-users', descripcion: 'Clientes de la empresa: documento (NIT, CUI…), contacto, vendedor, tipo de precio, entrega, crédito, ubicación y datos de exportación.' },
            { id: 'vendedores', nombre: 'Vendedores', icono: 'ti-user-dollar', descripcion: 'Vendedores de la empresa: contacto, comisiones (general, crédito y contado), siglas y usuario del sistema.' },
            { id: 'series-recibos', nombre: 'Series Recibos', icono: 'ti-list-numbers', descripcion: 'Series de los recibos, retenciones y exenciones: recibo inicial, serie principal, tipo y si se muestra en la lista.' },
            { id: 'correlativo-dte', nombre: 'Correlativo - DTE', icono: 'ti-123', descripcion: 'Correlativo interno de las facturas (FE) y de las notas de crédito (NC): el siguiente documento toma el número siguiente.' }
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
            { id: 'productos-y-servicios', nombre: 'Productos y servicios', icono: 'ti-package', descripcion: 'Definición de artículos: clasificación y tipo, proveedor, presentación, medida, punto mínimo, costo, ubicación, bodega, precios e imagen.' },
            { id: 'precios-de-venta', nombre: 'Precios de venta', icono: 'ti-tags', descripcion: 'Precio de cada producto en cada tipo de precio: fecha, margen sobre el costo, precio sugerido, vigencia y lista de precios en PDF o Excel.' }
          ]
        }
      ],
      mantenimientos: [
        {
          subgrupo: 'Ventas',
          icono: 'ti-truck-delivery',
          pantallas: [
            { id: 'envios', nombre: 'Envíos', icono: 'ti-truck', descripcion: 'Envíos de productos a un cliente: bodega, cliente, forma de pago, precios y productos con lote y vencimiento; impresión tipo factura o tipo envío.' },
            { id: 'contrasenas-cobros', nombre: 'Contraseñas de Cobro', icono: 'ti-key', descripcion: 'Recepción de facturas por el cliente: contraseña de cobro, días de crédito y fecha estimada de cobro de cada factura.' },
            { id: 'despachos', nombre: 'Despachos', icono: 'ti-package-export', descripcion: 'Facturas por despachar por fechas, cliente y estado; despacho de productos con guías, reportes de salida y envío, mensajero y entrega.' },
            { id: 'retenciones', nombre: 'Retenciones', icono: 'ti-receipt-tax', descripcion: 'Constancias de retención (IVA o ISR) recibidas del cliente y aplicadas a sus facturas.' },
            { id: 'exenciones', nombre: 'Exenciones', icono: 'ti-shield-check', descripcion: 'Constancias de exención del cliente aplicadas a sus facturas.' }
          ]
        }
      ],
      registros: [
        {
          subgrupo: 'Facturas',
          icono: 'ti-file-invoice',
          pantallas: [
            { id: 'facturas-ventas', nombre: 'Facturas Ventas', icono: 'ti-file-invoice', descripcion: 'Factura electrónica (FEL, certificador COFIDI): cliente, venta y crédito, impuestos, productos con lote y vencimiento, detalle contable, inventario y pagos.' },
            { id: 'consulta-de-facturas', nombre: 'Consulta de Facturas', icono: 'ti-file-search', descripcion: 'Resumen de las facturas de venta por cliente, vendedor, forma de pago, fechas y estado (con saldo, pagadas, anuladas, sin certificar), con sus productos, detalle contable y pagos.', separador: true }
          ]
        },
        {
          subgrupo: 'Recibos',
          icono: 'ti-receipt-2',
          pantallas: [
            { id: 'recibos', nombre: 'Recibos', icono: 'ti-receipt-2', descripcion: 'Recibos de cobro: cliente, forma y tipo de pago, banco y documento, facturas que paga con su abono, retención, gastos administrativos, anulación e impresión (original o copia, con firma y sello digital).' },
            { id: 'consulta-de-recibos', nombre: 'Consulta de Recibos', icono: 'ti-file-search', descripcion: 'Resumen de los recibos de cobro por cliente, vendedor, forma de pago, fechas y estado (emitidos, liquidados, anulados), con las facturas que pagó cada uno.', separador: true }
          ]
        },
        {
          subgrupo: 'Notas electrónicas',
          icono: 'ti-file-certificate',
          pantallas: [
            { id: 'notas-de-credito-electronicas', nombre: 'Notas de Crédito', icono: 'ti-file-minus', descripcion: 'Descuentos y devoluciones sobre una factura: bajan su saldo; la devolución regresa los productos a la bodega destino.' },
            { id: 'notas-de-debito-electronicas', nombre: 'Notas de Débito', icono: 'ti-file-plus', descripcion: 'Cargos adicionales sobre una factura (intereses, correcciones): suben su saldo.' },
            { id: 'notas-de-abono-electronicas', nombre: 'Notas de Abono', icono: 'ti-file-dollar', descripcion: 'Abonos sobre una factura (devoluciones o ajustes a favor del cliente): bajan su saldo.' },
            { id: 'consulta-de-notas', nombre: 'Consulta de Notas', icono: 'ti-file-search', descripcion: 'Resumen de las notas de crédito, débito o abono (según el tipo elegido) por cliente, vendedor, tipo de ajuste, fechas y estado, con sus productos, su detalle contable y su factura de referencia.', separador: true },
            { id: 'anulacion-de-documentos-dte', nombre: 'Anulación de Documentos DTE', icono: 'ti-file-x', descripcion: 'Anula una factura o una nota con su motivo, deja el registro de quién y cuándo, y puede duplicar la factura anulada.', separador: true }
          ]
        }
      ]
    },
    opciones: {
      catalogos: ['Formas de pago'],
      registros: ['Cotizaciones', 'Pedidos', 'Notas de crédito', 'Cobros'],
      mantenimientos: ['Listas de precios', 'Descuentos'],
      procesos: ['Anulación de documentos', 'Antigüedad de saldos', 'Comisiones'],
      reportes: [],
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
      procesos: [
        {
          subgrupo: 'Procesos',
          icono: 'ti-settings-automation',
          pantallas: [
            { id: 'carga-facturas-sat', nombre: 'Carga Facturas SAT', icono: 'ti-file-import', descripcion: 'Carga del archivo de facturas de la SAT (.xls, .xlsx o .csv) con su clasificación y cuenta contable, y generación de las compras o de los documentos de caja chica.' }
          ]
        },
        {
          subgrupo: 'Cuentas x Pagar',
          icono: 'ti-report-money',
          pantallas: [
            { id: 'cxp-mensual', nombre: 'Consolidado CXP mensual', icono: 'ti-calendar-month', descripcion: 'Cuentas por pagar de un mes: proveedor, tipo de fecha, saldo, tipo de proveedor y días de mora.' },
            { id: 'cxp-general', nombre: 'Consolidado general', icono: 'ti-report-money', descripcion: 'Cuentas por pagar en un rango de fechas, con su valor y saldo en quetzales.' },
            { id: 'cxp-periodo', nombre: 'CXP por periodo', icono: 'ti-calendar-dollar', descripcion: 'Saldo de las compras a una fecha, con resumen por proveedor y estado de cuenta.' },
            { id: 'cxp-estado', nombre: 'Estado de cuenta proveedores', icono: 'ti-file-invoice', descripcion: 'Estado de cuenta de uno o todos los proveedores en un rango de fechas: saldo anterior, compras, pagos, saldo final y antigüedad, en PDF o Excel.' }
          ]
        }
      ],
      catalogos: [
        {
          // Generales (script 101): las 4 de productos son las mismas pantallas y tablas de Facturación.
          subgrupo: 'Generales',
          icono: 'ti-settings',
          pantallas: [
            { id: 'clasificaciones-compra', nombre: 'Clasificación compras', icono: 'ti-tags', descripcion: 'Clasificaciones fiscales de las compras: siglas, libro de compras y si aplica IVA.' },
            { id: 'tipos-documento-compra', nombre: 'Tipo documento', icono: 'ti-file-description', descripcion: 'Tipos de documento de las compras y cómo se calcula su IVA.', separador: true },
            { id: 'tipos-de-medida', nombre: 'Tipos de medida', icono: 'ti-ruler-measure', descripcion: 'Unidades de medida de los productos (las mismas de Facturación).' },
            { id: 'clasificaciones-y-tipos', nombre: 'Clasificación de productos', icono: 'ti-category', descripcion: 'Clasificaciones de productos y servicios con su cuenta, y los tipos de productos de cada clasificación.' },
            { id: 'presentaciones-productos', nombre: 'Presentaciones', icono: 'ti-box', descripcion: 'Presentaciones en que vienen los productos.' },
            { id: 'tipos-de-precio', nombre: 'Tipos de precios', icono: 'ti-currency-dollar', descripcion: 'Listas de precio: % de utilidad, % de descuento, factor y estado.' },
            { id: 'productos-y-servicios', nombre: 'Productos y servicios', icono: 'ti-package', descripcion: 'Definición de artículos (el mismo catálogo de Facturación): clasificación y tipo, proveedor, presentación, medida, punto mínimo, costo, ubicación, bodega, precios e imagen.', separador: true },
            { id: 'parametros-compras', nombre: 'Parámetros módulo', icono: 'ti-adjustments', descripcion: 'Encargados de compras, pedidos y facturación, quién recibe traslados, transacción principal de ventas y avisos por correo.' }
          ]
        },
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
                { id: 'consultar-compras', nombre: 'Consultar Compras', icono: 'ti-file-search', descripcion: 'Resumen de los ingresos de compras (maestro y detalle) por empresa, proveedor y fechas, para modificar las que no están contabilizadas ni en un mes cerrado.', separador: true },
                { id: 'regularizacion-anticipos', nombre: 'Regularización anticipos', icono: 'ti-arrows-exchange', descripcion: 'Liquida los anticipos a proveedores (cheques y notas de débito) contra las compras por pagar y genera su póliza contable.', separador: true },
                { id: 'notas-credito-compras', nombre: 'Notas crédito compras', icono: 'ti-receipt-refund', descripcion: 'Notas de crédito y débito de los proveedores: factura de referencia, devolución al inventario, detalle contable y póliza.', separador: true },
                { id: 'productos-consignacion', nombre: 'Productos en consignación', icono: 'ti-packages', descripcion: 'Partes de depósito de los proveedores: envío o devolución de mercadería en consignación y su carga al inventario.' },
                { id: 'contrasenas-pago', nombre: 'Contraseñas de pago', icono: 'ti-key', descripcion: 'Recepción de facturas del proveedor: documentos recibidos, fecha estimada de pago, autorización, impresión y liquidación.' }
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
      catalogos: ['Compradores', 'Condiciones de pago'],
      mantenimientos: ['Series de documentos', 'Listas de precios de proveedores'],
      procesos: ['Aprobación de órdenes de compra', 'Anulación de documentos', 'Antigüedad de saldos'],
      reportes: [],
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
    // Catálogos (script 143): los grupos Generales y Proveedores de Compras y el grupo Productos de
    // Facturación/Ventas, con las mismas pantallas y tablas (se llenan al final de este archivo).
    subgrupos: {
      catalogos: [],
      registros: [
        {
          subgrupo: 'Movimientos',
          icono: 'ti-arrows-up-down',
          pantallas: [
            { id: 'entradas', nombre: 'Entradas', icono: 'ti-package-import', descripcion: 'Ingresos por compras y ajustes de compras (notas de proveedores) por fechas, proveedor, productos, bodega y tipo; por línea, producto, proveedor o documento, en PDF o Excel.' },
            { id: 'salidas', nombre: 'Salidas', icono: 'ti-package-export', descripcion: 'Salidas por ventas y ajustes de ventas (notas de clientes) por fechas, cliente, productos, bodega y tipo; por línea, producto, cliente o documento, en PDF o Excel.' },
            { id: 'vencimiento-productos', nombre: 'Vencimiento de productos', icono: 'ti-calendar-exclamation', descripcion: 'Productos vencidos y por vencer (3, 6, 12 o 18 meses) por bodega, con lote, vencimiento, fabricación, existencia, costo y valor; en PDF o Excel.' }
          ]
        },
        {
          subgrupo: 'Traslados y ajustes',
          icono: 'ti-arrows-exchange',
          pantallas: [
            { id: 'traslados-entre-bodegas', nombre: 'Traslados entre bodegas', icono: 'ti-arrows-exchange', descripcion: 'Traslado de productos de una bodega a otra con su lote y vencimiento: registrar, operar, revertir, anular e imprimir.' },
            { id: 'ajustes-por-lotes', nombre: 'Ajustes al inventario por lotes', icono: 'ti-barcode', descripcion: 'Cambio de lote, fabricación y vencimiento de una cantidad de producto en la bodega, con su motivo y costo.' },
            { id: 'ajustes-por-producto', nombre: 'Ajustes al inventario por producto', icono: 'ti-adjustments-horizontal', descripcion: 'Añadir o disminuir existencias de una bodega con su motivo, justificación, lote y costo.', separador: true },
            { id: 'devoluciones-reingresos', nombre: 'Devoluciones y reingresos', icono: 'ti-arrow-back-up-double', descripcion: 'Notas por devolución o reingreso de productos: tipo de nota, justificación, compra de ingreso y referencias, aplicar a inventario o revertir.' }
          ]
        }
      ],
      mantenimientos: [
        {
          subgrupo: 'Kardex',
          icono: 'ti-list-numbers',
          pantallas: [
            {
              subgrupo: 'Movimiento de Kardex',
              icono: 'ti-arrows-up-down',
              pantallas: [
                { id: 'kardex-con-costos', nombre: 'Kardex con costos', icono: 'ti-report-money', descripcion: 'Movimientos de cada producto en bodega con existencias, costo unitario, costo del movimiento, costo promedio y costo total; en PDF o Excel.' },
                { id: 'kardex-sin-costos', nombre: 'Kardex sin costos', icono: 'ti-list-numbers', descripcion: 'Movimientos de cada producto en bodega con lote, fabricación, vencimiento y existencias por lote y producto; en PDF o Excel.' }
              ]
            },
            {
              subgrupo: 'Análisis de Costos',
              icono: 'ti-chart-line',
              pantallas: [
                { id: 'analisis-costos-local', nombre: 'Análisis de costos local', icono: 'ti-chart-line', descripcion: 'Compras de cada producto con su costo unitario, promedio ponderado, descuentos, bonificaciones, notas de crédito y costo neto.' },
                { id: 'analisis-costo-importacion', nombre: 'Análisis costo importación', icono: 'ti-world-dollar', descripcion: 'Compras importadas con sus gastos extras prorrateados: costo unitario, gasto por unidad y costo con gastos en quetzales y dólares; reportes detallado, resumido y consolidado.' }
              ]
            }
          ]
        },
        {
          subgrupo: 'Control de inventario',
          icono: 'ti-adjustments-alt',
          pantallas: [
            { id: 'minimos-y-maximos', nombre: 'Mínimos y máximos', icono: 'ti-arrows-vertical', descripcion: 'Existencia contra puntos mínimos y máximos por producto y bodega: estado, cantidad y valor a pedir; mínimos y máximos editables.' },
            { id: 'costos', nombre: 'Costos', icono: 'ti-coin', descripcion: 'Costo del catálogo contra el último costo y el promedio ponderado de compras, con la diferencia; actualización del costo.' }
          ]
        }
      ],
      procesos: [
        {
          subgrupo: 'Procesos de inventario',
          icono: 'ti-settings-automation',
          pantallas: [
            { id: 'toma-fisica', nombre: 'Toma física', icono: 'ti-clipboard-check', descripcion: 'Fotografía de existencias de una bodega a una fecha de corte, conteo físico (ciego), diferencias valuadas y ajustes automáticos de sobrantes y faltantes; acta con firmas.' },
            { id: 'recalcular-costo-promedio', nombre: 'Recalcular costo promedio', icono: 'ti-calculator', descripcion: 'Promedio ponderado perpetuo de cada producto contra el costo del catálogo; aplica el costo a los productos marcados con su historial.' },
            { id: 'cierre-de-inventario', nombre: 'Cierre de inventario', icono: 'ti-lock', descripcion: 'Cierre mensual con los saldos por producto y bodega (libro de inventarios); un mes cerrado ya no acepta movimientos; reapertura con motivo.' }
          ]
        }
      ],
      reportes: [
        {
          subgrupo: 'Reportes de inventario',
          icono: 'ti-report-analytics',
          pantallas: [
            { id: 'existencias-inventario', nombre: 'Existencias', icono: 'ti-packages', descripcion: 'Existencias a una fecha por bodega, producto y lote, con vencimiento; un producto o todos. PDF y Excel.' },
            { id: 'kardex-por-producto', nombre: 'Kardex por producto', icono: 'ti-list-details', descripcion: 'Movimientos del 1 de enero a la fecha con saldo inicial, entradas, salidas, saldo y costo promedio; un producto o todos. PDF y Excel.' },
            { id: 'valuacion-de-inventario', nombre: 'Valuación de inventario', icono: 'ti-report-money', descripcion: 'Existencia a una fecha valuada al costo promedio ponderado, con el porcentaje de cada producto. PDF y Excel.' },
            { id: 'rotacion-de-inventario', nombre: 'Rotación', icono: 'ti-refresh', descripcion: 'Rotación y días de inventario del 1 de enero a la fecha; clasificación alta, media, baja y sin movimiento. PDF y Excel.' }
          ]
        }
      ]
    },
    opciones: {
      catalogos: [],
      registros: [],
      mantenimientos: ['Ubicaciones'],
      procesos: [],
      reportes: [],
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
    id: 'presupuesto-flujo',
    corto: 'Presupuesto y Flujo',
    color: 'rosa',
    nombre: 'Presupuesto y flujo de efectivo',
    icono: 'ti-report-money',
    descripcion: 'Proyección de ingresos y egresos, flujo de efectivo y comparativo contra lo ejecutado.',
    subgrupos: {
      catalogos: [
        { subgrupo: 'Presupuesto', icono: 'ti-table', pantallas: [
          { id: 'rubros-presupuesto', nombre: 'Rubros de presupuesto', icono: 'ti-list-details', descripcion: 'Rubros que se presupuestan por grupo: ingresos, personal, financieros, administrativos, impuestos e inversiones.' },
          { id: 'rubros-cuentas', nombre: 'Rubros y cuentas contables', icono: 'ti-link', descripcion: 'Cuentas contables de cada rubro: de ellas sale la ejecución del presupuesto.' },
          { id: 'escenarios-presupuesto', nombre: 'Escenarios', icono: 'ti-adjustments', descripcion: 'Escenarios base, optimista y conservador con sus factores de ingresos y egresos.' }
        ] },
        { subgrupo: 'Flujo de efectivo', icono: 'ti-arrows-exchange', pantallas: [
          { id: 'rubros-de-flujo', nombre: 'Rubros de flujo', icono: 'ti-arrows-exchange', descripcion: 'Rubros del flujo por actividad (NIC 7) con su origen: manual, cobros o pagos.' }
        ] }
      ],
      registros: [
        { subgrupo: 'Presupuesto', icono: 'ti-table-plus', pantallas: [
          { id: 'formulacion-presupuesto', nombre: 'Formulación del presupuesto', icono: 'ti-table-plus', descripcion: 'Presupuesto por rubro y mes con supuestos, versiones y envío a revisión.' },
          { id: 'modificaciones-presupuestarias', nombre: 'Modificaciones presupuestarias', icono: 'ti-arrows-shuffle', descripcion: 'Traslados, ampliaciones y reducciones del presupuesto aprobado con justificación.' }
        ] },
        { subgrupo: 'Flujo de efectivo', icono: 'ti-timeline', pantallas: [
          { id: 'proyeccion-de-flujo', nombre: 'Proyección de flujo', icono: 'ti-timeline', descripcion: 'Flujo de 13 semanas o 12 meses con saldo de bancos, cobros y pagos automáticos, escenario y alerta de saldo mínimo.' }
        ] }
      ],
      procesos: [
        { subgrupo: 'Presupuesto', icono: 'ti-settings-automation', pantallas: [
          { id: 'aprobacion-presupuesto', nombre: 'Aprobación de presupuestos', icono: 'ti-checks', descripcion: 'Revisión, aprobación (segregación de funciones), devolución, cierre y anulación de presupuestos.' },
          { id: 'ejecucion-presupuestaria', nombre: 'Ejecución presupuestaria', icono: 'ti-player-play', descripcion: 'Calcula la ejecución mes a mes desde las partidas contables y muestra el avance con semáforo.' }
        ] }
      ],
      reportes: [
        { subgrupo: 'Reportes', icono: 'ti-report-analytics', pantallas: [
          { id: 'presupuesto-vs-ejecutado-pf', nombre: 'Presupuesto vs. ejecutado', icono: 'ti-target-arrow', descripcion: 'Mes y acumulado por rubro con variación, % de ejecución y semáforo; o el ejecutado por mes. PDF y Excel.' },
          { id: 'estado-flujo-efectivo', nombre: 'Estado de flujo de efectivo', icono: 'ti-arrows-exchange-2', descripcion: 'NIC 7 por el método indirecto: operación, inversión y financiamiento, conciliado con caja y bancos. PDF y Excel.' },
          { id: 'flujo-proyectado-vs-real', nombre: 'Flujo proyectado vs. real', icono: 'ti-chart-arrows', descripcion: 'Entradas, salidas y saldo proyectados contra los movimientos reales de caja y bancos por período. PDF y Excel.' },
          { id: 'indicadores-financieros', nombre: 'Indicadores financieros', icono: 'ti-gauge', descripcion: 'Liquidez, prueba ácida, capital de trabajo, endeudamiento, rentabilidad y días de cobro con semáforo. PDF y Excel.' }
        ] }
      ]
    },
    opciones: {
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
    subgrupos: {
      catalogos: [
        { subgrupo: 'Emisor', icono: 'ti-id-badge-2', pantallas: [
          { id: 'sat-emisor', nombre: 'Datos del emisor', icono: 'ti-id-badge-2', descripcion: 'NIT, nombre del emisor, régimen de IVA e ISR, agente retenedor y certificador FEL (sin claves).' },
          { id: 'sat-establecimientos', nombre: 'Establecimientos', icono: 'ti-building-store', descripcion: 'Establecimientos registrados en el RTU con su código SAT.' }
        ] },
        { subgrupo: 'FEL', icono: 'ti-file-certificate', pantallas: [
          { id: 'sat-tipos-dte', nombre: 'Tipos de DTE', icono: 'ti-file-certificate', descripcion: 'Documentos tributarios electrónicos (FACT, FCAM, FPEQ, FESP, NCRE, NDEB, NABN, RECI) y su efecto en el IVA.' },
          { id: 'sat-frases', nombre: 'Frases y escenarios', icono: 'ti-quote', descripcion: 'Frases que exige la SAT en los DTE según el régimen; se marcan las que aplican a la empresa.' }
        ] }
      ],
      registros: [
        { subgrupo: 'Documentos', icono: 'ti-files', pantallas: [
          { id: 'dte-emitidos', nombre: 'DTE emitidos', icono: 'ti-file-certificate', descripcion: 'Bandeja de facturas y notas del período: certificadas, pendientes de certificar y anuladas.' },
          { id: 'dte-recibidos', nombre: 'DTE recibidos', icono: 'ti-file-download', descripcion: 'Facturas recibidas según el archivo de la SAT y si ya están registradas en compras.' },
          { id: 'constancias-retencion', nombre: 'Constancias de retención', icono: 'ti-receipt-tax', descripcion: 'Retenciones de IVA e ISR recibidas de clientes y emitidas a proveedores.' }
        ] }
      ],
      procesos: [
        { subgrupo: 'Impuestos', icono: 'ti-calculator', pantallas: [
          { id: 'conciliacion-fiscal', nombre: 'Conciliación fiscal', icono: 'ti-arrows-diff', descripcion: 'DTE de la SAT contra compras registradas, montos distintos y ventas sin certificar.' },
          { id: 'liquidacion-impuestos', nombre: 'Liquidación de impuestos', icono: 'ti-calculator', descripcion: 'IVA del mes (débito, crédito, retenciones, remanente), ISR e ISO; cierre del período fiscal.' },
          { id: 'impuestos-regimen', nombre: 'Cálculo de impuestos del régimen', icono: 'ti-receipt-tax', descripcion: 'Cálculo de cada obligación del calendario según el régimen: IVA, pequeño contribuyente, ISR mensual o trimestral, ISO, retenciones e ISR anual.' },
          { id: 'calendario-fiscal', nombre: 'Calendario fiscal', icono: 'ti-calendar-due', descripcion: 'Obligaciones del año según el régimen, con vencimientos y registro de su presentación.' }
        ] }
      ],
      reportes: [
        { subgrupo: 'Libros', icono: 'ti-books', pantallas: [
          { id: 'libro-ventas', nombre: 'Libro de ventas', icono: 'ti-book', descripcion: 'Libro de ventas y servicios del período con gravado, exento e IVA débito. PDF y Excel.' },
          { id: 'libro-compras', nombre: 'Libro de compras', icono: 'ti-book-2', descripcion: 'Libro de compras y servicios por período de presentación: bienes, servicios, combustibles, exento e IVA crédito. PDF y Excel.' }
        ] },
        { subgrupo: 'Análisis', icono: 'ti-chart-histogram', pantallas: [
          { id: 'resumen-iva', nombre: 'Resumen de IVA', icono: 'ti-chart-histogram', descripcion: 'IVA débito, crédito, retenciones, remanente y a pagar de cada mes del año, con gráficas.' },
          { id: 'dte-por-estado', nombre: 'DTE por estado', icono: 'ti-chart-pie', descripcion: 'Documentos emitidos por tipo y estado de certificación, con valores e IVA.' }
        ] }
      ]
    },
    opciones: {
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  },
  {
    id: 'nominas',
    corto: 'Nóminas',
    color: 'coral',
    nombre: 'Nóminas y planillas',
    icono: 'ti-users',
    descripcion: 'Empleados, planillas, IGSS, ISR y prestaciones.',
    subgrupos: {
      catalogos: [
        { subgrupo: 'Personal', icono: 'ti-users', pantallas: [
          { id: 'nom-empleados', nombre: 'Empleados', icono: 'ti-users', descripcion: 'Ficha del empleado: DPI, NIT, afiliación IGSS, puesto, jornada, salario, bonificación y cuenta para el pago.' },
          { id: 'nom-departamentos', nombre: 'Departamentos', icono: 'ti-sitemap', descripcion: 'Departamentos que agrupan la planilla y el costo de personal.' },
          { id: 'nom-puestos', nombre: 'Puestos', icono: 'ti-briefcase', descripcion: 'Puestos con su departamento y salario base de referencia.' }
        ] },
        { subgrupo: 'Configuración', icono: 'ti-adjustments', pantallas: [
          { id: 'nom-conceptos', nombre: 'Conceptos de ingreso y descuento', icono: 'ti-list-details', descripcion: 'Comisiones, bonos, viáticos y descuentos con su afectación a IGSS, ISR y prestaciones.' },
          { id: 'nom-parametros', nombre: 'Parámetros de nómina', icono: 'ti-adjustments', descripcion: 'IGSS laboral y patronal, bonificación incentivo, salario mínimo, ISR de asalariados y cuentas de la partida.' }
        ] }
      ],
      registros: [
        { subgrupo: 'Novedades', icono: 'ti-clock-plus', pantallas: [
          { id: 'nom-novedades', nombre: 'Novedades del período', icono: 'ti-clock-plus', descripcion: 'Horas extra, ausencias, suspensiones IGSS, otros ingresos y descuentos del mes.' },
          { id: 'nom-prestamos', nombre: 'Anticipos y préstamos', icono: 'ti-cash-banknote', descripcion: 'Anticipos y préstamos con su cuota, que se descuenta en cada planilla.' },
          { id: 'nom-vacaciones', nombre: 'Vacaciones', icono: 'ti-beach', descripcion: 'Saldo de vacaciones (15 días por año) y registro de los goces.' }
        ] }
      ],
      procesos: [
        { subgrupo: 'Planillas', icono: 'ti-file-dollar', pantallas: [
          { id: 'nom-planilla', nombre: 'Planillas', icono: 'ti-file-dollar', descripcion: 'Planilla ordinaria, Bono 14 y aguinaldo: cálculo, aprobación, pago y partida contable.' },
          { id: 'nom-liquidacion', nombre: 'Liquidación laboral', icono: 'ti-user-minus', descripcion: 'Salario pendiente, indemnización, aguinaldo, Bono 14 y vacaciones proporcionales al dar de baja.' }
        ] }
      ],
      reportes: [
        { subgrupo: 'Reportes', icono: 'ti-report', pantallas: [
          { id: 'nom-reporte-planilla', nombre: 'Planilla del período', icono: 'ti-file-spreadsheet', descripcion: 'Planilla por departamento con ingresos, descuentos, líquido y cuota patronal. PDF y Excel.' },
          { id: 'nom-boletas', nombre: 'Boletas de pago', icono: 'ti-receipt', descripcion: 'Boleta de cada empleado con ingresos, descuentos, líquido y firma de recibido.' },
          { id: 'nom-planilla-igss', nombre: 'Planilla del IGSS', icono: 'ti-shield-heart', descripcion: 'Salario afecto, cuota laboral y patronal por afiliado del mes.' },
          { id: 'nom-retenciones-isr', nombre: 'Retenciones de ISR', icono: 'ti-receipt-tax', descripcion: 'ISR retenido a cada asalariado por mes y total del año.' },
          { id: 'nom-libro-salarios', nombre: 'Libro de salarios', icono: 'ti-book', descripcion: 'Libro de salarios por empleado y período (Código de Trabajo art. 102).' },
          { id: 'nom-costo-personal', nombre: 'Costo de personal', icono: 'ti-chart-bar', descripcion: 'Sueldos, bonificación, prestaciones y cuota patronal por departamento y mes.' },
          { id: 'nom-provision-prestaciones', nombre: 'Provisión de prestaciones', icono: 'ti-pig-money', descripcion: 'Provisión mensual de indemnización, aguinaldo, Bono 14 y vacaciones por empleado.' }
        ] }
      ]
    },
    opciones: {
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
    subgrupos: {
      catalogos: [
        { subgrupo: 'Aduanas', icono: 'ti-building-community', pantallas: [
          { id: 'com-agentes', nombre: 'Agentes aduanales', icono: 'ti-id', descripcion: 'Agentes aduanales con su licencia, contacto y honorario.' },
          { id: 'com-aduanas', nombre: 'Aduanas', icono: 'ti-building-community', descripcion: 'Aduanas marítimas, terrestres, aérea, express e internas de Guatemala.' },
          { id: 'com-incoterms', nombre: 'Incoterms', icono: 'ti-world-share', descripcion: 'Incoterms 2020 con quién paga el flete y el seguro.' }
        ] },
        { subgrupo: 'Aranceles y transporte', icono: 'ti-barcode', pantallas: [
          { id: 'com-partidas', nombre: 'Partidas arancelarias', icono: 'ti-barcode', descripcion: 'Partidas del SAC con su DAI e IVA.' },
          { id: 'com-transportistas', nombre: 'Navieras y transportistas', icono: 'ti-ship', descripcion: 'Navieras, aerolíneas, transportistas terrestres y couriers.' }
        ] }
      ],
      registros: [
        { subgrupo: 'Comercio exterior', icono: 'ti-world', pantallas: [
          { id: 'com-polizas', nombre: 'Pólizas de importación', icono: 'ti-file-import', descripcion: 'DUCA con productos, FOB, flete, seguro, partidas y gastos locales; costeo, liquidación e ingreso a bodega.' },
          { id: 'com-exportaciones', nombre: 'Exportaciones', icono: 'ti-file-export', descripcion: 'Exportaciones con cliente, destino, Incoterm, productos y valor en quetzales.' },
          { id: 'com-embarques', nombre: 'Embarques', icono: 'ti-ship', descripcion: 'Seguimiento de embarques con estado, ETA y bitácora de eventos.' }
        ] }
      ],
      procesos: [
        { subgrupo: 'Importaciones', icono: 'ti-calculator', pantallas: [
          { id: 'com-liquidacion', nombre: 'Liquidación de pólizas', icono: 'ti-calculator', descripcion: 'Bandeja de pólizas por liquidar: costo CIF, DAI, IVA y gastos prorrateados; ingreso a la bodega.' }
        ] }
      ],
      reportes: [
        { subgrupo: 'Reportes', icono: 'ti-report', pantallas: [
          { id: 'com-importaciones-periodo', nombre: 'Importaciones por período', icono: 'ti-calendar-stats', descripcion: 'Pólizas liquidadas por mes con CIF, DAI, IVA, gastos y costo. PDF y Excel.' },
          { id: 'com-costo-poliza', nombre: 'Costo por póliza', icono: 'ti-receipt', descripcion: 'Costo de cada producto por póliza: FOB, flete y seguro, DAI, gastos, unitario y recargo. PDF y Excel.' },
          { id: 'com-exportaciones-destino', nombre: 'Exportaciones por destino', icono: 'ti-world', descripcion: 'Exportaciones por país con su participación. PDF y Excel.' },
          { id: 'com-tributos-aduana', nombre: 'Tributos de aduana', icono: 'ti-receipt-tax', descripcion: 'DAI e IVA de importación por mes y aduana (crédito fiscal). PDF y Excel.' }
        ] }
      ]
    },
    opciones: {
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  },
  {
    id: 'hospital',
    corto: 'Hospital',
    color: 'rojo',
    hereda: 'comercio',
    nombre: 'Administración hospitalaria',
    icono: 'ti-building-hospital',
    descripcion: 'Pacientes, admisión, cuenta del paciente, camas, honorarios médicos, aseguradoras y facturación hospitalaria.',
    opciones: {
      catalogos: ['Pacientes', 'Médicos y especialidades', 'Áreas, habitaciones y camas', 'Servicios y tarifas', 'Aseguradoras y convenios'],
      registros: ['Admisión', 'Citas y agenda médica', 'Cuenta del paciente', 'Órdenes médicas y farmacia', 'Programación de quirófanos'],
      procesos: ['Censo diario y cargo día-cama', 'Egreso y facturación', 'Liquidación de honorarios médicos', 'Reclamos a aseguradoras', 'Cierre de caja hospitalaria'],
      reportes: ['Censo y ocupación', 'Ingresos por servicio y médico', 'Cuentas abiertas de pacientes', 'Cartera de aseguradoras', 'Indicadores hospitalarios'],
      ayuda: ['Manual del módulo', 'Preguntas frecuentes']
    }
  }
];

// Inventarios › Catálogos: acceso a los grupos de Compras (Generales y Proveedores) y al grupo Productos de
// Facturación/Ventas. Son los mismos objetos, así que cualquier cambio en esos grupos se ve también aquí.
(function () {
  const mod = (id) => window.MODULOS.find((m) => m.id === id);
  const inv = mod('inventarios'), com = mod('compras'), fac = mod('facturacion');
  if (!inv || !com || !fac) return;
  inv.subgrupos.catalogos = [
    ...(com.subgrupos.catalogos || []),
    ...(fac.subgrupos.catalogos || []).filter((s) => s.subgrupo === 'Productos')
  ];
})();

// Reportes de Facturación/Ventas y de Compras (reportes_comerciales.js).
(function () {
  const mod = (id) => window.MODULOS.find((m) => m.id === id);
  const pon = (id, subgrupo, pantallas) => { const m = mod(id); if (!m) return; m.subgrupos = m.subgrupos || {}; m.subgrupos.reportes = [{ subgrupo, icono: 'ti-report-analytics', pantallas }]; };
  pon('facturacion', 'Reportes de ventas', [
    { id: 'ventas-por-periodo', nombre: 'Ventas por período', icono: 'ti-calendar-stats', descripcion: 'Ventas del período por mes (resumido) o por factura (detallado), de un producto o de todos, con gráfica. PDF y Excel.' },
    { id: 'ventas-por-cliente', nombre: 'Ventas por cliente', icono: 'ti-users', descripcion: 'Ventas del período por cliente con su participación, de un producto o de todos; detallado con sus facturas. PDF y Excel.' },
    { id: 'reporte-cuentas-por-cobrar', nombre: 'Cuentas por cobrar', icono: 'ti-cash', descripcion: 'Saldo por cobrar a una fecha con antigüedad (no vencido, 1-30, 31-60, 61-90 y más de 90 días), por cliente o por factura. PDF y Excel.' },
    { id: 'grafica-de-ventas', nombre: 'Gráfica de ventas', icono: 'ti-chart-histogram', descripcion: 'Ventas por mes, clientes principales y productos principales del período, con su tabla de datos. PDF y Excel.' }
  ]);
  pon('compras', 'Reportes de compras', [
    { id: 'compras-por-periodo', nombre: 'Compras por período', icono: 'ti-calendar-stats', descripcion: 'Compras del período por mes (resumido) o por documento (detallado), de un producto o de todos, con gráfica. PDF y Excel.' },
    { id: 'compras-por-proveedor', nombre: 'Compras por proveedor', icono: 'ti-truck', descripcion: 'Compras del período por proveedor con su participación, de un producto o de todos; detallado con sus documentos. PDF y Excel.' },
    { id: 'reporte-cuentas-por-pagar', nombre: 'Cuentas por pagar', icono: 'ti-receipt-2', descripcion: 'Saldo por pagar a una fecha con antigüedad (no vencido, 1-30, 31-60, 61-90 y más de 90 días), por proveedor o por documento. PDF y Excel.' },
    { id: 'grafica-de-compras', nombre: 'Gráfica de compras', icono: 'ti-chart-histogram', descripcion: 'Compras por mes, proveedores principales y productos principales del período, con su tabla de datos. PDF y Excel.' }
  ]);
})();

// Contabilidad › Reportes y gráficas (contabilidad_reportes.js).
(function () {
  const m = window.MODULOS.find((x) => x.id === 'contabilidad');
  if (!m) return;
  m.subgrupos = m.subgrupos || {};
  m.subgrupos.reportes = [
    { subgrupo: 'Libros contables', icono: 'ti-books', pantallas: [
      { id: 'libro-diario', nombre: 'Libro diario', icono: 'ti-notebook', descripcion: 'Partidas del período en orden cronológico con su detalle de cuentas (detallado) o una línea por partida (resumido); empresa o consolidado. PDF y Excel.' },
      { id: 'libro-mayor', nombre: 'Libro mayor', icono: 'ti-book-2', descripcion: 'Movimientos de cada cuenta con saldo inicial, debe, haber y saldo acumulado; una cuenta o todas; detallado o resumido. PDF y Excel.' },
      { id: 'balanza-de-comprobacion', nombre: 'Balanza de comprobación', icono: 'ti-scale', descripcion: 'Saldos iniciales, movimientos y saldos finales deudores y acreedores por cuenta y nivel, con la comprobación de cuadre. PDF y Excel.' }
    ] },
    { subgrupo: 'Estados financieros', icono: 'ti-report-money', pantallas: [
      { id: 'balance-general', nombre: 'Balance general', icono: 'ti-building-bank', descripcion: 'Activo, pasivo y patrimonio a una fecha por nivel de cuenta, con el resultado del ejercicio, cuadre, gráficas y firmas. PDF y Excel.' },
      { id: 'estado-de-resultados', nombre: 'Estado de resultados', icono: 'ti-chart-line', descripcion: 'Ingresos, costos y gastos del período con utilidad bruta, de operación y neta, % sobre ingresos y columnas por mes. PDF y Excel.' },
      { id: 'presupuesto-vs-ejecutado', nombre: 'Presupuesto vs. ejecutado', icono: 'ti-target-arrow', descripcion: 'Rubros del presupuesto del año con lo presupuestado, ejecutado, variación y % de ejecución por grupo. PDF y Excel.' }
    ] }
  ];
})();
