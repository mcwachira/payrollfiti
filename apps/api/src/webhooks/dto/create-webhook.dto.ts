import { ArrayMinSize, IsArray, IsIn, IsUrl } from 'class-validator';

/** Event catalogue this pass supports dispatching. */
export const WEBHOOK_EVENTS = [
  'payroll.run.completed',
  'invoice.paid',
] as const;

export class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: string[];
}
