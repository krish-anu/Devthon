import { Body, Controller, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() payload: ChatRequestDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim();
    const clientIp = ip || req.ip || 'unknown';

    const lastMessage = payload.messages?.[payload.messages.length - 1];
    this.logger.debug(
      `Chat request from ${clientIp} (messages=${payload.messages?.length ?? 0}, lastRole=${lastMessage?.role ?? 'n/a'}, lastLength=${lastMessage?.content?.length ?? 0}, contextLength=${payload.pageContext?.textContent?.length ?? 0})`,
    );

    const authHeader =
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined;

    return this.chatService.handleChat(payload, clientIp, authHeader);
  }
}
