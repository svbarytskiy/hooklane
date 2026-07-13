export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export type AuthMeResponse = AuthenticatedUser;
