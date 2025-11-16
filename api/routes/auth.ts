/**
 * This is a user authentication API route demo.
 */
import { Router, type Request, type Response } from 'express'

const router = Router()

router.post('/register', async (_req: Request, res: Response): Promise<void> => {
  res.status(501).json({ error: 'not implemented' })
})

router.post('/login', async (_req: Request, res: Response): Promise<void> => {
  res.status(501).json({ error: 'not implemented' })
})

router.post('/logout', async (_req: Request, res: Response): Promise<void> => {
  res.status(501).json({ error: 'not implemented' })
})

export default router
