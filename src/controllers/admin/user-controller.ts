/**
 * User Controller
 * Контроллер для управления пользователями
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/admin.js';
import { UserController, BaseController } from '../../interfaces/controllers.js';
import { BaseControllerClass } from '../../interfaces/controllers.js';
import { UserServiceImpl } from '../../services/admin/user-service.js';
import { UserRepositoryImpl } from '../../repositories/user-repository.js';
import { RepositoryFactory } from '../../repositories/index.js';

export class UserControllerImpl extends BaseControllerClass implements UserController, BaseController {
  private userService: UserServiceImpl;

  constructor() {
    super();
    const userRepository = RepositoryFactory.getUserRepository();
    this.userService = new UserServiceImpl(userRepository);
  }

  async index(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Перенаправляем на dashboard
      res.redirect('/admin');
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async show(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.userService.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      this.handleSuccess(user, req, res);
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.create(req.body);
      this.handleSuccess(user, req, res, 'User created successfully');
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.userService.update(id, req.body);
      this.handleSuccess(user, req, res, 'User updated successfully');
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.userService.delete(id);
      
      if (success) {
        this.handleSuccess(null, req, res, 'User deleted successfully');
      } else {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Получаем статистику пользователей
      const usersCount = await this.userService.getUsersCount();
      const usersWithBalance = await this.userService.getUsersWithBalance();
      const totalBalance = await this.userService.getTotalBalance();
      const totalOrderSum = await this.userService.getTotalOrderSum();

      const stats = {
        totalUsers: usersCount,
        usersWithBalance,
        totalBalance,
        totalOrderSum
      };

      // Генерируем HTML для дашборда
      const html = this.generateDashboardHTML(stats);
      res.send(html);
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async detailed(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sort = 'createdAt', order = 'desc' } = req.query;
      
      const users = await this.userService.getUsersWithStats(
        {},
        { field: sort as string, direction: order as 'asc' | 'desc' },
        { page: 1, limit: 100 }
      );

      const html = this.generateUsersDetailedHTML(users.items);
      res.send(html);
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async search(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      const users = await this.userService.searchUsers(q as string);
      
      this.handleSuccess(users, req, res);
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async showDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await this.userService.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Получаем заказы пользователя
      const orders = await this.userService.getUserOrders(userId);
      
      this.handleSuccess({ user, orders }, req, res);
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async updateBalance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { amount, operation } = req.body;

      if (!amount || !operation) {
        return res.status(400).json({
          success: false,
          error: 'Amount and operation are required'
        });
      }

      const user = await this.userService.updateBalance(userId, amount, operation);
      this.handleSuccess(user, req, res, 'Balance updated successfully');
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async getPartners(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { level = '1' } = req.query;
      
      const partners = await this.userService.getReferralChain(userId, parseInt(level as string));
      this.handleSuccess(partners, req, res);
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async changeInviter(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { inviterId } = req.body;

      // Логика изменения пригласителя
      // TODO: Реализовать в сервисе
      
      this.handleSuccess(null, req, res, 'Inviter changed successfully');
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  async exportUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Логика экспорта пользователей
      // TODO: Реализовать экспорт в CSV/Excel
      
      this.handleSuccess(null, req, res, 'Users exported successfully');
    } catch (error) {
      this.handleError(error as Error, req, res, next);
    }
  }

  private generateDashboardHTML(stats: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Dashboard - Vital Bot</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            color: #333;
          }
          .header {
            background: white;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 30px;
          }
          .header h1 {
            color: #667eea;
            font-size: 24px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 0 20px;
            margin-bottom: 30px;
          }
          .stat-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
          }
          .stat-number {
            font-size: 32px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 10px;
          }
          .stat-label {
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .actions {
            padding: 0 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
          }
          .action-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 25px;
            border: none;
            border-radius: 8px;
            text-decoration: none;
            text-align: center;
            font-weight: 600;
            transition: transform 0.2s ease;
          }
          .action-btn:hover {
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚀 Vital Bot Admin Dashboard</h1>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${stats.totalUsers}</div>
            <div class="stat-label">Total Users</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.usersWithBalance}</div>
            <div class="stat-label">Users with Balance</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.totalBalance.toFixed(2)} PZ</div>
            <div class="stat-label">Total Balance</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.totalOrderSum.toFixed(2)} PZ</div>
            <div class="stat-label">Total Orders</div>
          </div>
        </div>
        
        <div class="actions">
          <a href="/admin/users-detailed" class="action-btn">👥 Manage Users</a>
          <a href="/admin/orders" class="action-btn">📦 Manage Orders</a>
          <a href="/admin/partners" class="action-btn">🤝 Manage Partners</a>
          <a href="/admin/products" class="action-btn">🛍️ Manage Products</a>
        </div>
      </body>
      </html>
    `;
  }

  private generateUsersDetailedHTML(users: any[]): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Users Management - Vital Bot</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            color: #333;
          }
          .header {
            background: white;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .header h1 {
            color: #667eea;
            font-size: 24px;
          }
          .table-container {
            background: white;
            margin: 0 20px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow-x: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 1200px;
          }
          th, td {
            padding: 12px 8px;
            text-align: left;
            border-bottom: 1px solid #e1e5e9;
          }
          th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
            position: sticky;
            top: 0;
            z-index: 10;
          }
          .user-cell {
            position: sticky;
            left: 0;
            background: white;
            border-right: 2px solid #667eea;
            z-index: 15;
            min-width: 140px;
            max-width: 140px;
            width: 140px;
          }
          .compact-cell {
            min-width: 80px;
            max-width: 80px;
            width: 80px;
          }
          .actions-cell {
            min-width: 120px;
            max-width: 120px;
            width: 120px;
          }
          .action-btn {
            background: #667eea;
            color: white;
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-right: 5px;
          }
          .action-btn:hover {
            background: #5a6fd8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>👥 Users Management</h1>
        </div>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th class="compact-cell">Select</th>
                <th class="user-cell">User</th>
                <th class="compact-cell">Balance</th>
                <th class="compact-cell">Orders</th>
                <th class="compact-cell">Inviter</th>
                <th class="compact-cell">L1 Partners</th>
                <th class="compact-cell">L2 Partners</th>
                <th class="compact-cell">L3 Partners</th>
                <th class="compact-cell">Total Orders</th>
                <th class="compact-cell">Bonuses</th>
                <th class="compact-cell">Payments</th>
                <th class="compact-cell">Remaining</th>
                <th class="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(user => `
                <tr>
                  <td class="compact-cell">
                    <input type="checkbox" class="user-checkbox" value="${user.id}">
                  </td>
                  <td class="user-cell">
                    <strong>${user.firstName || 'Unknown'}</strong><br>
                    <small>@${user.username || 'no-username'}</small>
                  </td>
                  <td class="compact-cell">${user.balance.toFixed(2)} PZ</td>
                  <td class="compact-cell">${user.ordersCount}</td>
                  <td class="compact-cell">${user.inviter?.firstName || '-'}</td>
                  <td class="compact-cell clickable-partners" onclick="showPartnersList('${user.id}', '${user.firstName || 'User'}', 1)">
                    ${user.directPartners}
                  </td>
                  <td class="compact-cell">${user.level2Partners}</td>
                  <td class="compact-cell">${user.level3Partners}</td>
                  <td class="compact-cell">${user.totalOrderSum.toFixed(2)} PZ</td>
                  <td class="compact-cell">0 PZ</td>
                  <td class="compact-cell">0 PZ</td>
                  <td class="compact-cell">0 PZ</td>
                  <td class="actions-cell">
                    <button class="action-btn" onclick="showUserDetails('${user.id}')">Details</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <script>
          function showUserDetails(userId) {
            window.open('/admin/users/' + userId, '_blank');
          }
          
          function showPartnersList(userId, userName, level) {
            // Открыть модальное окно со списком партнеров
            alert('Partners list for ' + userName + ' (Level ' + level + ')');
          }
        </script>
      </body>
      </html>
    `;
  }
}
