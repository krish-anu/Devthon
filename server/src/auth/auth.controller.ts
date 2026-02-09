import { Body, Controller, Post, Req, Res, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { OtpSendDto } from './dto/otp-send.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { GoogleLoginDto, GoogleCodeDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('google')
  async google(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleLogin(dto.token, dto.signup ?? false, dto.role);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('google/code')
  async googleCode(
    @Body() dto: GoogleCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleLoginWithCode(
      dto.code,
      dto.redirectUri,
      dto.signup ?? false,
      dto.role,
    );
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    return { user: result.user, accessToken: result.accessToken };
  }

  /** Server-side OAuth redirect: start authorization */
  @Get('google/start')
  startGoogleAuth(@Req() req: any, @Res() res: any) {
    const { signup, role, redirect } = req.query || {};

    // generate state: base64 JSON {nonce, signup, role, redirect}
    const nonce = Math.random().toString(36).slice(2);
    const stateObj = { nonce, signup: signup === 'true', role: role || null, redirect: redirect || null };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

    // set state cookie (httpOnly)
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60 * 1000, // 5 minutes
    });

    const client_id = process.env.GOOGLE_CLIENT_ID ?? '';
    const redirect_uri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    const scope = 'openid email profile';
    const params = new URLSearchParams({
      client_id: String(client_id),
      redirect_uri: String(redirect_uri),
      response_type: 'code',
      scope,
      state,
      prompt: 'select_account',
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.redirect(url);
  }

  /** Server-side OAuth callback */
  @Get('google/callback')
  async googleCallback(@Req() req: any, @Res() res: any) {
    const { code, state } = req.query || {};
    const cookie = req.cookies?.oauth_state;
    if (!code) return res.status(400).send('Missing code');
    if (!state || !cookie || state !== cookie) {
      return res.status(400).send('Invalid state');
    }

    // parse state
    let stateObj: any = {};
    try {
      stateObj = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch (e) {}

    const signup = stateObj.signup ?? false;
    const role = stateObj.role ?? undefined;
    const redirectTo = stateObj.redirect ?? '/auth/callback';

    // Exchange code and set cookies
    const result = await this.authService.googleLoginWithCode(code, undefined, signup, role);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('refreshToken', result.refreshToken, cookieOptions);

    // Redirect to frontend and include access token in fragment
    const redirectUrl = `${redirectTo}#access_token=${encodeURIComponent(result.accessToken)}`;
    return res.redirect(redirectUrl);
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto.refreshToken ?? req.cookies?.refreshToken;
    const result = await this.authService.refresh(refreshToken);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    return { user: result.user, accessToken: result.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.sub);
    res.clearCookie('refreshToken', { path: '/' });
    return { success: true };
  }

  @Post('otp/send')
  sendOtp(@Body() dto: OtpSendDto) {
    return { success: true, message: 'OTP sent', email: dto.email };
  }

  @Post('otp/verify')
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return { verified: true, code: dto.code };
  }
}
