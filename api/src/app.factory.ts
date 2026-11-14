import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express, { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './config';

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: process.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
  });

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const config = app.get<AppConfig>(APP_CONFIG);
  app.enableCors({
    origin: config.corsOrigins,
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Idempotency-Key'],
    exposedHeaders: ['Retry-After'],
    methods: ['GET', 'POST', 'DELETE'],
  });

  // Own JSON parser so bad bodies also get the {"error"} shape.
  app.use(express.json({ limit: '100kb' }));
  app.use((err: { status?: number; type?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (!err) return next();
    const status = err.status ?? 400;
    const error = err.type === 'entity.too.large' ? 'request body is too large' : 'request body is not valid JSON';
    res.status(status).json({ error });
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Clinic Booking API')
    .setDescription(
      'Lets patients list appointment slots, book one, look it up, cancel it, and page through their bookings.\n\n' +
        'Everything is JSON. Every error response looks like `{"error": "<message>"}`.\n\n' +
        'Every request needs the `X-API-Key` header; a missing or wrong key returns **401**. ' +
        'Click **Authorize** and enter the key to try requests from this page.',
    )
    .setVersion('1.0')
    .addTag('Slots', 'Browse available appointment slots')
    .addTag('Bookings', 'Book, look up, list and cancel bookings')
    .addTag('Admin', '⚠️ Destructive operations for admins and automated tests. Not for patients.')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'apiKey')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/openapi.json',
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Clinic Booking API docs',
  });

  return app;
}
