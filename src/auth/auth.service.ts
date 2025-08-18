import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token); // verifica o JWT
      const user = await this.prisma.users.findUnique({
        where: { id: payload.id },
      });

      if (!user) throw new UnauthorizedException('User not found');

      return user;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
