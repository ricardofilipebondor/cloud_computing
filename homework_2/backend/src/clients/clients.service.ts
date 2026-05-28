import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExternalEmailValidationService } from '../integrations/email-validation.service';
import { HomeworkDbService } from '../integrations/homework-db.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

type ClientPayload = {
  client_type: 'individual' | 'company';
  name: string;
  email: string;
  phone: string;
  tax_identifier: string;
  address: string;
};

@Injectable()
export class ClientsService {
  constructor(
    private readonly homeworkDbService: HomeworkDbService,
    private readonly emailValidationService: ExternalEmailValidationService,
  ) {}

  private ensureClientExists<T>(client: T | null, clientId: string): T {
    if (!client) {
      throw new NotFoundException(`Client '${clientId}' not found`);
    }
    return client;
  }

  private async validateEmailOrThrow(email: string): Promise<void> {
    const emailValidation = await this.emailValidationService.validateEmail(email);
    if (!emailValidation.isValid) {
      throw new BadRequestException({
        message: 'Email validation failed',
        email,
        providerResponse: emailValidation.raw,
      });
    }
  }

  private toClientPayload(
    dto: CreateClientDto | UpdateClientDto,
    fallback?: ClientPayload,
  ): ClientPayload {
    return {
      client_type: dto.clientType ?? fallback?.client_type ?? 'individual',
      name: dto.name ?? fallback?.name ?? '',
      email: dto.email ?? fallback?.email ?? '',
      phone: dto.phone ?? fallback?.phone ?? '',
      tax_identifier: dto.taxIdentifier ?? fallback?.tax_identifier ?? '',
      address: dto.address ?? fallback?.address ?? '',
    };
  }

  async createClient(dto: CreateClientDto) {
    await this.validateEmailOrThrow(dto.email);
    const payload = this.toClientPayload(dto);

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
    const client = this.ensureClientExists(
      await this.homeworkDbService.getClientById(clientId),
      clientId,
    );
    return {
      status: 'ok',
      data: client,
    };
  }

  async updateClient(clientId: string, dto: UpdateClientDto) {
    const existingClient = this.ensureClientExists(
      await this.homeworkDbService.getClientById(clientId),
      clientId,
    );
    const nextClient = this.toClientPayload(dto, existingClient);

    if (dto.email && dto.email !== existingClient.email) {
      await this.validateEmailOrThrow(dto.email);
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
    this.ensureClientExists(await this.homeworkDbService.getClientById(clientId), clientId);

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
