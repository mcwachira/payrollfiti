import { IsNotEmpty, IsString } from 'class-validator';

export class TwoFactorEnableDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
