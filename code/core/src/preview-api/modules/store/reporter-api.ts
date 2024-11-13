export interface Report {
  id: string;
  version: number;
  result: unknown;
  status: 'failed' | 'passed' | 'warning';
}

export class ReporterAPI {
  reports: Report[] = [];

  async addReport(report: Report) {
    this.reports.push(report);
  }
}
