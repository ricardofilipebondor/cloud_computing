import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceProductDto } from './invoice-product.dto';

export class CreateInvoiceDto {
  @IsString()
  @MinLength(3)
  clientId!: string;

  @IsString()
  @MinLength(3)
  invoiceNumber!: string;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsIn(['RON', 'USD', 'EUR', 'GBP'])
  currency!: 'RON' | 'USD' | 'EUR' | 'GBP';

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsIn(['draft', 'sent', 'paid', 'overdue'])
  status!: 'draft' | 'sent' | 'paid' | 'overdue';

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceProductDto)
  products!: InvoiceProductDto[];
}
