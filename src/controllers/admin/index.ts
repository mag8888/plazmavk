/**
 * Admin Controllers Index
 * Экспорт всех админских контроллеров
 */

export { AuthControllerImpl } from './auth-controller.js';
export { UserControllerImpl } from './user-controller.js';

// Фабрика контроллеров
export class AdminControllerFactory {
  private static authController: AuthControllerImpl;
  private static userController: UserControllerImpl;

  static getAuthController(): AuthControllerImpl {
    if (!AdminControllerFactory.authController) {
      AdminControllerFactory.authController = new AuthControllerImpl();
    }
    return AdminControllerFactory.authController;
  }

  static getUserController(): UserControllerImpl {
    if (!AdminControllerFactory.userController) {
      AdminControllerFactory.userController = new UserControllerImpl();
    }
    return AdminControllerFactory.userController;
  }
}
