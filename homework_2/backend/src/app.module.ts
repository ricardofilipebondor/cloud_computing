import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsController } from './clients/clients.controller';
import { ClientsService } from './clients/clients.service';
import { DbInitializationService } from './integrations/db-initialization.service';
import { ExchangeRateService } from './integrations/exchange-rate.service';
import { HomeworkDbService } from './integrations/homework-db.service';
import { ExternalEmailValidationService } from './integrations/email-validation.service';
import { InvoicesController } from './invoices/invoices.controller';
import { InvoicesService } from './invoices/invoices.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
  ],
  controllers: [ClientsController, InvoicesController],
  providers: [
    ClientsService,
    InvoicesService,
    HomeworkDbService,
    ExternalEmailValidationService,
    ExchangeRateService,
    DbInitializationService, // Startup auto-creation logic for CRM tables.
  ],
})
export class AppModule {}
