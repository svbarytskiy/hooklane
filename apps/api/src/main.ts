import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Env } from './config/env.schema';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}
bootstrap();
