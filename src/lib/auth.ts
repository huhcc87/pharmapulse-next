import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * IMPORTANT:
 * Replace this with your actual auth.
 * Must return: { userId, email, role, tenantId }
 */
export async function getSessionUser(): Promise<{
  userId: string;
  email: string;
  role: "owner" | "staff" | "super_admin";
  tenantId: string;
} | null> {
  // Read cookies
  const c = await cookies();

  let tenantId = c.get("pp_tenant")?.value;
  const email = c.get("pp_email")?.value || "admin@pharmapulse.com";
  const role = (c.get("pp_role")?.value as any) || "owner";
  let userId = c.get("pp_user")?.value;

  // Development fallback: If no cookies set, try to get/create default tenant
  if (!tenantId && process.env.NODE_ENV === "development") {
    try {
      // Try to find first tenant or create default
      let tenant = await prisma.tenant.findFirst({
        orderBy: { createdAt: "asc" },
      });

      if (!tenant) {
        // Create default tenant for development
        tenant = await prisma.tenant.create({
          data: {
            name: "Default Pharmacy",
          },
        });
      }

      tenantId = tenant.id;
      userId = userId || `dev-user-${tenant.id}`;

      // Set cookies for future requests (development only)
      c.set("pp_tenant", tenantId, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
      c.set("pp_user", userId, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
      c.set("pp_email", email, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
      c.set("pp_role", role, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    } catch (error) {
      console.error("Failed to create default tenant:", error);
      // If database error, still return null
      return null;
    }
  }

  if (!tenantId) {
    return null;
  }

  // Super admin override by env email list
  const superAdmins =
    process.env.SUPER_ADMIN_EMAILS?.split(",").map((s) => s.trim().toLowerCase()) ?? [];
  const isSuper = superAdmins.includes(email.toLowerCase());

  return {
    userId: userId || "local-user",
    email,
    role: isSuper ? "super_admin" : role,
    tenantId,
  };
}

export function requireAuth<T>(user: T | null): asserts user is T {
  if (!user) {
    const err = new Error("UNAUTHORIZED");
    // @ts-ignore
    err.status = 401;
    throw err;
  }
}

// Minimal authOptions for NextAuth (for compatibility if NextAuth is used elsewhere)
// Note: We're using direct API routes for login/register, not NextAuth
export const authOptions = {
  providers: [],
  callbacks: {
    async session({ session, token }: any) {
      return session;
    },
    async jwt({ token }: any) {
      return token;
    },
  },
  pages: {},
};
