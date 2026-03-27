/**
 * Auth Controller
 * Контроллер для аутентификации в админ-панели
 */

import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../interfaces/controllers.js';
import { BaseControllerClass } from '../../interfaces/controllers.js';

export class AuthControllerImpl extends BaseControllerClass implements AuthController {
  async loginPage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawError = req.query.error;
      const error = typeof rawError === 'string' ? rawError.replace(/[&<>"']/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)) : undefined;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vital Bot Admin Panel</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .login-container { 
              background: white; 
              padding: 40px; 
              border-radius: 12px; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              width: 100%;
              max-width: 400px;
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo h1 {
              color: #333;
              font-size: 28px;
              font-weight: 700;
            }
            .logo p {
              color: #666;
              margin-top: 5px;
            }
            .form-group { margin-bottom: 20px; }
            label { 
              display: block; 
              margin-bottom: 8px; 
              font-weight: 600; 
              color: #333; 
            }
            input { 
              width: 100%; 
              padding: 14px; 
              border: 2px solid #e1e5e9; 
              border-radius: 8px; 
              box-sizing: border-box;
              font-size: 16px;
              transition: border-color 0.3s ease;
            }
            input:focus {
              outline: none;
              border-color: #667eea;
            }
            button { 
              width: 100%; 
              padding: 14px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white; 
              border: none; 
              border-radius: 8px; 
              cursor: pointer; 
              font-size: 16px;
              font-weight: 600;
              transition: transform 0.2s ease;
            }
            button:hover { 
              transform: translateY(-2px);
            }
            .error { 
              color: #e74c3c; 
              margin-top: 15px; 
              text-align: center;
              padding: 10px;
              background: #fdf2f2;
              border-radius: 6px;
              border: 1px solid #fecaca;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="login-container">
            <div class="logo">
              <h1>🚀 Vital Bot</h1>
              <p>Admin Panel</p>
            </div>
            
            <form method="POST" action="/admin/login">
              <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
              </div>
              <button type="submit">Login</button>
              ${error ? `<div class="error">${error}</div>` : ''}
            </form>
            
            <div class="footer">
              <p>© 2024 Vital Bot. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      res.send(html);
    } catch (error) {
      this.handleError(error as Error, req as any, res, next);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { password } = req.body;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminPassword) {
        console.error('❌ ADMIN_PASSWORD environment variable is not set! Login disabled.');
        res.redirect('/admin/login?error=Server configuration error');
        return;
      }

      if (password && password === adminPassword) {
        (req.session as any).isAdmin = true;
        res.redirect('/admin');
      } else {
        res.redirect('/admin/login?error=Invalid password');
      }
    } catch (error) {
      this.handleError(error as Error, req as any, res, next);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
        res.redirect('/admin/login');
      });
    } catch (error) {
      this.handleError(error as Error, req as any, res, next);
    }
  }

  async checkAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = req.session as any;
      if (!session.isAdmin) {
        return res.redirect('/admin/login');
      }
      next();
    } catch (error) {
      this.handleError(error as Error, req as any, res, next);
    }
  }
}
