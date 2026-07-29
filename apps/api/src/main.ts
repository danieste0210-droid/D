import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('CloverApp Panamá API')
    .setDescription('API de administración de ventas de lotería/chance')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  // Bind explícito a 0.0.0.0: en Windows, listen(port) sin host puede quedar solo en loopback,
  // inalcanzable desde otros dispositivos de la red (ej. el celular probando con Expo Go).
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`CloverApp API escuchando en http://localhost:${port} (docs en /docs)`);
}

bootstrap();
