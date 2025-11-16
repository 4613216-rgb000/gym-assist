import { Request, Response, NextFunction } from 'express';
import { createClient, type User } from '@supabase/supabase-js';
import { config } from '../config';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

interface AuthedRequest extends Request { user: User }

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });

  (req as AuthedRequest).user = data.user as User;
  next();
}
