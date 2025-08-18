import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Token não informado');
    }

    const token = authHeader.replace('Bearer ', '');

    const isValid = this.authService.validateToken(token);
    if (!isValid) {
      throw new UnauthorizedException('Token inválido');
    }

    return true;
  }
}
