import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatContoller } from './chat.controller';

@Module({
  controllers: [ChatContoller],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
