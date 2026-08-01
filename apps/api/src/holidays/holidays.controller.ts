import { Controller, Get, Query } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { ListHolidaysQueryDto } from './dto/list-holidays-query.dto';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  list(@Query() query: ListHolidaysQueryDto) {
    const year = query.year ?? new Date().getUTCFullYear();
    return this.holidaysService.listForCountry(query.country, year);
  }
}
