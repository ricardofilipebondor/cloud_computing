import {
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceProductDto } from './invoice-product.dto';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @IsOptional()
  @IsIn(['RON', 'USD', 'EUR', 'GBP'])
  currency?: 'RON' | 'USD' | 'EUR' | 'GBP';

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(['draft', 'sent', 'paid', 'overdue'])
  status?: 'draft' | 'sent' | 'paid' | 'overdue';

  @IsOptional()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceProductDto)
  products?: InvoiceProductDto[];
}
