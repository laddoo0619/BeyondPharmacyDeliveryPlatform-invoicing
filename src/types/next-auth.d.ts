import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    storeId?: string | null;
    storeSlug?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      storeId?: string | null;
      storeSlug?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    id?: string;
    storeId?: string | null;
    storeSlug?: string | null;
  }
}
