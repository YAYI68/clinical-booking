import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ErrorDto } from '../common/error.dto';
import { send } from '../common/send';
import { BookingDto, BookingPageDto, NewBookingDto } from './booking.dto';
import { BookingsService } from './bookings.service';

@ApiTags('Bookings')
@ApiSecurity('apiKey')
@ApiResponse({ status: 401, description: 'Missing or wrong X-API-Key', type: ErrorDto })
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Book a slot (levels 1–5)',
    description: [
      '**Level 1:** returns 201 with the booking, status `confirmed`.',
      '**Level 2:** **400** if `slot_id`, `name` or `email` is missing or empty, or the email isn\'t valid. **404** if the slot doesn\'t exist. **400** if the slot has already started. `name` and `email` are trimmed and `email` is stored in lower case.',
      '**Level 3:** a slot that already has a confirmed booking returns **409**, even when many requests arrive at the same moment.',
      '**Level 4:** optional `Idempotency-Key` header. Sending the same key and body again gets back the same status and booking `id`. A key reused with a different body returns **422**.',
      '**Level 5:** at most 5 attempts per email per minute, failed attempts included. The 6th returns **429** with a `Retry-After` header in whole seconds.',
    ].join('\n\n'),
  })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Level 4: makes retries safe' })
  @ApiBody({ type: NewBookingDto })
  @ApiResponse({ status: 201, description: 'Booked', type: BookingDto })
  @ApiResponse({ status: 400, description: 'Missing or invalid field, or the slot has already started', type: ErrorDto })
  @ApiResponse({ status: 404, description: "The slot doesn't exist", type: ErrorDto })
  @ApiResponse({ status: 409, description: 'Slot already booked', type: ErrorDto })
  @ApiResponse({ status: 422, description: 'Idempotency-Key reused with a different body', type: ErrorDto })
  @ApiResponse({
    status: 429,
    description: 'Too many attempts for this email',
    type: ErrorDto,
    headers: { 'Retry-After': { description: 'Seconds to wait', schema: { type: 'integer' } } },
  })
  create(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(res, this.bookings.create(body, idempotencyKey));
  }

  @Get()
  @ApiOperation({
    summary: "Level 4 · List a person's bookings",
    description:
      "That person's bookings, oldest first. The email match ignores case. Pass `next_cursor` back as `cursor` to get the next page; the last page has `next_cursor: null`.",
  })
  @ApiQuery({ name: 'email', required: true })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiResponse({ status: 200, description: 'A page of bookings', type: BookingPageDto })
  @ApiResponse({ status: 400, description: 'Missing email, invalid limit or invalid cursor', type: ErrorDto })
  list(
    @Query('email') email: unknown,
    @Query('limit') limit: unknown,
    @Query('cursor') cursor: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(res, this.bookings.listByEmail(email, limit, cursor));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Level 1 · Get a booking' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'The booking', type: BookingDto })
  @ApiResponse({ status: 404, description: 'No booking with that id', type: ErrorDto })
  get(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    return send(res, this.bookings.get(id));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Level 3 · Cancel a booking', description: 'Sets `status` to `cancelled` and frees the slot.' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'The cancelled booking', type: BookingDto })
  @ApiResponse({ status: 404, description: 'No booking with that id', type: ErrorDto })
  @ApiResponse({ status: 409, description: 'Already cancelled', type: ErrorDto })
  cancel(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    return send(res, this.bookings.cancel(id));
  }
}
