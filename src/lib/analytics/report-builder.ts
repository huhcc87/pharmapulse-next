// Advanced Analytics & Report Builder
// Custom report builder with drag-and-drop functionality

export interface ReportField {
  id: string;
  name: string;
  type: 'metric' | 'dimension' | 'date' | 'filter';
  dataType: 'number' | 'string' | 'date' | 'boolean';
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  format?: string;
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'between';
  value: any;
}

export interface ReportConfig {
  id?: string;
  name: string;
  description?: string;
  fields: ReportField[];
  filters: ReportFilter[];
  groupBy?: string[];
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  dateRange?: {
    from: Date;
    to: Date;
  };
  format: 'table' | 'chart' | 'both';
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
}

export interface ReportResult {
  data: any[];
  summary?: {
    total?: number;
    average?: number;
    count?: number;
  };
  chartData?: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
    }>;
  };
}

/**
 * Build custom report based on configuration
 */
export async function buildCustomReport(
  config: ReportConfig,
  tenantId: number = 1
): Promise<ReportResult> {
  // This would integrate with your database queries
  // For now, return mock structure
  
  const result: ReportResult = {
    data: [],
    summary: {},
  };

  // Build query based on config
  const query = buildQuery(config);
  
  // Execute query (would use Prisma)
  // const data = await executeQuery(query, tenantId);
  
  // Format results
  if (config.format === 'chart' || config.format === 'both') {
    result.chartData = formatChartData(result.data, config);
  }

  return result;
}

/**
 * Build SQL-like query from report config
 */
function buildQuery(config: ReportConfig): any {
  // Convert report config to query structure
  return {
    select: config.fields.map((f) => ({
      field: f.id,
      aggregation: f.aggregation,
    })),
    where: config.filters.map((f) => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
    })),
    groupBy: config.groupBy,
    orderBy: config.orderBy,
    dateRange: config.dateRange,
  };
}

/**
 * Format data for charts
 */
function formatChartData(data: any[], config: ReportConfig): ReportResult['chartData'] {
  if (!config.chartType || data.length === 0) {
    return undefined;
  }

  // Extract labels and data based on chart type
  const labels: string[] = [];
  const datasets: Array<{ label: string; data: number[]; backgroundColor?: string }> = [];

  // Group data for chart
  if (config.groupBy && config.groupBy.length > 0) {
    const grouped = groupData(data, config.groupBy[0]);
    labels.push(...Object.keys(grouped));
    
    const metricField = config.fields.find((f) => f.type === 'metric');
    if (metricField) {
      datasets.push({
        label: metricField.name,
        data: Object.values(grouped).map((group: any) => {
          return group.reduce((sum: number, item: any) => {
            return sum + (item[metricField.id] || 0);
          }, 0);
        }) as number[],
      });
    }
  }

  return {
    labels,
    datasets,
  };
}

/**
 * Group data by field
 */
function groupData(data: any[], field: string): Record<string, any[]> {
  return data.reduce((acc, item) => {
    const key = item[field] || 'Unknown';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, any[]>);
}

/**
 * Get available report fields
 */
export function getAvailableFields(): ReportField[] {
  return [
    // Metrics
    { id: 'revenue', name: 'Revenue', type: 'metric', dataType: 'number', aggregation: 'sum', format: 'currency' },
    { id: 'sales_count', name: 'Sales Count', type: 'metric', dataType: 'number', aggregation: 'count' },
    { id: 'avg_order_value', name: 'Average Order Value', type: 'metric', dataType: 'number', aggregation: 'avg', format: 'currency' },
    { id: 'profit', name: 'Profit', type: 'metric', dataType: 'number', aggregation: 'sum', format: 'currency' },
    { id: 'quantity_sold', name: 'Quantity Sold', type: 'metric', dataType: 'number', aggregation: 'sum' },
    
    // Dimensions
    { id: 'product_name', name: 'Product Name', type: 'dimension', dataType: 'string' },
    { id: 'category', name: 'Category', type: 'dimension', dataType: 'string' },
    { id: 'customer_name', name: 'Customer Name', type: 'dimension', dataType: 'string' },
    { id: 'payment_method', name: 'Payment Method', type: 'dimension', dataType: 'string' },
    { id: 'branch', name: 'Branch', type: 'dimension', dataType: 'string' },
    
    // Date
    { id: 'date', name: 'Date', type: 'date', dataType: 'date' },
    { id: 'month', name: 'Month', type: 'date', dataType: 'date' },
    { id: 'year', name: 'Year', type: 'date', dataType: 'date' },
  ];
}

/**
 * Get predefined report templates
 */
export function getReportTemplates(): ReportConfig[] {
  return [
    {
      name: 'Sales by Product',
      description: 'Revenue and quantity sold by product',
      fields: [
        { id: 'product_name', name: 'Product', type: 'dimension', dataType: 'string' },
        { id: 'revenue', name: 'Revenue', type: 'metric', dataType: 'number', aggregation: 'sum', format: 'currency' },
        { id: 'quantity_sold', name: 'Quantity', type: 'metric', dataType: 'number', aggregation: 'sum' },
      ],
      filters: [],
      groupBy: ['product_name'],
      format: 'both',
      chartType: 'bar',
    },
    {
      name: 'Sales Trend',
      description: 'Revenue trend over time',
      fields: [
        { id: 'date', name: 'Date', type: 'date', dataType: 'date' },
        { id: 'revenue', name: 'Revenue', type: 'metric', dataType: 'number', aggregation: 'sum', format: 'currency' },
      ],
      filters: [],
      groupBy: ['date'],
      orderBy: [{ field: 'date', direction: 'asc' }],
      format: 'both',
      chartType: 'line',
    },
    {
      name: 'Customer Analytics',
      description: 'Customer purchase behavior',
      fields: [
        { id: 'customer_name', name: 'Customer', type: 'dimension', dataType: 'string' },
        { id: 'sales_count', name: 'Orders', type: 'metric', dataType: 'number', aggregation: 'count' },
        { id: 'revenue', name: 'Total Revenue', type: 'metric', dataType: 'number', aggregation: 'sum', format: 'currency' },
        { id: 'avg_order_value', name: 'Avg Order Value', type: 'metric', dataType: 'number', aggregation: 'avg', format: 'currency' },
      ],
      filters: [],
      groupBy: ['customer_name'],
      orderBy: [{ field: 'revenue', direction: 'desc' }],
      format: 'table',
    },
  ];
}
