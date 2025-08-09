import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { SendPrivateMessageDto } from './dto/send-private-message.dto';

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

  @Get('conversations/:id')
  async getUserConversationByUser(@Param('id') id: string) {
    return await this.chatService.getUserConversations(id);
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

  @Post('messages/group')
  async postGroupMessage(@Body() body: SendGroupMessageDto) {
    return await this.chatService.saveGroupMessage(body);
  }

  @Post('messages/private')
  async postPrivateMessage(@Body() body: SendPrivateMessageDto) {
    return await this.chatService.savePrivateMessage(body);
  }
}
