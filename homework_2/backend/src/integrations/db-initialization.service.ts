import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HomeworkDbService } from './homework-db.service';

@Injectable()
export class DbInitializationService implements OnModuleInit {
  private readonly logger = new Logger(DbInitializationService.name);

  constructor(private readonly homeworkDbService: HomeworkDbService) {}

  async onModuleInit(): Promise<void> {
    // Keep Homework 1 schema aligned with CRM domain.
    const clientsExists = await this.homeworkDbService.tableExists('clients');
    if (!clientsExists) {
      await this.homeworkDbService.createClientsTable();
      this.logger.log("Table 'clients' was created automatically");
    } else {
      await this.homeworkDbService.updateClientsTable();
      this.logger.log("Table 'clients' schema was synchronized");
    }

    const invoicesExists = await this.homeworkDbService.tableExists('invoices');
    if (!invoicesExists) {
      await this.homeworkDbService.createInvoicesTable();
      this.logger.log("Table 'invoices' was created automatically");
    } else {
      await this.homeworkDbService.updateInvoicesTable();
      this.logger.log("Table 'invoices' schema was synchronized");
    }
  }
}
