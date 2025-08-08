import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };

  app.enableCors({
    origin: ['http://localhost:7155', 'http://localhost:5173'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  await app.listen(3001);
}
bootstrap();
