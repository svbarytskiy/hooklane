export type UserRole = 'user' | 'admin';

export type ProfileResponse = {
  id: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};
