import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './app.factory';
import { APP_CONFIG, AppConfig } from './config';

async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();
  const { port } = app.get<AppConfig>(APP_CONFIG);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on :${port} — docs at /docs`, 'Bootstrap');
}

bootstrap();
