import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, PasskeyController],
  providers: [AuthService, JwtStrategy, PasskeyService],
  exports: [AuthService],
})
export class AuthModule {}
