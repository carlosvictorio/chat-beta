import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { SendPrivateMessageDto } from './dto/send-private-message.dto';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinGroup')
  handleJoinGroup(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`Socket ${client.id} joining room: ${data.projectId}`);
    client.join(data.projectId);
  }

  @SubscribeMessage('sendGroupMessage')
  async handleSendGroupMessage(
    @MessageBody() dto: SendGroupMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    if (!dto.projectId) {
      client.emit('error', { message: 'projectId is required' });
      return;
    }

    const savedMessage = await this.chatService.saveGroupMessage(dto);

    this.server.to(dto.projectId.toString()).emit('newMessage', {
      id: savedMessage.id,
      content: savedMessage.content,
      senderUserId: savedMessage.sender_user_id,
      createdAt: savedMessage.created_at,
    });
  }

  @SubscribeMessage('sendPrivateMessage')
  async handlePrivateMessage(
    @MessageBody() dto: SendPrivateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // Salvar no banco de dados
    const savedMessage = await this.chatService.savePrivateMessage(dto);

    // Nome da sala privada
    const room = this.getPrivateRoomName(
      Number(dto.senderUserId),
      Number(dto.receiverUserId),
    );

    // Emitir para ambos os usuários na sala
    this.server.to(room).emit('newPrivateMessage', {
      id: savedMessage.id,
      content: savedMessage.content,
      senderUserId: savedMessage.sender_user_id,
      receiverUserId: savedMessage.receiver_user_id,
      createdAt: savedMessage.created_at,
    });
  }

  @SubscribeMessage('registerPrivateRooms')
  handleRegisterPrivateRooms(
    @MessageBody() data: { UserId: number; privateChatUserIds: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    data.privateChatUserIds.map((otherUserId) => {
      const roomName = this.getPrivateRoomName(data.UserId, otherUserId);
      client.join(roomName);
    });
  }

  @SubscribeMessage('getConversations')
  async handleGetConversations(
    @MessageBody() data: { userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Buscar as conversas do usuário no serviço
      const conversations = await this.chatService.getUserConversations(
        `${data.userId}`,
      );

      // Enviar as conversas de volta para o cliente que solicitou
      client.emit('conversationsList', {
        status: 'success',
        data: conversations,
      });
    } catch (error) {
      client.emit('error', {
        status: 'error',
        message: 'Failed to fetch conversations',
      });
      console.error('Error fetching conversations:', error);
    }
  }

  private getPrivateRoomName(userId1: number, userId2: number): string {
    const sorted = [userId1, userId2].sort((a, b) => a - b);
    return `private_${sorted[0]}_${sorted[1]}`;
  }
}
