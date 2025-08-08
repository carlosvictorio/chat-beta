export class ConversationsDTO {
  name: String;
  isGroup: boolean;
  photoUrl: null | string;
  lastMessage: null | string;
  lastMessageDate: null | Date;
  lastMessageIdUser: null | number;
}
