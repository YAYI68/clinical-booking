import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from './common/public.decorator';

@ApiExcludeController()
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok' };
  }
}
