import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatContoller } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [ChatContoller],
  providers: [ChatGateway, ChatService],
  exports: [ChatGateway, ChatService],
  imports: [AuthModule],
})
export class ChatModule {}
