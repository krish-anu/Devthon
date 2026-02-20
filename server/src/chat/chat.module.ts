import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ChatController } from './chat.controller';
import { ChatKnowledgeService } from './chat.knowledge.service';
import { ChatService } from './chat.service';
import { ChatToolsService } from './chat.tools.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule, RewardsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatKnowledgeService, ChatToolsService],
})
export class ChatModule {}
