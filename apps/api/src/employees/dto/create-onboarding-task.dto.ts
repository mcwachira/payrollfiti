import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOnboardingTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
}
