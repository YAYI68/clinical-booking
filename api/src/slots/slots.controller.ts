import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiError } from '../common/api-error';
import { ErrorDto } from '../common/error.dto';
import { SlotListDto } from './slot.dto';
import { SlotsService } from './slots.service';

@ApiTags('Slots')
@ApiSecurity('apiKey')
@ApiResponse({ status: 401, description: 'Missing or wrong X-API-Key', type: ErrorDto })
@Controller('slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get()
  @ApiOperation({ summary: 'Level 1 · List slots', description: 'Every slot, earliest `start` first.' })
  @ApiQuery({ name: 'provider', required: false, description: "Only this provider's slots (exact match)" })
  @ApiOkResponse({ type: SlotListDto })
  list(@Query('provider') provider?: unknown): SlotListDto {
    if (provider !== undefined && typeof provider !== 'string') throw new ApiError(400, 'provider must be a single value');
    return { slots: this.slots.list(provider) };
  }
}
