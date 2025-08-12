export class ConversationsDTO {
  name: string;
  isGroup: boolean;
  idUserOrProject: bigint;
  photoUrl: null | string;
  lastMessage: null | string;
  lastMessageDate: null | Date;
  lastMessageIdUser: null | bigint;
}
