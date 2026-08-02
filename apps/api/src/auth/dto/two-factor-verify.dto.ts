import { IsNotEmpty, IsString } from 'class-validator';

export class TwoFactorVerifyDto {
  @IsString()
  @IsNotEmpty()
  challengeToken!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}
