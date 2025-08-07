export class SendPrivateMessageDto {
  senderUserId: bigint;
  receiverUserId: bigint;
  content: string;
}
