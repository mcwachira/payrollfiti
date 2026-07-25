import { Matches } from 'class-validator';

export class PeriodQueryDto {
  /** e.g. "2026-07" */
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;
}
