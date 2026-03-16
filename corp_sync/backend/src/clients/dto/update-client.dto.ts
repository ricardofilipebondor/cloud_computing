import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateClientDto {
  @IsOptional()
  @IsIn(['individual', 'company'])
  clientType?: 'individual' | 'company';

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  taxIdentifier?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  address?: string;
}
