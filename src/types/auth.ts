export interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  loginTime: number | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export const DEFAULT_ADMIN_USER = 'admin';
// Default password is "pratyushos" - in a real app this would be hashed server-side
export const DEFAULT_PASSWORD_HASH = 'pratyushos'; // Simple demo hash