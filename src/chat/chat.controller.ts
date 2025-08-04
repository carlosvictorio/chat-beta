import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatContoller {
  constructor(private readonly chatService: ChatService) {}

  @Get('user-projects/:id')
  async getProjectsByUser(@Param('id') id: string) {
    return await this.chatService.getProjectByUser(id);
  }

  @Get('user-contacts/:id')
  async getContactsByUserId(@Param('id') id: string) {
    return await this.chatService.getContactsByUser(id);
  }

  @Get('messages/private')
  async getPrivateMessages(
    @Query('user1') user1: string,
    @Query('user2') user2: string,
  ) {
    const messages = await this.chatService.getPrivateMessages(
      Number(user1),
      Number(user2),
    );
    if (messages.length === 0) return 'Sem mensagens';

    return messages;
  }

  @Get('messages/group')
  async getGroupMessage(@Query('projectid') projectid: string) {
    const messages = await this.chatService.getGroupMessages(Number(projectid));
    if (messages.length === 0) return 'Sem mensagens';

    return messages;
  }
}
