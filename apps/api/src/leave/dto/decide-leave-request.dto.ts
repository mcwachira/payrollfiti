import { IsIn } from 'class-validator';

export class DecideLeaveRequestDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
}
