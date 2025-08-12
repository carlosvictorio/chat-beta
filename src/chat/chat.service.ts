import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ProjectDto } from './dto/project.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { SendPrivateMessageDto } from './dto/send-private-message.dto';
import { ConversationsDTO } from './dto/conversations.dto';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async getProjectByUser(userId: string) {
    const idBigInt = BigInt(userId);

    const projectByUser = await this.prisma.member_project.findMany({
      where: { id_user: idBigInt },
      include: { project: true },
    });

    const projects = projectByUser.map(
      (p): ProjectDto => ({
        id: p.project.id,
        name: p.project.name_project,
        senderUserId: p.id_user,
      }),
    );

    return projects;
  }

  async getContactsByUser(userId: string) {
    const projects = this.getProjectByUser(userId);
    const projectsId = (await projects).map((p) => p.id);

    const idBigInt = BigInt(userId);

    //Pega todos os membros desses projetos (menos o próprio usuário)
    const sharedMembers = await this.prisma.member_project.findMany({
      where: {
        id_project: { in: projectsId },
        NOT: { id_user: idBigInt },
      },
      include: {
        users: true, // traz dados do usuário
      },
    });

    // Elimina duplicatas por `id_user`
    const uniqueUsersMap = new Map<
      number,
      (typeof sharedMembers)[0]['users']
    >();

    for (const member of sharedMembers) {
      if (!uniqueUsersMap.has(Number(member.id_user))) {
        uniqueUsersMap.set(Number(member.id_user), member.users);
      }
    }

    const arrayContactUnique = Array.from(uniqueUsersMap.values());
    const arrayContactUniqueWithoutBigInt = arrayContactUnique.map((a) => ({
      ...a,
      id: Number(a.id),
    }));

    // Retorna os contatos
    return arrayContactUniqueWithoutBigInt;
  }

  async saveGroupMessage(dto: SendGroupMessageDto) {
    const create = await this.prisma.message.create({
      data: {
        content: dto.content,
        sender_user_id: dto.senderUserId,
        id_project: dto.projectId,
      },
      select: {
        id: true,
        content: true,
        sender_user_id: true,
        created_at: true,
      },
    });

    await this.chatGateway.emitConversationsList(create.id);

    return create;
  }

  async savePrivateMessage(dto: SendPrivateMessageDto) {
    //console.log('💡 DTO recebido em savePrivateMessage:', dto);
    return await this.prisma.message.create({
      data: {
        content: dto.content,
        sender_user_id: dto.senderUserId,
        receiver_user_id: dto.receiverUserId,
      },
    });
  }

  async getPrivateMessages(userId1: number, userId2: number) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          {
            sender_user_id: BigInt(userId1),
            receiver_user_id: BigInt(userId2),
          },
          {
            sender_user_id: BigInt(userId2),
            receiver_user_id: BigInt(userId1),
          },
        ],
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    return messages
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .map((m) => ({
        ...m,
        id: m.id,
        idProject: m.id_project,
        senderUserId: m.sender_user_id,
        receiverUserId: m.receiver_user_id,
      }));
  }

  async getGroupMessages(projectId: number) {
    const messages = await this.prisma.message.findMany({
      where: {
        id_project: projectId,
      },
      orderBy: {
        created_at: 'asc',
      },
      select: {
        id: true,
        content: true,
        created_at: true,
        sender_user_id: true,
      },
    });

    return messages
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .map((m) => ({
        ...m,
        id: m.id,
        senderUserId: m.sender_user_id,
        createdAt: m.created_at,
      }));
  }

  async getUserByMember(memberId: bigint | null) {
    if (!memberId) return;
    const member = await this.prisma.member_project.findFirstOrThrow({
      where: {
        id: Number(memberId),
      },
      include: {
        users: true,
      },
    });
    return member?.users;
  }

  async getUserConversations(userId: string) {
    const idBigInt = BigInt(userId);

    const projects = await this.prisma.member_project.findMany({
      where: { id_user: idBigInt },
      include: { project: true },
    });

    const users = await this.getContactsByUser(userId);

    const projectConversations: ConversationsDTO[] = await Promise.all(
      projects.map(async (project) => {
        const groupMessages = await this.getGroupMessages(
          Number(project.project.id),
        );
        const lastGroupMessage = groupMessages[groupMessages.length - 1];

        /*const user = await this.getUserByMember(
          lastGroupMessage?.sender_member_project_id,
        );*/

        const user = await this.prisma.users.findFirstOrThrow({
          where: {
            id: lastGroupMessage?.sender_user_id ?? undefined,
          },
        });

        return {
          isGroup: true,
          idUserOrProject: project.project.id,
          lastMessage: lastGroupMessage?.content,
          lastMessageDate: lastGroupMessage?.created_at,
          lastMessageIdUser: user?.id ?? null,
          name: project.project.name_project,
          photoUrl: null,
        };
      }),
    );

    const privateConversations: ConversationsDTO[] = await Promise.all(
      users.map(async (user) => {
        const privateMessages = await this.getPrivateMessages(
          Number(userId),
          user.id,
        );
        const lastPrivateMessages = privateMessages[privateMessages.length - 1];

        return {
          isGroup: false,
          idUserOrProject: BigInt(user.id),
          lastMessage: lastPrivateMessages?.content,
          lastMessageDate: lastPrivateMessages?.created_at,
          lastMessageIdUser: lastPrivateMessages?.sender_user_id,
          name: user.name_user,
          photoUrl: user.photo_user,
        };
      }),
    );

    const allConversations: ConversationsDTO[] = [
      ...projectConversations,
      ...privateConversations,
    ];

    return allConversations.sort((a, b) => {
      const dateA = a.lastMessageDate
        ? new Date(a.lastMessageDate).getTime()
        : 0;
      const dateB = b.lastMessageDate
        ? new Date(b.lastMessageDate).getTime()
        : 0;
      return dateB - dateA;
    });
  }

  async getConversationByMessageGroup(messageId: bigint) {
    const message = await this.prisma.message.findFirstOrThrow({
      where: {
        id: messageId,
      },
    });

    let name: string = '';
    let photo: string | null = null;
    if (!!message.id_project) {
      const project = await this.prisma.project.findFirstOrThrow({
        where: {
          id: message.id_project,
        },
      });

      name = project.name_project;
    }

    return {
      isGroup: !!message.id_project,
      idUserOrProject: message.id_project!,
      lastMessage: message?.content,
      lastMessageDate: message?.created_at,
      lastMessageIdUser: message?.sender_user_id,
      name: name,
      photoUrl: photo,
    };
  }
}
