import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExternalEmailValidationService } from '../integrations/email-validation.service';
import { HomeworkDbService } from '../integrations/homework-db.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly homeworkDbService: HomeworkDbService,
    private readonly emailValidationService: ExternalEmailValidationService,
  ) {}

  async createClient(dto: CreateClientDto) {
    const emailValidation = await this.emailValidationService.validateEmail(dto.email);
    if (!emailValidation.isValid) {
      throw new BadRequestException({
        message: 'Email validation failed',
        email: dto.email,
        providerResponse: emailValidation.raw,
      });
    }

    const payload = {
      client_type: dto.clientType,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      tax_identifier: dto.taxIdentifier,
      address: dto.address,
    };

    const created = await this.homeworkDbService.insertClient(payload);
    return {
      status: 'ok',
      message: 'Client created successfully',
      data: {
        id: created.rowId,
        ...payload,
        email_validation_status: 'valid',
      },
    };
  }

  async getClients() {
    const clients = await this.homeworkDbService.getClientRows();
    return {
      status: 'ok',
      count: clients.length,
      data: clients,
    };
  }

  async getClientById(clientId: string) {
    const client = await this.homeworkDbService.getClientById(clientId);
    if (!client) {
      throw new NotFoundException(`Client '${clientId}' not found`);
    }
    return {
      status: 'ok',
      data: client,
    };
  }

  async updateClient(clientId: string, dto: UpdateClientDto) {
    const existingClient = await this.homeworkDbService.getClientById(clientId);
    if (!existingClient) {
      throw new NotFoundException(`Client '${clientId}' not found`);
    }

    const nextClient = {
      client_type: dto.clientType ?? existingClient.client_type,
      name: dto.name ?? existingClient.name,
      email: dto.email ?? existingClient.email,
      phone: dto.phone ?? existingClient.phone,
      tax_identifier: dto.taxIdentifier ?? existingClient.tax_identifier,
      address: dto.address ?? existingClient.address,
    };

    if (dto.email && dto.email !== existingClient.email) {
      const emailValidation = await this.emailValidationService.validateEmail(dto.email);
      if (!emailValidation.isValid) {
        throw new BadRequestException({
          message: 'Email validation failed',
          email: dto.email,
          providerResponse: emailValidation.raw,
        });
      }
    }

    await this.homeworkDbService.updateClient(clientId, nextClient);
    return {
      status: 'ok',
      message: 'Client updated successfully',
      data: {
        id: clientId,
        ...nextClient,
      },
    };
  }

  async deleteClient(clientId: string) {
    const existingClient = await this.homeworkDbService.getClientById(clientId);
    if (!existingClient) {
      throw new NotFoundException(`Client '${clientId}' not found`);
    }

    const hasInvoices = await this.homeworkDbService.hasInvoicesForClient(clientId);
    if (hasInvoices) {
      throw new BadRequestException(
        `Client '${clientId}' has invoices. Delete invoices first, then delete client.`,
      );
    }

    await this.homeworkDbService.deleteClient(clientId);
    return {
      status: 'ok',
      message: 'Client deleted successfully',
    };
  }
}
