import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private user;

  async validateToken(token: string) {
    try {
      // aqui só decodifica sem validar expiração
      const payload = this.jwtService.verify(token, {
        secret: process.env.SECRET,
        ignoreExpiration: true,
      });

      const user = await this.prisma.users.findUnique({
        where: { email_user: payload.sub },
      });

      if (!user) throw new UnauthorizedException('User not found');

      return { user, expired: false }; // retorna também o payload
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        // token expirado → retorna info para refresh
        return { expired: true, payload: this.jwtService.decode(token) };
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}
