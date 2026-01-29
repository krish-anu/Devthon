import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const header = (req.headers['x-request-id'] as string) || '';
    const id = header || `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    req.headers['x-request-id'] = id as any;
    res.setHeader('x-request-id', id);
    next();
  }
}
