import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateClientDto {
  @IsIn(['individual', 'company'])
  clientType!: 'individual' | 'company';

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(7)
  phone!: string;

  @IsString()
  @MinLength(3)
  taxIdentifier!: string;

  @IsString()
  @MinLength(5)
  address!: string;
}
