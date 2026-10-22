import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Connecting to database...")
  
  // Create dummy data
  const newProduct = await prisma.testProduct.create({
    data: {
      name: "Test iPhone 15 Pro",
      price: 150000
    }
  })
  console.log("Successfully Created Product in Supabase:", newProduct)

  // Read data
  const allProducts = await prisma.testProduct.findMany()
  console.log("\nAll Products currently in Database:", allProducts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
