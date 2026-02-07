import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions as any);

export const GET = handler as any;
export const POST = handler as any;