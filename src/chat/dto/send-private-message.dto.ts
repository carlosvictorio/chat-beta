export class SendPrivateMessageDto {
  sender_user_id: bigint;
  receiver_user_id: bigint;
  content: string;
}
