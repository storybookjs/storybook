export interface Report<T = unknown> {
  type: string;
  version?: number;
  result: T;
  status: 'failed' | 'passed' | 'warning';
}

export class ReporterAPI {
  reports: Report[] = [];

  async addReport(report: Report): Promise<void> {
    this.reports.push(report);
  }
}
