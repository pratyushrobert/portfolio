export interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  loginTime: number | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
