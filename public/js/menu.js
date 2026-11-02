// Estructura de módulos y grupos de menú de Financiero.
// Cada opción con "vista" abre una pantalla funcional; el resto muestra "en construcción".
const AYUDA = ['Manual del módulo', 'Preguntas frecuentes', 'Soporte técnico'];

const GRUPOS = [
  { id: 'catalogos', nombre: 'Catálogos', icono: 'ti-books' },
  { id: 'registros', nombre: 'Registros', icono: 'ti-pencil' },
  { id: 'mantenimientos', nombre: 'Mantenimientos', icono: 'ti-tool' },
  { id: 'procesos', nombre: 'Procesos', icono: 'ti-settings-automation' },
  { id: 'reportes', nombre: 'Reportes y gráficas', icono: 'ti-chart-bar' },
  { id: 'ayuda', nombre: 'Ayuda', icono: 'ti-help' },
];

const MODULOS = [
  {
    id: 'contabilidad', nombre: 'Contabilidad y presupuesto', icono: 'ti-calculator',
    opciones: {
      catalogos: ['Plan de cuentas', 'Centros de costo', 'Tipos de póliza', 'Monedas y tipos de cambio'],
      registros: ['Pólizas contables', 'Presupuesto anual', 'Modificaciones presupuestarias'],
      mantenimientos: ['Períodos contables', 'Parámetros contables'],
      procesos: ['Cierre mensual', 'Cierre anual', 'Ejecución presupuestaria'],
      reportes: ['Balance general', 'Estado de resultados', 'Libro diario', 'Libro mayor', 'Presupuesto vs. ejecutado'],
      ayuda: AYUDA,
    },
  },
  {
    id: 'facturacion', nombre: 'Facturación y ventas', icono: 'ti-receipt',
    opciones: {
      catalogos: [{ nombre: 'Clientes y proveedores', vista: 'terceros' }, 'Productos y servicios', 'Series de facturación', 'Vendedores'],
      registros: ['Facturas', 'Notas de crédito', 'Notas de débito', 'Recibos de cobro'],
      mantenimientos: ['Listas de precios', 'Condiciones de pago'],
      procesos: ['Anulación de documentos', 'Cuentas por cobrar'],
      reportes: ['Ventas por período', 'Ventas por cliente', 'Antigüedad de saldos'],
      ayuda: AYUDA,
    },
  },
  {
    id: 'inventarios', nombre: 'Inventarios', icono: 'ti-box',
    opciones: {
      catalogos: ['Productos', 'Bodegas', 'Unidades de medida', 'Categorías'],
      registros: ['Entradas', 'Salidas', 'Traslados entre bodegas', 'Ajustes'],
      mantenimientos: ['Costos', 'Mínimos y máximos'],
      procesos: ['Toma física', 'Cierre de inventario'],
      reportes: ['Existencias', 'Kardex', 'Valuación de inventario'],
      ayuda: AYUDA,
    },
  },
  {
    id: 'sat', nombre: 'Integraciones SAT', icono: 'ti-building-bank',
    opciones: {
      catalogos: ['Certificador FEL', 'Establecimientos', 'Tipos de DTE', 'Frases y escenarios'],
      registros: ['DTE emitidos', 'DTE recibidos'],
      mantenimientos: ['Configuración del emisor', 'Series por establecimiento'],
      procesos: ['Certificar DTE pendientes', 'Anular DTE', 'Consulta de NIT'],
      reportes: ['Libro de ventas', 'Libro de compras', 'Bitácora de integración'],
      ayuda: AYUDA,
    },
  },
  {
    id: 'nominas', nombre: 'Nóminas y planillas', icono: 'ti-users',
    opciones: {
      catalogos: ['Empleados', 'Puestos', 'Departamentos', 'Conceptos de pago'],
      registros: ['Planillas', 'Horas extra', 'Ausencias y vacaciones'],
      mantenimientos: ['Tablas IGSS e ISR', 'Bonificaciones'],
      procesos: ['Cálculo de planilla', 'Aguinaldo y Bono 14', 'Indemnizaciones'],
      reportes: ['Planilla del período', 'Recibos de pago', 'Planilla IGSS'],
      ayuda: AYUDA,
    },
  },
  {
    id: 'comercio-exterior', nombre: 'Importaciones y exportaciones', icono: 'ti-ship',
    opciones: {
      catalogos: ['Proveedores del exterior', 'Agentes aduanales', 'Incoterms', 'Aranceles'],
      registros: ['Pólizas de importación', 'Exportaciones', 'Gastos de importación'],
      mantenimientos: ['Puertos y aduanas', 'Tipos de cambio'],
      procesos: ['Liquidación de importaciones', 'Prorrateo de gastos'],
      reportes: ['Importaciones por período', 'Costo de importación por producto'],
      ayuda: AYUDA,
    },
  },
];

// Convierte "Plan de cuentas" en "plan-de-cuentas" para usarlo en la URL.
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

for (const m of MODULOS) {
  for (const g of GRUPOS) {
    m.opciones[g.id] = m.opciones[g.id].map((o) => (typeof o === 'string' ? { nombre: o } : o)).map((o) => ({ ...o, id: slug(o.nombre) }));
  }
}
