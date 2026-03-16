import { prisma } from "./db";

export async function resolveStore(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store || !store.isActive) return null;
  return store;
}
