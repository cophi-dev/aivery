import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to clear the Exercise collection...');
  
  const { count } = await prisma.exercise.deleteMany({});
  
  console.log(`Successfully deleted ${count} exercises.`);
}

main()
  .catch((e) => {
    console.error('Error clearing exercises:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 