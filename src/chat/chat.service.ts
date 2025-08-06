import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ProjectDto } from './dto/project.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { SendPrivateMessageDto } from './dto/send-private-message.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectByUser(userId: string) {
    const idBigInt = BigInt(userId);

    const projectByUser = await this.prisma.member_project.findMany({
      where: { id_user: idBigInt },
      include: { project: true },
    });

    const projects = projectByUser.map(
      (p): ProjectDto => ({
        id: Number(p.project.id),
        name: p.project.name_project,
        senderMemberProjectId: Number(p.id),
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
    console.log('💡 DTO recebido em saveGroupMessage:', dto);
    return await this.prisma.message.create({
      data: {
        content: dto.content,
        sender_member_project_id: Number(dto.senderMemberProjectId),
        id_project: Number(dto.projectId),
      },
      select: {
        id: true,
        content: true,
        sender_member_project_id: true,
        created_at: true,
      },
    });
  }

  async savePrivateMessage(dto: SendPrivateMessageDto) {
    return await this.prisma.message.create({
      data: {
        content: dto.content,
        sender_user_id: Number(dto.sender_user_id),
        receiver_user_id: Number(dto.receiver_user_id),
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

    return messages.map((m) => ({
      ...m,
      id: Number(m.id),
      sender_member_project_id: Number(m.sender_member_project_id),
      receiver_member_project_id: Number(m.receiver_member_project_id),
      id_project: Number(m.id_project),
      sender_user_id: Number(m.sender_user_id),
      receiver_user_id: Number(m.receiver_user_id),
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
        sender_member_project_id: true,
      },
    });

    return messages.map((m) => ({
      ...m,
      id: Number(m.id),
      sender_member_project_id: Number(m.sender_member_project_id),
    }));
  }
}
