import { IsBoolean } from 'class-validator';

export class UpdateOnboardingTaskDto {
  @IsBoolean()
  completed!: boolean;
}
