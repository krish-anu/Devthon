import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';
import { RecaptchaService } from '../common/recaptcha.service';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, PasskeyController],
  providers: [AuthService, JwtStrategy, PasskeyService, RecaptchaService],
  exports: [AuthService],
})
export class AuthModule {}
