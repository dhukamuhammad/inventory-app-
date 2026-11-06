import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prismaClientSingleton = () => {
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

function getPrismaClient(): PrismaClient {
  if (!globalThis.prismaGlobal || !(globalThis.prismaGlobal as any).dispatchedOrder) {
    if (globalThis.prismaGlobal) {
      try {
        (globalThis.prismaGlobal as any).$disconnect?.();
      } catch (e) {}
    }
    globalThis.prismaGlobal = prismaClientSingleton();
  }
  return globalThis.prismaGlobal;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = getPrismaClient();
}
