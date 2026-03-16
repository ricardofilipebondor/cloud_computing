import { IsIn, IsNumber, IsPositive, IsString, Max, Min, MinLength } from 'class-validator';

export class InvoiceProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  vatPercent!: number;

  @IsIn(['RON', 'USD', 'EUR', 'GBP'])
  currency!: 'RON' | 'USD' | 'EUR' | 'GBP';
}
