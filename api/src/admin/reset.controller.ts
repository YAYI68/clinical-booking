import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { RateLimiterService } from '../bookings/rate-limiter.service';
import { ErrorDto } from '../common/error.dto';
import { ResetDto } from '../slots/slot.dto';
import { SlotsService } from '../slots/slots.service';

@ApiTags('Admin')
@ApiSecurity('apiKey')
@ApiResponse({ status: 401, description: 'Missing or wrong X-API-Key', type: ErrorDto })
@Controller('reset')
export class ResetController {
  constructor(
    private readonly slots: SlotsService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: '⚠️ Admin · Replace all slots (destructive)',
    description: [
      '**⚠️ Deletes every booking.** Admin and testing only. Not for patients, and not reachable through the web app.',
      'Replaces all slots with the ones you send, including slots in the past. It also clears saved idempotency keys and rate-limit counters. (Spec level 1.)',
    ].join('\n\n'),
  })
  @ApiBody({ type: ResetDto })
  @ApiOkResponse({ description: 'Done', schema: { example: { ok: true, slots: 3 } } })
  @ApiResponse({ status: 400, description: 'Invalid slots payload', type: ErrorDto })
  reset(@Body() body: unknown) {
    const slots = this.slots.parseResetBody(body);
    this.slots.replaceAll(slots);
    this.rateLimiter.clear();
    return { ok: true, slots: slots.length };
  }
}
