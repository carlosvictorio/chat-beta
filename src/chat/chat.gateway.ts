import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { SendPrivateMessageDto } from './dto/send-private-message.dto';
import { ChatService } from './chat.service';
import { ConversationsDTO } from './dto/conversations.dto';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { users } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class ChatGateway {
  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) {}

  private userLogged: users;

  getUserLogged() {
    return this.userLogged;
  }

  setUserLogged(value: users) {
    this.userLogged = value;
  }

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.authService.validateToken(token);
      this.setUserLogged(payload.user!);
      const userId = payload.user!.id; // ou payload.id, depende do seu JWT

      (client as any).userId = userId;

      console.log(`✅ Usuário ${userId} conectado (socket ${client.id})`);

      // 👉 Ao conectar, o usuário já entra em todos os grupos e privados
      const projectsByUser = await this.chatService.getProjectByUser(
        userId.toString(),
      );
      projectsByUser.forEach((p) => {
        client.join(p.id.toString());
      });

      const contactsByUser = await this.chatService.getContactsByUser(
        userId.toString(),
      );
      contactsByUser.forEach((c) => {
        client.join(this.getPrivateRoomName(Number(userId), c.id));
      });
    } catch (e) {
      console.error('❌ Erro na conexão do socket:', e.message);
      client.disconnect(true);
    }
  }

  async emitConversationsList(created: any, isGroup: boolean) {
    const conversation: ConversationsDTO | ConversationsDTO[] = await (isGroup
      ? this.chatService.getConversationByMessageGroup(created.idMessage)
      : this.chatService.getConversationByMessagePrivate(created.idMessage));

    created.listEmitsIds.map((idEmit: bigint) =>
      this.server.emit(`conversationsList_${idEmit}`, {
        status: 'success-update',
        data: isGroup
          ? conversation
          : (conversation as ConversationsDTO[]).find(
              (conversation) => conversation.idUserOrProject != idEmit,
            ),
      }),
    );
  }

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
      senderUserName: savedMessage.senderUserName,
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
      senderUserName: savedMessage.senderUserName,
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
      client.emit(`conversationsList_${this.getUserLogged().id}`, {
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
