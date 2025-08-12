import { Module } from '@nestjs/common';
import { ChatGateway } from './chat/chat.gateway';
import { ChatModule } from './chat/chat.module';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule, ChatModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
