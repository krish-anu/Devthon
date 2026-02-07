import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import { PasskeyLoginStartDto } from './dto/passkey-login-start.dto';
import { PasskeyLoginFinishDto } from './dto/passkey-login-finish.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth/passkey')
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  /* -------------------------------------------------------------- */
  /*  Registration (requires authentication)                         */
  /* -------------------------------------------------------------- */

  /** Generate WebAuthn registration options for the logged-in user */
  @UseGuards(JwtAuthGuard)
  @Post('register/options')
  registerOptions(@Req() req: any) {
    return this.passkeyService.generateRegistrationOptions(req.user.sub);
  }

  /** Verify the browser's registration response and store the credential */
  @UseGuards(JwtAuthGuard)
  @Post('register/verify')
  registerVerify(@Req() req: any, @Body() body: any) {
    return this.passkeyService.verifyRegistration(req.user.sub, body);
  }

  /* -------------------------------------------------------------- */
  /*  Login (no authentication required)                             */
  /* -------------------------------------------------------------- */

  /** Generate WebAuthn authentication options for a given email */
  @Post('login/options')
  loginOptions(@Body() dto: PasskeyLoginStartDto) {
    return this.passkeyService.generateAuthenticationOptions(dto.email);
  }

  /** Verify the browser's authentication response and issue JWT tokens */
  @Post('login/verify')
  loginVerify(@Body() dto: PasskeyLoginFinishDto) {
    return this.passkeyService.verifyAuthentication(dto.email, dto.credential);
  }

  /* -------------------------------------------------------------- */
  /*  Management (requires authentication)                           */
  /* -------------------------------------------------------------- */

  /** List all passkeys registered by the logged-in user */
  @UseGuards(JwtAuthGuard)
  @Get('list')
  listPasskeys(@Req() req: any) {
    return this.passkeyService.listPasskeys(req.user.sub);
  }

  /** Delete a specific passkey */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deletePasskey(@Req() req: any, @Param('id') id: string) {
    return this.passkeyService.deletePasskey(req.user.sub, id);
  }
}
