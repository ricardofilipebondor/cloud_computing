import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  async createClient(@Body() dto: CreateClientDto) {
    return this.clientsService.createClient(dto);
  }

  @Get()
  async getClients() {
    return this.clientsService.getClients();
  }

  @Get(':id')
  async getClientById(@Param('id') id: string) {
    return this.clientsService.getClientById(id);
  }

  @Put(':id')
  async updateClient(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.updateClient(id, dto);
  }

  @Delete(':id')
  async deleteClient(@Param('id') id: string) {
    return this.clientsService.deleteClient(id);
  }
}
