import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatContoller } from './chat.controller';
import { ChatGateway } from './chat.gateway';

@Module({
  controllers: [ChatContoller],
  providers: [ChatGateway, ChatService],
  exports: [ChatGateway, ChatService],
})
export class ChatModule {}
