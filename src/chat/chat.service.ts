import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ProjectDto } from './dto/project.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { SendPrivateMessageDto } from './dto/send-private-message.dto';
import { ConversationsDTO } from './dto/conversations.dto';
import { ChatGateway } from './chat.gateway';
import { users } from '@prisma/client';

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

    const senderUser = await this.prisma.users.findFirstOrThrow({
      where: {
        id: BigInt(dto.senderUserId),
      },
    });

    await this.emitConversationsList(create.id, true);

    return { ...create, senderUserName: senderUser.name_user };
  }

  async savePrivateMessage(dto: SendPrivateMessageDto) {
    const create = await this.prisma.message.create({
      data: {
        content: dto.content,
        sender_user_id: dto.senderUserId,
        receiver_user_id: dto.receiverUserId,
      },
      select: {
        id: true,
        content: true,
        sender_user_id: true,
        receiver_user_id: true,
        created_at: true,
      },
    });

    const senderUser = await this.prisma.users.findFirstOrThrow({
      where: {
        id: BigInt(dto.senderUserId),
      },
    });

    await this.emitConversationsList(create.id, false);

    return { ...create, senderUserName: senderUser.name_user };
  }

  async emitConversationsList(idCreated: bigint, isGroup: boolean) {
    const message = await this.prisma.message.findFirstOrThrow({
      where: {
        id: idCreated,
      },
    });

    let valueReturn: any;
    if (isGroup) {
      const members = await this.prisma.member_project.findMany({
        where: {
          id_project: BigInt(message.id_project!),
        },
      });
      const listEmitsIds = members.map((member) => member.id_user);
      valueReturn = {
        listEmitsIds: listEmitsIds,
        idMessage: idCreated,
      };
    } else {
      const listEmitsIds = [message.receiver_user_id, message.sender_user_id];
      valueReturn = {
        listEmitsIds: listEmitsIds,
        idMessage: idCreated,
      };
    }
    await this.chatGateway.emitConversationsList(valueReturn, isGroup);
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

    return await Promise.all(
      messages
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        .map(async (m) => {
          const senderUser = await this.prisma.users.findFirstOrThrow({
            where: {
              id: m.sender_user_id,
            },
          });
          return {
            ...m,
            id: m.id,
            idProject: m.id_project,
            senderUserId: m.sender_user_id,
            receiverUserId: m.receiver_user_id,
            senderUserName: senderUser.name_user,
          };
        }),
    );
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

    return await Promise.all(
      messages
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        .map(async (m) => {
          const senderUser = await this.prisma.users.findFirstOrThrow({
            where: {
              id: m.sender_user_id,
            },
          });

          return {
            ...m,
            id: m.id,
            senderUserId: m.sender_user_id,
            createdAt: m.created_at,
            senderUserName: senderUser.name_user,
          };
        }),
    );
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
          lastMessageNameUser: lastGroupMessage?.sender_user_id
            ? user?.name_user
            : null,
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

        const senderUser = await this.prisma.users.findFirstOrThrow({
          where: {
            id: lastPrivateMessages?.sender_user_id,
          },
        });
        return {
          isGroup: false,
          idUserOrProject: BigInt(user.id),
          lastMessage: lastPrivateMessages?.content,
          lastMessageDate: lastPrivateMessages?.created_at,
          lastMessageIdUser: lastPrivateMessages?.sender_user_id,
          lastMessageNameUser: lastPrivateMessages?.sender_user_id
            ? senderUser.name_user
            : '',
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
    const senderUser = await this.prisma.users.findFirstOrThrow({
      where: {
        id: BigInt(message.sender_user_id),
      },
    });

    return {
      isGroup: !!message.id_project,
      idUserOrProject: message.id_project!,
      lastMessage: message?.content,
      lastMessageDate: message?.created_at,
      lastMessageIdUser: message?.sender_user_id,
      lastMessageNameUser: senderUser.name_user,
      name: name,
      photoUrl: photo,
    };
  }

  async getConversationByMessagePrivate(messageId: bigint) {
    const message = await this.prisma.message.findFirstOrThrow({
      where: {
        id: messageId,
      },
    });

    const senderUser = await this.prisma.users.findFirstOrThrow({
      where: {
        id: BigInt(message.sender_user_id),
      },
    });
    const receiverUser = await this.prisma.users.findFirstOrThrow({
      where: {
        id: BigInt(message.receiver_user_id!),
      },
    });

    return [
      {
        isGroup: false,
        idUserOrProject: receiverUser.id,
        lastMessage: message?.content,
        lastMessageDate: message?.created_at,
        lastMessageIdUser: message?.sender_user_id,
        lastMessageNameUser: senderUser.name_user,
        name: receiverUser.name_user,
        photoUrl: receiverUser.photo_user,
      },
      {
        isGroup: false,
        idUserOrProject: senderUser.id,
        lastMessage: message?.content,
        lastMessageDate: message?.created_at,
        lastMessageIdUser: message?.sender_user_id,
        lastMessageNameUser: senderUser.name_user,
        name: senderUser.name_user,
        photoUrl: senderUser.photo_user,
      },
    ];
  }
}
